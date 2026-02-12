import { session } from "../session.js";
import { showConfirmDialog, showError } from "../misc.js";
import { supabase } from "../supabase.js";
import { hideDrawer, resetMenuContainer, selectNavItem } from "../nav.js";
import { GENERIC_USER } from "../constants.js";

/** @returns {HTMLDivElement} */
export function renderProfile() {
    const profileMenu = document.querySelector(".menu.profile-menu");

    function renderProfileCard() {
        const profileCard = profileMenu.querySelector(".profile-card");

        /** @type {HTMLImageElement} */
        const profileImage = profileCard.querySelector(".profile-img");
        const displayName = profileCard.querySelector(".display-name");
        const username = profileCard.querySelector(".username");

        profileImage.src = session.get().profile.profile_image ?? GENERIC_USER;
        displayName.appendChild(document.createTextNode(session.get().profile.display_name ?? "Unknown"));
        username.appendChild(document.createTextNode(session.get().profile.username));
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

            detail.dataset.type = dKey;
            if (editable) detail.classList.add("editable");
            type.appendChild(document.createTextNode(dKey.replace(/_/g, " ")));
            value.appendChild(document.createTextNode(session.get()[source][dKey]));

            detailsContainer.appendChild(clone);
        }
    }

    function renderSecurityActions() {
        // TODO: Stuff like change password, MFA, etc.
        // Dynamic data like if MFA is enabled or not
    }

    renderProfileCard();
    renderPersonalDetails();

    return profileMenu;
}

/** @param {HTMLDivElement} profileMenu */
export function addProfileEvents(profileMenu) {
    const pfpImgWrapper = profileMenu.querySelector(".profile-card .img-wrapper");
    pfpImgWrapper.addEventListener("click", () => {
        // TODO: change profile picture (file select, supabase storage, etc)
    });

    const logoutBtn = profileMenu.querySelector(".profile-card .logout");
    logoutBtn.addEventListener("click", () =>
        showConfirmDialog("Are you sure you want to log out?", async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                showError("logoutBtn.on('click') / supabase.auth.signOut()", error);
                return;
            }

            localStorage.removeItem("device-session-token");
            console.log("Logged out!");
            window.location.href = "/login";
        })
    );

    const personalDetails = [...profileMenu.querySelectorAll(".personal-details .personal-detail")];
    for (const detail of personalDetails) {
        const type = detail.dataset.type;

        detail.querySelector(".edit").addEventListener("click", () => {
            if (type === "email") {
                // TODO
                return;
            }

            // TODO
        });
    }
}

export function renderProfileMenu() {
    resetMenuContainer();
    hideDrawer();
    selectNavItem("profile");
    
    const menu = document.querySelector(".menu.profile-menu");
    menu.classList.remove("hidden");
}
