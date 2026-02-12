import { hideDrawer, resetMenuContainer, resetNavBar } from "../nav.js";

export function renderNotFoundPage() {
    resetNavBar();
    resetMenuContainer();
    hideDrawer();
    
    const menu = document.querySelector(".menu.not-found-menu");
    menu.classList.remove("hidden");
}
