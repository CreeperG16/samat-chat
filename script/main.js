import { GENERIC_USER } from "./constants.js";
import { initAndShowLogin } from "./login-logic.js";
import { supabase } from "./supabase.js";

const chatMap = new Map();
// TODO: BETTER MESSAGE CACHE SYSTEM??????
const messageCache = new Map();

let currentUser = null;

const chatPanel = document.querySelector("#chat-panel");
/** @type {HTMLTemplateElement} */
const messageTemplate = document.querySelector("#message");


function insertMessageDivider(content) {
    const div = document.createElement("div");
    div.classList.add("message-divider");
    div.innerHTML = content;
    chatPanel.prepend(div);
}

function insertMessageIntoUi(message) {
    const clone = document.importNode(messageTemplate.content, true);

    const author = clone.querySelector(".message-author");
    const pfp = clone.querySelector(".message-pfp img");
    const timestamp = clone.querySelector(".message-timestamp");
    const content = clone.querySelector(".message-content");

    author.innerHTML = message.author.username;
    if (message.author.profile_image) pfp.src = message.author.profile_image;
    content.innerHTML = message.content;
    timestamp.innerHTML = new Date(message.created_at).toLocaleTimeString();

    const msg = clone.querySelector(".message")

    if (currentUser && currentUser.id === message.author.id)
        msg.classList.add("own-message");

    msg.dataset.messageid = message.id;

    chatPanel.prepend(clone);
}


async function handleMessage(event, action) {
    const message = event.payload.message;
    if (action === "create") {
        insertMessageIntoUi(message);
        messageCache.set(message.id, message);
    }

    if (action === "delete") {
        messageCache.delete(message.id);
        const element = document.querySelector(`.message[data-messageid="${message.id}"]`);
        element.remove();
    }
}

/** @type {import("@supabase/supabase-js").RealtimeChannel | null} */
let broadcastChannel = null;
async function updateSelectedChat(chatId) {
    const content = document.querySelector("#content");

    const chat = chatMap.get(chatId);

    if (broadcastChannel) {
        await broadcastChannel.unsubscribe();
        broadcastChannel = null;
    }

    const chatInfo = document.querySelector("#chat-info");
    if (chat) {
        chatInfo.innerHTML = "#" + chat.name;
        delete content.dataset.showmenu;

        broadcastChannel = supabase.channel(`chat:${chatId}`, { config: { private: false } });
        broadcastChannel
            .on("broadcast", { event: "message-create" }, (payload) => handleMessage(payload, "create"))
            .on("broadcast", { event: "message-delete" }, (payload) => handleMessage(payload, "delete"))
            .subscribe();
        // console.log("aaaa", broadcastChannel);
    } else {
        chatInfo.innerHTML = "";
        content.dataset.showmenu = "true";
    }

    chatPanel.innerHTML = "";
    chatPanel.dataset.chat_id = chatId;
    if (!chat) return;

    // TODO: proper caching?
    const messages = messageCache.get(chatId) ?? [];
    if (messages.length === 0) {
        const { data, error } = await supabase
            .from("messages")
            .select("*, author:profiles(*)")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true })
            .limit(25);
        if (error) {
            console.error("Error in updateSelectedChat() / select from messages", error);
            return;
        }

        messages.push(...data);
        messageCache.set(chatId, messages);
    }

    /** @type {Date} */
    let prevTime = null;
    for (const message of messages) {
        const msgTime = new Date(message.created_at);
        if (!prevTime || prevTime.getDate() !== msgTime.getDate())
            insertMessageDivider(msgTime.toDateString());
        prevTime = msgTime;
        insertMessageIntoUi(message);

    }

    // update selected chat
    const { error: stateUpdateErr } = await supabase
        .from("user_state")
        .update({ selected_chat: chatId, last_updated: new Date().toISOString() })
        .neq("user_id", "00000000-0000-0000-0000-000000000000");

    if (stateUpdateErr) {
        console.error("Error in updateSelectedChat() / update selected_chat", error);
    }
}

async function sendMessage(content, chat_id) {
    const { data, error } = await supabase.from("messages").insert({ content, chat_id });

    if (error) {
        console.error("Error in sendMessage() / insert into messages", error);
        return { success: false, data: error };
    }

    return { success: true, data };
}

/** @param {import("@supabase/supabase-js").User} user */
async function populateUi(user, profile) {
    // mobile menu button functionality
    const menuBtn = document.querySelector("#menu-btn");
    menuBtn.addEventListener("click", () => updateSelectedChat(null));

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

    const { data: chats, error: fetchChatsError } = await supabase.from("chats").select();
    if (fetchChatsError) {
        console.error("Error in populateUi() / select from chats", fetchChatsError);
    } else {
        for (const chat of chats) {
            chatMap.set(chat.id, chat);

            const div = document.createElement("div");
            div.innerHTML = "#" + chat.name;
            div.dataset.id = chat.id;
            sidePanel.appendChild(div);

            div.addEventListener("click", () => updateSelectedChat(chat.id));

            if (chat.private) continue;
            const publicIcon = document.createElement("p");
            publicIcon.innerHTML = " 🌏︎";
            publicIcon.id = "public-icon";
            div.appendChild(publicIcon);
        }
    }

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
        const selected = chats[0].id;
        updateSelectedChat(selected);
    } else {
        updateSelectedChat(userState.selected_chat);
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
