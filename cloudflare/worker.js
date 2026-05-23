/**
 * TrailCoach Pro — Cloudflare Worker
 * Proxy seguro para el intercambio de tokens OAuth de Strava.
 * El client_secret nunca llega al navegador.
 *
 * Variables de entorno requeridas (wrangler secret put):
 *   STRAVA_CLIENT_ID
 *   STRAVA_CLIENT_SECRET
 *   ALLOWED_ORIGIN   (opcional, ej: https://daferur-lang.github.io)
 */

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const allowed = env.ALLOWED_ORIGIN || '*';

    const CORS = {
      'Access-Control-Allow-Origin':  allowed === '*' ? '*' : origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age':       '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, CORS);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400, CORS);
    }

    const { grant_type, code, refresh_token } = body;

    if (!grant_type) {
      return json({ error: 'grant_type required' }, 400, CORS);
    }

    // Build Strava token request
    const stravaBody = {
      client_id:     env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type,
    };

    if (grant_type === 'authorization_code') {
      if (!code) return json({ error: 'code required' }, 400, CORS);
      stravaBody.code = code;
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token) return json({ error: 'refresh_token required' }, 400, CORS);
      stravaBody.refresh_token = refresh_token;
    } else {
      return json({ error: 'Unknown grant_type' }, 400, CORS);
    }

    // Forward to Strava
    const stravaResp = await fetch(STRAVA_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(stravaBody),
    });

    const data = await stravaResp.json();
    return json(data, stravaResp.status, CORS);
  },
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
