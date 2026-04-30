import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import * as Spotify from '../../services/spotify.js';
import { FRONTEND_URL, PROD_FRONTEND_URL } from '../../helpers/constants.js';

// Detect which frontend URL the request came from (for redirects + redirect_uri matching)
function detectFrontendUrl(req) {
  const origin = req.get('origin') || req.get('referer') || '';
  if (PROD_FRONTEND_URL && origin.includes(new URL(PROD_FRONTEND_URL).host)) return PROD_FRONTEND_URL;
  return FRONTEND_URL;
}

function getRedirectUri(req) {
  const fe = detectFrontendUrl(req);
  return `${fe}/api/spotify/callback`;
}

// ─── GET /api/spotify/auth-url
// Returns a Spotify auth URL with redirect_uri pointing back to the FE callback
export const getAuthUrl = async (req, res) => {
  try {
    const redirectUri = getRedirectUri(req);
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const url = Spotify.getAuthUrl(redirectUri, state);
    return responseHelper.success(res, { url, state, redirectUri });
  } catch (err) {
    logger.error(`Spotify auth-url error: ${err.message}`);
    return responseHelper.error(res, err.message, 500);
  }
};

// ─── POST /api/spotify/exchange  body: { code, redirectUri }
// Exchanges the OAuth code for tokens, stores them, returns user profile
export const postExchange = async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code) return responseHelper.error(res, 'code is required', 400);
    if (!redirectUri) return responseHelper.error(res, 'redirectUri is required', 400);

    await Spotify.exchangeCode(code, redirectUri);
    const profile = await Spotify.getMe();
    logger.info(`Spotify connected | user=${profile.id} | product=${profile.product}`);

    return responseHelper.success(res, {
      authenticated: true,
      profile: {
        id: profile.id,
        display_name: profile.display_name,
        email: profile.email,
        image: profile.images?.[0]?.url || null,
        product: profile.product,
        country: profile.country,
      },
    }, 'Spotify connected');
  } catch (err) {
    logger.error(`Spotify exchange error: ${err.message}`);
    return responseHelper.error(res, err.message, 500);
  }
};

// ─── GET /api/spotify/me
export const getProfile = async (req, res) => {
  try {
    const authed = await Spotify.isAuthenticated();
    if (!authed) return responseHelper.success(res, { authenticated: false });

    const profile = await Spotify.getMe();
    return responseHelper.success(res, {
      authenticated: true,
      profile: {
        id: profile.id,
        display_name: profile.display_name,
        email: profile.email,
        image: profile.images?.[0]?.url || null,
        product: profile.product,
        country: profile.country,
      },
    });
  } catch (err) {
    logger.error(`Spotify me error: ${err.message}`);
    return responseHelper.success(res, { authenticated: false, error: err.message });
  }
};

// ─── GET /api/spotify/token
// Returns the current access_token for the Web Playback SDK
export const getToken = async (req, res) => {
  try {
    const token = await Spotify.getValidAccessToken();
    if (!token) return responseHelper.error(res, 'not_authenticated', 401);
    return responseHelper.success(res, { access_token: token });
  } catch (err) {
    logger.error(`Spotify token error: ${err.message}`);
    return responseHelper.error(res, err.message, 500);
  }
};

// ─── POST /api/spotify/logout
export const postLogout = async (req, res) => {
  try {
    await Spotify.clearTokens();
    return responseHelper.success(res, { ok: true }, 'Logged out');
  } catch (err) {
    return responseHelper.error(res, err.message, 500);
  }
};

