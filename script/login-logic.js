import { GENERIC_USER, MIN_PWD_LEN } from "./constants.js";
import { supabase } from "./supabase.js";

/** @param {(session: import("@supabase/supabase-js").Session) => void} startSession */
export async function initAndShowLogin(startSession) {
    /** @type {HTMLDivElement} */
    const loginModal = document.querySelector("#login-modal");
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        // TODO
        console.error("Error in initAndShowLogin()", error);
        return { isLoggedIn: false, session: null };
    }

    if (!data.session) {
        console.log("not logged in");
        loginModal.dataset.show = "true";
        handleNotLoggedIn(startSession);
        return { isLoggedIn: false, session: null };
    } else {
        delete loginModal.dataset.show;
        startSession(data.session);
        return { isLoggedIn: true, session: data.session };
    }
}

export function setLoginMessage(msg) {
    const loginMessageElem = document.querySelector("#login-message");
    if (!msg) {
        loginMessageElem.innerHTML = "";
        loginMessageElem.style.display = "none";
    } else {
        loginMessageElem.innerHTML = msg;
        loginMessageElem.style.display = "inline";
    }
}

/** @param {(session: import("@supabase/supabase-js").Session) => void} startSession */
async function handleNotLoggedIn(startSession) {
    /** @type {HTMLDivElement} */
    const loginModal = document.querySelector("#login-modal");

    /** @type {HTMLInputElement[]} */
    const [unameInpt, pwdInpt] = loginModal.querySelectorAll("#login-modal input");
    /** @type {HTMLButtonElement[]} */
    const [loginBtn, signupBtn] = loginModal.querySelectorAll("#button-container button");

    /** @type {HTMLImageElement} */
    const profileImage = loginModal.querySelector("img");

    let userExists = false;

    const submitCallback = async () => {
        pwdInpt.removeEventListener("input", passwordInputChangeCB);
        unameInpt.removeEventListener("focusout", usernameInputFocusCB);

        loginBtn.removeEventListener("click", submitCallback);
        signupBtn.removeEventListener("click", submitCallback);

        loginBtn.disabled = signupBtn.disabled = unameInpt.disabled = pwdInpt.disabled = true;

        if (userExists) {
            const { session } = await logInUser(unameInpt.value.trim(), pwdInpt.value);
            if (!session) {
                handleNotLoggedIn(startSession);
            } else {
                delete loginModal.dataset.show;
                startSession(session);
            }
        } else {
            const { session } = await signUpNewUser(unameInpt.value.trim(), pwdInpt.value);
            delete loginModal.dataset.show;
            startSession(session);
        }
    };

    const usernameInputFocusCB = async () => {
        const username = unameInpt.value.trim();
        if (username === "") {
            loginBtn.style.display = "none";
            signupBtn.style.display = "none";
            return;
        }

        const { data, error } = await supabase.from("profiles").select().eq("username", username).limit(1);

        if (error) {
            console.error("error in handleNotLoggedIn() / usernameInputFocusCB()", error);
            return;
        }

        if (data[0]) {
            loginBtn.style.display = "inline";
            signupBtn.style.display = "none";

            userExists = true;
            profileImage.src = data[0].profile_image ?? GENERIC_USER;
        } else {
            loginBtn.style.display = "none";
            signupBtn.style.display = "inline";

            userExists = false;
            profileImage.src = GENERIC_USER;
        }
    };

    const passwordInputChangeCB = () => {
        /** @type {string} */
        const password = pwdInpt.value;
        const submitBtn = userExists ? loginBtn : signupBtn;

        if (password.length < MIN_PWD_LEN) {
            submitBtn.disabled = true;
            pwdInpt.classList.add("invalid");
            setLoginMessage(`Password is not long enough. Must be at least ${MIN_PWD_LEN} characters.`);
        } else {
            submitBtn.disabled = false;
            pwdInpt.classList.remove("invalid");
            setLoginMessage();
        }
    };

    // Reset everything to starting state
    unameInpt.disabled = pwdInpt.disabled = false;
    loginBtn.disabled = signupBtn.disabled = true;
    loginBtn.style.display = signupBtn.style.display = "none";
    pwdInpt.value = "";
    await usernameInputFocusCB();
    pwdInpt.classList.remove("invalid"); // remove it the first time so people actually have a chance to type their password lol
    // -----

    pwdInpt.addEventListener("input", passwordInputChangeCB);
    unameInpt.addEventListener("focusout", usernameInputFocusCB);

    loginBtn.addEventListener("click", submitCallback);
    signupBtn.addEventListener("click", submitCallback);
}

async function signUpNewUser(username, password) {
    const { data, error } = await supabase.auth.signUp({
        email: `${username}@samat.hu`,
        password,
        options: { data: { username, full_name: "TODO" } },
    });

    if (error) {
        console.error("Error in signUpNewUser()", error);
        setLoginMessage("An unknown error occured - check console for details.");
        return;
    }

    console.log("success signing up!", data);
    return { session: data.session };
}

async function logInUser(username, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: `${username}@samat.hu`,
        password,
    });

    if (error) {
        if (error.code === "invalid_credentials") {
            console.log("Provided credentials were invalid");
            setLoginMessage("Password was incorrect.");
            return { session: null };
        }

        console.error("Error in logInUser()", error);
        setLoginMessage("An unknown error occured - check console for details.");
        return { session: null };
    }

    console.log("success logging in!", data);
    return { session: data.session };
}
