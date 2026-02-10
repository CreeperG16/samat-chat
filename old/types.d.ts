declare interface UserProfile {
    id: string;
    username: string;
    profile_image: string | null;
    created_at: string;
}

declare interface Message {
    id: string;
    chat_id: string;
    author: UserProfile;
    content: string;
    created_at: string;
}

declare interface ClientMessage {
    id: string;
    chat_id: string;
    content: string;
}

declare interface Chat {
    id: string;
    name: string;
    private: boolean;
    members: string[];
    viewers: string[];
    created_at: string;
}

declare interface CacheChannel {
    id: string;
    details: Chat;
    messages: Message[];
    clientMessages: ClientMessage[];
    latestMessageAt: Date | null;
    oldestMessageAt: Date | null;
    lastFetchedAt: Date;
}
