// TrailCoach Pro — Main Coordinator
import { StravaClient }  from './js/strava.js';
import { PlanGenerator } from './js/plan.js';
import { ProfileManager } from './js/profile.js';
import { CoachAI }       from './js/coach.js';
import { UI }            from './js/ui.js';
import { GrantsManager, renderGrantsView } from './js/subvenciones.js';

const CONFIG_KEY = 'tc_config';

const DEFAULT_CONFIG = {
  stravaClientId:     '',
  stravaClientSecret: '',
  groqApiKey:       '',
  athleteName:        '',
  goalName:           '',
  goalDistance:       65,
  goalElevation:      2000,
  goalDate:           '2026-10-18',
  darkMode:           false
};

// ── State ──────────────────────────────────────────────────
const state = {
  config:    loadConfig(),
  activities: [],
  filters:   { year: null, month: null, type: null }
};

// ── Modules ────────────────────────────────────────────────
const strava   = new StravaClient();
const plan     = new PlanGenerator();
const profile  = new ProfileManager();
const coach    = new CoachAI();
const ui       = new UI();
const grants   = new GrantsManager();

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Apply theme immediately
  ui.applyTheme(state.config.darkMode);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});

    // Auto-update: cuando el SW nuevo toma el control, recarga la página
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    // Forzar comprobación de actualizaciones al volver a la app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.ready.then(reg => reg.update());
      }
    });
  }

  // Set up modules with config
  strava.setConfig(state.config);
  coach.setApiKey(state.config.groqApiKey);

  // Load cached activities
  const cached = strava.getCachedActivities();
  if (cached) state.activities = cached;

  // Set up UI
  ui.initNav(onNavigate);
  ui.setWelcomeTs();
  bindEvents();

  // Handle Strava OAuth callback
  await handleOAuthCallback();

  // Initial renders
  renderAll();
});

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

  // We have an OAuth code — exchange it
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

    // Sync activities right away
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
  // Plan
  if (state.config.goalDate) {
    plan.generate(state.config, state.activities);
  }
  ui.renderPlan(plan.getPlan() ? plan : null, state.config);
  ui.updateWeeklyKpis(state.activities);
  if (plan.getPlan()) ui.updateWeeksRemainingKpi(plan.getWeeksRemaining());

  // Activities
  ui.renderActivities(state.activities, state.filters);

  // Profile
  const stats   = profile.calculate(state.activities, state.config);
  const details = profile.getStatDetails(state.activities);
  const athlete = strava.getAthlete();
  ui.renderProfile(stats, state.config, athlete, details);

  // Grants
  renderGrantsView(grants);

  // Settings state
  ui.loadSettingsValues(state.config);
  const isConnected = strava.isConnected();
  ui.updateStravaStatus(isConnected, athlete?.firstname ? `${athlete.firstname} ${athlete.lastname || ''}` : null);
}

