// Persistence for a single-user, on-device journal.
// Entries and goals stay in the browser (private to this device).
// When you add accounts + a database later, swap these two functions
// to call your backend instead — the rest of the app won't change.

export async function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("save failed", e);
  }
}
