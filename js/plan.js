// Training Plan Generator — Periodization for Trail Running
// Phases: Base → Específico → Pico → Taper

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_ES  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Session templates by phase
const SESSIONS = {
  base: [
    {
      day: 1, // Monday
      name: 'Rodaje de recuperación + movilidad',
      type: 'easy',
      badgeClass: 'badge-rest',
      durationFn: (km) => `${25 + Math.round(km * 0.3)} min`,
      description: 'Rodaje muy suave en llano o ligeramente ondulado. Zona 1-2. Termina con 10 min de estiramientos dinámicos y movilidad de cadera.',
      tags: ['Zona 1-2', 'RPE 3-4', 'Llano', 'Movilidad']
    },
    {
      day: 3, // Wednesday
      name: 'Cuestas cortas',
      type: 'hills',
      badgeClass: 'badge-hills',
      durationFn: (km, w) => `${Math.min(8, 4 + Math.floor(w/2))}–${Math.min(12, 6 + Math.floor(w/2))} rep × 60–80m D+`,
      description: 'Calentamiento 15 min. Subidas a esfuerzo controlado (RPE 7), bajada trotando. Cierra con 10 min suave. Técnica: pasos cortos, cadencia alta, brazos activos.',
      tags: ['Zona 3-4', 'RPE 6-7', 'Técnica subida', 'Fuerza']
    },
    {
      day: 6, // Saturday
      name: 'Tirada larga suave',
      type: 'long',
      badgeClass: 'badge-long',
      durationFn: (km) => `${Math.round(60 + km * 8)} min`,
      description: 'Ritmo conversacional estricto (zona 2). El objetivo es tiempo en pies, no velocidad. Terreno trail con poco desnivel. Come y bebe desde el minuto 40.',
      tags: ['Zona 2', 'RPE 4-5', 'Trail', 'Base aeróbica']
    }
  ],
  specific: [
    {
      day: 1,
      name: 'Rodaje fácil en llano',
      type: 'easy',
      badgeClass: 'badge-easy',
      durationFn: (km) => `${30 + Math.round(km * 0.4)} min`,
      description: 'Recuperación activa post-semana. Zona 2 estricta. Puede ser asfalto o camino. Aprovecha para revisar sensaciones musculares.',
      tags: ['Zona 2', 'RPE 4', 'Recuperación', 'Llano']
    },
    {
      day: 2, // Tuesday
      name: 'Cuestas largas + técnica bajada',
      type: 'hills',
      badgeClass: 'badge-hills',
      durationFn: (km, w) => `${Math.min(6, 3 + Math.floor(w/3))}–${Math.min(8, 5 + Math.floor(w/3))} rep × 150–200m D+`,
      description: 'Calentamiento 15 min. Subidas a RPE 7-8, bajadas técnicas a ritmo progresivo. Foco en economía de bajada: centros de gravedad bajo, aterrizaje bajo la cadera. Vuelta calma 10 min.',
      tags: ['Zona 3-4', 'RPE 7-8', 'Técnica bajada', 'Fuerza específica']
    },
    {
      day: 4, // Thursday
      name: 'Rodaje trail técnico',
      type: 'easy',
      badgeClass: 'badge-easy',
      durationFn: (km) => `${50 + Math.round(km * 0.6)} min`,
      description: 'Trail con terreno variado. Zona 2-3. Practicamente no pares. Trabaja la lectura del terreno y adaptación de la zancada. Incluye algo de D+ sin forzar.',
      tags: ['Zona 2-3', 'RPE 5-6', 'Técnica', 'Trail variado']
    },
    {
      day: 6,
      name: 'Tirada larga con desnivel',
      type: 'long',
      badgeClass: 'badge-long',
      durationFn: (km) => `${Math.round(90 + km * 10)} min`,
      description: 'Salida de montaña con D+ progresivo. Zona 2, caminar en pendientes >15%. Hidratación y nutrición cada 40-50 min. Esta sesión simula las exigencias de tu objetivo.',
      tags: ['Zona 2', 'RPE 5-6', 'D+ real', 'Nutrición en carrera']
    }
  ],
  peak: [
    {
      day: 1,
      name: 'Descanso activo',
      type: 'rest',
      badgeClass: 'badge-rest',
      durationFn: () => '20–30 min',
      description: 'Paseo suave o yoga. Nada de carrera. Prepara las piernas para la semana más exigente.',
      tags: ['Descanso', 'Movilidad', 'Recuperación']
    },
    {
      day: 3,
      name: 'Series mixtas + cuestas',
      type: 'workout',
      badgeClass: 'badge-workout',
      durationFn: () => '70–80 min total',
      description: '15 min calentamiento. 4 rep × 200m D+ + 4 × 800m en llano a ritmo 10K. Zona 4-5. Vuelta calma 15 min. Esta es la sesión de calidad máxima del ciclo.',
      tags: ['Zona 4-5', 'RPE 8', 'VO2max', 'Calidad máxima']
    },
    {
      day: 5,
      name: 'Rodaje fácil + activación',
      type: 'easy',
      badgeClass: 'badge-easy',
      durationFn: () => '30–40 min',
      description: 'Rodaje suave con 4–6 aceleraciones de 20 seg al final. Mantén las piernas activas antes de la tirada del sábado.',
      tags: ['Zona 2', 'RPE 3-4', 'Activación', 'Pre-tirada']
    },
    {
      day: 6,
      name: 'Tirada ultra larga (pico de carga)',
      type: 'long',
      badgeClass: 'badge-long',
      durationFn: (km) => `${Math.round(150 + km * 12)} min`,
      description: 'Tu tirada más larga del ciclo. Zona 2 estricta. Practica tu protocolo de carrera: nutrición, hidratación, equipo. Camina en pendientes fuertes. Llega cansado pero no destruido.',
      tags: ['Zona 2', 'RPE 5', 'Simulacro carrera', 'Protocolo nutricional']
    }
  ],
  taper: [
    {
      day: 1,
      name: 'Descanso total',
      type: 'rest',
      badgeClass: 'badge-rest',
      durationFn: () => '—',
      description: 'Descanso completo. Movilidad y estiramientos suaves si los necesitas. La recuperación ES el entrenamiento.',
      tags: ['Descanso', 'Recuperación']
    },
    {
      day: 3,
      name: 'Cuestas suaves de activación',
      type: 'hills',
      badgeClass: 'badge-hills',
      durationFn: () => '4–6 rep × 60m D+',
      description: 'Solo para mantener las piernas vivas. RPE 5 máximo. No intentes sacar rendimiento. 15 min calentamiento + series suaves + 10 min vuelta calma.',
      tags: ['Zona 2-3', 'RPE 5', 'Activación', 'Sin fatiga']
    },
    {
      day: 5,
      name: 'Rodaje trail fácil',
      type: 'easy',
      badgeClass: 'badge-easy',
      durationFn: () => '40–50 min',
      description: 'Terreno similar a la carrera si es posible. Zona 2. Sin presión. Confirma que el equipo (zapatillas, mochila, bastones) está a punto.',
      tags: ['Zona 2', 'RPE 4', 'Verificar equipo', 'Trail']
    }
  ]
};

