import { GENERIC_USER } from "../constants.js";
import { showConfirmDialog, showError } from "../misc.js";
import { hideDrawer, resetMenuContainer, selectNavItem } from "../nav.js";
import { navigate } from "../router.js";
import { session } from "../session.js";
import { supabase } from "../supabase.js";

export async function fetchFriends() {
    await session.relationships().sync();
}

/** @returns {HTMLDivElement} */
export function renderFriends() {
    /** @type {HTMLTemplateElement} */
    const template = document.querySelector("#friend-card");
    const friendsMenu = document.querySelector(".menu.friends-menu");
    const incomingRequests = friendsMenu.querySelector(".section.incoming");
    const outgoingRequests = friendsMenu.querySelector(".section.outgoing");
    const friendsList = friendsMenu.querySelector(".section.friends");

    const setCount = (container, count) => (container.querySelector(".section-header").dataset.count = count);

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

    const renderCard = (friendId, container, relationType) => {
        const clone = document.importNode(template.content, true);

        const friend = session.profiles().get(friendId);

        /** @type {HTMLImageElement} */
        const profilePicImg = clone.querySelector(".img-container img");
        const actions = clone.querySelector(".actions");
        const card = clone.querySelector(".friend-card");

        profilePicImg.src = friend.profile_image ?? GENERIC_USER;

        addActionButtons(relationType, actions);
        card.classList.add(relationType);
        card.dataset.userid = friend.id;
        card.dataset.username = friend.username;

        container.appendChild(clone);
    };

    friendsMenu.querySelectorAll(".friend-card").forEach((c) => c.remove());
    friendsMenu.querySelectorAll(".section").forEach((s) => setCount(s, 0));

    if (session.relationships().incoming().size > 0)
        setCount(incomingRequests, session.relationships().incoming().size);
    if (session.relationships().outgoing().size > 0)
        setCount(outgoingRequests, session.relationships().outgoing().size);
    if (session.relationships().friends().size > 0) setCount(friendsList, session.relationships().friends().size);

    for (const incoming of session.relationships().incoming()) renderCard(incoming, incomingRequests, "incoming");
    for (const outgoing of session.relationships().outgoing()) renderCard(outgoing, outgoingRequests, "outgoing");
    for (const friend of session.relationships().friends()) renderCard(friend, friendsList, "friend");

    addFriendsEvents();

    return friendsMenu;
}

export function addFriendsEvents() {
    const msgBtnCallback = async (userId) => {
        const { data: chatId, error } = await supabase.rpc("select_or_create_dm", { recipient_id: userId });

        if (error) {
            showError(".friend-card.button.message->onClick / select_or_create_dm(uuid)", error);
            return;
        }

        navigate(`/chat/${chatId}`);
    };

    for (const friendCard of document.querySelectorAll(".friend-card")) {
        if (friendCard.classList.contains("friend")) {
            const messageBtn = friendCard.querySelector("button.message");
            messageBtn.addEventListener("click", () => msgBtnCallback(friendCard.dataset.userid));

            const removeBtn = friendCard.querySelector("button.remove");
            removeBtn.addEventListener("click", () =>
                showConfirmDialog(
                    `Are you sure you want to remove <strong><em>${friendCard.dataset.username}</em></strong> from your friends?`,
                    async () => {
                        await session.relationships().removeFriend(friendCard.dataset.userid);
                        renderFriends();
                    }
                )
            );
        }

        if (friendCard.classList.contains("incoming")) {
            const acceptBtn = friendCard.querySelector("button.accept");
            acceptBtn.addEventListener("click", async () => {
                await session.relationships().acceptRequest(friendCard.dataset.userid);
                renderFriends();
            });

            const ignoreBtn = friendCard.querySelector("button.remove");
            ignoreBtn.addEventListener("click", async () => {
                await session.relationships().ignoreRequest(friendCard.dataset.userid);
                renderFriends();
            });
        }

        if (friendCard.classList.contains("outgoing")) {
            const cancelBtn = friendCard.querySelector("button.remove");
            cancelBtn.addEventListener("click", async () => {
                await session.relationships().cancelRequest(friendCard.dataset.userid);
                renderFriends();
            });
        }
    }

    const addFriendBtn = document.querySelector(".friends-menu .add-friend-btn");
    addFriendBtn.addEventListener("click", () => navigate("/friends/add"));
}

export function renderFriendsMenu() {
    resetMenuContainer();
    hideDrawer();
    selectNavItem("friends");

    const menu = document.querySelector(".menu.friends-menu");
    menu.classList.remove("hidden");
}

// Add friend menu
export function renderAddFriendView() {
    const mainPanel = document.querySelector(".main");
    const friendsContainer = mainPanel.querySelector(".container.friends-container");

    friendsContainer.classList.remove("hidden");
    mainPanel.classList.add("drawer-open");
}

function setSystemMessage(msg) {
    const systemMsg = document.querySelector(".system-message");
    systemMsg.innerHTML = "";
    if (!msg) return;

    systemMsg.appendChild(document.createTextNode(msg));
}

export function addAddFriendViewEvents() {
    const mainPanel = document.querySelector(".main");
    const friendsContainer = mainPanel.querySelector(".container.friends-container");

    /** @type {HTMLFormElement} */
    const friendForm = document.querySelector("#add-friend-form");

    friendForm.username.addEventListener("focusout", async () => {
        /** @type {HTMLInputElement} */
        const u = friendForm.username;

        const msg = (m) => {
            u.setCustomValidity(m ?? "");
            setSystemMessage(m);
        }

        msg();
        if (!u.checkValidity()) return;
        if (u.value === "") return;

        u.classList.add("loading");
        u.setCustomValidity("Loading...");

        const { data, error } = await supabase.from("profiles").select().eq("username", u.value).limit(1).maybeSingle();

        u.classList.remove("loading");

        if (error) {
            friendForm.userid.value = "";
            msg("Unknown error occured in username lookup. Check console for details.");
            showError("friendUsername.focusout / select ... from profiles", error);
            return;
        }

        if (!data) {
            friendForm.userid.value = "";
            msg("No such user exists!");
            return;
        }

        if (data.username === session.get().profile.username) {
            friendForm.userid.value = "";
            msg("Can't send a friend request to yourself!");
            return;
        }

        if (session.relationships().friends().has(data.id)) {
            friendForm.userid.value = "";
            msg("You're already friends with this person!");
            return;
        }

        // Add profile to cache
        session.profiles().set(data.id, data);

        msg();
        friendForm.userid.value = data.id;
        return;
    });

    friendForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (session.relationships().incoming().has(friendForm.userid.value)) {
            // Accept friend request instead of sending a new one
            await session.relationships().acceptRequest(friendForm.userid.value);
            renderFriends();
            navigate("/friends");
            return;
        }

        if (session.relationships().outgoing().has(friendForm.userid.value)) {
            // No need to send the request again
            navigate("/friends");
            return;
        }

        await session.relationships().addFriend(friendForm.userid.value);
        renderFriends();

        friendForm.userid.value = "";
        friendForm.username.value = "";

        navigate("/friends");
    });
}
