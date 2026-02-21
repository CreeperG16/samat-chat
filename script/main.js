import { channelCache, initSession, subscribeToChat } from "./session.js";
import { initRouter, navigate } from "./router.js";
import { updateProfileImage } from "./nav.js";

import { fetchDMs, renderDMCards, renderMessagesMenu } from "./pages/messages.js";
import { fetchChannels, renderChannelCards, renderChannelsMenu } from "./pages/channels.js";
import { addAddFriendViewEvents, fetchFriends, renderAddFriendView, renderFriends, renderFriendsMenu } from "./pages/friends.js";
import { addProfileEvents, renderProfile, renderProfileMenu } from "./pages/profile.js";
import { addChatViewEvents, renderChatView } from "./pages/chat-view.js";

async function main() {
    const loggedIn = await initSession();
    if (!loggedIn) return;

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
