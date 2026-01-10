import { GENERIC_USER } from "./constants.js";
import { initAndShowLogin } from "./login-logic.js";
import { supabase } from "./supabase.js";
import { showError } from "./misc.js";

/** @typedef {{ id: string; username: string; profile_image: string | null; created_at: string }} UserProfile */
/** @typedef {{ id: string; chat_id: string; author: UserProfile; content: string; created_at: string; }} Message */
/** @typedef {{ id: string; name: string; private: boolean; members: string[]; viewers: string[]; created_at: string }} Chat */
/** @typedef {{ id: string; details: Chat; messages: Message[]; latestMessageAt: Date | null; oldestMessageAt: Date | null; lastFetchedAt: Date }} CacheChannel */

/** @type {Map<string, CacheChannel>} */
const channelCache = new Map();

/** @param {CacheChannel} cacheChannel */
function updateCacheMessages(cacheChannel) {
    cacheChannel.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (cacheChannel.messages.length === 0) return;

    cacheChannel.latestMessageAt = new Date(cacheChannel.messages.at(-1).created_at);
    cacheChannel.oldestMessageAt = new Date(cacheChannel.messages.at(0).created_at);
}

/** @type {Map<string, import("@supabase/supabase-js").RealtimeChannel>} */
const chatSockets = new Map();

/** @param {boolean} open */
function setMenuState(open) {
    /** @type {HTMLDivElement} */
    const contentElement = document.querySelector("#content");
    if (open) {
        contentElement.dataset.showmenu = "true";
    } else {
        delete contentElement.dataset.showmenu;
    }
}

let currentUser = null;

const chatPanel = document.querySelector("#chat-panel");
/** @type {HTMLTemplateElement} */
const messageTemplate = document.querySelector("#message");

function renderMessageDivider(content) {
    const div = document.createElement("div");
    div.classList.add("message-divider");
    div.innerHTML = content;
    chatPanel.prepend(div);
}

function renderMessage(message) {
    const clone = document.importNode(messageTemplate.content, true);

    const author = clone.querySelector(".message-author");
    const pfp = clone.querySelector(".message-pfp img");
    const timestamp = clone.querySelector(".message-timestamp");
    const content = clone.querySelector(".message-content");

    author.innerHTML = message.author.username;
    if (message.author.profile_image) pfp.src = message.author.profile_image;
    content.innerHTML = message.content;
    timestamp.innerHTML = new Date(message.created_at).toLocaleTimeString();

    const msg = clone.querySelector(".message");

    if (currentUser && currentUser.id === message.author.id) msg.classList.add("own-message");

    msg.dataset.messageid = message.id;

    chatPanel.prepend(clone);
}

async function sendMessage(content, chat_id) {
    const { data, error } = await supabase.from("messages").insert({ content, chat_id });

    if (error) {
        console.error("Error in sendMessage() / 'insert into messages'", error);
        return { success: false, data: error };
    }

    return { success: true, data };
}

async function fetchChats() {
    const { data: chats, error } = await supabase.from("chats").select();

    if (error) {
        showError("fetchChats() / 'select * from chats'", error);
        return;
    }

    for (const chat of chats) {
        channelCache.set(chat.id, {
            id: chat.id,
            details: chat,
            lastFetchedAt: new Date(),
            messages: [],
            latestMessageAt: null,
            oldestMessageAt: null,
        });

        const socket = supabase
            .channel(`chat:${chat.id}`)
            .on("broadcast", { event: "message-create" }, (m) => handleMessage(m, "create"))
            .on("broadcast", { event: "message-delete" }, (m) => handleMessage(m, "delete"))
            .subscribe();

        chatSockets.set(chat.id, socket);
    }
}

async function fetchMessages(chatId) {
    const cachedChannel = channelCache.get(chatId);
    if (!chatId) {
        showError("fetchMessages(chatId) / channelCache.get(chatId)", "Channel not cached???");
        return;
    }

    const { data: messages, error } = await supabase
        .from("messages")
        .select("*, author:profiles(*)")
        .eq("chat_id", chatId)
        .gt("created_at", cachedChannel.latestMessageAt ?? new Date(0).toISOString())
        .limit(25);

    if (error) {
        showError("fetchMessages(chatId) / 'select * from messages where ...'", error);
        return;
    }

    cachedChannel.lastFetchedAt = new Date();
    if (messages.length === 0) return;

    cachedChannel.messages.push(...messages);
    updateCacheMessages(cachedChannel);
}

function handleMessage(event, action) {
    const message = event.payload.message;
    const cacheChannel = channelCache.get(message.chat_id);
    if (!cacheChannel) return;

    if (action === "create") {
        cacheChannel.messages.push(message);
        updateCacheMessages(cacheChannel);
        renderMessages(cacheChannel.id);
    }

    if (action === "delete") {
        const idx = cacheChannel.messages.findIndex((m) => m.id === message.id);
        if (idx === -1) return;

        cacheChannel.messages.splice(idx, 1);
        updateCacheMessages(cacheChannel);
        renderMessages(cacheChannel.id);
    }
}

