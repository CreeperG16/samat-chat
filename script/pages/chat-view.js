import { GENERIC_USER } from "../constants.js";
import { showError } from "../misc.js";
import { addMsgsToCache, channelCache, session } from "../session.js";
import { supabase } from "../supabase.js";

// TODO: THIS IS VERY FLAKY
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

function renderMessages(messages) {
    messagePanel.innerHTML = "";

    let previousMessageTime = null;
    for (const msg of messages) {
        const currentMessageTime = new Date(msg.created_at);
        if (!previousMessageTime || previousMessageTime.getDate() !== currentMessageTime.getDate())
            renderMessageDivider(currentMessageTime.toDateString());

        previousMessageTime = currentMessageTime;
        renderMessage(msg);
    }
}

async function fetchMessages(chatId) {
    const channelCacheEntry = channelCache.get(chatId);
    if (!chatId) {
        showError("chat-view.js / fetchMessages(chatId) / channelCache().get(chatId)", "Channel not cached???");
        return;
    }

    const { data: messages, error } = await supabase
        .from("messages")
        .select("*, author:profiles(*)")
        .eq("chat_id", chatId)
        .gt("created_at", (channelCacheEntry.latestMessageAt ?? new Date(0)).toISOString())
        .order("created_at", { ascending: false })
        .limit(25); // latest 25 messages (will be reordered client side too)

    if (error) {
        showError("chat-view.js / fetchMessages(chatId) / select * from messages ...", error);
        return;
    }

    channelCacheEntry.lastFetchedAt = new Date();
    if (messages.length === 0) return;

    addMsgsToCache(chatId, ...messages);
}

export function renderChatView({ chat_id }) {
    // TODO
    const mainPanel = document.querySelector(".main");
    const messageContainer = mainPanel.querySelector(".container.message-container");

    messageContainer.classList.remove("hidden");
    mainPanel.classList.add("drawer-open");

    // console.log("CHAT VIEW!!! chat id is", chat_id);
    const cacheEntry = channelCache.get(chat_id);
    // console.log(cacheEntry);
    if (!cacheEntry || cacheEntry.messages.length < 25) {
        // Fetch messages and then render
        fetchMessages(chat_id).then(() => {
            const newEntry = channelCache.get(chat_id);
            // console.log(channelCache, newEntry);
            renderMessages(newEntry.messages);
        });
    } else {
        renderMessages(cacheEntry.messages);
    }
}
