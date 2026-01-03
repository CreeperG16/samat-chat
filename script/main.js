import { initAndShowLogin } from "./login-logic.js";
import { supabase } from "./supabase.js";

/** @param {import("@supabase/supabase-js").Session} session */
async function chatSession(session) {
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
        console.error("Error in chatSession() / getUser()", userError);
        return;
    }

    console.log(session);

    // :D
    // const { data, error } = await supabase.from("chats").select();
    // console.log(data)
}

const { isLoggedIn, session } = await initAndShowLogin(chatSession);
