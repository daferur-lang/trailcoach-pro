/**
 * TrailCoach Pro — Configuración pública
 *
 * Rellena estos valores UNA VEZ después de:
 *   1. Registrar tu app en strava.com/settings/api
 *   2. Desplegar el Cloudflare Worker (ver cloudflare/README)
 *
 * Estos valores son seguros para estar en el código (son públicos por diseño).
 * El client_secret de Strava NUNCA aparece aquí — vive en el Worker.
 */
export const APP_CONFIG = {
  // Tu Strava Client ID (número, en strava.com/settings/api)
  stravaClientId: '',

  // URL de tu Cloudflare Worker desplegado
  // Ejemplo: 'https://trailcoach-strava.tu-cuenta.workers.dev'
  workerUrl: '',

  // Valores por defecto del atleta (se pueden cambiar en Ajustes)
  athleteName:  'Diego Codarini',
  goalDistance:  65,
  goalElevation: 2000,
  goalDate:      '2026-10-18',
  goalName:      '',
};
