import { GENERIC_USER } from "../constants.js";
import { showError } from "../misc.js";
import { session } from "../session.js";
import { supabase } from "../supabase.js";

export async function fetchFriends() {
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
            const other = user_1.id === session.get().user.id ? user_2 : user_1;

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
export function renderFriends(friends) {
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
export function addFriendsEvents(friendsMenu) {}
