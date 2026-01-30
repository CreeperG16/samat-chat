import { supabase } from "../script/supabase.js";
import { showError } from "../script/misc.js";

const form = document.querySelector("form");
const header = document.querySelector("h1");

header.querySelectorAll("span > span").forEach((s) =>
    s.addEventListener("click", (e) => {
        if (e.target.classList.contains("selected")) return;

        const switchToMode = e.target.dataset.mode;
        form.mode.value = switchToMode;
        header.querySelectorAll("span > span").forEach((s) => s.classList.remove("selected"));
        e.target.classList.add("selected");

        if (form.mode.value === "signup") {
            /** @type {HTMLInputElement} */
            const p = form.password;
            p.pattern = "^(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z]).{6,}";
            
            form.username.classList.remove("hidden");
        } else if (form.mode.value === "login") {
            form.password.pattern = ".*";
            form.username.classList.add("hidden");
        }
    })
);

form.username.addEventListener("focusout", async () => {
    /** @type {HTMLInputElement} */
    const u = form.username;
    
    u.setCustomValidity("");
    if (!u.checkValidity()) return;
    if (u.value === "") return;

    u.classList.add("loading");
    u.setCustomValidity("Loading...");

    const { data, error } = await supabase.from("profiles").select().eq("username", u.value).limit(1).maybeSingle();
    if (error) {
        u.classList.remove("loading");
        u.setCustomValidity("Unknown error occured in username validation. Check console for details.");
        // TODO: show some message in ui
        showError("username.focusout callback username validation (supabase)", error);
        return;
    }
    if (data) {
        u.classList.remove("loading");
        u.setCustomValidity("Username already taken.");
        return;
    }

    u.classList.remove("loading");
    u.setCustomValidity("");
})

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return alert("invalid");

    if (form.mode.value === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: form.email.value,
            password: form.password.value,
            options: { captchaToken: form["cf-turnstile-response"].value }
        })
    } else {
        alert(form.mode.value)
    }
});
