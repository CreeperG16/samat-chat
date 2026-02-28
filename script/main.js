import { channelCache, initSession, session, subscribeToChat } from "./session.js";
import { initRouter, navigate } from "./router.js";
import { updateProfileImage } from "./nav.js";

import { fetchDMs, renderDMCards, renderMessagesMenu } from "./pages/messages.js";
import { fetchChannels, renderChannelCards, renderChannelsMenu } from "./pages/channels.js";
import {
    addAddFriendViewEvents,
    fetchFriends,
    renderAddFriendView,
    renderFriends,
    renderFriendsMenu,
} from "./pages/friends.js";
import { addProfileEvents, renderProfile, renderProfileMenu } from "./pages/profile.js";
import { addChatViewEvents, renderChatView } from "./pages/chat-view.js";
import { VAPID_PUBLIC_KEY } from "./constants.js";
import { supabase } from "./supabase.js";
import { showError } from "./misc.js";

async function serviceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    return registration;
}

// TODO - move this somewhere else
/** @param {ServiceWorkerRegistration} sw */
function notifications(sw) {
    const notifBanner = document.querySelector("#push-notifications");

    if (Notification.permission === "default") {
        notifBanner.classList.remove("hidden");
    }

    if (Notification.permission === "granted") {
        subscribeWebPush(sw);
    }

    notifBanner.querySelector("#enable-notifications").addEventListener("click", async () => {
        await Notification.requestPermission();
        if (Notification.permission !== "default") notifBanner.classList.add("hidden");

        if (Notification.permission === "granted") subscribeWebPush(sw);
    });

    notifBanner.querySelector(".dismiss").addEventListener("click", () => notifBanner.classList.add("hidden"));
}

// const a = {
//     endpoint:
//         "https://wns2-par02p.notify.windows.com/w/?token=BQYAAAAPByOy001r1OgJHZ3DRniUdKhWHIFTSm4LX%2fNQuYm6B4h5o%2fUhfywNmGA%2f2f4pliq12aWnCfMC0c1TRnudenyLsb7lHTMOPTIhaEbJLcbPEXvdW1z68WDYzMVLQDDaHU8yp6JwcG%2bgWlFX4wuSJaAf7xqvzOciXYqsHVP%2b3FIAsTHx5JJqWZl1ivklDP0%2bdG5mcwzebfIuJnoSfzxEfFr1U0PSVTUyq2b3rdB8MdnMDOTU%2fb22N6FHNVENeO2JyvlYX7rh9fa%2fYiRmWUB3gDBxwTCSXl9kRVwuaLBkLBOZ1PDjzDnKZGnjJEakSjKjOm8%3d",
//     expirationTime: null,
//     keys: {
//         p256dh: "BP0VOPXszFId_y6cRIgmFPBvbjQKtgIVIDrJhoHQaJ8PDBYtYaYrSKk21KaAVghBEOOy2KBA6w0iPdT1YH6bLK8",
//         auth: "A1o8LbyM9nLYe7fB9QMGcQ",
//     },
// };

/** @param {ServiceWorkerRegistration} sw */
async function subscribeWebPush(sw) {
    let currentSubscription = await sw.pushManager.getSubscription();
    if (currentSubscription === null) {
        currentSubscription = await sw.pushManager.subscribe({
            applicationServerKey: VAPID_PUBLIC_KEY,
            userVisibleOnly: true,
        });
    }
    if (session.get().deviceSession.push_subscription === null) {
        const { error } = await supabase.functions.invoke("manage-push-subscription", {
            body: {
                action: "subscribe",
                push_subscription: currentSubscription.toJSON(),
            },
        });

        if (error) {
            showError("subscribeWebPush() / manage-push-subscription", error);
            return;
        }

        console.log("Success!");
    }
}

async function main() {
    const loggedIn = await initSession();
    if (!loggedIn) return;

    const sw = await serviceWorker();

    notifications(sw);

    updateProfileImage();
    await Promise.all([fetchFriends(), fetchDMs(), fetchChannels()]);

    renderDMCards();
    renderChannelCards();
    renderFriends();

    const profileMenu = renderProfile();
    addProfileEvents(profileMenu);

    addChatViewEvents();
    addAddFriendViewEvents();

    for (const { id } of channelCache.getAll()) subscribeToChat(id);

    initRouter({
        "/": renderMessagesMenu,
        "/channels": renderChannelsMenu,
        "/friends": renderFriendsMenu,
        "/profile": renderProfileMenu,

        "/chat/:chat_id": renderChatView,
        "/friends/add": renderAddFriendView,
    });

    const redirect = sessionStorage.getItem("redirect");
    if (redirect) {
        sessionStorage.removeItem("redirect");
        navigate(redirect);
    }
}

main();
