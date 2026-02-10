/** @type {Map<string, CacheChannel>} */
const channelCacheMap = new Map();

export const channelCache = () => channelCacheMap;

/** @type {import("@supabase/supabase-js").User | null} */
let currentUser = null;
export const getCurrentUser = () => currentUser;
/** @param {import("@supabase/supabase-js").User} u */
export const setCurrentUser = (u) => (currentUser = u);

/** @type {Map<string, import("@supabase/supabase-js").RealtimeChannel>} */
const chatSocketMap = new Map();

export const chatSockets = () => chatSocketMap;

/** @param {CacheChannel} cacheChannel */
export function updateCacheMessages(cacheChannel) {
    // cacheChannel.

    cacheChannel.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (cacheChannel.messages.length === 0) return;

    cacheChannel.latestMessageAt = new Date(cacheChannel.messages.at(-1).created_at);
    cacheChannel.oldestMessageAt = new Date(cacheChannel.messages.at(0).created_at);
}
