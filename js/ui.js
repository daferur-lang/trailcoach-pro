// UI Module — Navigation, Renders, Toast, Modal, Filters
import { formatPace, formatTime, formatDistance, formatElevation, activityTypeLabel, activityTypeClass } from './strava.js';
import { formatWeekDates, formatGoalDate } from './plan.js';
import { renderAthleteCard, renderStatsList } from './profile.js';
import { formatCoachReply } from './coach.js';

export class UI {
  constructor() {
    this._currentView     = 'plan';
    this._activityFilters = { year: null, month: null, type: null };
    this._filterTarget    = null;
    this._toastTimer      = null;
    this._expandedStat    = null;
    this._expandedWeek    = null;
    this._dropdownOpen    = false;

    // Bind global close handlers
    document.addEventListener('click', e => this._onDocClick(e));
  }

  // ── Navigation ────────────────────────────────────────────
  initNav(onNavigate) {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.setActiveView(view);
        onNavigate(view);
      });
    });
  }

  setActiveView(viewName) {
    this._currentView = viewName;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view${this._cap(viewName)}`));
  }

  _cap(s) {
    const map = { plan: 'Plan', actividades: 'Actividades', tu: 'Tu', coach: 'Coach' };
    return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ── Toast ─────────────────────────────────────────────────
  toast(msg, duration = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(this._toastTimer);
    el.textContent = msg;
    el.classList.add('show');
    this._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  // ── Loading overlay ───────────────────────────────────────
  showLoading(msg = 'Cargando...') {
    const o = document.getElementById('loadingOverlay');
    const t = document.getElementById('loadingText');
    if (t) t.textContent = msg;
    if (o) o.style.display = 'flex';
  }

  hideLoading() {
    const o = document.getElementById('loadingOverlay');
    if (o) o.style.display = 'none';
  }

  // ── Settings Modal ────────────────────────────────────────
  openSettings() {
    document.getElementById('settingsModal')?.classList.add('open');
  }

  closeSettings() {
    document.getElementById('settingsModal')?.classList.remove('open');
  }

  loadSettingsValues(config) {
    const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    set('workerUrl',          config.workerUrl);
    set('stravaClientId',     config.stravaClientId);
    set('stravaClientSecret', config.stravaClientSecret);
    set('groqApiKey',         config.groqApiKey);
    set('athleteName',    config.athleteName);
    set('goalName',           config.goalName);
    set('goalDistance',       config.goalDistance);
    set('goalElevation',      config.goalElevation);
    set('goalDate',           config.goalDate);

    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.setAttribute('aria-checked', String(!!config.darkMode));

    const redirectSpan = document.getElementById('redirectUriHint');
    if (redirectSpan) {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      redirectSpan.textContent = url.toString();
    }
  }

  readSettingsValues() {
    const val = id => document.getElementById(id)?.value?.trim() || '';
    const toggle = document.getElementById('darkModeToggle');
    return {
      workerUrl:          val('workerUrl'),
      stravaClientId:     val('stravaClientId'),
      stravaClientSecret: val('stravaClientSecret'),
      groqApiKey:         val('groqApiKey'),
      athleteName:    val('athleteName'),
      goalName:           val('goalName'),
      goalDistance:       parseFloat(val('goalDistance')) || null,
      goalElevation:      parseFloat(val('goalElevation')) || null,
      goalDate:           val('goalDate'),
      darkMode:           toggle?.getAttribute('aria-checked') === 'true'
    };
  }

  updateStravaStatus(connected, athleteName) {
    const status = document.getElementById('stravaStatus');
    const text   = document.getElementById('stravaStatusText');
    const connBtn = document.getElementById('stravaConnectBtn');
    const discBtn = document.getElementById('stravaDisconnectBtn');
    if (!status) return;
    if (connected) {
      status.className = 'strava-status connected';
      text.textContent = athleteName ? `Conectado: ${athleteName}` : 'Conectado';
      if (connBtn) connBtn.style.display = 'none';
      if (discBtn) discBtn.style.display = '';
    } else {
      status.className = 'strava-status disconnected';
      text.textContent = 'No conectado';
      if (connBtn) connBtn.style.display = '';
      if (discBtn) discBtn.style.display = 'none';
    }
  }

  // Dark mode
  applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    const meta = document.getElementById('themeColorMeta');
    if (meta) meta.setAttribute('content', dark ? '#1C1A17' : '#E8621A');
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.setAttribute('aria-checked', String(dark));
  }

  // ── Plan View ─────────────────────────────────────────────
  renderPlan(planGenerator, config) {
    const planObjective = document.getElementById('planObjective');
    const currentCard   = document.getElementById('currentWeekCard');
    const upcomingList  = document.getElementById('upcomingWeeksList');
    const planEmpty     = document.getElementById('planEmpty');
    const kpiStrip      = document.getElementById('weeklyKpis');

    if (!config?.goalDate || !planGenerator?.getPlan()) {
      if (planEmpty)     planEmpty.style.display = '';
      if (currentCard)  currentCard.innerHTML = '';
      if (upcomingList) upcomingList.innerHTML = '';
      if (kpiStrip)     kpiStrip.style.display = 'none';
      return;
    }

    if (planEmpty) planEmpty.style.display = 'none';

    if (planObjective) {
      const goalStr = config.goalName
        ? `${config.goalName} — ${config.goalDistance || '?'} km ${config.goalElevation || '?'}m D+ · ${formatGoalDate(config.goalDate)}`
        : `${config.goalDistance || '?'} km · ${config.goalElevation || '?'} m D+ · ${formatGoalDate(config.goalDate)}`;
      planObjective.textContent = goalStr;
    }

    const current  = planGenerator.getCurrentWeek();
    const upcoming = planGenerator.getUpcomingWeeks(10);

    if (current && currentCard) {
      currentCard.innerHTML = this._buildWeekCard(current, true);
      this._bindSessionToggles(currentCard);
    }

    if (upcomingList) {
      upcomingList.innerHTML = upcoming.map(w => this._buildCollapsedWeek(w)).join('');
      this._bindCollapsedWeeks(upcomingList);
    }
  }

  updateWeeklyKpis(activities) {
    const kpiKm   = document.getElementById('kpiKm');
    const kpiElev = document.getElementById('kpiElev');

    if (!activities?.length) {
      if (kpiKm)   kpiKm.textContent   = '0';
      if (kpiElev) kpiElev.textContent = '0';
      return;
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek   = activities.filter(a => new Date(a.start_date) >= oneWeekAgo);
    const weekKm     = thisWeek.reduce((s, a) => s + a.distance / 1000, 0);
    const weekElev   = thisWeek.reduce((s, a) => s + (a.total_elevation_gain || 0), 0);

    if (kpiKm)    kpiKm.textContent   = weekKm.toFixed(1);
    if (kpiElev)  kpiElev.textContent = Math.round(weekElev);

    const strip = document.getElementById('weeklyKpis');
    if (strip) strip.style.display = '';
  }

  updateWeeksRemainingKpi(n) {
    const el = document.getElementById('kpiWeeks');
    if (el) el.textContent = n;
    const strip = document.getElementById('weeklyKpis');
    if (strip) strip.style.display = '';
  }

  _buildWeekCard(week, isCurrent) {
    const deloadBadge = week.isDeload ? '<span class="week-phase" style="background:var(--c-accent-bg);color:var(--c-accent);">Descarga</span>' : '';
    const phaseBadge  = `<span class="week-phase">${week.phaseLabel}</span>`;
    const dates       = formatWeekDates(week.startDate, week.endDate);

    const sessionsHtml = week.sessions.map((s, idx) => `
      <div class="session-item" data-idx="${idx}">
        <div class="session-day">
          <div class="session-day-num">${s.dayNum}</div>
          <div class="session-day-name">${s.dayName}</div>
        </div>
        <div class="session-info">
          <div class="session-name">${_esc(s.name)}</div>
          <div class="session-meta">Correr · ${s.duration}</div>
        </div>
        <span class="session-type-badge ${s.badgeClass}">${_typeLabel(s.type)}</span>
        <svg class="session-chevron chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="session-detail" id="sd-${week.weekNum}-${idx}">
        <p>${_esc(s.description)}</p>
        <div class="session-detail-tags">${s.tags.map(t => `<span class="detail-tag">${t}</span>`).join('')}</div>
      </div>`
    ).join('');

    return `
      <div class="week-card ${isCurrent ? 'current-week' : ''}">
        <div class="week-card-header">
          <div class="week-label">
            ${isCurrent ? '<div class="week-dot"></div>' : ''}
            <span class="week-number">Semana ${week.weekNum}</span>
            ${phaseBadge}${deloadBadge}
          </div>
          <div class="week-dates">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${dates}
          </div>
        </div>
        <div class="week-stats">
          <span class="week-stat">~<strong>${week.targetKm}</strong> km</span>
          <span class="week-stat">~<strong>${week.targetElev}</strong> m D+</span>
          <span class="week-stat"><strong>${week.sessions.length}</strong> sesiones</span>
        </div>
        ${sessionsHtml}
      </div>`;
  }

  _buildCollapsedWeek(week) {
    const dates = formatWeekDates(week.startDate, week.endDate);
    const sessionsHtml = week.sessions.map((s, idx) => `
      <div class="session-item" data-idx="${idx}">
        <div class="session-day">
          <div class="session-day-num">${s.dayNum}</div>
          <div class="session-day-name">${s.dayName}</div>
        </div>
        <div class="session-info">
          <div class="session-name">${_esc(s.name)}</div>
          <div class="session-meta">Correr · ${s.duration}</div>
        </div>
        <span class="session-type-badge ${s.badgeClass}">${_typeLabel(s.type)}</span>
        <svg class="session-chevron chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="session-detail" id="sd-${week.weekNum}-${idx}">
        <p>${_esc(s.description)}</p>
        <div class="session-detail-tags">${s.tags.map(t => `<span class="detail-tag">${t}</span>`).join('')}</div>
      </div>`
    ).join('');

    return `
      <div class="week-card-collapsed" data-week="${week.weekNum}">
        <div class="week-collapsed-header">
          <div class="week-collapsed-left">
            <span class="week-collapsed-num">Semana ${week.weekNum}</span>
            <span class="week-phase">${week.phaseLabel}</span>
          </div>
          <div class="week-collapsed-right">
            <span class="week-collapsed-km">${week.targetKm} km</span>
            <svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="week-collapsed-dates" style="padding: 0 16px 12px; font-size:12px; color:var(--text-3); font-weight:500;">${dates}</div>
        <div class="week-collapsed-body" id="wcb-${week.weekNum}">${sessionsHtml}</div>
      </div>`;
  }

  _bindSessionToggles(container) {
    container.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        const parent = item.closest('.week-card, .week-collapsed-body');
        const weekNum = item.closest('[data-week]')?.dataset.week || item.closest('.week-card')?.querySelector('.week-number')?.textContent.match(/\d+/)?.[0];
        const idx     = item.dataset.idx;
        const detail  = parent?.querySelector(`[id^="sd-"][id$="-${idx}"]`) || item.nextElementSibling;
        if (!detail) return;
        const isOpen = detail.classList.toggle('open');
        item.querySelector('.chevron-icon')?.classList.toggle('rotated', isOpen);
      });
    });
  }

  _bindCollapsedWeeks(container) {
    container.querySelectorAll('.week-collapsed-header').forEach(header => {
      header.addEventListener('click', () => {
        const card  = header.closest('.week-card-collapsed');
        const wNum  = card.dataset.week;
        const body  = document.getElementById(`wcb-${wNum}`);
        const chev  = header.querySelector('.chevron-icon');
        if (!body) return;
        const isOpen = body.classList.toggle('open');
        chev?.classList.toggle('rotated', isOpen);
        if (isOpen) this._bindSessionToggles(body);
      });
    });
  }

  // ── Activities View ───────────────────────────────────────
  renderActivities(activities, filters = {}) {
    const list  = document.getElementById('activitiesList');
    const empty = document.getElementById('activitiesEmpty');
    if (!list) return;

    let filtered = activities || [];

    if (filters.year)  filtered = filtered.filter(a => new Date(a.start_date).getFullYear() === filters.year);
    if (filters.month) filtered = filtered.filter(a => new Date(a.start_date).getMonth() + 1 === filters.month);
    if (filters.type) {
      filtered = filtered.filter(a => {
        const t = (a.sport_type || a.type || '').toLowerCase();
        if (filters.type === 'trail') return t.includes('trail');
        if (filters.type === 'run')   return t.includes('run') && !t.includes('trail');
        return true;
      });
    }

    if (!filtered.length) {
      if (empty) {
        empty.style.display = '';
        if (!activities?.length) {
          empty.querySelector('p').innerHTML = 'Conecta Strava para ver<br>tus actividades';
          empty.querySelector('.btn-primary').style.display = '';
        } else {
          empty.querySelector('p').innerHTML = 'Sin actividades con<br>estos filtros';
          empty.querySelector('.btn-primary').style.display = 'none';
        }
      }
      const cards = list.querySelectorAll('.activity-card');
      cards.forEach(c => c.remove());
      return;
    }

    if (empty) empty.style.display = 'none';

    list.innerHTML = filtered.map(a => this._buildActivityCard(a)).join('') + (document.getElementById('activitiesEmpty')?.outerHTML || '');
    list.querySelector('#activitiesEmpty')?.remove();

    // Re-inject empty placeholder (hidden)
    if (!document.getElementById('activitiesEmpty')) {
      const placeholder = document.createElement('div');
      placeholder.className = 'empty-state';
      placeholder.id = 'activitiesEmpty';
      placeholder.style.display = 'none';
      placeholder.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><p>Sin actividades</p><button class="btn-primary" id="connectStravaBtn">Conectar Strava</button>`;
      list.appendChild(placeholder);
    }
  }

  _buildActivityCard(a) {
    const dist  = formatDistance(a.distance);
    const time  = formatTime(a.moving_time);
    const pace  = formatPace(a.average_speed);
    const elev  = a.total_elevation_gain ? formatElevation(a.total_elevation_gain) : null;
    const date  = new Date(a.start_date_local || a.start_date);
    const dateStr = `${date.getDate()} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][date.getMonth()]}`;
    const typeTag   = activityTypeLabel(a);
    const typeClass = activityTypeClass(a);
    const name = a.name || typeTag;

    return `
      <div class="activity-card">
        <div class="activity-top">
          <div class="activity-name">${_esc(name)}</div>
          <div class="activity-date">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${dateStr}
          </div>
        </div>
        <div class="activity-stats">
          <div class="activity-stat">
            <span class="activity-stat-label">Distancia</span>
            <span class="activity-stat-value">${dist}</span>
          </div>
          <div class="activity-stat">
            <span class="activity-stat-label">Tiempo</span>
            <span class="activity-stat-value">${time}</span>
          </div>
          <div class="activity-stat">
            <span class="activity-stat-label">Ritmo medio</span>
            <span class="activity-stat-value">${pace} <small style="font-size:11px;font-weight:500;">/km</small></span>
          </div>
        </div>
        ${elev ? `<div style="font-size:12px;color:var(--c-primary);font-weight:600;margin-top:2px;">+ ${elev} D+</div>` : ''}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
          <span class="activity-type-tag ${typeClass}">${typeTag}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
  }

  // Filter dropdown
  openFilterDropdown(anchorEl, items, currentValue, onSelect) {
    this._closeDropdown();
    const dropdown = document.getElementById('filterDropdown');
    const inner    = document.getElementById('filterDropdownInner');
    if (!dropdown || !inner) return;

    inner.innerHTML = items.map(item => `
      <button class="dropdown-item ${item.value === currentValue ? 'selected' : ''}" data-value="${item.value}">
        ${_esc(item.label)}
      </button>`).join('');

    inner.querySelectorAll('.dropdown-item').forEach(btn => {
      btn.addEventListener('click', () => {
        onSelect(btn.dataset.value === '' ? null : (isNaN(btn.dataset.value) ? btn.dataset.value : parseInt(btn.dataset.value)));
        this._closeDropdown();
      });
    });

    const rect = anchorEl.getBoundingClientRect();
    dropdown.style.display = 'block';
    dropdown.style.left    = `${rect.left}px`;
    dropdown.style.top     = `${rect.bottom + 6}px`;
    dropdown.style.minWidth = `${Math.max(160, rect.width)}px`;
    this._dropdownOpen = true;
    this._filterTarget = anchorEl;
  }

  _closeDropdown() {
    const dropdown = document.getElementById('filterDropdown');
    if (dropdown) dropdown.style.display = 'none';
    this._dropdownOpen = false;
    this._filterTarget = null;
  }

  _onDocClick(e) {
    if (this._dropdownOpen && !e.target.closest('#filterDropdown') && e.target !== this._filterTarget) {
      this._closeDropdown();
    }
    if (e.target.classList.contains('modal-overlay')) {
      this.closeSettings();
    }
  }

  // ── Profile View ──────────────────────────────────────────
  renderProfile(stats, config, athlete, details) {
    const cardWrapper = document.getElementById('athleteCardWrapper');
    const statsList   = document.getElementById('statsList');
    if (cardWrapper) cardWrapper.innerHTML = renderAthleteCard(stats, config, athlete);
    if (statsList)   {
      statsList.innerHTML = renderStatsList(stats, details);
      this._bindStatToggles();
      this._animateStatBars();
    }
  }

  _bindStatToggles() {
    document.querySelectorAll('.stat-row-header').forEach(header => {
      header.addEventListener('click', () => {
        const key    = header.closest('.stat-row')?.dataset.stat;
        const detail = document.getElementById(`detail-${key}`);
        const chev   = header.querySelector('.chevron-icon');
        if (!detail) return;
        const isOpen = detail.classList.toggle('open');
        chev?.classList.toggle('rotated', isOpen);
      });
    });
  }

  _animateStatBars() {
    // Animate after next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelectorAll('.stat-bar-fill').forEach(bar => {
          bar.style.width = bar.dataset.target || '0%';
        });
      });
    });
  }

  // ── Coach View ────────────────────────────────────────────
  addCoachMessage(text, isUser = false) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const row = document.createElement('div');
    row.className = `chat-row ${isUser ? 'user' : 'coach'}`;

    const now = new Date();
    const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isUser ? 'user-bubble' : 'coach-bubble'}`;

    if (isUser) {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = formatCoachReply(text);
    }

    const tsEl = document.createElement('span');
    tsEl.className = 'chat-ts';
    tsEl.textContent = ts;

    row.appendChild(bubble);
    row.appendChild(tsEl);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const typing = document.createElement('div');
    typing.id = 'typingIndicator';
    typing.className = 'chat-row coach';
    typing.innerHTML = `
      <div class="chat-bubble coach-bubble">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>`;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
  }

  hideTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
  }

  setCoachStatus(text, isThinking = false) {
    const el = document.getElementById('coachStatus');
    if (el) el.textContent = text;
  }

  enableSendBtn(enabled) {
    const btn = document.getElementById('sendBtn');
    if (btn) btn.disabled = !enabled;
  }

  clearChat() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = `
      <div class="chat-row coach">
        <div class="chat-bubble coach-bubble">
          Chat reiniciado. ¿En qué puedo ayudarte hoy?
        </div>
      </div>`;
  }

  // Welcome timestamp
  setWelcomeTs() {
    const el = document.getElementById('welcomeTs');
    if (!el) return;
    const now = new Date();
    el.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }
}

// Helpers
function _esc(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function _typeLabel(type) {
  const map = { easy: 'Fácil', hills: 'Cuestas', long: 'Tirada larga', rest: 'Descanso', workout: 'Calidad', race: 'Carrera' };
  return map[type] || type;
}
