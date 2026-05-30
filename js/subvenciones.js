// Grants (Subvenciones) data manager — localStorage-backed
const GRANTS_KEY = 'tc_grants';

const SAMPLE = [
  {
    id: 'g1',
    convocatoria: 'Consejería de Inclusión Social',
    tipo: 'Autonómica',
    proyecto: 'Equipamiento e Intervención Social',
    importe: 35000,
    deadline: '2026-06-15',
    estado: 'enviada',
    comisionPct: 10
  },
  {
    id: 'g2',
    convocatoria: 'Ministerio de Derechos Sociales',
    tipo: 'IRPF Estatal',
    proyecto: 'Digitalización del voluntariado y base de datos',
    importe: 60000,
    deadline: '',
    estado: 'concedida',
    comisionPct: 8
  },
  {
    id: 'g3',
    convocatoria: 'Ayuntamiento (Área de Bienestar)',
    tipo: 'Local',
    proyecto: 'Talleres comunitarios de integración',
    importe: 12000,
    deadline: '2026-07-12',
    estado: 'redaccion',
    comisionPct: 12
  },
  {
    id: 'g4',
    convocatoria: 'Fondos Europeos (Next Gen)',
    tipo: '',
    proyecto: 'Infraestructura sostenible y eficiencia energética',
    importe: 150000,
    deadline: '',
    estado: 'denegada',
    comisionPct: 5
  }
];

export class GrantsManager {
  constructor() {
    this._grants = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(GRANTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return SAMPLE.map(g => ({ ...g }));
  }

  _save() {
    localStorage.setItem(GRANTS_KEY, JSON.stringify(this._grants));
  }

  getAll() { return this._grants; }

  add(data) {
    const grant = { id: Date.now().toString(), ...data };
    this._grants.unshift(grant);
    this._save();
    return grant;
  }

  update(id, data) {
    const i = this._grants.findIndex(g => g.id === id);
    if (i !== -1) { this._grants[i] = { ...this._grants[i], ...data }; this._save(); }
  }

  remove(id) {
    this._grants = this._grants.filter(g => g.id !== id);
    this._save();
  }

  totals() {
    const gs = this._grants;
    const total    = gs.reduce((s, g) => s + (g.importe || 0), 0);
    const conceded = gs.filter(g => g.estado === 'concedida').reduce((s, g) => s + (g.importe || 0), 0);
    const revision = gs.filter(g => ['enviada', 'redaccion'].includes(g.estado))
                       .reduce((s, g) => s + (g.importe || 0), 0);
    const comision = gs.filter(g => g.estado === 'concedida')
                       .reduce((s, g) => s + (g.importe || 0) * ((g.comisionPct || 0) / 100), 0);
    const avgPct   = gs.length ? gs.reduce((s, g) => s + (g.comisionPct || 0), 0) / gs.length : 0;
    return { total, conceded, revision, comision, avgPct };
  }
}

// Helpers used by app.js to render the grants view
export function renderGrantsView(manager) {
  _renderKpis(manager.totals());
  _renderList(manager.getAll());
}

function _renderKpis(t) {
  const el = document.getElementById('grantsKpis');
  if (!el) return;
  el.innerHTML = `
    <div class="grant-kpi-card">
      <div class="grant-kpi-label">Total solicitado</div>
      <div class="grant-kpi-value" style="color:var(--c-primary)">${_eur(t.total)}</div>
    </div>
    <div class="grant-kpi-card">
      <div class="grant-kpi-label">Concedido</div>
      <div class="grant-kpi-value" style="color:var(--c-success)">${_eur(t.conceded)}</div>
    </div>
    <div class="grant-kpi-card">
      <div class="grant-kpi-label">En revisión</div>
      <div class="grant-kpi-value" style="color:var(--c-warning)">${_eur(t.revision)}</div>
    </div>
    <div class="grant-kpi-card">
      <div class="grant-kpi-label">Honorarios éxito</div>
      <div class="grant-kpi-value">${_eur(t.comision)} <span class="grant-kpi-sub">${t.avgPct.toFixed(0)}% media</span></div>
    </div>`;
}

function _renderList(grants) {
  const el = document.getElementById('grantsList');
  if (!el) return;
  if (!grants.length) {
    el.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg><p>Sin solicitudes.<br>Pulsa + Nueva para añadir.</p></div>`;
    return;
  }
  el.innerHTML = grants.map(g => _buildCard(g)).join('');
}

const STATUS_MAP = {
  redaccion: { label: 'En Redacción',     cls: 'gs-warning' },
  enviada:   { label: 'En Revisión',       cls: 'gs-warning' },
  concedida: { label: 'Concedida',         cls: 'gs-success' },
  denegada:  { label: 'Denegada',          cls: 'gs-danger'  },
  pendiente: { label: 'Pendiente',         cls: 'gs-neutral' }
};

function _buildCard(g) {
  const st       = STATUS_MAP[g.estado] || { label: g.estado, cls: 'gs-neutral' };
  const deadline = g.deadline ? _fmtDate(g.deadline) : '—';
  const comEur   = g.estado === 'concedida' ? _eur((g.importe || 0) * (g.comisionPct || 0) / 100) : `${_eur((g.importe || 0) * (g.comisionPct || 0) / 100)}`;
  const tipoTag  = g.tipo ? `<span class="grant-tipo">${_esc(g.tipo)}</span>` : '';
  return `
    <div class="grant-card" data-id="${_esc(g.id)}">
      <div class="grant-card-head">
        <div class="grant-card-org">
          <span class="grant-org-name">${_esc(g.convocatoria)}</span>
          ${tipoTag}
        </div>
        <span class="grant-status ${st.cls}">${st.label}</span>
      </div>
      <div class="grant-card-proyecto">${_esc(g.proyecto)}</div>
      <div class="grant-card-foot">
        <span class="grant-importe">${_eur(g.importe || 0)}</span>
        <div class="grant-foot-meta">
          <span>Plazo: ${deadline}</span>
          <span>Comisión: ${g.comisionPct || 0}% · ${comEur}</span>
        </div>
        <div class="grant-actions">
          <button class="grant-edit-btn" data-id="${_esc(g.id)}" aria-label="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="grant-del-btn" data-id="${_esc(g.id)}" aria-label="Eliminar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

function _eur(n) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function _fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
