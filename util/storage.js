// localStorage can be missing or throw (private mode, blocked site data, quota):
// persistence is a convenience, so failures fall back silently.
export function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Not saved: the app keeps working with what is in memory.
    }
}
