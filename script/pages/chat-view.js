import { GENERIC_USER } from "../constants.js";
import { currentChat, showError } from "../misc.js";
import { channelCache, session } from "../session.js";
import { supabase } from "../supabase.js";

// TODO: THIS IS VERY JANK - SOLIDIFY ASAP!
// HASTILY PUT TOGETHER
// JUST TO FINALLY SEE MESSAGES IN THE MESSAGE APP
// along with /script/session.js channelCache code

/** @type {HTMLTemplateElement} */
const messageTemplate = document.querySelector("#message-template");
const messagePanel = document.querySelector(".main .message-container .messages");

function renderMessageDivider(content) {
    const div = document.createElement("div");
    div.classList.add("message-divider");
    div.innerHTML = content;
    messagePanel.prepend(div);
}

function renderMessage(msg) {
    const clone = document.importNode(messageTemplate.content, true);

    /** @type {HTMLImageElement} */
    const pfpImg = clone.querySelector(".message-pfp > img");
    const author = clone.querySelector(".message-author");
    const timestamp = clone.querySelector(".message-timestamp");
    const content = clone.querySelector(".message-content");

    const message = clone.querySelector(".message");

    pfpImg.src = msg.author.profile_image ?? GENERIC_USER;
    author.appendChild(document.createTextNode(msg.author.display_name));
    timestamp.appendChild(document.createTextNode(new Date(msg.created_at).toLocaleTimeString()));
    content.appendChild(document.createTextNode(msg.content));

    if (session.get().user.id === msg.author.id) message.classList.add("own-message");

    message.dataset.messageid = msg.id;

    messagePanel.prepend(clone);
}

/** @param {Date} d1 @param {Date} d2 */
const isSameDate = (d1, d2) =>
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

export function renderMessages(messages) {
    messagePanel.innerHTML = "";

    let previousMessageTime = null;
    for (const msg of messages) {
        const currentMessageTime = new Date(msg.created_at);
        if (!previousMessageTime || !isSameDate(previousMessageTime, currentMessageTime))
            renderMessageDivider(currentMessageTime.toDateString());

        previousMessageTime = currentMessageTime;
        renderMessage(msg);
    }
}

async function fetchMessages(chatId) {
    const channelCacheEntry = channelCache.get(chatId);
    if (!channelCacheEntry) {
        showError("chat-view.js / fetchMessages(chatId) / channelCache().get(chatId)", "Channel not cached???");
        return;
    }

    const { data: messages, error } = await supabase
        .from("messages")
        .select("*, author:profiles(*)")
        .eq("chat_id", chatId)
        // .gt("created_at", (channelCacheEntry.latestMessageAt ?? new Date(0)).toISOString())
        .order("created_at", { ascending: false })
        .limit(25); // latest 25 messages (will be reordered client side too)

    if (error) {
        showError("chat-view.js / fetchMessages(chatId) / select * from messages ...", error);
        return;
    }

    channelCacheEntry.lastFetchedAt = new Date();
    if (messages.length === 0) return;

    channelCache.addMessages(chatId, ...messages);
}

async function sendMessage(chat_id, content) {
    const { data, error } = await supabase.from("messages").insert({ content, chat_id });

    if (error) {
        showError("chat-view.js / sendMessage() / insert into messages", error);
        return { success: false, data: error };
    }

    return { success: true, data };
}

export function addChatViewEvents() {
    /** @type {HTMLDivElement} */
    const chatfield = document.querySelector(".chat-field");
    chatfield.addEventListener("keypress", (ev) => {
        const currentChatId = currentChat();
        if (!currentChatId) return;

        if (ev.key === "Enter" && !ev.shiftKey) {
            const message = ev.target.innerText.trim();
            if (!message) return;

            ev.preventDefault();
            ev.target.innerHTML = "";

            sendMessage(currentChatId, message);
        }
    });
}

export function renderChatView({ chat_id }) {
    const mainPanel = document.querySelector(".main");
    const messageContainer = mainPanel.querySelector(".container.message-container");

    messageContainer.classList.remove("hidden");
    mainPanel.classList.add("drawer-open");

    const cacheEntry = channelCache.get(chat_id);
    if (!cacheEntry || cacheEntry.lastFetchedAt === null) {
        // Fetch messages and then render
        fetchMessages(chat_id).then(() => {
            const newEntry = channelCache.get(chat_id);
            renderMessages(newEntry.messages);
        });
    } else {
        renderMessages(cacheEntry.messages);
    }
}