function onNavigate(view) {
  if (view === 'coach') {
    ui.enableSendBtn(true);
  }
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
    let count = 0;
    state.activities = await strava.fetchActivities({
      onProgress: n => {
        count = n;
        const loadingText = document.getElementById('loadingText');
        if (loadingText) loadingText.textContent = `Descargando... ${n} actividades`;
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
  // Sync button
  document.getElementById('syncBtn')?.addEventListener('click', syncActivities);

  // Settings open/close
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    ui.loadSettingsValues(state.config);
    ui.openSettings();
  });
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => ui.closeSettings());

  // From plan empty state
  document.getElementById('openSettingsFromPlan')?.addEventListener('click', () => ui.openSettings());

  // From activities connect button (re-delegated)
  document.getElementById('activitiesList')?.addEventListener('click', e => {
    if (e.target.closest('#connectStravaBtn')) {
      ui.openSettings();
    }
  });

  // Save settings
  document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
    const newConfig = ui.readSettingsValues();
    state.config = { ...DEFAULT_CONFIG, ...newConfig };
    saveConfig();
    strava.setConfig(state.config);
    coach.setApiKey(state.config.groqApiKey);
    ui.applyTheme(state.config.darkMode);
    ui.closeSettings();
    ui.toast('Configuración guardada');
    renderAll();
  });

  // Strava connect
  document.getElementById('stravaConnectBtn')?.addEventListener('click', () => {
    const clientId = document.getElementById('stravaClientId')?.value?.trim();
    const secret   = document.getElementById('stravaClientSecret')?.value?.trim();
    if (!clientId || !secret) {
      ui.toast('Introduce Client ID y Client Secret');
      return;
    }
    // Save temporarily so we can use after redirect
    const tempConfig = { ...state.config, stravaClientId: clientId, stravaClientSecret: secret };
    state.config = tempConfig;
    saveConfig();
    strava.setConfig(state.config);
    window.location.href = strava.getAuthUrl();
  });

  // Strava help modal
  document.getElementById('stravaHelpBtn')?.addEventListener('click', () => {
    const domain = new URL(window.location.href).hostname;
    const el = document.getElementById('helpCallbackDomain');
    if (el) el.textContent = domain;
    document.getElementById('stravaHelpModal')?.classList.add('open');
  });
  document.getElementById('closeStravaHelpBtn')?.addEventListener('click', () => {
    document.getElementById('stravaHelpModal')?.classList.remove('open');
  });
  document.getElementById('stravaHelpModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });

  // Strava disconnect
  document.getElementById('stravaDisconnectBtn')?.addEventListener('click', () => {
    strava.disconnect();
    state.activities = [];
    ui.updateStravaStatus(false);
    ui.toast('Strava desconectado');
    renderAll();
  });

  // Dark mode toggle
  document.getElementById('darkModeToggle')?.addEventListener('click', function() {
    const current = this.getAttribute('aria-checked') === 'true';
    this.setAttribute('aria-checked', String(!current));
    ui.applyTheme(!current);
  });

  // Activity filters
  document.getElementById('yearFilter')?.addEventListener('click', function() {
    const years = _getUniqueYears(state.activities);
    ui.openFilterDropdown(this, [
      { label: 'Todos los años', value: '' },
      ...years.map(y => ({ label: String(y), value: String(y) }))
    ], state.filters.year, val => {
      state.filters.year = val;
      document.getElementById('yearFilterLabel').textContent = val ? String(val) : 'Año';
      this.classList.toggle('active', !val);
      document.getElementById('yearFilter').classList.toggle('active', true);
      ui.renderActivities(state.activities, state.filters);
    });
  });

  document.getElementById('monthFilter')?.addEventListener('click', function() {
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

  document.getElementById('typeFilter')?.addEventListener('click', function() {
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

  // Previous weeks
  document.getElementById('prevWeeksBtn')?.addEventListener('click', () => {
    // Show all past weeks in a simple list
    const allPlan = plan.getPlan();
    if (!allPlan) return;
    const current = plan.getCurrentWeek();
    const past = allPlan.filter(w => !current || w.weekNum < current.weekNum);
    if (!past.length) { ui.toast('No hay semanas anteriores todavía'); return; }
    ui.toast(`${past.length} semanas anteriores completadas`);
  });

  // Chat input
  const chatInput = document.getElementById('chatInput');
  const sendBtn   = document.getElementById('sendBtn');

  chatInput?.addEventListener('input', () => {
    const hasText = chatInput.value.trim().length > 0;
    ui.enableSendBtn(hasText);
  });

  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  sendBtn?.addEventListener('click', sendChatMessage);

  // Quick chips
  document.getElementById('quickChips')?.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const msg = chip.dataset.msg;
    if (chatInput) chatInput.value = msg;
    ui.enableSendBtn(true);
    sendChatMessage();
  });

  // Clear chat
  document.getElementById('clearChatBtn')?.addEventListener('click', () => {
    coach.clearHistory();
    ui.clearChat();
    ui.toast('Chat reiniciado');
  });

  // Profile menu (placeholder)
  document.getElementById('profileMenuBtn')?.addEventListener('click', () => {
    ui.toast('Actualiza tus datos en Ajustes');
  });

  // ── Grants ────────────────────────────────────────────────
  const grantModal      = document.getElementById('grantModal');
  const grantModalTitle = document.getElementById('grantModalTitle');

  function openGrantModal(grant = null) {
    document.getElementById('grantEditId').value       = grant?.id || '';
    document.getElementById('grantConvocatoria').value = grant?.convocatoria || '';
    document.getElementById('grantTipo').value         = grant?.tipo || '';
    document.getElementById('grantProyecto').value     = grant?.proyecto || '';
    document.getElementById('grantImporte').value      = grant?.importe ?? '';
    document.getElementById('grantComision').value     = grant?.comisionPct ?? '';
    document.getElementById('grantDeadline').value     = grant?.deadline || '';
    document.getElementById('grantEstado').value       = grant?.estado || 'redaccion';
    grantModalTitle.textContent = grant ? 'Editar Solicitud' : 'Nueva Solicitud';
    grantModal?.classList.add('open');
  }

  function closeGrantModal() { grantModal?.classList.remove('open'); }

  document.getElementById('addGrantBtn')?.addEventListener('click', () => openGrantModal());
  document.getElementById('closeGrantModalBtn')?.addEventListener('click', closeGrantModal);
  grantModal?.addEventListener('click', e => { if (e.target === e.currentTarget) closeGrantModal(); });

  document.getElementById('saveGrantBtn')?.addEventListener('click', () => {
    const id = document.getElementById('grantEditId').value;
    const data = {
      convocatoria: document.getElementById('grantConvocatoria').value.trim(),
      tipo:         document.getElementById('grantTipo').value.trim(),
      proyecto:     document.getElementById('grantProyecto').value.trim(),
      importe:      parseFloat(document.getElementById('grantImporte').value) || 0,
      comisionPct:  parseFloat(document.getElementById('grantComision').value) || 0,
      deadline:     document.getElementById('grantDeadline').value,
      estado:       document.getElementById('grantEstado').value
    };
    if (!data.convocatoria || !data.proyecto) {
      ui.toast('Rellena organismo y proyecto');
      return;
    }
    if (id) { grants.update(id, data); } else { grants.add(data); }
    closeGrantModal();
    renderGrantsView(grants);
    ui.toast(id ? 'Solicitud actualizada' : 'Solicitud añadida');
  });

  document.getElementById('grantsList')?.addEventListener('click', e => {
    const editBtn = e.target.closest('.grant-edit-btn');
    const delBtn  = e.target.closest('.grant-del-btn');
    if (editBtn) {
      const id = editBtn.dataset.id;
      const g  = grants.getAll().find(x => x.id === id);
      if (g) openGrantModal(g);
    }
    if (delBtn) {
      const id = delBtn.dataset.id;
      if (confirm('¿Eliminar esta solicitud?')) {
        grants.remove(id);
        renderGrantsView(grants);
        ui.toast('Solicitud eliminada');
      }
    }
  });
}

// ── Send Chat Message ──────────────────────────────────────
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const msg   = input?.value?.trim();
  if (!msg) return;

  if (!coach.hasApiKey()) {
    ui.toast('Configura tu API Key de Groq en Ajustes');
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
      config:         state.config,
      activities:     state.activities,
      plan:           plan.getPlan(),
      planGenerator:  plan.getPlan() ? plan : null
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

function _getUniqueYears(activities) {
  const years = new Set(activities.map(a => new Date(a.start_date).getFullYear()));
  return Array.from(years).sort((a, b) => b - a);
}
