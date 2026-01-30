import { GENERIC_USER, MIN_PWD_LEN } from "../script/constants.js";
import { showError } from "../script/misc.js";
import { supabase } from "../script/supabase.js";

function redirect(path) {
    window.location.href = path;
}

function setLoginMessage(msg) {
    const loginMessageElem = document.querySelector("#login-message");
    loginMessageElem.innerHTML = "";
    if (msg) loginMessageElem.appendChild(document.createTextNode(msg));
}

async function main() {
    const { data: session } = await supabase.auth.getSession();
    if (session.session) {
        console.log("already logged in");
        redirect("/"); // TODO: show some kind of message?
        return;
    }

    /** @type {HTMLDivElement} */
    const content = document.querySelector("#content");

    document.querySelector("#mode-switcher").addEventListener("click", () => {
        content.classList.toggle("mode-login");
        content.classList.toggle("mode-signup");
    });

    /** @type {HTMLInputElement[]} */
    const [emailInput, pwdInput, unameInput] = document.querySelectorAll("#content input");
    /** @type {HTMLButtonElement[]} */
    const [loginBtn, signupBtn] = document.querySelectorAll("#button-container button");

    // Called when the user presses login or signup
    const submitCallback = async () => {
        content.classList.add("loading");

        unameInput.removeEventListener("focusout", unameInputFocusCallback);
        pwdInput.removeEventListener("input", passwordInputCallback);

        loginBtn.removeEventListener("click", submitCallback);
        signupBtn.removeEventListener("click", submitCallback);

        const captchaToken = document.querySelector('input[name="cf-turnstile-response"]')?.value;

        if (content.classList.contains("mode-login")) {
            const { error } = await supabase.auth.signInWithPassword({
                email: emailInput.value,
                password: pwdInput.value,
                options: { captchaToken },
            });

            if (error) {
                if (error.code === "invalid_credentials") {
                    console.log("Provided credentials were invalid");
                    setLoginMessage("Password was incorrect.");
                    redirect("/login");
                    return;
                }

                showError("submitCallback / login", error);
                setLoginMessage("An unknown error occured - check console for details.");
                return;
            }

            redirect("/");
        } else {
            const { error } = await supabase.auth.signUp({
                email: emailInput.value,
                password: pwdInput.value,
                options: { data: { username: unameInput.value, full_name: "TODO" }, captchaToken },
            });

            if (error) {
                setLoginMessage(`An unknown error occured: ${error.message}`);
                showError("submitCallback/auth.signUp()", error);
                return;
            } else {
                setLoginMessage("Check your inbox for your confirmation email!");
            }
        }
    };

    // Called whenever the user focus changes input elements
    const unameInputFocusCallback = async () => {
        const username = unameInput.value.toLowerCase();
        if (username === "" || !unameInput.checkValidity()) {
            return;
        }

        const { data, error } = await supabase
            .from("profiles")
            .select()
            .eq("username", username)
            .limit(1)
            .maybeSingle();

        if (error) {
            showError("emailInputFocusCallback / select * from profiles", error);
            return;
        }

        if (data) {
            unameInput.setCustomValidity("This username already exists.");
        } else {
            unameInput.setCustomValidity("");
        }
    };

    const passwordInputCallback = () => {
        /** @type {string} */
        const password = pwdInput.value;

        if (password.length === 0) {
            setLoginMessage();
        } else if (password.length < MIN_PWD_LEN) {
            setLoginMessage(`Password is not long enough. Must be at least ${MIN_PWD_LEN} characters.`);
        } else if (!/[A-Z]/.test(password)) {
            setLoginMessage(`Password must contain at least one capital letter.`);
        } else if (!/[a-z]/.test(password)) {
            setLoginMessage(`Password must contain at least one lowercase letter.`);
        } else if (!/\d/.test(password)) {
            setLoginMessage(`Password must contain at least one number.`);
        } else {
            setLoginMessage();
        }
    };

    emailInput.addEventListener("focusout", unameInputFocusCallback);
    pwdInput.addEventListener("input", passwordInputCallback);
    loginBtn.addEventListener("click", submitCallback);
    signupBtn.addEventListener("click", submitCallback);
    unameInputFocusCallback();
}

main();
