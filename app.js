// TrailCoach Pro — Main Coordinator
import { APP_CONFIG }    from './config.js';
import { StravaClient }  from './js/strava.js';
import { PlanGenerator } from './js/plan.js';
import { ProfileManager } from './js/profile.js';
import { CoachAI }       from './js/coach.js';
import { UI }            from './js/ui.js';

const CONFIG_KEY  = 'tc_config';
const ACCESS_KEY  = 'tc_access_code';

const DEFAULT_CONFIG = {
  // Strava — el client_secret vive en el Worker, no aquí
  stravaClientId: APP_CONFIG.stravaClientId || '',
  workerUrl:      APP_CONFIG.workerUrl      || '',

  // IA coach (Groq — gratuito)
  groqApiKey: '',

  // Atleta y objetivo
  athleteName:   APP_CONFIG.athleteName   || 'Diego Codarini',
  goalName:      APP_CONFIG.goalName      || '',
  goalDistance:  APP_CONFIG.goalDistance  || 65,
  goalElevation: APP_CONFIG.goalElevation || 2000,
  goalDate:      APP_CONFIG.goalDate      || '2026-10-18',

  darkMode: false
};

// ── State ──────────────────────────────────────────────────
const state = {
  config:     loadConfig(),
  activities: [],
  filters:    { year: null, month: null, type: null }
};

// ── Modules ────────────────────────────────────────────────
const strava  = new StravaClient();
const plan    = new PlanGenerator();
const profile = new ProfileManager();
const coach   = new CoachAI();
const ui      = new UI();

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (checkAccess()) {
    initApp();
  } else {
    showGate();
  }
});

function checkAccess() {
  const codes = APP_CONFIG.accessCodes;
  if (!codes || codes.length === 0) return true;
  const stored = localStorage.getItem(ACCESS_KEY);
  return Boolean(stored && codes.includes(stored));
}

function showGate() {
  document.getElementById('accessGate')?.classList.add('open');

  const input  = document.getElementById('gateCodeInput');
  const btn    = document.getElementById('gateSubmitBtn');
  const errEl  = document.getElementById('gateError');

  function tryCode() {
    const code = (input?.value || '').trim().toUpperCase();
    if (!code) return;
    if (APP_CONFIG.accessCodes.includes(code)) {
      localStorage.setItem(ACCESS_KEY, code);
      document.getElementById('accessGate')?.classList.remove('open');
      initApp();
    } else {
      if (errEl) errEl.style.display = 'block';
      input?.classList.add('gate-shake');
      setTimeout(() => input?.classList.remove('gate-shake'), 500);
    }
  }

  btn?.addEventListener('click', tryCode);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') tryCode(); });
  input?.addEventListener('input', () => {
    if (errEl) errEl.style.display = 'none';
  });
}

async function initApp() {
  ui.applyTheme(state.config.darkMode);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  strava.setConfig({
    clientId:  state.config.stravaClientId,
    workerUrl: state.config.workerUrl
  });
  coach.setApiKey(state.config.groqApiKey);

  const cached = strava.getCachedActivities();
  if (cached) state.activities = cached;

  ui.initNav(onNavigate);
  ui.setWelcomeTs();
  bindEvents();

  await handleOAuthCallback();
  renderAll();
}

// ── OAuth Callback ─────────────────────────────────────────
async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  const error  = params.get('error');

  if (error) {
    ui.toast('Strava rechazó la conexión: ' + error);
    clearUrlParams();
    return;
  }
  if (!code) return;

  clearUrlParams();
  ui.showLoading('Conectando con Strava...');
  try {
    await strava.exchangeCode(code);
    const athlete = await strava.fetchAthlete();
    if (athlete.firstname && !state.config.athleteName) {
      state.config.athleteName = `${athlete.firstname} ${athlete.lastname || ''}`.trim();
      saveConfig();
    }
    ui.toast(`Conectado como ${athlete.firstname} ${athlete.lastname || ''}`);
    await syncActivities();
  } catch (err) {
    ui.toast('Error conectando: ' + err.message);
  } finally {
    ui.hideLoading();
    renderAll();
  }
}

