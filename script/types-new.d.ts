declare interface UserProfile {
    id: string;
    username: string;
    profile_image: string | null;
    created_at: string;
}

declare interface Message {
    id: string;
    chat_id: string;
    author_id: string;
    content: string;
    created_at: string;
}

declare interface Chat {
    id: string;
    name: string;
    private: boolean;
    members: string[];
    chat_members: { profiles: UserProfile }[];
    messages: Message[]; // LAST MESSAGE
    viewers: string[];
    created_at: string;
}
