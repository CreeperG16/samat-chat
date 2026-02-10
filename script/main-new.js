import { GENERIC_USER } from "./constants.js";
import { supabase } from "./supabase.js";
// import "./types-new.d.ts";

const currentSession = {
    session: null,
    user: null,
    profile: null,
};

function showError(where, err) {
    console.error(`Error in ${where}:`, err);

    const errBanner = document.querySelector("#err-banner");

    const fmtErr = (e) => e.toString() + (e.stack ? " - at:\n" + e.stack : "");

    errBanner.querySelector(".where").innerHTML = where;
    errBanner.querySelector(".message").innerHTML =
        err instanceof Error ? fmtErr(err) : JSON.stringify(err);

    errBanner.classList.add("has-err");
    setTimeout(() => errBanner.classList.remove("has-err"), 10_000);
}

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

async function fetchDMs() {
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
        showError("fetchDMs() / select ... from chats", fetchConvsErr)
        return;
    }

    return conversations;
}

/** @param {Chat[]} conversations @returns {HTMLDivElement} */
function renderDMCards(conversations) {
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
                const otherUser = conversation.chat_members.find((x) => x.profiles.id !== currentSession.user.id);
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
function addDMEvents(messagesMenu) {}

async function fetchChannels() {
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
function renderChannelCards(channels) {
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
function addChannelEvents(channelsMenu) {}

async function fetchFriends() {
    const { data: relationshipData, error } = await supabase.from("relationships").select(`
            status,
            user_1:profiles!relationships_user_1_fkey(*),
            user_2:profiles!relationships_user_2_fkey(*)
        `);

    if (error) {
        showError("fetchFriends() / select ... from relationships", error);
        return;
    }

    const relationships = {
        friends: [],
        pendingOutgoing: [],
        pendingIncoming: [],
    };

    try {
        for (const { user_1, user_2, status } of relationshipData) {
            const other = user_1.id === currentSession.user.id ? user_2 : user_1;
    
            if (status === "friends") relationships.friends.push(other);
            if (status === "pending_incoming") {
                // user_1 <--- user_2
                if (user_1.id === other.id) relationships.pendingOutgoing.push(other); // I (user_2) sent a request to user_1
                if (user_2.id === other.id) relationships.pendingIncoming.push(other); // user_2 sent a request to me (user_1)
            }
            if (status === "pending_outgoing") {
                // user_1 ---> user_2
                if (user_1.id === other.id) relationships.pendingIncoming.push(other); // user_1 sent a request to me (user_2)
                if (user_2.id === other.id) relationships.pendingOutgoing.push(other); // I (user_1) sent a request to user_2
            }
        }
    } catch (e) {
        showError("fetchFriends() / for (... of relationshipData) ...", e);
    }

    return relationships;
}

/** @returns {HTMLDivElement} */
function renderFriends(friends) {
    /** @type {HTMLTemplateElement} */
    const template = document.querySelector("#friend-card");
    const friendsMenu = document.querySelector(".menu.friends-menu");
    const incomingRequests = friendsMenu.querySelector(".section.incoming");
    const outgoingRequests = friendsMenu.querySelector(".section.outgoing");
    const friendsList = friendsMenu.querySelector(".section.friends");

    const addActionButtons = (relationType, container) => {
        const makeBtn = (inner, cl) => {
            const btn = document.createElement("button");
            btn.innerHTML = inner;
            btn.classList.add(cl);
            return btn;
        };

        if (relationType === "outgoing") {
            container.appendChild(makeBtn("X", "remove"));
        } else if (relationType === "incoming") {
            container.appendChild(makeBtn("✓", "accept"));
            container.appendChild(makeBtn("X", "remove"));
        } else if (relationType === "friend") {
            container.appendChild(makeBtn("💬", "message"));
            container.appendChild(makeBtn("X", "remove"));
        }
    };

    const renderCard = (friend, container, relationType) => {
        const clone = document.importNode(template.content, true);

        /** @type {HTMLImageElement} */
        const profilePicImg = clone.querySelector(".img-container img");
        const contactName = clone.querySelector(".contact-name");
        const actions = clone.querySelector(".actions");

        profilePicImg.src = friend.profile_image ?? GENERIC_USER;
        contactName.appendChild(document.createTextNode(friend.username));

        addActionButtons(relationType, actions);

        container.appendChild(clone);
    };

    if (friends.pendingIncoming.length > 0)
        incomingRequests.querySelector(".section-header").dataset.count = friends.pendingIncoming.length;
    if (friends.pendingOutgoing.length > 0)
        outgoingRequests.querySelector(".section-header").dataset.count = friends.pendingOutgoing.length;
    if (friends.friends.length > 0) friendsList.querySelector(".section-header").dataset.count = friends.friends.length;

    for (const incoming of friends.pendingIncoming) renderCard(incoming, incomingRequests, "incoming");
    for (const outgoing of friends.pendingOutgoing) renderCard(outgoing, outgoingRequests, "outgoing");
    for (const friend of friends.friends) renderCard(friend, friendsList, "friend");

    return friendsMenu;
}

/** @param {HTMLDivElement} friendsMenu */
function addFriendsEvents(friendsMenu) {}

/** @returns {HTMLDivElement} */
function renderProfile() {
    const profileMenu = document.querySelector(".menu.profile-menu");

    function renderProfileCard() {
        const profileCard = profileMenu.querySelector(".profile-card");

        /** @type {HTMLImageElement} */
        const profileImage = profileCard.querySelector(".profile-img");
        const displayName = profileCard.querySelector(".display-name");
        const username = profileCard.querySelector(".username");

        profileImage.src = currentSession.profile.profile_image ?? GENERIC_USER;
        displayName.appendChild(document.createTextNode(currentSession.profile.display_name ?? "Unknown"));
        username.appendChild(document.createTextNode(currentSession.profile.username));
    }

    function renderPersonalDetails() {
        const details = [
            ["username", "profile", false],
            ["display_name", "profile", true],
            ["email", "user", true],
        ];
        const detailsContainer = profileMenu.querySelector(".personal-details");

        /** @type {HTMLTemplateElement} */
        const template = detailsContainer.querySelector("#personal-detail");

        for (const [dKey, source, editable] of details) {
            const clone = document.importNode(template.content, true);

            const detail = clone.querySelector(".personal-detail");
            const type = clone.querySelector(".type");
            const value = clone.querySelector(".value");

            if (editable) detail.classList.add("editable");
            type.appendChild(document.createTextNode(dKey.replace(/_/g, " ")));
            value.appendChild(document.createTextNode(currentSession[source][dKey]));

            detailsContainer.appendChild(clone);
        }
    }

    renderProfileCard();
    renderPersonalDetails();

    return profileMenu;
}

/** @param {HTMLDivElement} profileMenu */
function addProfileEvents(profileMenu) {}

async function isLoggedIn() {
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

    currentSession.session = data.session;

    const { data: user, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
        console.error("Failed to get user???", userErr);
        return false;
    }

    currentSession.user = user.user;

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

    currentSession.profile = profile;

    return true;
}

function updateProfileImage() {
    /** @type {HTMLImageElement} */
    const profileIcon = document.querySelector(".nav-item.profile img");
    profileIcon.src = currentSession.profile.profile_image;
}

async function main() {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) return;

    updateProfileImage();

    const conversations = await fetchDMs();
    const messagesMenu = renderDMCards(conversations);
    addDMEvents(messagesMenu);

    const channels = await fetchChannels();
    const channelsMenu = renderChannelCards(channels);
    addChannelEvents(channelsMenu);

    const friends = await fetchFriends();
    const friendsMenu = renderFriends(friends);
    addFriendsEvents(friendsMenu);

    const profileMenu = renderProfile();
    addProfileEvents(profileMenu);
}

main();
