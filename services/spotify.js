import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '../helpers/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKENS_FILE = path.join(__dirname, '..', 'data', 'spotify-tokens.json');

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-top-read',
  'user-read-recently-played',
].join(' ');

// ─── In-memory cache so we don't hit disk on every request
let cachedTokens = null;
let lastLoad = 0;

async function ensureDataDir() {
  const dir = path.dirname(TOKENS_FILE);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}

export async function loadTokens(force = false) {
  if (!force && cachedTokens && Date.now() - lastLoad < 5000) return cachedTokens;
  try {
    const content = await fs.readFile(TOKENS_FILE, 'utf-8');
    cachedTokens = JSON.parse(content);
    lastLoad = Date.now();
    return cachedTokens;
  } catch {
    cachedTokens = null;
    return null;
  }
}

export async function saveTokens(tokens) {
  await ensureDataDir();
  const data = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || cachedTokens?.refresh_token,
    expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
    user_id: tokens.user_id || cachedTokens?.user_id,
    saved_at: new Date().toISOString(),
  };
  await fs.writeFile(TOKENS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  cachedTokens = data;
  lastLoad = Date.now();
  return data;
}

export async function clearTokens() {
  cachedTokens = null;
  try { await fs.unlink(TOKENS_FILE); } catch {}
}

// ─── OAuth helpers
export function getAuthUrl(redirectUri, state) {
  if (!SPOTIFY_CLIENT_ID) throw new Error('Spotify not configured (missing SPOTIFY_CLIENT_ID)');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: state || '',
    show_dialog: 'false',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function spotifyTokenRequest(params) {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('Spotify not configured (missing client credentials)');
  }
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.error || `Token request failed: ${res.status}`);
  }
  return res.json();
}

export async function exchangeCode(code, redirectUri) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const tokens = await spotifyTokenRequest(params);
  return saveTokens(tokens);
}

export async function refreshTokens() {
  const tokens = await loadTokens();
  if (!tokens?.refresh_token) throw new Error('No refresh token stored');
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  });
  const fresh = await spotifyTokenRequest(params);
  // Spotify may not return a new refresh_token; reuse the old one
  return saveTokens({
    ...fresh,
    refresh_token: fresh.refresh_token || tokens.refresh_token,
  });
}

/**
 * Returns a valid access_token, refreshing if expired.
 * If no tokens exist at all, returns null.
 */
export async function getValidAccessToken() {
  const tokens = await loadTokens();
  if (!tokens?.access_token) return null;

  // Refresh if expired or expiring within 60 seconds
  if (Date.now() >= tokens.expires_at - 60_000) {
    try {
      const fresh = await refreshTokens();
      return fresh.access_token;
    } catch (err) {
      console.error('Spotify token refresh failed:', err.message);
      return null;
    }
  }
  return tokens.access_token;
}

// ─── Authenticated Spotify API call
async function spotifyApi(method, endpoint, body) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error('Not authenticated with Spotify');

  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://api.spotify.com/v1${endpoint}`;

  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  // Some endpoints return 204 No Content (play/pause/skip)
  if (res.status === 204) return { ok: true };

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || err.message || `Spotify API error: ${res.status}`;
    const error = new Error(msg);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

// ─── High-level API methods
export async function getMe() {
  return spotifyApi('GET', '/me');
}

export async function getPlaylists(limit = 30, offset = 0) {
  return spotifyApi('GET', `/me/playlists?limit=${limit}&offset=${offset}`);
}

export async function getPlaylistTracks(playlistId, limit = 50) {
  return spotifyApi('GET', `/playlists/${playlistId}/tracks?limit=${limit}`);
}

export async function search(query, types = 'track', limit = 10) {
  // Spotify caps search limit at 10 for new dev apps (post Nov 2024 quota changes)
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 10);
  const params = new URLSearchParams({ q: query, type: types, limit: String(safeLimit) });
  return spotifyApi('GET', `/search?${params.toString()}`);
}

export async function getCurrentlyPlaying() {
  try {
    return await spotifyApi('GET', '/me/player/currently-playing');
  } catch (err) {
    if (err.status === 204) return { is_playing: false, item: null };
    throw err;
  }
}

export async function getDevices() {
  return spotifyApi('GET', '/me/player/devices');
}

export async function play({ deviceId, contextUri, uris, positionMs } = {}) {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  const body = {};
  if (contextUri) body.context_uri = contextUri;
  if (uris) body.uris = uris;
  if (positionMs) body.position_ms = positionMs;
  return spotifyApi('PUT', `/me/player/play${params}`, body);
}

export async function pause(deviceId) {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  return spotifyApi('PUT', `/me/player/pause${params}`);
}

export async function next(deviceId) {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  return spotifyApi('POST', `/me/player/next${params}`);
}

export async function previous(deviceId) {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  return spotifyApi('POST', `/me/player/previous${params}`);
}

export async function setVolume(volumePercent, deviceId) {
  const params = new URLSearchParams({ volume_percent: String(Math.round(volumePercent)) });
  if (deviceId) params.set('device_id', deviceId);
  return spotifyApi('PUT', `/me/player/volume?${params.toString()}`);
}

export async function transferPlayback(deviceId, play = true) {
  return spotifyApi('PUT', '/me/player', { device_ids: [deviceId], play });
}

