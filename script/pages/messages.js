import { GENERIC_USER } from "../constants.js";
import { showError } from "../misc.js";
import { hideDrawer, resetMenuContainer, selectNavItem } from "../nav.js";
import { navigate } from "../router.js";
import { session } from "../session.js";
import { supabase } from "../supabase.js";

export async function fetchDMs() {
    const { data, error } = await supabase
        .from("chats")
        .select(
            `*,
            chat_members(profiles(*)),
            messages(*)`
        )
        .in("type", ["direct", "group"])
        .order("created_at", { referencedTable: "messages", ascending: false })
        .limit(1, { referencedTable: "messages" })
        .order("updated_at", { ascending: false });

    if (error) {
        showError("fetchDMs() / select ... from chats", error);
        return;
    }

    return data;
}

/** @param {Chat[]} conversations @returns {HTMLDivElement} */
export function renderDMCards(conversations) {
    /** @type {HTMLTemplateElement} */
    const template = document.querySelector("#message-card");
    const messagesMenu = document.querySelector(".messages-menu");

    try {
        for (const conversation of conversations) {
            const clone = document.importNode(template.content, true);

            /** @type {HTMLImageElement} */
            const contactImage = clone.querySelector(".img-container img");
            const contactName = clone.querySelector(".contact-name");
            const messagePeek = clone.querySelector(".message-peek");
            const cardDiv = clone.querySelector(".message-card");

            // TODO
            if (conversation.type === "direct") {
                const otherUser = conversation.chat_members.find((x) => x.profiles.id !== session.get().user.id);
                contactImage.src = otherUser.profiles.profile_image ?? GENERIC_USER;
                contactName.appendChild(document.createTextNode(otherUser.profiles.username));
            } else if (conversation.type === "group") {
                // TODO - group and icon
                contactImage.src = GENERIC_USER;
                contactName.appendChild(document.createTextNode(conversation.name));
            }

            if (conversation.messages.length > 0) {
                messagePeek.appendChild(document.createTextNode(conversation.messages[0].content));
            } else {
                messagePeek.innerHTML = "No messages yet";
                messagePeek.classList.add("no-messages");
            }

            cardDiv.dataset.id = conversation.id;

            messagesMenu.appendChild(clone);
        }
    } catch (e) {
        showError("renderDMCards()", e);
    }

    return messagesMenu;
}

/** @param {HTMLDivElement} messagesMenu */
export function addDMEvents(messagesMenu) {
    /** @type {HTMLDivElement} */
    const mainPanel = document.querySelector(".main");
    const messageContainer = mainPanel.querySelector(".message-container");

    mainPanel.querySelectorAll(".container").forEach(x => x.classList.add("hidden"));
    messageContainer.classList.remove("hidden");

    /** @param {PointerEvent} ev */
    const onMessageCardClick = (ev) => {
        const chatId = ev.currentTarget.dataset.id;
        // messageContainer.innerHTML = chatId

        // TODO:
        // On page init all realtime sockets should already be subscribed to?
        // 2. Get cached messages
        // On cache miss: 3. fetch messages from db

        // mainPanel.classList.add("drawer-open");
        navigate(`/chat/${chatId}`);
    };

    document
        .querySelectorAll(".messages-menu .message-card")
        .forEach((c) => c.addEventListener("click", onMessageCardClick));
}

export function renderMessagesMenu() {
    resetMenuContainer();
    hideDrawer();
    selectNavItem("messages");

    const menu = document.querySelector(".menu.messages-menu");
    menu.classList.remove("hidden");
}