export class PlanGenerator {
  constructor() {
    this._plan = null;
  }

  generate(config, activities = []) {
    const today    = new Date();
    const goalDate = new Date(config.goalDate);

    if (!config.goalDate || isNaN(goalDate)) return null;
    if (goalDate <= today) return null;

    const msPerWeek   = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks  = Math.max(4, Math.ceil((goalDate - today) / msPerWeek));

    // Current training load from last 4 weeks
    const fourWeeksAgo = new Date(today - 28 * 24 * 60 * 60 * 1000);
    const recent = activities.filter(a => new Date(a.start_date) >= fourWeeksAgo);
    const recentKm   = recent.reduce((s, a) => s + (a.distance || 0) / 1000, 0) / 4;
    const recentElev = recent.reduce((s, a) => s + (a.total_elevation_gain || 0), 0) / 4;

    const baseKm   = Math.max(25, recentKm);
    const baseElev = Math.max(300, recentElev);
    const peakKm   = Math.min(90, (config.goalDistance || 65) * 0.65);
    const peakElev = Math.min(2500, (config.goalElevation || 2000) * 0.55);

    // Phase distribution
    const taperW    = Math.min(3, Math.round(totalWeeks * 0.12));
    const peakW     = Math.min(2, Math.round(totalWeeks * 0.10));
    const specificW = Math.round((totalWeeks - taperW - peakW) * 0.50);
    const baseW     = totalWeeks - taperW - peakW - specificW;

    const phases = [
      { name: 'base',     label: 'Base',      weeks: Math.max(2, baseW)     },
      { name: 'specific', label: 'Específico', weeks: Math.max(2, specificW) },
      { name: 'peak',     label: 'Pico',       weeks: Math.max(1, peakW)     },
      { name: 'taper',    label: 'Taper',      weeks: Math.max(1, taperW)    }
    ];

    const plan = [];
    let weekNum = 0;

    for (const phase of phases) {
      for (let i = 0; i < phase.weeks; i++) {
        weekNum++;
        const isDeload = (i > 0 && i % 3 === 2 && phase.name !== 'taper');

        // Start date: find Monday of the week
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + (weekNum - 1) * 7);
        const dow = weekStart.getDay();
        const toMon = dow === 0 ? -6 : 1 - dow;
        weekStart.setDate(weekStart.getDate() + toMon);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const progress = weekNum / totalWeeks;
        const loadFactor = this._loadCurve(progress, phase.name, isDeload);
        const targetKm   = Math.round((baseKm + (peakKm - baseKm) * loadFactor) * 10) / 10;
        const targetElev = Math.round(baseElev + (peakElev - baseElev) * loadFactor);

        const sessions = this._buildSessions(phase.name, i, targetKm, weekStart);

        plan.push({
          weekNum,
          phase:      phase.name,
          phaseLabel: phase.label,
          startDate:  weekStart,
          endDate:    weekEnd,
          targetKm,
          targetElev,
          isDeload,
          sessions
        });
      }
    }

