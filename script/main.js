import { GENERIC_USER } from "./constants.js";
import { initAndShowLogin } from "./login-logic.js";
import { supabase } from "./supabase.js";

const chatMap = new Map();
function updateSelectedChat(chatId) {
    const content = document.querySelector("#content");

    const chat = chatMap.get(chatId);

    const chatInfo = document.querySelector("#chat-info");
    if (chat) {
        chatInfo.innerHTML = "#" + chat.name;
        delete content.dataset.showmenu;
    } else {
        chatInfo.innerHTML = "";
        content.dataset.showmenu = "true";
    }
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

    const {
        data: [profile],
        error: profileError,
    } = await supabase.from("profiles").select().eq("id", user.id);
    if (profileError) {
        console.error("Error in chatSession() / select from profiles", profileError);
        return;
    }

    await populateUi(user, profile);

    // :D
    // const { data, error } = await supabase.from("chats").select();
    // console.log(data)
}

const { isLoggedIn, session } = await initAndShowLogin(chatSession);
