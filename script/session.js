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

// TODO: THIS IS VERY JANK - SOLIDIFY ASAP!
// HASTILY PUT TOGETHER
// JUST TO FINALLY SEE MESSAGES IN THE MESSAGE APP
// along with /script/pages/chat-view.js
// and realtime channel code in /script/main.js main()

/**
 * @typedef {{
 *  messages: any[];
 *  latestMessageAt: Date | null;
 *  oldestMessageAt: Date | null;
 *  lastFetchedAt: Date | null;
 * }} ChannelCacheEntry
 */

/**
 * @type {Map<string, ChannelCacheEntry>}
 */
export const channelCache = new Map();

/** @param {ChannelCacheEntry} cacheEntry */
function updateCacheMessages(cacheEntry) {
    cacheEntry.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (cacheEntry.messages.length === 0) {
        cacheEntry.latestMessageAt = null;
        cacheEntry.oldestMessageAt = null;
        return;
    }

    cacheEntry.messages = cacheEntry.messages.filter((x, i, a) => i === a.findIndex(y => y.id === x.id));
    cacheEntry.latestMessageAt = new Date(cacheEntry.messages.at(-1).created_at);
    cacheEntry.oldestMessageAt = new Date(cacheEntry.messages.at(0).created_at);
}

export function addMsgsToCache(chatId, ...messages) {
    const channelCacheEntry = channelCache.get(chatId);
    if (!channelCacheEntry) {
        // TODO: ?
        return false;
    }
    
    channelCacheEntry.messages.push(...messages);
    updateCacheMessages(channelCacheEntry);
}

export function removeMsgsFromCache(chatId, ...messages) {
    const channelCacheEntry = channelCache.get(chatId);
    if (!channelCacheEntry) {
        // TODO: ?
        return false;
    }

    channelCacheEntry.messages = channelCacheEntry.messages.filter(
        (x) => !messages.map((toDelete) => toDelete.id).includes(x.id)
    );
    updateCacheMessages(channelCacheEntry);
}
