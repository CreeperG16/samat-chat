import { GENERIC_USER } from "../constants.js";
import { showError } from "../misc.js";
import { session } from "../session.js";
import { supabase } from "../supabase.js";

export async function fetchDMs() {
    const { data: conversations, error: fetchConvsErr } = await supabase
        .from("chats")
        .select(
            `*,
            chat_members (
                profiles (*)
            ),
            messages (*)`
        )
        .in("type", ["direct", "group"])
        .order("created_at", { referencedTable: "messages", ascending: false })
        .limit(1, { referencedTable: "messages" });

    if (fetchConvsErr) {
        showError("fetchDMs() / select ... from chats", fetchConvsErr);
        return;
    }

    return conversations;
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

            messagePeek.appendChild(document.createTextNode(conversation.messages[0].content));

            cardDiv.dataset.id = conversation.id;

            messagesMenu.appendChild(clone);
        }
    } catch (e) {
        showError("renderDMCards()", e);
    }

    return messagesMenu;
}

/** @param {HTMLDivElement} messagesMenu */
export function addDMEvents(messagesMenu) {}
