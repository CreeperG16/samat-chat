// WIP - more complex, not hardcoded routes later
const ROUTES = {
    "/": "messages",
    "/channels": "channels",
    "/friends": "friends",
    "/profile": "profile",
    // "/404": "not-found",
};

export function navigate(path) {
    history.pushState({}, "", path);
    render(path);
}

function render(path) {
    document.querySelectorAll(".nav-item.selected").forEach((s) => s.classList.remove("selected"));
    document.querySelectorAll(".menu").forEach((m) => m.classList.add("hidden"));

    const page = ROUTES[path];
    if (page) {
        document.querySelector(`.nav-item.${page}`).classList.add("selected");
        document.querySelector(`.${page}-menu`).classList.remove("hidden");
    } else {
        history.replaceState({}, "", "/404");
        document.querySelector(`.not-found-menu`).classList.remove("hidden");
    }
}

export function initRouter() {
    document.querySelectorAll("[data-link]").forEach((n) =>
        n.addEventListener("click", (e) => {
            e.preventDefault();
            n.querySelector(".nav-item").classList.add("selected");
            navigate(n.getAttribute("href"));
        })
    );

    window.addEventListener("popstate", () => {
        render(window.location.pathname);
    });

    render(window.location.pathname);
}
