const CLIENT_ID_STORAGE_KEY = 'noir_spotify_client_id';
const TOKEN_STORAGE_KEY = 'noir_spotify_session_token';
const STATE_STORAGE_KEY = 'noir_spotify_oauth_state';
const VERIFIER_STORAGE_KEY = 'noir_spotify_pkce_verifier';
const RETURN_PATH_STORAGE_KEY = 'noir_spotify_return_path';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const AUTH_SCOPES = ['playlist-read-private', 'playlist-read-collaborative', 'user-read-private'];
let oauthCallbackPromise = null;

const configuredClientId = () => String(import.meta.env.VITE_SPOTIFY_CLIENT_ID || '').trim();

const getClientId = () => {
  try {
    return localStorage.getItem(CLIENT_ID_STORAGE_KEY) || configuredClientId();
  } catch {
    return configuredClientId();
  }
};
const saveClientId = (clientId) => {
  const normalizedId = String(clientId || '').trim();
  if (!normalizedId) throw new Error('Enter your Spotify app Client ID to continue.');
  const previousId = getClientId();
  if (normalizedId === configuredClientId()) {
    try { localStorage.removeItem(CLIENT_ID_STORAGE_KEY); } catch { /* Environment configuration remains usable. */ }
    if (previousId && previousId !== normalizedId) sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return normalizedId;
  }
  try {
    if (previousId && previousId !== normalizedId) sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, normalizedId);
  } catch {
    throw new Error('Your browser could not save the Spotify Client ID. Check its storage settings and try again.');
  }
  return normalizedId;
};

const getRedirectUri = () => `${window.location.origin}${window.location.pathname}`;

const randomString = (length) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return [...values].map(value => alphabet[value % alphabet.length]).join('');
};

const createCodeChallenge = async (verifier) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const readToken = () => {
  try {
    const value = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const saveToken = (token) => {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  return token;
};

const requestToken = async (body) => {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error?.message || 'Spotify could not authorize NOIR. Please connect again.');
  }
  return saveToken({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || readToken()?.refreshToken || '',
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000
  });
};

const getFreshAccessToken = async ({ forceRefresh = false } = {}) => {
  const token = readToken();
  if (!token) return null;
  if (!forceRefresh && token.accessToken && token.expiresAt > Date.now() + 60_000) return token.accessToken;
  if (!token.refreshToken) return null;
  const refreshed = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    client_id: getClientId()
  });
  return refreshed.accessToken || null;
};

const spotifyRequest = async (url, { retry = true } = {}) => {
  const requestUrl = new URL(url, SPOTIFY_API_BASE);
  if (requestUrl.origin !== SPOTIFY_API_BASE) throw new Error('Spotify returned an invalid playlist page.');
  const accessToken = await getFreshAccessToken();
  if (!accessToken) throw new Error('Connect Spotify before importing a playlist.');
  const response = await fetch(requestUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 401 && retry) {
    const refreshedToken = await getFreshAccessToken({ forceRefresh: true });
    if (refreshedToken) return spotifyRequest(requestUrl.toString(), { retry: false });
  }
  if (!response.ok) {
    if (response.status === 403) throw new Error('Spotify could not share this playlist. It must be one of your playlists or a playlist you collaborate on.');
    if (response.status === 429) throw new Error('Spotify is receiving too many requests. Wait a moment and try again.');
    throw new Error(`Spotify playlist request failed (${response.status}). Please try again.`);
  }
  return response.json();
};

const fetchAllPages = async (initialUrl) => {
  const results = [];
  let url = initialUrl;
  const visitedUrls = new Set();
  while (url) {
    if (visitedUrls.has(url)) throw new Error('Spotify returned a repeated playlist page. Please refresh and try again.');
    visitedUrls.add(url);
    const data = await spotifyRequest(url);
    if (Array.isArray(data.items)) results.push(...data.items);
    url = typeof data.next === 'string' ? data.next : null;
  }
  return results;
};

const completeOAuthCallback = () => {
  if (oauthCallbackPromise) return oauthCallbackPromise;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const returnedState = params.get('state');
  const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  const returnPath = sessionStorage.getItem(RETURN_PATH_STORAGE_KEY) || '#/explore';

  window.history.replaceState({}, document.title, window.location.pathname);
  if (returnPath) window.location.hash = returnPath.startsWith('#') ? returnPath : `#${returnPath}`;
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(RETURN_PATH_STORAGE_KEY);

  if (error) throw new Error(error === 'access_denied' ? 'Spotify connection was cancelled.' : 'Spotify could not authorize NOIR.');
  if (!code || !verifier || !expectedState || returnedState !== expectedState) {
    throw new Error('Spotify sign-in expired or could not be verified. Please connect again.');
  }

  oauthCallbackPromise = requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: getClientId(),
    code_verifier: verifier
  }).finally(() => {
    oauthCallbackPromise = null;
  });

  return oauthCallbackPromise;
};

export const spotifyImport = {
  getClientId,
  saveClientId,
  getRedirectUri,
  hasOAuthCallback: () => {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('code') || params.get('error'));
  },
  isCompletingOAuthCallback: () => Boolean(oauthCallbackPromise),
  isConnected: () => Boolean(readToken()?.accessToken),

  connect: async () => {
    const clientId = getClientId();
    if (!clientId) throw new Error('Add your Spotify Client ID before connecting.');
    const verifier = randomString(64);
    const state = randomString(32);
    const challenge = await createCodeChallenge(verifier);
    sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
    sessionStorage.setItem(STATE_STORAGE_KEY, state);
    sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, `${window.location.hash || '#/explore'}`);

    const authorizationUrl = new URL('https://accounts.spotify.com/authorize');
    authorizationUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      scope: AUTH_SCOPES.join(' '),
      state,
      code_challenge_method: 'S256',
      code_challenge: challenge
    });
    window.location.assign(authorizationUrl.toString());
  },

  completeOAuthCallback,

  getPlaylists: async () => {
    const [profile, playlists] = await Promise.all([
      spotifyRequest(`${SPOTIFY_API_BASE}/me`),
      fetchAllPages(`${SPOTIFY_API_BASE}/me/playlists?limit=50`)
    ]);
    return playlists.filter(playlist =>
      playlist?.id && playlist?.name &&
      (playlist.owner?.id === profile.id || playlist.collaborative === true)
    );
  },

  getPlaylistItems: async (playlistId) => {
    if (!playlistId) return [];
    const items = await fetchAllPages(`${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(playlistId)}/items?limit=50&additional_types=track`);
    return items
      .map(entry => entry?.item || entry?.track)
      .filter(track => track?.name && Array.isArray(track.artists) && track.type !== 'episode')
      .map(track => ({
        title: track.name,
        artists: track.artists.map(artist => artist?.name).filter(Boolean),
        durationMs: Number(track.duration_ms) || 0,
        spotifyId: track.id || '',
        spotifyUrl: track.external_urls?.spotify || ''
      }));
  },

  disconnect: () => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};