function renderChatSelector(chat) {
    const div = document.createElement("div");
    div.innerHTML = "#" + chat.name;
    div.dataset.id = chat.id;

    div.addEventListener("click", () => selectChat(chat.id));

    if (!chat.private) {
        const publicIcon = document.createElement("p");
        publicIcon.innerHTML = " 🌏︎";
        publicIcon.id = "public-icon";
        div.appendChild(publicIcon);
    }

    return div;
}

function renderMessages(chatId) {
    chatPanel.innerHTML = "";

    const cachedChannel = channelCache.get(chatId);
    if (!cachedChannel) return;

    /** @type {Date | null} */
    let previousMessageTime = null;

    for (const message of cachedChannel.messages) {
        const currentMessageTime = new Date(message.created_at);
        if (!previousMessageTime || previousMessageTime.getDate() !== currentMessageTime.getDate())
            renderMessageDivider(currentMessageTime.toDateString());

        previousMessageTime = currentMessageTime;
        renderMessage(message);
    }
}

async function selectChat(chatId) {
    const cachedChannel = channelCache.get(chatId);
    setMenuState(!!cachedChannel);

    const chatInfo = document.querySelector("#chat-info");
    if (!cachedChannel) {
        chatInfo.innerHTML = "";
    } else {
        chatInfo.innerHTML = "#" + cachedChannel.details.name;
    }

    // fetch messages if necessary?
    // TODO: logic for this
    if (cachedChannel.messages.length === 0) {
        await fetchMessages(chatId);
    }

    renderMessages(chatId);
}

/** @param {import("@supabase/supabase-js").User} user */
async function populateUi(user, profile) {
    // mobile menu button functionality
    const menuBtn = document.querySelector("#menu-btn");
    menuBtn.addEventListener("click", () => selectChat(null));

    // user info
    const userInfoElm = document.querySelector("#user-info");
    const unameElm = document.createElement("h1");
    const pfpImgElm = document.createElement("img");

    pfpImgElm.src = profile.profile_image ?? GENERIC_USER;
    pfpImgElm.alt = `User avatar for ${profile.username}`;
    unameElm.innerHTML = "@" + profile.username;

    userInfoElm.appendChild(pfpImgElm);
    userInfoElm.appendChild(unameElm);

    // User state
    const { data: userState, error: stateError } = await supabase.from("user_state").select().limit(1).single();

    // chats (channels)
    const sidePanel = document.querySelector("#side-panel");

    await fetchChats();
    for (const chat of channelCache.values()) {
        const selector = renderChatSelector(chat.details);
        sidePanel.appendChild(selector);
    }

    // const { data: chats, error: fetchChatsError } = await supabase.from("chats").select();
    // if (fetchChatsError) {
    //     console.error("Error in populateUi() / select from chats", fetchChatsError);
    // } else {
    //     for (const chat of chats) {
    //         chatMap.set(chat.id, chat);

    //         const div = document.createElement("div");
    //         div.innerHTML = "#" + chat.name;
    //         div.dataset.id = chat.id;
    //         sidePanel.appendChild(div);

    //         div.addEventListener("click", () => updateSelectedChat(chat.id));

    //         if (chat.private) continue;
    //         const publicIcon = document.createElement("p");
    //         publicIcon.innerHTML = " 🌏︎";
    //         publicIcon.id = "public-icon";
    //         div.appendChild(publicIcon);
    //     }
    // }

    /** @type {HTMLDivElement} */
    const chatField = document.querySelector("#chat-field");
    chatField.addEventListener("keypress", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            const message = ev.target.innerText.trim();
            if (!message) return;

            ev.preventDefault();
            ev.target.innerHTML = "";

            const { chat_id } = document.querySelector("#chat-panel").dataset;

            sendMessage(message, chat_id);
        }
    });

    // Update selected chat
    if (!userState.selected_chat) {
        const selected = channelCache.values()[0].id;
        selectChat(selected);
    } else {
        selectChat(userState.selected_chat);
    }
}

/** @param {import("@supabase/supabase-js").Session} session */
async function chatSession(session) {
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
        console.error("Error in chatSession() / getUser()", userError);
        return;
    }

    currentUser = user;

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select()
        .eq("id", user.id)
        .limit(1)
        .single();

    await supabase.realtime.setAuth();

    if (profileError) {
        console.error("Error in chatSession() / select from profiles", profileError);
        return;
    }

    await populateUi(user, profile);
}

const { isLoggedIn, session } = await initAndShowLogin(chatSession);