    this._plan = plan;
    return plan;
  }

  _loadCurve(progress, phase, isDeload) {
    let base;
    if (phase === 'taper') {
      base = 0.55 - (progress * 0.3);
    } else {
      // Smooth S-curve progression
      base = 1 / (1 + Math.exp(-8 * (progress - 0.5)));
    }
    return isDeload ? base * 0.72 : base;
  }

  _buildSessions(phaseName, weekIndex, targetKm, weekStart) {
    const templates = SESSIONS[phaseName] || SESSIONS.base;
    return templates.map(t => {
      const sessionDate = new Date(weekStart);
      // Adjust so day 0=Sun,1=Mon,...6=Sat aligns with template day
      const currentDow = weekStart.getDay(); // Monday = 1
      let daysToAdd = t.day - currentDow;
      if (daysToAdd < 0) daysToAdd += 7;
      sessionDate.setDate(weekStart.getDate() + daysToAdd);

      return {
        date:        sessionDate,
        dayNum:      sessionDate.getDate(),
        dayName:     DAY_NAMES[sessionDate.getDay()],
        name:        t.name,
        type:        t.type,
        badgeClass:  t.badgeClass,
        duration:    t.durationFn(targetKm, weekIndex),
        description: t.description,
        tags:        t.tags
      };
    });
  }

  getCurrentWeek() {
    if (!this._plan) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this._plan.find(w => {
      const s = new Date(w.startDate); s.setHours(0,0,0,0);
      const e = new Date(w.endDate);   e.setHours(23,59,59,999);
      return today >= s && today <= e;
    }) || this._plan[0];
  }

  getUpcomingWeeks(limit = 8) {
    if (!this._plan) return [];
    const current = this.getCurrentWeek();
    if (!current) return this._plan.slice(1, 1 + limit);
    return this._plan.filter(w => w.weekNum > current.weekNum).slice(0, limit);
  }

  getPlan() {
    return this._plan;
  }

  getWeeksRemaining() {
    if (!this._plan) return 0;
    const current = this.getCurrentWeek();
    if (!current) return 0;
    return this._plan.filter(w => w.weekNum >= current.weekNum).length;
  }
}

// Date formatting helpers
export function formatWeekDates(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTH_ES[s.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTH_ES[s.getMonth()]} – ${e.getDate()} ${MONTH_ES[e.getMonth()]}`;
}

export function formatGoalDate(dateStr) {
  const d = new Date(dateStr);
  return `${MONTH_ES[d.getMonth()]} ${d.getFullYear()}`;
}
