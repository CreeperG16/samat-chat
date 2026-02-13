import { currentChat, showError } from "./misc.js";
import { renderMessages } from "./pages/chat-view.js";
import { renderDMCards } from "./pages/messages.js";
import { supabase } from "./supabase.js";

/**
 * @type {{
 *  session: import("@supabase/supabase-js").Session;
 *  user: import("@supabase/supabase-js").User;
 *  profile: {
 *      id: string;
 *      username: string;
 *      profile_image: string | null;
 *      display_name: string;
 *  }
 * }}
 */
const currentSession = {
    session: null,
    user: null,
    profile: null,
};

export const session = {
    get: () => currentSession,
    setSession: (s) => (currentSession.session = s),
    setUser: (u) => (currentSession.user = u),
    setProfile: (p) => (currentSession.profile = p),
};

export async function initSession() {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
        showError("session.js / initSession() / supabase.auth.getSession()", sessionErr);
        window.location.href = "/login";
        return false;
    }

    if (!sessionData.session) {
        console.log("Not logged in");
        window.location.href = "/login";
        return false;
    }

    const { data: hasValidSession, error: deviceSessionErr } = await supabase.rpc("valid_device_session");
    if (deviceSessionErr) {
        showError("session.js / initSession() / valid_device_session()", deviceSessionErr);
        await supabase.auth.signOut();
        window.location.href = "/login";
        return false;
    }

    if (!hasValidSession) {
        console.log("No valid device session");
        await supabase.auth.signOut();
        window.location.href = "/login";
        return false;
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
        showError("session.js / initSession() / supabase.auth.getUser()", userErr);
        console.error("Failed to get user????");
        return false;
    }

    const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select()
        .eq("id", userData.user.id)
        .limit(1)
        .single();

    if (profileErr) {
        showError("session.js / initSession() / select ... from profiles", profileErr);
        return false;
    }

    supabase.realtime.setAuth(sessionData.session.access_token);
    supabase.functions.setAuth(sessionData.session.access_token);

    session.setSession(sessionData.session);
    session.setUser(userData.user);
    session.setProfile(profile);

    return true;
}

// TODO: THIS IS VERY JANK - SOLIDIFY ASAP!
// HASTILY PUT TOGETHER
// JUST TO FINALLY SEE MESSAGES IN THE MESSAGE APP
// along with /script/pages/chat-view.js

/**
 * @typedef {{
 *  id: string;
 *  details: any;
 *  messages: any[];
 *  latestMessageAt: Date | null;
 *  oldestMessageAt: Date | null;
 *  lastFetchedAt: Date | null;
 *  updatedAt: Date | null;
 * }} ChannelCacheEntry
 */

/**
 * @type {Map<string, ChannelCacheEntry>}
 */
const channelCacheMap = new Map();

export const channelCache = {
    get: (chatId) => channelCacheMap.get(chatId),
    getAll: () => [...channelCacheMap.values()],
    addChannel: (chat) => addChannelToCache(chat),
    addMessages: (chatId, ...messages) => addMsgsToCache(chatId, ...messages),
    removeMessages: (chatId, ...messages) => removeMsgsFromCache(chatId, ...messages),
    updateEntry: (chatId) => updateCacheEntry(chatId),
};

// TODO: return values????
function updateCacheEntry(chatId) {
    const cacheEntry = channelCacheMap.get(chatId);
    if (!cacheEntry) return false;

    cacheEntry.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (cacheEntry.messages.length === 0) {
        cacheEntry.latestMessageAt = null;
        cacheEntry.oldestMessageAt = null;
        return true;
    }

    cacheEntry.messages = cacheEntry.messages.filter((x, i, a) => i === a.findIndex((y) => y.id === x.id));
    cacheEntry.latestMessageAt = new Date(cacheEntry.messages.at(-1).created_at);
    cacheEntry.oldestMessageAt = new Date(cacheEntry.messages.at(0).created_at);

    // Redundant? :c
    // latestMessageAt doesn't exist if there are no messages
    // updatedAt should still exist
    // (if the channel is new, then it's the channel's created_at)
    // (if all the messages have been deleted, then it should retain the
    //  last message's created_at, even though it's been deleted)
    if (cacheEntry.latestMessageAt) cacheEntry.updatedAt = cacheEntry.latestMessageAt;

    return true;
}

// CHAT IS ROW FROM DATABASE
function addChannelToCache(chat) {
    const entry = {
        id: chat.id,
        details: chat,
        updatedAt: new Date(chat.updated_at),
        messages: [],
        lastFetchedAt: null,
        latestMessageAt: null,
        oldestMessageAt: null,
    };

    channelCacheMap.set(chat.id, entry);
    return entry;
}

function addMsgsToCache(chatId, ...messages) {
    const channelCacheEntry = channelCacheMap.get(chatId);
    if (!channelCacheEntry) {
        // TODO
        return;
    }

    channelCacheEntry.messages.push(...messages);
    updateCacheEntry(chatId);
}

function removeMsgsFromCache(chatId, ...messages) {
    const channelCacheEntry = channelCacheMap.get(chatId);
    if (!channelCacheEntry) {
        // TODO
        return;
    }

    channelCacheEntry.messages = channelCacheEntry.messages.filter(
        (x) => !messages.map((toDelete) => toDelete.id).includes(x.id)
    );
    updateCacheEntry(chatId);
}

const realtimeChannels = new Map();

// Callback called on new message realtime event
function handleMsgEvent({ event, payload: { message } }) {
    const cacheEntry = channelCache.get(message.chat_id);
    if (!cacheEntry) {
        console.warn("Message received for unknown channel '%s'.", chat_id);
        return;
    }

    const currentChatId = currentChat();
    switch (event) {
        case "message-create":
            channelCache.addMessages(message.chat_id, message);
            break;
        case "message-delete":
            channelCache.removeMessages(message.chat_id, message);
            break;
    }

    if (currentChatId === message.chat_id) renderMessages(cacheEntry.messages);
    if (["direct", "group"].includes(cacheEntry.details.type)) renderDMCards();
}

// Subscribe to realtime topic for chat ID
export function subscribeToChat(chatId) {
    const rChannel = supabase.realtime.channel(`chat:${chatId}`, { config: { private: true } });
    rChannel
        .on("broadcast", { event: "message-create" }, handleMsgEvent)
        .on("broadcast", { event: "message-delete" }, handleMsgEvent)
        .subscribe();

    realtimeChannels.set(chatId, rChannel);
}