// state: 'off' | 'track' | 'context'
export async function setRepeat(state, deviceId) {
  const params = new URLSearchParams({ state });
  if (deviceId) params.set('device_id', deviceId);
  return spotifyApi('PUT', `/me/player/repeat?${params.toString()}`);
}

export async function setShuffle(on, deviceId) {
  const params = new URLSearchParams({ state: String(!!on) });
  if (deviceId) params.set('device_id', deviceId);
  return spotifyApi('PUT', `/me/player/shuffle?${params.toString()}`);
}

export async function getQueue() {
  return spotifyApi('GET', '/me/player/queue');
}

export async function addToQueue(uri, deviceId) {
  const params = new URLSearchParams({ uri });
  if (deviceId) params.set('device_id', deviceId);
  return spotifyApi('POST', `/me/player/queue?${params.toString()}`);
}

export async function seek(positionMs, deviceId) {
  const params = new URLSearchParams({ position_ms: String(Math.round(positionMs)) });
  if (deviceId) params.set('device_id', deviceId);
  return spotifyApi('PUT', `/me/player/seek?${params.toString()}`);
}

/**
 * Get a track's metadata (includes preview_url if available).
 */
export async function getTrack(trackId) {
  return spotifyApi('GET', `/tracks/${trackId}`);
}

export async function getPlaylist(playlistId) {
  return spotifyApi('GET', `/playlists/${playlistId}`);
}

export async function getAlbum(albumId) {
  return spotifyApi('GET', `/albums/${albumId}`);
}

export async function getArtist(artistId) {
  return spotifyApi('GET', `/artists/${artistId}`);
}

export async function getArtistAlbums(artistId, limit = 10) {
  // Spotify caps this at 10 for new dev apps (post Nov 2024 quota changes)
  const safeLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 10);
  return spotifyApi('GET', `/artists/${artistId}/albums?include_groups=album,single&limit=${safeLimit}`);
}

export async function getSavedTracks(limit = 50, offset = 0) {
  return spotifyApi('GET', `/me/tracks?limit=${limit}&offset=${offset}`);
}

export async function saveTrack(trackId) {
  return spotifyApi('PUT', `/me/tracks?ids=${trackId}`);
}

export async function unsaveTrack(trackId) {
  return spotifyApi('DELETE', `/me/tracks?ids=${trackId}`);
}

export async function checkSavedTracks(trackIds) {
  const ids = Array.isArray(trackIds) ? trackIds.join(',') : trackIds;
  return spotifyApi('GET', `/me/tracks/contains?ids=${ids}`);
}

export async function getTopTracks(limit = 30, timeRange = 'medium_term') {
  return spotifyApi('GET', `/me/top/tracks?limit=${limit}&time_range=${timeRange}`);
}

export async function getTopArtists(limit = 30, timeRange = 'medium_term') {
  return spotifyApi('GET', `/me/top/artists?limit=${limit}&time_range=${timeRange}`);
}

export async function getRecentlyPlayed(limit = 30) {
  return spotifyApi('GET', `/me/player/recently-played?limit=${limit}`);
}

export async function getFeaturedPlaylists(limit = 12) {
  return spotifyApi('GET', `/browse/featured-playlists?limit=${limit}`);
}

export async function getNewReleases(limit = 12) {
  return spotifyApi('GET', `/browse/new-releases?limit=${limit}`);
}

// ─── Playlist management
export async function createPlaylist(userId, { name, description = '', public: isPublic = false }) {
  return spotifyApi('POST', `/users/${userId}/playlists`, { name, description, public: isPublic });
}

export async function updatePlaylist(playlistId, { name, description, public: isPublic }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (description !== undefined) body.description = description;
  if (isPublic !== undefined) body.public = isPublic;
  return spotifyApi('PUT', `/playlists/${playlistId}`, body);
}

export async function addTracksToPlaylist(playlistId, uris) {
  return spotifyApi('POST', `/playlists/${playlistId}/tracks`, { uris });
}

export async function removeTracksFromPlaylist(playlistId, uris) {
  return spotifyApi('DELETE', `/playlists/${playlistId}/tracks`, {
    tracks: uris.map(uri => ({ uri })),
  });
}

export async function unfollowPlaylist(playlistId) {
  return spotifyApi('DELETE', `/playlists/${playlistId}/followers`);
}

export async function followPlaylist(playlistId) {
  return spotifyApi('PUT', `/playlists/${playlistId}/followers`, { public: false });
}

/**
 * Stream the 30-second preview through the BE (so the FE just gets bytes, no Spotify call).
 * Returns { stream: ReadableStream, contentType: string, contentLength: string }
 * Throws if the track has no preview_url.
 */
export async function streamPreview(trackId) {
  const track = await getTrack(trackId);
  if (!track.preview_url) {
    const err = new Error('No 30-second preview available for this track');
    err.status = 404;
    throw err;
  }
  const previewRes = await fetch(track.preview_url);
  if (!previewRes.ok) {
    const err = new Error(`Preview fetch failed: ${previewRes.status}`);
    err.status = previewRes.status;
    throw err;
  }
  return {
    stream: previewRes.body,
    contentType: previewRes.headers.get('content-type') || 'audio/mpeg',
    contentLength: previewRes.headers.get('content-length'),
    track: {
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      preview_url: track.preview_url,
    },
  };
}

export async function isAuthenticated() {
  const token = await getValidAccessToken();
  return !!token;
}
