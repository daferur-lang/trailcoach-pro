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
    'TCP-DAFERUR-2026',  // Admin — Diego Codarini
    'TCP-CUMBRE-2026',   // #01
    'TCP-SENDERO-2026',  // #02
    'TCP-CIMA-2026',     // #03
    'TCP-CRESTA-2026',   // #04
    'TCP-PICO-2026',     // #05
    'TCP-BOSQUE-2026',   // #06
    'TCP-ROCA-2026',     // #07
    'TCP-NIEBLA-2026',   // #08
    'TCP-VIENTO-2026',   // #09
    'TCP-ALBA-2026',     // #10
    'TCP-ULTRA-2026',    // #11
    'TCP-SPRINT-2026',   // #12
    'TCP-ENDURO-2026',   // #13
    'TCP-SIERRA-2026',   // #14
    'TCP-NIEVE-2026',    // #15
    'TCP-ARROYO-2026',   // #16
    'TCP-LADERA-2026',   // #17
    'TCP-TREINTA-2026',  // #18
    'TCP-VERTICE-2026',  // #19
    'TCP-DESAFIO-2026',  // #20
  ],
};
