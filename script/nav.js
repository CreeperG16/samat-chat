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
    document.querySelector(".main").classList.remove("drawer-open");
}
