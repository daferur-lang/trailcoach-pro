/**
 * TrailCoach Pro — Strava Full Setup (100% automático)
 *
 * Qué hace:
 *   1. Login en Strava
 *   2. Actualiza Authorization Callback Domain → daferur-lang.github.io
 *   3. Actualiza Website → https://daferur-lang.github.io/trailcoach-pro/
 *   4. Rellena y envía el formulario Developer Program (aumento de atletas)
 *
 * Uso — pon tus credenciales como variables de entorno:
 *   STRAVA_EMAIL=tu@email.com STRAVA_PASSWORD=tupass node strava-setup.js
 *
 * Instalación (una sola vez):
 *   npm install playwright
 */

const { chromium } = require('playwright');
const readline = require('readline');

// ── Configuración de la app ────────────────────────────────────────────────
const CLIENT_ID    = '249650';
const APP_NAME     = 'TrailCoach Pro';
const APP_URL      = 'https://daferur-lang.github.io/trailcoach-pro/';
const CALLBACK_DOM = 'daferur-lang.github.io';
const CONTACT_EMAIL = 'daferur@gmail.com';
const NUM_ATHLETES  = '20';

const APP_DESCRIPTION =
  'TrailCoach Pro is a personal coaching PWA for trail runners. ' +
  'Athletes connect their Strava account to analyze their activity history, ' +
  'receive AI-generated training plans tailored to their goals, and track ' +
  'progress toward a target race. It is a closed-group tool for approximately ' +
  '20 athletes, fully non-commercial and personal use only.';

const REASON_FOR_INCREASE =
  'I am coaching a small private group of ~20 trail runners. Each athlete needs ' +
  'to connect their own Strava account to access their personal activity data. ' +
  'The app only reads activity data (read + activity:read_all scopes) and never ' +
  'writes or modifies any data. All usage is personal and non-commercial.';

// ──────────────────────────────────────────────────────────────────────────

function pause(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer); });
  });
}

async function tryFill(page, selectors, value) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.fill(value);
        return true;
      }
    } catch {}
  }
  return false;
}

async function tryClick(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        return true;
      }
    } catch {}
  }
  return false;
}

