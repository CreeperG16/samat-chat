import { renderNotFoundPage } from "./pages/not-found.js";

const routes = [];

export function navigate(path) {
    history.pushState({}, "", path);
    render(path);
}

function render(path) {
    // console.log("Attempting to render", path);

    let handled = false;
    for (const route of routes) {
        const result = route.pattern.exec(path);
        // console.log("Tested '%s' for route '%o', result is '%o'", path, route.pattern, result);
        if (!result) continue;

        // console.log(result, route);
        route.handler(result.groups);
        handled = true;
        break;
    }

    if (handled) return;
    console.log("No route matched '%s', rendering 404 page", path);
    history.replaceState({}, "", "/404");
    renderNotFoundPage();
}

export function initRouter(initRoutes) {
    for (const [route, handler] of Object.entries(initRoutes)) {
        // This makes a regex pattern for :params in the route
        // Makes named capturing groups in the pattern
        const pattern = new RegExp(`^${route.replace(/:([^\/]+)/g, (_, s) => `(?<${s}>.+)`)}$`);

        routes.push({ pattern, handler });
    }

    // TODO: generalise this
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
