import { GENERIC_USER } from "../constants.js";
import { showError } from "../misc.js";
import { hideDrawer, resetMenuContainer, selectNavItem } from "../nav.js";
import { navigate } from "../router.js";
import { channelCache, session } from "../session.js";
import { supabase } from "../supabase.js";

export async function fetchDMs() {
    const { data, error } = await supabase
        .from("chats")
        .select(
            `*,
            chat_members(profiles(*)),
            messages(*, author:profiles(*))`
        )
        .in("type", ["direct", "group"])
        .order("created_at", { referencedTable: "messages", ascending: false })
        .limit(1, { referencedTable: "messages" })
        .order("updated_at", { ascending: false });

    if (error) {
        showError("fetchDMs() / select ... from chats", error);
        return;
    }

    // TODO: uhmmm just make this better. it ugly :c
    for (const chat of data) {
        channelCache.addChannel({
            id: chat.id,
            name: chat.name,
            private: chat.private,
            type: chat.type,
            updated_at: chat.updated_at,
            chat_members: chat.chat_members,
        });

        channelCache.addMessages(chat.id, ...chat.messages);
    }
}

/** Renders DM cards from cache @returns {HTMLDivElement} */
export function renderDMCards() {
    /** @type {HTMLTemplateElement} */
    const template = document.querySelector("#message-card");
    const messagesMenu = document.querySelector(".messages-menu");

    messagesMenu.querySelectorAll(".message-card").forEach(m => m.remove());

    const cacheEntries = channelCache.getAll().sort((a, b) => b.updatedAt - a.updatedAt);
    for (const { details, messages } of cacheEntries) {
        if (details.type !== "direct" && details.type !== "group") continue;

        const clone = document.importNode(template.content, true);

        /** @type {HTMLImageElement} */
        const contactImage = clone.querySelector(".img-container img");
        const contactName = clone.querySelector(".contact-name");
        const messagePeek = clone.querySelector(".message-peek");
        const cardDiv = clone.querySelector(".message-card");

        // TODO
        if (details.type === "direct") {
            const otherUser = details.chat_members.find((x) => x.profiles.id !== session.get().user.id);
            contactImage.src = otherUser.profiles.profile_image ?? GENERIC_USER;
            contactName.appendChild(document.createTextNode(otherUser.profiles.username));
        } else if (details.type === "group") {
            // TODO - group and icon
            contactImage.src = GENERIC_USER;
            contactName.appendChild(document.createTextNode(details.name));
        }

        if (messages.length === 0) {
            messagePeek.innerHTML = "No messages yet";
            messagePeek.classList.add("no-messages");
        } else {
            const lastMsg = messages.at(-1);
            if (lastMsg.author.id === session.get().user.id) {
                messagePeek.appendChild(document.createTextNode("You: " + lastMsg.content));
            } else {
                messagePeek.appendChild(document.createTextNode(lastMsg.content));
            }
        }

        cardDiv.dataset.id = details.id;

        messagesMenu.appendChild(clone);
    }

    addDMEvents();

    return messagesMenu;
}

function addDMEvents() {
    /** @type {HTMLDivElement} */
    const mainPanel = document.querySelector(".main");
    const messageContainer = mainPanel.querySelector(".message-container");

    /** @param {PointerEvent} ev */
    const onMessageCardClick = (ev) => {
        mainPanel.querySelectorAll(".container").forEach((x) => x.classList.add("hidden"));
        messageContainer.classList.remove("hidden");

        const chatId = ev.currentTarget.dataset.id;
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
