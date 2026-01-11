import { GENERIC_USER } from "./constants.js";
import { initAndShowLogin } from "./login-logic.js";
import { supabase } from "./supabase.js";
import { showError } from "./misc.js";
import { renderChatSelector, renderMessages } from "./render.js";
import { channelCache, chatSockets, setCurrentUser, updateCacheMessages } from "./session.js";

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

async function sendMessage(content, chat_id) {
    const { data, error } = await supabase.from("messages").insert({ content, chat_id });

    if (error) {
        showError("sendMessage() / 'insert into messages'", error);
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
        channelCache().set(chat.id, {
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

        chatSockets().set(chat.id, socket);
    }
}

async function fetchMessages(chatId) {
    const cachedChannel = channelCache().get(chatId);
    if (!chatId) {
        showError("fetchMessages(chatId) / channelCache().get(chatId)", "Channel not cached???");
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
    const cacheChannel = channelCache().get(message.chat_id);
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

async function selectChat(chatId) {
    const cachedChannel = channelCache().get(chatId);
    setMenuState(!!cachedChannel);

    document.querySelectorAll(".selected-chat").forEach((s) => s.classList.remove("selected-chat"));

    const chatInfo = document.querySelector("#chat-info");
    if (!cachedChannel) {
        chatInfo.innerHTML = "";
    } else {
        chatInfo.innerHTML = "#" + cachedChannel.details.name;
        document.querySelector(`div[data-chatid="${chatId}"]`).classList.add("selected-chat");
    }

    // fetch messages if necessary?
    // TODO: logic for this
    if (cachedChannel.messages.length === 0) {
        await fetchMessages(chatId);
    }

    renderMessages(chatId);
}

/** @param {UserProfile} profile */
async function populateUi(profile) {
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

    if (stateError) {
        showError("populateUi() / 'select * from user_state'", stateError);
    }

    // chats (channels)
    const sidePanel = document.querySelector("#side-panel");

    await fetchChats();
    for (const chat of channelCache().values()) {
        const selector = renderChatSelector(chat.details);
        sidePanel.appendChild(selector);
        selector.addEventListener("click", () => selectChat(chat.id));
    }

    /** @type {HTMLDivElement} */
    const chatField = document.querySelector("#chat-field");
    chatField.addEventListener("keypress", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            const message = ev.target.innerText.trim();
            if (!message) return;

            ev.preventDefault();
            ev.target.innerHTML = "";

            const { chatid } = document.querySelector(".selected-chat").dataset;

            sendMessage(message, chatid);
        }
    });

    // Update selected chat
    if (!userState.selected_chat) {
        const selected = channelCache().values()[0].id;
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

    setCurrentUser(user);

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

    await populateUi(profile);
}

const { isLoggedIn, session } = await initAndShowLogin(chatSession);
