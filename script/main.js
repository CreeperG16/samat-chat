import { GENERIC_USER } from "./constants.js";
import { supabase } from "./supabase.js";
import { showError } from "./misc.js";
import { addMsgsToCache, channelCache, removeMsgsFromCache, session } from "./session.js";
import { initRouter, navigate } from "./router.js";
import { addDMEvents, fetchDMs, renderDMCards, renderMessagesMenu } from "./pages/messages.js";
import { addChannelEvents, fetchChannels, renderChannelCards, renderChannelsMenu } from "./pages/channels.js";
import { addFriendsEvents, fetchFriends, renderFriends, renderFriendsMenu } from "./pages/friends.js";
import { addProfileEvents, renderProfile, renderProfileMenu } from "./pages/profile.js";
import { addChatViewEvents, renderChatView, renderMessages } from "./pages/chat-view.js";

const OFFLINE_DEV = false;

// Check if logged in, and set current session object if so
async function isLoggedIn() {
    if (OFFLINE_DEV) {
        session.setProfile({
            id: "ce1320cf-5d94-4f34-91ef-08fb14be8e33",
            username: "user",
            display_name: "Just A User",
            profile_image: GENERIC_USER,
        });
        session.setUser({
            id: "ce1320cf-5d94-4f34-91ef-08fb14be8e33",
            email: "user@example.com",
        });
        session.setSession({
            id: "a5f86bdf-5781-470e-907c-bd7a7a0b55e3",
        });

        return true;
    }

    const { data, error } = await supabase.auth.getSession();

    if (error) {
        showError("main() / getSession()", error);
        window.location.href = "/login";
        return false;
    }

    if (!data.session) {
        console.log("not logged in");
        window.location.href = "/login";
        return false;
    }

    const { data: hasValidSession, error: deviceSessionErr } = await supabase.rpc("valid_device_session");
    if (deviceSessionErr) {
        showError("main() / valid_device_session()", deviceSessionErr);
        await supabase.auth.signOut();
        window.location.href = "/login";
        return false;
    }

    if (!hasValidSession) {
        console.log("not logged in - no valid session");

        await supabase.auth.signOut();
        window.location.href = "/login";
        return false;
    }

    session.setSession(data.session);

    const { data: user, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
        console.error("Failed to get user???", userErr);
        return false;
    }

    session.setUser(user.user);

    const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select()
        .eq("id", user.user.id)
        .limit(1)
        .single();

    if (profileErr) {
        console.error("Failed to fetch profile", profileErr);
        return false;
    }

    session.setProfile(profile);

    return true;
}

// Updates the profile picture in the navbar
function updateProfileImage() {
    /** @type {HTMLImageElement} */
    const profileIcon = document.querySelector(".nav-item.profile img");
    profileIcon.src = session.get().profile.profile_image ?? GENERIC_USER;
}

function enableBackButton() {
    const main = document.querySelector(".main");
    main.querySelector(".message-container .header .back-btn").addEventListener("click", () =>
        // main.classList.remove("drawer-open")
        // navigate("/")
        history.go(-1)
    );
}

const channelMap = new Map();
async function main() {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) return;

    updateProfileImage();
    enableBackButton();

    if (OFFLINE_DEV) {
        const profileMenu = renderProfile();
        addProfileEvents(profileMenu);
        return;
    }

    const [conversations, channels, friends] = await Promise.all([fetchDMs(), fetchChannels(), fetchFriends()]);

    const messagesMenu = renderDMCards(conversations);
    addDMEvents(messagesMenu);

    const channelsMenu = renderChannelCards(channels);
    addChannelEvents(channelsMenu);

    const friendsMenu = renderFriends(friends);
    addFriendsEvents(friendsMenu);

    const profileMenu = renderProfile();
    addProfileEvents(profileMenu);

    addChatViewEvents();

    // TODO: move this realtime code somewhere else (organisation)
    // REALLY JANK SYSTEM - SOLIDIFY ASAP!
    // HASTILY PUT TOGETHER
    // JUST TO FINALLY SEE MESSAGES IN THE MESSAGE APP
    // along with /script/pages/chat-view.js
    // and /script/session.js channelCache code
    supabase.realtime.setAuth(session.get().session.access_token);

    for (const chat of [...conversations, ...channels]) {
        const realtimeChannel = supabase.realtime.channel(`chat:${chat.id}`, {
            config: { private: true },
        });

        channelCache.set(chat.id, {
            messages: [],
            lastFetchedAt: null,
            latestMessageAt: null,
            oldestMessageAt: null,
        });

        const handleMsgEvent = ({ event, payload }) => {
            const { chat_id } = payload.message;
            const channelCacheEntry = channelCache.get(chat_id);

            if (!channelCacheEntry) {
                console.warn("Message  received for unknown channel '%s'.", chat_id);
                return;
            }

            const isInChatScreen = location.pathname.match(/\/chat\/(?<chatid>[^\/]+)/);
            const currOpenChatId = isInChatScreen?.groups?.chatid;

            if (event === "message-delete") {
                removeMsgsFromCache(chat_id, payload.message);
                if (isInChatScreen && currOpenChatId === chat_id) {
                    const msgElement = document.querySelector(`.message[data-messageid="${payload.message.id}"]`);
                    if (msgElement) msgElement.remove();
                }

                return;
            }

            // message-create
            addMsgsToCache(chat_id, payload.message);
            if (isInChatScreen && currOpenChatId === chat_id) {
                renderMessages(channelCacheEntry.messages);
            }
        }

        realtimeChannel
            .on("broadcast", { event: "message-create" }, handleMsgEvent)
            .on("broadcast", { event: "message-delete" }, handleMsgEvent)
            .subscribe();

        channelMap.set(chat.id, realtimeChannel);
    }

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
