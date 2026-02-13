import { showError } from "../misc.js";
import { hideDrawer, resetMenuContainer, selectNavItem } from "../nav.js";
import { navigate } from "../router.js";
import { channelCache } from "../session.js";
import { supabase } from "../supabase.js";

export async function fetchChannels() {
    const { data, error } = await supabase
        .from("chats")
        .select("*, chat_members(profiles(*))")
        .in("type", ["public", "private"]);

    if (error) {
        showError("fetchChannels() / select * from chats", error);
        return;
    }

    for (const chat of data) {
        channelCache.addChannel({
            id: chat.id,
            name: chat.name,
            private: chat.private,
            type: chat.type,
            updated_at: chat.updated_at,
            chat_members: chat.chat_members,
        });
    }
}

/** Renders channels from cache @returns {HTMLDivElement} */
export function renderChannelCards() {
    /** @type {HTMLTemplateElement} */
    const template = document.querySelector("#channel-card");
    const channelsMenu = document.querySelector(".channels-menu");

    channelsMenu.querySelectorAll(".channel-card").forEach(c => c.remove());

    const cacheEntries = channelCache.getAll();

    try {
        for (const { details } of cacheEntries) {
            if (!["public", "private"].includes(details.type)) continue;

            const clone = document.importNode(template.content, true);

            const channelName = clone.querySelector(".channel-name");
            const channelDiv = clone.querySelector(".channel-card");
            channelName.appendChild(document.createTextNode(details.name));
            if (details.type === "public") channelDiv.classList.add("public-channel");

            channelDiv.dataset.id = details.id;

            channelsMenu.appendChild(clone);
        }
    } catch (e) {
        showError("renderChannelCards()", e);
    }

    addChannelEvents();

    return channelsMenu;
}

function addChannelEvents() {
    /** @type {HTMLDivElement} */
    const mainPanel = document.querySelector(".main");
    const messageContainer = mainPanel.querySelector(".message-container");

    /** @param {PointerEvent} ev */
    const onChannelCardClick = (ev) => {
        mainPanel.querySelectorAll(".container").forEach(x => x.classList.add("hidden"));
        messageContainer.classList.remove("hidden");

        const chatId = ev.currentTarget.dataset.id;
        navigate(`/chat/${chatId}`);
    };

    document
        .querySelectorAll(".channels-menu .channel-card")
        .forEach((c) => c.addEventListener("click", onChannelCardClick));
}

export function renderChannelsMenu() {
    resetMenuContainer();
    hideDrawer();
    selectNavItem("channels");
    
    const menu = document.querySelector(".menu.channels-menu");
    menu.classList.remove("hidden");
}
