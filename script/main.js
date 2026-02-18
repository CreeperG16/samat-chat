import { channelCache, initSession, subscribeToChat } from "./session.js";
import { initRouter, navigate } from "./router.js";
import { updateProfileImage } from "./nav.js";

import { fetchDMs, renderDMCards, renderMessagesMenu } from "./pages/messages.js";
import { fetchChannels, renderChannelCards, renderChannelsMenu } from "./pages/channels.js";
import { addFriendsEvents, fetchFriends, renderFriends, renderFriendsMenu } from "./pages/friends.js";
import { addProfileEvents, renderProfile, renderProfileMenu } from "./pages/profile.js";
import { addChatViewEvents, renderChatView } from "./pages/chat-view.js";

async function main() {
    const loggedIn = await initSession();
    if (!loggedIn) return;

    updateProfileImage();

    const [friends] = await Promise.all([fetchFriends(), fetchDMs(), fetchChannels()]);

    renderDMCards();
    renderChannelCards();

    const friendsMenu = renderFriends(friends);
    addFriendsEvents(friendsMenu);

    const profileMenu = renderProfile();
    addProfileEvents(profileMenu);

    addChatViewEvents();

    for (const { id } of channelCache.getAll()) subscribeToChat(id);

    initRouter({
        "/": renderMessagesMenu,
        "/channels": renderChannelsMenu,
        "/friends": renderFriendsMenu,
        "/profile": renderProfileMenu,

        "/chat/:chat_id": renderChatView,
    });

    const redirect = sessionStorage.getItem("redirect");
    if (redirect) {
        sessionStorage.removeItem("redirect");
        navigate(redirect);
    }
}

main();