// ─── GET /api/spotify/playlists
export const getPlaylists = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const offset = parseInt(req.query.offset) || 0;
    const data = await Spotify.getPlaylists(limit, offset);
    return responseHelper.success(res, data);
  } catch (err) {
    logger.error(`Spotify playlists error: ${err.message}`);
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/search?q=...&type=track,artist
export const getSearch = async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return responseHelper.error(res, 'q is required', 400);
    const type = req.query.type || 'track';
    const limit = parseInt(req.query.limit) || 20;
    const data = await Spotify.search(q, type, limit);
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/now-playing
export const getNowPlaying = async (req, res) => {
  try {
    const data = await Spotify.getCurrentlyPlaying();
    return responseHelper.success(res, data || { is_playing: false, item: null });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/devices
export const getDevices = async (req, res) => {
  try {
    const data = await Spotify.getDevices();
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/play  body: { deviceId, contextUri, uris, positionMs }
export const postPlay = async (req, res) => {
  try {
    await Spotify.play(req.body || {});
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/pause
export const postPause = async (req, res) => {
  try {
    await Spotify.pause(req.body?.deviceId);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/next
export const postNext = async (req, res) => {
  try {
    await Spotify.next(req.body?.deviceId);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/previous
export const postPrevious = async (req, res) => {
  try {
    await Spotify.previous(req.body?.deviceId);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/volume  body: { volumePercent, deviceId }
export const postVolume = async (req, res) => {
  try {
    const { volumePercent, deviceId } = req.body || {};
    if (typeof volumePercent !== 'number') return responseHelper.error(res, 'volumePercent (0-100) required', 400);
    await Spotify.setVolume(volumePercent, deviceId);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/repeat  body: { state, deviceId }   state: off|track|context
export const postRepeat = async (req, res) => {
  try {
    const { state, deviceId } = req.body || {};
    if (!['off', 'track', 'context'].includes(state)) return responseHelper.error(res, 'state must be off/track/context', 400);
    await Spotify.setRepeat(state, deviceId);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/shuffle  body: { state: bool, deviceId }
export const postShuffle = async (req, res) => {
  try {
    const { state, deviceId } = req.body || {};
    await Spotify.setShuffle(!!state, deviceId);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/queue
export const getQueue = async (req, res) => {
  try {
    const data = await Spotify.getQueue();
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/queue  body: { uri, deviceId }
export const postQueue = async (req, res) => {
  try {
    const { uri, deviceId } = req.body || {};
    if (!uri) return responseHelper.error(res, 'uri required', 400);
    await Spotify.addToQueue(uri, deviceId);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/transfer  body: { deviceId, play }
export const postTransfer = async (req, res) => {
  try {
    const { deviceId, play = true } = req.body || {};
    if (!deviceId) return responseHelper.error(res, 'deviceId required', 400);
    await Spotify.transferPlayback(deviceId, play);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/playlist/:id
export const getPlaylist = async (req, res) => {
  try {
    const data = await Spotify.getPlaylist(req.params.id);
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/album/:id
export const getAlbum = async (req, res) => {
  try {
    const data = await Spotify.getAlbum(req.params.id);
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/artist/:id
export const getArtist = async (req, res) => {
  try {
    const [artist, albums] = await Promise.all([
      Spotify.getArtist(req.params.id),
      Spotify.getArtistAlbums(req.params.id, 10).catch((err) => { console.warn('Artist albums failed:', err.message); return { items: [] }; }),
    ]);
    return responseHelper.success(res, { ...artist, albums });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/saved-tracks
export const getSavedTracks = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const data = await Spotify.getSavedTracks(limit, offset);
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── PUT /api/spotify/saved-tracks/:id  (save / like)
export const putSavedTrack = async (req, res) => {
  try {
    await Spotify.saveTrack(req.params.id);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── DELETE /api/spotify/saved-tracks/:id  (unsave)
export const deleteSavedTrack = async (req, res) => {
  try {
    await Spotify.unsaveTrack(req.params.id);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/saved-tracks/check?ids=...
export const checkSavedTracks = async (req, res) => {
  try {
    const ids = req.query.ids;
    if (!ids) return responseHelper.error(res, 'ids required', 400);
    const data = await Spotify.checkSavedTracks(ids);
    return responseHelper.success(res, { saved: data });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/top-tracks
export const getTopTracks = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const timeRange = req.query.time_range || 'medium_term';
    const data = await Spotify.getTopTracks(limit, timeRange);
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/top-artists
export const getTopArtists = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const timeRange = req.query.time_range || 'medium_term';
    const data = await Spotify.getTopArtists(limit, timeRange);
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/recently-played
export const getRecentlyPlayed = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const data = await Spotify.getRecentlyPlayed(limit);
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/featured-playlists
export const getFeaturedPlaylists = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;
    const data = await Spotify.getFeaturedPlaylists(limit);
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/new-releases
export const getNewReleases = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;
    const data = await Spotify.getNewReleases(limit);
    return responseHelper.success(res, data);
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/create-playlist  body: { name, description?, public? }
export const postCreatePlaylist = async (req, res) => {
  try {
    const { name, description, public: isPublic } = req.body || {};
    if (!name) return responseHelper.error(res, 'name required', 400);
    const me = await Spotify.getMe();
    const data = await Spotify.createPlaylist(me.id, { name, description, public: isPublic });
    return responseHelper.success(res, data, 'Playlist created');
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── PUT /api/spotify/playlist/:id  body: { name?, description?, public? }
export const putUpdatePlaylist = async (req, res) => {
  try {
    await Spotify.updatePlaylist(req.params.id, req.body || {});
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── POST /api/spotify/playlist/:id/tracks  body: { uris: [...] }
export const postAddTracks = async (req, res) => {
  try {
    const { uris } = req.body || {};
    if (!Array.isArray(uris) || !uris.length) return responseHelper.error(res, 'uris array required', 400);
    const data = await Spotify.addTracksToPlaylist(req.params.id, uris);
    return responseHelper.success(res, data, 'Tracks added');
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── DELETE /api/spotify/playlist/:id/tracks  body: { uris: [...] }
export const deletePlaylistTracks = async (req, res) => {
  try {
    const { uris } = req.body || {};
    if (!Array.isArray(uris) || !uris.length) return responseHelper.error(res, 'uris array required', 400);
    await Spotify.removeTracksFromPlaylist(req.params.id, uris);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── DELETE /api/spotify/playlist/:id/follow  (unfollow / "delete")
export const deletePlaylistFollow = async (req, res) => {
  try {
    await Spotify.unfollowPlaylist(req.params.id);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── PUT /api/spotify/playlist/:id/follow
export const putPlaylistFollow = async (req, res) => {
  try {
    await Spotify.followPlaylist(req.params.id);
    return responseHelper.success(res, { ok: true });
  } catch (err) {
    return responseHelper.error(res, err.message, err.status || 500);
  }
};

// ─── GET /api/spotify/preview/:trackId
// Streams the 30s preview through the BE so the FE just plays/saves bytes.
// query ?download=1 → forces Content-Disposition attachment for download
export const getPreview = async (req, res) => {
  try {
    const { trackId } = req.params;
    if (!trackId) return responseHelper.error(res, 'trackId required', 400);

    const { stream, contentType, contentLength, track } = await Spotify.streamPreview(trackId);

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');

    if (req.query.download === '1') {
      const filename = `${track.artists} - ${track.name}.mp3`.replace(/[^\w\s.-]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    // Pipe Web stream → Node response
    if (stream.pipeTo) {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } else {
      stream.pipe(res);
    }
  } catch (err) {
    logger.error(`Spotify preview error: ${err.message}`);
    return responseHelper.error(res, err.message, err.status || 500);
  }
};
