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
  stravaClientId: '249650',

  workerUrl: 'https://trailcoach-strava.daferur.workers.dev',

  // Valores por defecto del atleta (se pueden cambiar en Ajustes)
  athleteName:  'Diego Codarini',
  goalDistance:  65,
  goalElevation: 2000,
  goalDate:      '2026-10-18',
  goalName:      '',

  // Códigos de acceso — añade uno por persona, elimínalo para revocar.
  // Formato sugerido: TCP-NOMBRE-AÑO  (mayúsculas, sin espacios)
  // Deja el array vacío [] para desactivar el control de acceso.
  accessCodes: [
    'TCP-DIEGO-2026',   // Admin — Diego Codarini
  ],
};