// ── Renders ────────────────────────────────────────────────
function renderAll() {
  if (state.config.goalDate) {
    plan.generate(state.config, state.activities);
  }
  ui.renderPlan(plan.getPlan() ? plan : null, state.config);
  ui.updateWeeklyKpis(state.activities);
  if (plan.getPlan()) ui.updateWeeksRemainingKpi(plan.getWeeksRemaining());

  ui.renderActivities(state.activities, state.filters);

  const stats   = profile.calculate(state.activities, state.config);
  const details = profile.getStatDetails(state.activities);
  ui.renderProfile(stats, state.config, strava.getAthlete(), details);

  ui.loadSettingsValues(state.config);
  const athlete = strava.getAthlete();
  ui.updateStravaStatus(
    strava.isConnected(),
    athlete ? `${athlete.firstname || ''} ${athlete.lastname || ''}`.trim() : null
  );
}

function onNavigate(view) {
  if (view === 'coach') ui.enableSendBtn(true);
}

// ── Sync Activities ────────────────────────────────────────
async function syncActivities() {
  if (!strava.isConnected()) {
    ui.toast('Conecta Strava primero');
    ui.openSettings();
    return;
  }

  const syncBtn = document.getElementById('syncBtn');
  syncBtn?.classList.add('syncing');
  ui.showLoading('Sincronizando actividades...');

  try {
    state.activities = await strava.fetchActivities({
      onProgress: n => {
        const t = document.getElementById('loadingText');
        if (t) t.textContent = `Descargando... ${n} actividades`;
      }
    });
    ui.toast(`${state.activities.length} actividades sincronizadas`);
    renderAll();
  } catch (err) {
    ui.toast('Error: ' + err.message);
  } finally {
    ui.hideLoading();
    syncBtn?.classList.remove('syncing');
  }
}

