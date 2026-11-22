import { auth, isGuestSessionActive } from './auth';

const GUEST_CLIENT_ID_KEY = 'bizmind_guest_client_id_v1';

function getGuestClientId(): string {
  try {
    let id = localStorage.getItem(GUEST_CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return 'guest-ephemeral';
  }
}

/**
 * Authenticated fetch wrapper for all /api/* calls.
 * Sends Firebase ID Token for signed-in users, or scoped guest session header
 * in Guest Mode so the backend can enforce proper auth & tiered rate limiting.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-BizMind-Client', 'web-2.1');

  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch {
      // fallback if token refresh fails transiently
    }
  } else if (isGuestSessionActive()) {
    headers.set('X-BizMind-Guest-Session', getGuestClientId());
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
