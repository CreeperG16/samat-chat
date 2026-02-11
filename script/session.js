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
}