// ── Events ─────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('syncBtn')?.addEventListener('click', syncActivities);

  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    ui.loadSettingsValues(state.config);
    ui.openSettings();
  });
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => ui.closeSettings());
  document.getElementById('openSettingsFromPlan')?.addEventListener('click', () => ui.openSettings());

  document.getElementById('activitiesList')?.addEventListener('click', e => {
    if (e.target.closest('#connectStravaBtn')) ui.openSettings();
  });

  // Guardar configuración
  document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    const newConfig = ui.readSettingsValues();
    state.config = { ...DEFAULT_CONFIG, ...newConfig };
    saveConfig();
    strava.setConfig({ clientId: state.config.stravaClientId, workerUrl: state.config.workerUrl });
    coach.setApiKey(state.config.groqApiKey);
    ui.applyTheme(state.config.darkMode);
    ui.closeSettings();
    ui.toast('Configuración guardada');
    renderAll();
  });

  // Strava — un solo clic, sin client_secret
  document.getElementById('stravaConnectBtn')?.addEventListener('click', () => {
    const workerUrl = document.getElementById('workerUrl')?.value?.trim() || state.config.workerUrl;
    const clientId  = document.getElementById('stravaClientId')?.value?.trim() || state.config.stravaClientId;

    if (!workerUrl) {
      ui.toast('Configura el Worker URL en ajustes avanzados');
      return;
    }
    if (!clientId) {
      ui.toast('Configura el Strava Client ID en ajustes avanzados');
      return;
    }

    // Guardar antes de redirigir
    state.config.workerUrl     = workerUrl;
    state.config.stravaClientId = clientId;
    saveConfig();
    strava.setConfig({ clientId, workerUrl });

    window.location.href = strava.getAuthUrl();
  });

  document.getElementById('stravaDisconnectBtn')?.addEventListener('click', () => {
    strava.disconnect();
    state.activities = [];
    ui.updateStravaStatus(false);
    ui.toast('Strava desconectado');
    renderAll();
  });

  // Dark mode
  document.getElementById('darkModeToggle')?.addEventListener('click', function () {
    const current = this.getAttribute('aria-checked') === 'true';
    this.setAttribute('aria-checked', String(!current));
    ui.applyTheme(!current);
  });

  // Filtros de actividades
  document.getElementById('yearFilter')?.addEventListener('click', function () {
    const years = [...new Set(state.activities.map(a => new Date(a.start_date).getFullYear()))].sort((a,b)=>b-a);
    ui.openFilterDropdown(this, [
      { label: 'Todos los años', value: '' },
      ...years.map(y => ({ label: String(y), value: String(y) }))
    ], state.filters.year, val => {
      state.filters.year = val;
      document.getElementById('yearFilterLabel').textContent = val ? String(val) : 'Año';
      ui.renderActivities(state.activities, state.filters);
    });
  });

  document.getElementById('monthFilter')?.addEventListener('click', function () {
    const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    ui.openFilterDropdown(this, [
      { label: 'Todos los meses', value: '' },
      ...MONTHS.map((m, i) => ({ label: m, value: String(i + 1) }))
    ], state.filters.month, val => {
      state.filters.month = val;
      document.getElementById('monthFilterLabel').textContent = val ? ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][val-1] : 'Mes';
      ui.renderActivities(state.activities, state.filters);
    });
  });

  document.getElementById('typeFilter')?.addEventListener('click', function () {
    ui.openFilterDropdown(this, [
      { label: 'Todos los tipos', value: '' },
      { label: 'Trail',          value: 'trail' },
      { label: 'Carrera',        value: 'run' }
    ], state.filters.type, val => {
      state.filters.type = val;
      document.getElementById('typeFilterLabel').textContent = val ? (val === 'trail' ? 'Trail' : 'Carrera') : 'Tipo';
      ui.renderActivities(state.activities, state.filters);
    });
  });

  document.getElementById('prevWeeksBtn')?.addEventListener('click', () => {
    const allPlan = plan.getPlan();
    if (!allPlan) return;
    const current = plan.getCurrentWeek();
    const past = allPlan.filter(w => !current || w.weekNum < current.weekNum);
    ui.toast(past.length ? `${past.length} semanas completadas` : 'No hay semanas anteriores todavía');
  });

  // Chat
  const chatInput = document.getElementById('chatInput');
  const sendBtn   = document.getElementById('sendBtn');

  chatInput?.addEventListener('input', () => {
    ui.enableSendBtn(chatInput.value.trim().length > 0);
  });
  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });
  sendBtn?.addEventListener('click', sendChatMessage);

  document.getElementById('quickChips')?.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (chatInput) chatInput.value = chip.dataset.msg;
    ui.enableSendBtn(true);
    sendChatMessage();
  });

  document.getElementById('clearChatBtn')?.addEventListener('click', () => {
    coach.clearHistory();
    ui.clearChat();
    ui.toast('Chat reiniciado');
  });

  document.getElementById('profileMenuBtn')?.addEventListener('click', () => {
    ui.toast('Actualiza tus datos en Ajustes');
  });
}

// ── Chat ──────────────────────────────────────────────────
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const msg   = input?.value?.trim();
  if (!msg) return;

  if (!coach.hasApiKey()) {
    ui.toast('Configura tu Groq API Key en Ajustes — es gratis');
    ui.openSettings();
    return;
  }

  input.value = '';
  ui.enableSendBtn(false);
  ui.addCoachMessage(msg, true);
  ui.showTypingIndicator();
  ui.setCoachStatus('Pensando...');

  try {
    const context = coach.buildContext({
      config:        state.config,
      activities:    state.activities,
      planGenerator: plan.getPlan() ? plan : null
    });
    const reply = await coach.sendMessage(msg, context);
    ui.hideTypingIndicator();
    ui.addCoachMessage(reply, false);
    ui.setCoachStatus('Listo para entrenar');
  } catch (err) {
    ui.hideTypingIndicator();
    ui.addCoachMessage('Error: ' + err.message, false);
    ui.setCoachStatus('Error — verifica tu API key');
  }
}

// ── Helpers ────────────────────────────────────────────────
function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return { ...DEFAULT_CONFIG, ...saved };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig() {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
}

function clearUrlParams() {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash   = '';
  window.history.replaceState({}, '', url.toString());
}
