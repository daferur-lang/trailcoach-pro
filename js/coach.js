// ProRun Coach — Claude API chat with athlete context
const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL      = 'claude-sonnet-4-6';
const HISTORY_KEY = 'tc_chat_history';
const MAX_HISTORY = 20; // message pairs to keep

const SYSTEM_PROMPT = `Eres ProRun Coach, un entrenador experto en trail running de media y larga distancia con 15+ años de experiencia en carreras de montaña (50K, 100K, ultras de montaña).

Características de tu coaching:
- Directo, motivador y práctico. Sin relleno ni palabras vacías.
- Hablas en español, tuteo natural.
- Das consejos accionables, no teoría abstracta.
- Conoces a fondo periodización, nutrición deportiva, entrenamiento de fuerza para trail, técnica de subida/bajada, gestión de la fatiga y recuperación.
- Cuando no sabes algo con certeza, lo dices y das la mejor orientación posible.
- Usas markdown básico para estructurar respuestas largas (negritas, listas cortas).
- Máximo 3-4 párrafos por respuesta salvo que sea un plan detallado.`;

export class CoachAI {
  constructor() {
    this._apiKey  = '';
    this._history = this._loadHistory();
  }

  setApiKey(key) {
    this._apiKey = key;
  }

  hasApiKey() {
    return !!(this._apiKey && this._apiKey.startsWith('sk-ant'));
  }

  buildContext(state) {
    const { config, activities, plan, planGenerator } = state;
    const lines = [];

    lines.push('--- CONTEXTO DEL ATLETA ---');
    if (config?.athleteName) lines.push(`Atleta: ${config.athleteName}`);

    if (config?.goalDistance && config?.goalDate) {
      const d = new Date(config.goalDate);
      const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      lines.push(`Objetivo: ${config.goalDistance} km con ${config.goalElevation || '?'} m D+ en ${months[d.getMonth()]} ${d.getFullYear()}`);
      if (planGenerator) {
        lines.push(`Semanas restantes: ${planGenerator.getWeeksRemaining()}`);
      }
    }

    if (activities?.length) {
      const recent5 = activities.slice(0, 5);
      lines.push('\nÚltimas 5 actividades (Strava):');
      recent5.forEach(a => {
        const dist  = (a.distance / 1000).toFixed(1) + ' km';
        const elev  = a.total_elevation_gain ? `${Math.round(a.total_elevation_gain)} m D+` : '';
        const pace  = a.average_speed ? this._formatPace(a.average_speed) : '';
        const date  = new Date(a.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        lines.push(`- ${date}: ${a.name} | ${dist}${elev ? ' | ' + elev : ''} | ${pace}`);
      });

      // Weekly KPIs (last 7 days)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thisWeek   = activities.filter(a => new Date(a.start_date) >= oneWeekAgo);
      const weekKm     = thisWeek.reduce((s, a) => s + a.distance / 1000, 0);
      const weekElev   = thisWeek.reduce((s, a) => s + (a.total_elevation_gain || 0), 0);
      if (thisWeek.length) {
        lines.push(`\nÚltimos 7 días: ${weekKm.toFixed(1)} km | ${Math.round(weekElev)} m D+ | ${thisWeek.length} sesiones`);
      }
    } else {
      lines.push('\nActividades Strava: no sincronizadas todavía.');
    }

    if (planGenerator) {
      const currentWeek = planGenerator.getCurrentWeek();
      if (currentWeek) {
        lines.push(`\nPlan actual — Semana ${currentWeek.weekNum} (${currentWeek.phaseLabel}):`);
        currentWeek.sessions.forEach(s => {
          lines.push(`- ${s.dayName} ${s.dayNum}: ${s.name} (${s.duration})`);
        });
      }
    }

    return lines.join('\n');
  }

  async sendMessage(userMessage, context) {
    if (!this.hasApiKey()) {
      throw new Error('Configura tu API Key de Anthropic en Ajustes para usar el coach IA.');
    }

    const contextualSystem = `${SYSTEM_PROMPT}\n\n${context}`;

    // Build messages array with history
    const messages = [
      ...this._history,
      { role: 'user', content: userMessage }
    ];

    const body = {
      model:      MODEL,
      max_tokens: 1024,
      system:     contextualSystem,
      messages
    };

    const resp = await fetch(CLAUDE_API, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         this._apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (resp.status === 401) throw new Error('API Key inválida. Verifica en Ajustes.');
    if (resp.status === 429) throw new Error('Límite de Claude alcanzado. Espera un momento.');
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error ${resp.status}`);
    }

    const data = await resp.json();
    const reply = data.content?.[0]?.text || 'Sin respuesta.';

    // Update history
    this._history.push({ role: 'user', content: userMessage });
    this._history.push({ role: 'assistant', content: reply });

    // Trim to MAX_HISTORY pairs
    while (this._history.length > MAX_HISTORY * 2) {
      this._history.splice(0, 2);
    }

    this._saveHistory();
    return reply;
  }

  clearHistory() {
    this._history = [];
    localStorage.removeItem(HISTORY_KEY);
  }

  _loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  _saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(this._history));
  }

  _formatPace(speedMs) {
    if (!speedMs || speedMs <= 0) return '';
    const s = 1000 / speedMs;
    return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}/km`;
  }
}

// Format coach reply: convert basic markdown to HTML
export function formatCoachReply(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}
