import { supabase } from "../script/supabase.js";
import { showError } from "../script/misc.js";
import { MIN_PWD_LEN } from "../script/constants.js";

const redirect = (path) => (window.location.href = path);

const header = document.querySelector("h1");
const form = document.querySelector("form");
const content = document.querySelector("#content");

function setErrorMsg(msg) {
    const errMsg = document.querySelector("#err-msg");
    errMsg.innerHTML = "";
    if (!msg) return;

    errMsg.appendChild(document.createTextNode(msg));
}

function showErrorParam() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("err")) {
        switch (params.get("err")) {
            case "invalid_credentials":
                setErrorMsg("Invalid email or password");
                return;
            default:
                setErrorMsg(
                    `ERR: '${params.get("err")}' - An unknown error has occured. Check the console for details.`
                );
                return;
        }
    }

    if (params.has("action")) {
        if (params.get("action") === "wait_for_email") {
            content.classList.add("hidden");
        }
    }
}

async function main() {
    const { data: session } = await supabase.auth.getSession();
    if (session.session) {
        console.log("Already logged in!");
        redirect("/"); // TODO: show some kind of message?
        return;
    }

    showErrorParam();
}

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
});

form.password.addEventListener("input", () => {
    if (form.mode.value !== "signup") return;

    /** @type {string} */
    const password = form.password.value;

    if (password.length === 0) {
        setErrorMsg();
    } else if (password.length < MIN_PWD_LEN) {
        setErrorMsg(`Password is not long enough. Must be at least ${MIN_PWD_LEN} characters.`);
    } else if (!/[A-Z]/.test(password)) {
        setErrorMsg(`Password must contain at least one capital letter.`);
    } else if (!/[a-z]/.test(password)) {
        setErrorMsg(`Password must contain at least one lowercase letter.`);
    } else if (!/\d/.test(password)) {
        setErrorMsg(`Password must contain at least one number.`);
    } else {
        setErrorMsg();
    }
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return alert("invalid");

    if (form.mode.value === "login") {
        const { error } = await supabase.auth.signInWithPassword({
            email: form.email.value,
            password: form.password.value,
            options: { captchaToken: form["cf-turnstile-response"].value },
        });

        if (error) {
            if (error.code === "invalid_credentials") {
                console.log("Provided credentials were invalid");
                redirect("/login/?err=invalid_credentials");
                return;
            }

            showError("signInWithPassword()", error);
            redirect(`/login/?err=${error.code}`);
            return;
        }

        redirect("/");

        return;
    } else {
        const { error } = await supabase.auth.signUp({
            email: form.email.value,
            password: form.password.value,
            options: {
                data: { username: form.username.value, full_name: "TODO" },
                captchaToken: form["cf-turnstile-response"].value,
            },
        });

        if (error) {
            showError("signUp()", error);
            redirect(`/login/?err=${error.code}`);
            return;
        }

        // TODO: 
        setErrorMsg("Check your inbox for the confirmation email!");
        redirect("/login/?action=wait_for_email");
    }
});

main();