(async () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   TrailCoach Pro — Strava Full Setup     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Credenciales
  const email    = process.env.STRAVA_EMAIL    || await ask('Email de Strava: ');
  const password = process.env.STRAVA_PASSWORD || await ask('Contraseña de Strava: ');

  console.log('\n🚀  Iniciando navegador…\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized', '--no-sandbox'],
    slowMo: 80,
  });

  const ctx  = await browser.newContext({ viewport: null });
  const page = await ctx.newPage();

  // ── PASO 1: LOGIN ─────────────────────────────────────────────────────
  console.log('[ 1/4 ] Login en Strava…');
  await page.goto('https://www.strava.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.fill('#email',    email);
  await page.fill('#password', password);
  await page.click('[type=submit]');

  try {
    await page.waitForURL(u => !u.includes('/login'), { timeout: 15000 });
    console.log('        ✅  Login correcto.\n');
  } catch {
    console.log('        ⚠️  Timeout esperando redirect post-login.');
    console.log('           Si hay captcha, resuélvelo manualmente en el navegador.');
    await ask('           Pulsa ENTER cuando estés dentro del dashboard… ');
  }

  // ── PASO 2: AJUSTES DE LA API ─────────────────────────────────────────
  console.log('[ 2/4 ] Actualizando ajustes de la API de Strava…');
  await page.goto('https://www.strava.com/settings/api', { waitUntil: 'networkidle', timeout: 20000 });
  await pause(1500);

  const websiteFilled  = await tryFill(page,
    ['input[name="application[website]"]', 'input#application_website', 'input[placeholder*="ebsite"]'],
    APP_URL);

  const callbackFilled = await tryFill(page,
    ['input[name="application[authorization_callback_domain]"]', 'input#application_authorization_callback_domain'],
    CALLBACK_DOM);

  if (websiteFilled || callbackFilled) {
    const saved = await tryClick(page,
      ['button[type=submit]', 'input[type=submit]', 'button:has-text("Update")', 'button:has-text("Save")']);
    await pause(2000);
    console.log(`        Website:         ${websiteFilled  ? '✅' : '⚠️ no encontrado'} → ${APP_URL}`);
    console.log(`        Callback domain: ${callbackFilled ? '✅' : '⚠️ no encontrado'} → ${CALLBACK_DOM}`);
    console.log(`        Guardado:        ${saved ? '✅' : '⚠️ botón no encontrado'}`);
  } else {
    console.log('        ⚠️  No se encontraron los campos (puede que ya estén configurados).');
  }

  await page.screenshot({ path: 'strava-api-settings.png', fullPage: true });
  console.log('        📸  strava-api-settings.png\n');

  // ── PASO 3: FORMULARIO DEVELOPER PROGRAM ──────────────────────────────
  console.log('[ 3/4 ] Abriendo formulario Developer Program (aumento de atletas)…');
  await page.goto('https://developers.strava.com/docs/rate-limits/', { waitUntil: 'networkidle', timeout: 20000 });
  await pause(2000);

  // Scroll hasta el final para encontrar el formulario
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(1500);

  // Buscar iframe del formulario (Typeform, Google Form, etc.)
  const frames = page.frames();
  let formFrame = null;
  for (const frame of frames) {
    const url = frame.url();
    if (url.includes('typeform') || url.includes('google') || url.includes('form')) {
      formFrame = frame;
      console.log(`        Frame del formulario encontrado: ${url}`);
      break;
    }
  }

  // Si hay un enlace al formulario externo, seguirlo
  if (!formFrame) {
    const formLink = page.locator('a[href*="typeform"], a[href*="form"], a[href*="google"], a:has-text("form"), a:has-text("Form"), a:has-text("request"), a:has-text("Request")').first();
    const href = await formLink.getAttribute('href').catch(() => null);
    if (href) {
      console.log(`        Redirigiendo al formulario: ${href}`);
      await page.goto(href, { waitUntil: 'networkidle', timeout: 20000 });
      await pause(2000);
    }
  }

  await page.screenshot({ path: 'strava-form-page.png', fullPage: true });
  console.log('        📸  strava-form-page.png');

  // ── PASO 4: RELLENAR FORMULARIO ───────────────────────────────────────
  console.log('\n[ 4/4 ] Rellenando formulario…');

  const target = formFrame || page;

  // Intentar rellenar campos comunes del formulario
  const filled = {
    clientId:     await tryFill(target, ['input[name*="client"], input[placeholder*="Client"], input[placeholder*="client"], input[placeholder*="ID"], input[placeholder*="id"]'], CLIENT_ID),
    appName:      await tryFill(target, ['input[name*="name"], input[placeholder*="name"], input[placeholder*="Name"], input[placeholder*="app"]'], APP_NAME),
    website:      await tryFill(target, ['input[name*="website"], input[name*="url"], input[placeholder*="website"], input[placeholder*="URL"]'], APP_URL),
    email:        await tryFill(target, ['input[type="email"], input[name*="email"], input[placeholder*="email"], input[placeholder*="Email"]'], CONTACT_EMAIL),
    numAthletes:  await tryFill(target, ['input[name*="athlete"], input[placeholder*="athlete"], input[placeholder*="Athlete"], input[name*="user"], input[name*="number"]'], NUM_ATHLETES),
    description:  await tryFill(target, ['textarea[name*="description"], textarea[placeholder*="description"], textarea[placeholder*="Description"], textarea:first-of-type'], APP_DESCRIPTION),
    reason:       await tryFill(target, ['textarea[name*="reason"], textarea[placeholder*="reason"], textarea[placeholder*="Reason"], textarea:nth-of-type(2)'], REASON_FOR_INCREASE),
  };

  console.log('\n   Campos rellenados:');
  Object.entries(filled).forEach(([k, v]) => console.log(`   • ${k.padEnd(14)} ${v ? '✅' : '—  (no encontrado)'}`));

  await page.screenshot({ path: 'strava-form-filled.png', fullPage: true });
  console.log('\n   📸  strava-form-filled.png');

  // Intentar enviar
  const submitted = await tryClick(page,
    ['button[type=submit]', 'input[type=submit]', 'button:has-text("Submit")', 'button:has-text("Send")', 'button:has-text("Enviar")']);

  if (submitted) {
    await pause(3000);
    await page.screenshot({ path: 'strava-form-submitted.png', fullPage: true });
    console.log('\n✅  Formulario enviado.');
    console.log('   📸  strava-form-submitted.png');
  } else {
    console.log('\n⚠️  No se encontró botón de envío automático.');
    console.log('   Por favor, revisa el formulario en el navegador y envíalo manualmente.');
    await ask('   Pulsa ENTER cuando lo hayas enviado… ');
  }

  // ── RESUMEN ───────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   ✅  Configuración completada            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n  Client ID:       ${CLIENT_ID}`);
  console.log(`  Callback domain: ${CALLBACK_DOM}`);
  console.log(`  Website:         ${APP_URL}`);
  console.log('\n  Capturas guardadas:');
  console.log('  • strava-api-settings.png');
  console.log('  • strava-form-page.png');
  console.log('  • strava-form-filled.png');
  console.log('  • strava-form-submitted.png  (si se envió automáticamente)');
  console.log('\n  Strava tarda 7-10 días hábiles en aprobar el aumento de atletas.');
  console.log('  Te notificarán por email a ' + CONTACT_EMAIL + '.\n');

  await ask('Pulsa ENTER para cerrar el navegador… ');
  await browser.close();
})();
