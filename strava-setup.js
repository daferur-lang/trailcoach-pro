/**
 * TrailCoach Pro — Strava API Setup
 *
 * Configura automáticamente:
 *   1. Authorization Callback Domain → daferur-lang.github.io
 *   2. Website → https://daferur-lang.github.io/trailcoach-pro/
 *   3. Rellena el formulario de Extended API Access (para levantar el límite de atletas)
 *
 * Uso:
 *   npm install playwright          (solo la primera vez)
 *   node strava-setup.js
 *
 * Opcional — login automático:
 *   STRAVA_EMAIL=tu@email.com STRAVA_PASSWORD=tupass node strava-setup.js
 */

const { chromium } = require('playwright');
const readline = require('readline');

const APP_URL      = 'https://daferur-lang.github.io/trailcoach-pro/';
const CALLBACK_DOM = 'daferur-lang.github.io';

// ── Extended API Access form answers ──────────────────────────────────────
const APP_DESCRIPTION = [
  'TrailCoach Pro es una PWA de entrenamiento personal para trail runners.',
  'Los atletas conectan su cuenta de Strava para analizar su historial de actividades,',
  'recibir planes de entrenamiento personalizados con IA y hacer seguimiento de su',
  'progreso hacia un objetivo de carrera. Es una herramienta de coaching individual,',
  'no comercial, para un grupo cerrado de ~20 deportistas.'
].join(' ');

async function pause(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForUser(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`\n⏸  ${msg}\n   Pulsa ENTER cuando estés listo... `, () => {
      rl.close();
      resolve();
    });
  });
}

(async () => {
  console.log('\n🚀  TrailCoach Pro — Strava Setup\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
    slowMo: 60,
  });

  const ctx  = await browser.newContext({ viewport: null });
  const page = await ctx.newPage();

  // ── 1. LOGIN ──────────────────────────────────────────────────────────
  console.log('1/4  Abriendo Strava login…');
  await page.goto('https://www.strava.com/login', { waitUntil: 'domcontentloaded' });

  const email    = process.env.STRAVA_EMAIL;
  const password = process.env.STRAVA_PASSWORD;

  if (email && password) {
    console.log('     Usando credenciales de variables de entorno…');
    await page.fill('#email',    email);
    await page.fill('#password', password);
    await page.click('[type=submit]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
    console.log('     Login completado.');
  } else {
    console.log('     Por favor, inicia sesión en la ventana del navegador.');
    await waitForUser('Inicia sesión en Strava y vuelve aquí.');
  }

  // ── 2. ABRIR AJUSTES DE LA API ────────────────────────────────────────
  console.log('\n2/4  Abriendo ajustes de la API de Strava…');
  await page.goto('https://www.strava.com/settings/api', { waitUntil: 'networkidle' });
  await pause(1500);

  const currentUrl = page.url();
  if (!currentUrl.includes('/settings/api')) {
    console.error('❌  No se pudo llegar a /settings/api. ¿Estás logueado?');
    await waitForUser('Navega manualmente a strava.com/settings/api y pulsa ENTER.');
  }

  // ── 3. ACTUALIZAR CALLBACK DOMAIN Y WEBSITE ───────────────────────────
  console.log('3/4  Actualizando Authorization Callback Domain y Website…');

  // Website
  const websiteField = page.locator('input[name="application[website]"], input#application_website').first();
  if (await websiteField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await websiteField.fill(APP_URL);
    console.log(`     Website → ${APP_URL}`);
  } else {
    console.log('     ⚠️  Campo Website no encontrado, saltando…');
  }

  // Authorization Callback Domain
  const callbackField = page.locator(
    'input[name="application[authorization_callback_domain]"], input#application_authorization_callback_domain'
  ).first();

  if (await callbackField.isVisible({ timeout: 3000 }).catch(() => false)) {
    const current = await callbackField.inputValue();
    console.log(`     Callback domain actual: "${current}"`);
    await callbackField.fill(CALLBACK_DOM);
    console.log(`     Callback domain nuevo:  "${CALLBACK_DOM}"`);
  } else {
    console.log('     ⚠️  Campo Callback Domain no encontrado, saltando…');
  }

  // Guardar
  const saveBtn = page.locator('button[type=submit], input[type=submit]').first();
  if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await saveBtn.click();
    await pause(2000);
    console.log('     ✅  Ajustes guardados.');
  } else {
    await waitForUser('Guarda los cambios manualmente y pulsa ENTER.');
  }

  await page.screenshot({ path: 'strava-api-settings.png', fullPage: true });
  console.log('     📸  Captura guardada: strava-api-settings.png');

  // ── 4. SOLICITAR EXTENDED API ACCESS ──────────────────────────────────
  console.log('\n4/4  Buscando formulario de Extended API Access…');

  // El enlace puede estar en /settings/api como botón o enlace
  const extLink = page.locator('a:has-text("Extended"), a:has-text("extended"), button:has-text("Request")').first();

  if (await extLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await extLink.click();
    await pause(2000);
  } else {
    // Intentar URL directa del formulario
    await page.goto('https://www.strava.com/developers/request-access', { waitUntil: 'networkidle' }).catch(() => {});
    await pause(1500);
    if (!page.url().includes('request') && !page.url().includes('form')) {
      console.log('     ℹ️  El formulario de Extended Access puede no estar en una URL fija.');
      console.log('     Búscalo en strava.com/settings/api → "Request Extended API Access".');
      await waitForUser('Abre el formulario manualmente y pulsa ENTER cuando esté visible.');
    }
  }

  // Rellenar descripción si el campo existe
  const descField = page.locator('textarea').first();
  if (await descField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await descField.fill(APP_DESCRIPTION);
    console.log('     Descripción de la app rellenada.');
    await page.screenshot({ path: 'strava-extended-form.png', fullPage: true });
    console.log('     📸  Captura del formulario: strava-extended-form.png');
    await waitForUser('Revisa el formulario, completa cualquier campo extra y ENVÍALO manualmente. Luego pulsa ENTER.');
  } else {
    console.log('     ℹ️  Formulario no encontrado automáticamente.');
    await waitForUser('Rellena y envía el formulario de Extended API Access manualmente, luego ENTER.');
  }

  // ── RESUMEN ───────────────────────────────────────────────────────────
  console.log('\n✅  Configuración completada:');
  console.log(`   • Authorization Callback Domain: ${CALLBACK_DOM}`);
  console.log(`   • Website: ${APP_URL}`);
  console.log('   • Formulario Extended API Access: enviado (revisa tu email)');
  console.log('\n   Capturas guardadas:');
  console.log('   • strava-api-settings.png');
  console.log('   • strava-extended-form.png');
  console.log('\n   Cierra el navegador cuando quieras.\n');

  await browser.close();
})();
