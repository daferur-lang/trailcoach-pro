// Strava API v3 — OAuth 2.0 + Activities
const STRAVA_API   = 'https://www.strava.com/api/v3';
const TOKEN_URL    = 'https://www.strava.com/oauth/token';
const AUTH_URL     = 'https://www.strava.com/oauth/authorize';
const CACHE_KEY    = 'tc_activities';
const TOKENS_KEY   = 'tc_strava_tokens';
const ATHLETE_KEY  = 'tc_strava_athlete';

export class StravaClient {
  constructor() {
    this.tokens   = JSON.parse(localStorage.getItem(TOKENS_KEY) || 'null');
    this.athlete  = JSON.parse(localStorage.getItem(ATHLETE_KEY) || 'null');
    this._config  = null;
  }

  setConfig(config) {
    this._config = config;
  }

  isConnected() {
    return !!(this.tokens && this.tokens.access_token);
  }

  getAthlete() {
    return this.athlete;
  }

  // Build OAuth redirect URL
  getAuthUrl() {
    const redirectUri = this._getRedirectUri();
    const params = new URLSearchParams({
      client_id:     this._config.clientId,
      redirect_uri:  redirectUri,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: 'read,activity:read_all'
    });
    return `${AUTH_URL}?${params}`;
  }

  _getRedirectUri() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash   = '';
    return url.toString();
  }

  // Exchange authorization code for tokens
  async exchangeCode(code) {
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     this._config.clientId,
        client_secret: this._config.clientSecret,
        code,
        grant_type: 'authorization_code'
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `Auth failed: ${resp.status}`);
    }
    const data = await resp.json();
    this._saveTokens(data);
    if (data.athlete) {
      this.athlete = data.athlete;
      localStorage.setItem(ATHLETE_KEY, JSON.stringify(data.athlete));
    }
    return data;
  }

  // Refresh expired access token
  async refreshToken() {
    if (!this.tokens?.refresh_token) throw new Error('No refresh token');
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     this._config.clientId,
        client_secret: this._config.clientSecret,
        grant_type:    'refresh_token',
        refresh_token: this.tokens.refresh_token
      })
    });
    if (!resp.ok) throw new Error('Token refresh failed');
    const data = await resp.json();
    this._saveTokens(data);
    return data;
  }

  _saveTokens(data) {
    this.tokens = {
      access_token:  data.access_token,
      refresh_token: data.refresh_token || this.tokens?.refresh_token,
      expires_at:    data.expires_at
    };
    localStorage.setItem(TOKENS_KEY, JSON.stringify(this.tokens));
  }

  async _getValidToken() {
    if (!this.tokens) throw new Error('Not authenticated');
    const now = Math.floor(Date.now() / 1000);
    if (this.tokens.expires_at < now + 300) {
      await this.refreshToken();
    }
    return this.tokens.access_token;
  }

  async _get(path, params = {}) {
    const token = await this._getValidToken();
    const url = new URL(`${STRAVA_API}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (resp.status === 429) throw new Error('Límite de Strava alcanzado. Espera 15 min.');
    if (!resp.ok) throw new Error(`Strava error ${resp.status}`);
    return resp.json();
  }

  // Fetch athlete profile
  async fetchAthlete() {
    const data = await this._get('/athlete');
    this.athlete = data;
    localStorage.setItem(ATHLETE_KEY, JSON.stringify(data));
    return data;
  }

  // Fetch all activities (paginated), cache results
  async fetchActivities({ onProgress } = {}) {
    const allActivities = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const batch = await this._get('/athlete/activities', { per_page: perPage, page });
      if (!batch.length) break;
      allActivities.push(...batch);
      if (onProgress) onProgress(allActivities.length);
      if (batch.length < perPage) break;
      page++;
    }

    // Normalize & cache
    const normalized = allActivities.map(a => this._normalizeActivity(a));
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: normalized }));
    return normalized;
  }

  // Get cached activities, refresh if older than 1 hour
  getCachedActivities() {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    return data;
  }

  getCacheAge() {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts } = JSON.parse(raw);
    return Math.floor((Date.now() - ts) / 60000); // minutes
  }

  _normalizeActivity(a) {
    return {
      id:             a.id,
      name:           a.name,
      type:           a.type,
      sport_type:     a.sport_type || a.type,
      start_date:     a.start_date,
      start_date_local: a.start_date_local,
      distance:       a.distance,             // meters
      moving_time:    a.moving_time,          // seconds
      elapsed_time:   a.elapsed_time,         // seconds
      total_elevation_gain: a.total_elevation_gain || 0,
      average_speed:  a.average_speed,        // m/s
      max_speed:      a.max_speed,
      average_heartrate: a.average_heartrate,
      max_heartrate:  a.max_heartrate,
      kudos_count:    a.kudos_count,
      trainer:        a.trainer,
      manual:         a.manual,
      map:            a.map ? { summary_polyline: a.map.summary_polyline } : null
    };
  }

  isTrailOrRun(activity) {
    const t = (activity.sport_type || activity.type || '').toLowerCase();
    return t.includes('run') || t.includes('trail') || t.includes('hike');
  }

  disconnect() {
    localStorage.removeItem(TOKENS_KEY);
    localStorage.removeItem(ATHLETE_KEY);
    localStorage.removeItem(CACHE_KEY);
    this.tokens  = null;
    this.athlete = null;
  }
}

// Formatting helpers
export function formatPace(speedMs) {
  if (!speedMs || speedMs <= 0) return '—';
  const secPerKm = 1000 / speedMs;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function formatTime(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDistance(meters) {
  if (!meters) return '—';
  return (meters / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
}

export function formatElevation(m) {
  if (!m && m !== 0) return '—';
  return Math.round(m) + ' m';
}

export function activityTypeLabel(activity) {
  const t = (activity.sport_type || activity.type || '').toLowerCase();
  if (t.includes('trail'))  return 'Trail';
  if (t.includes('run'))    return 'Carrera';
  if (t.includes('hike'))   return 'Senderismo';
  if (t.includes('ride'))   return 'Ciclismo';
  if (t.includes('swim'))   return 'Natación';
  return activity.sport_type || activity.type || 'Actividad';
}

export function activityTypeClass(activity) {
  const t = (activity.sport_type || activity.type || '').toLowerCase();
  if (t.includes('trail')) return 'tag-trail';
  if (t.includes('run'))   return 'tag-run';
  return 'tag-other';
}
