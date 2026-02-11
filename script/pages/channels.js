import { showError } from "../misc.js";
import { supabase } from "../supabase.js";

export async function fetchChannels() {
    const { data: channels, error: fetchChannelsErr } = await supabase
        .from("chats")
        .select("*")
        .in("type", ["public", "private"]);

    if (fetchChannelsErr) {
        showError("fetchChannels() / select * from chats", fetchChannelsErr);
        return;
    }

    return channels;
}

/** @param {Chat[]} channels @returns {HTMLDivElement} */
export function renderChannelCards(channels) {
    /** @type {HTMLTemplateElement} */
    const template = document.querySelector("#channel-card");
    const channelsMenu = document.querySelector(".channels-menu");

    try {
        for (const channel of channels) {
            const clone = document.importNode(template.content, true);

            const channelName = clone.querySelector(".channel-name");
            const channelDiv = clone.querySelector(".channel-card");
            channelName.appendChild(document.createTextNode(channel.name));
            if (channel.type === "public") channelDiv.classList.add("public-channel");

            channelDiv.dataset.id = channel.id;

            channelsMenu.appendChild(clone);
        }
    } catch (e) {
        showError("renderChannelCards()", e);
    }

    return channelsMenu;
}

/** @param {HTMLDivElement} channelsMenu */
export function addChannelEvents(channelsMenu) {}
