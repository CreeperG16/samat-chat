import { GENERIC_USER } from "./constants.js";
import { session } from "./session.js";

// TODO: clean this functionality up
// Move it somewhere better?
// not sure yet where it would fit

const nav = document.querySelector(".nav");

export function resetNavBar() {
    nav.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("selected"));
}

export function selectNavItem(id) {
    resetNavBar();
    nav.querySelector(`.nav-item.${id}`)?.classList?.add("selected");
}

export function resetMenuContainer() {
    document.querySelectorAll(".menu-container .menu").forEach((m) => m.classList.add("hidden"));
}

export function hideDrawer() {
    document.querySelector(".main .message-container .messages").innerHTML = "";

    document.querySelectorAll(".main .container").forEach((c) => c.classList.add("hidden"));
    document.querySelector(".main").classList.remove("drawer-open");
}

// Updates the profile picture in the navbar
export function updateProfileImage() {
    /** @type {HTMLImageElement} */
    const profileIcon = document.querySelector(".nav-item.profile img");
    profileIcon.src = session.get().profile.profile_image ?? GENERIC_USER;
}
