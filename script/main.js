import { GENERIC_USER } from "./constants.js";
import { supabase } from "./supabase.js";
import { showError } from "./misc.js";
import { session } from "./session.js";
import { addDMEvents, fetchDMs, renderDMCards } from "./pages/messages.js";
import { addChannelEvents, fetchChannels, renderChannelCards } from "./pages/channels.js";
import { addFriendsEvents, fetchFriends, renderFriends } from "./pages/friends.js";
import { addProfileEvents, renderProfile } from "./pages/profile.js";

const OFFLINE_DEV = false;

// Navbar code
document.querySelectorAll(".nav-item").forEach((navItem) => {
    navItem.addEventListener("click", () => {
        try {
            if (navItem.classList.contains("selected")) return;
            document.querySelector(".nav-item.selected").classList.remove("selected");
            navItem.classList.add("selected");

            document.querySelectorAll(".menu").forEach((m) => m.classList.add("hidden"));
            if (navItem.classList.contains("messages")) {
                document.querySelector(".messages-menu").classList.remove("hidden");
            } else if (navItem.classList.contains("channels")) {
                document.querySelector(".channels-menu").classList.remove("hidden");
            } else if (navItem.classList.contains("friends")) {
                document.querySelector(".friends-menu").classList.remove("hidden");
            } else if (navItem.classList.contains("profile")) {
                document.querySelector(".profile-menu").classList.remove("hidden");
            }
        } catch (e) {
            showError(".nav-item.on('click')", e);
        }
    });
});

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
    profileIcon.src = session.get().profile.profile_image;
}

async function main() {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) return;

    updateProfileImage();

    const [conversations, channels, friends] = await Promise.all([fetchDMs(), fetchChannels(), fetchFriends()]);

    const messagesMenu = renderDMCards(conversations);
    addDMEvents(messagesMenu);

    const channelsMenu = renderChannelCards(channels);
    addChannelEvents(channelsMenu);

    const friendsMenu = renderFriends(friends);
    addFriendsEvents(friendsMenu);

    const profileMenu = renderProfile();
    addProfileEvents(profileMenu);
}

main();
