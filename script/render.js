import { channelCache, getCurrentUser } from "./session.js";

const chatPanel = document.querySelector("#chat-panel");

/** @type {HTMLTemplateElement} */
const messageTemplate = document.querySelector("#message");

export function renderMessageDivider(content) {
    const div = document.createElement("div");
    div.classList.add("message-divider");
    div.innerHTML = content;
    chatPanel.prepend(div);
}

export function renderMessage(message) {
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

    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === message.author.id) msg.classList.add("own-message");

    msg.dataset.messageid = message.id;

    chatPanel.prepend(clone);
}

export function renderChatSelector(chat) {
    const div = document.createElement("div");
    div.innerHTML = "#" + chat.name;
    div.dataset.chatid = chat.id;

    if (!chat.private) {
        const publicIcon = document.createElement("p");
        publicIcon.innerHTML = " 🌏︎";
        publicIcon.id = "public-icon";
        div.appendChild(publicIcon);
    }

    return div;
}

export function renderMessages(chatId) {
    chatPanel.innerHTML = "";

    const cachedChannel = channelCache().get(chatId);
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
