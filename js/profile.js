// Athlete Profile — Stats Calculation + Player Card Renderer
// Stats: SPR (Sprint), MIDDLE, LONG, ENDURANCE — scale 0–100

const STAT_META = {
  sprint: {
    key:     'sprint',
    label:   'Sprint',
    cardLabel: 'SPRINT',
    barClass:  'bar-sprint',
    color:   '#06B6D4',
    description: 'Rendimiento en distancias cortas y velocidad máxima. Basado en tus actividades de menos de 10 km.'
  },
  middle: {
    key:     'middle',
    label:   'Media distancia',
    cardLabel: 'MIDDLE',
    barClass:  'bar-middle',
    color:   '#E8621A',
    description: 'Capacidad aeróbica en 10–25 km. Combina ritmo y resistencia en terreno variado.'
  },
  long: {
    key:     'long',
    label:   'Larga distancia',
    cardLabel: 'LONG',
    barClass:  'bar-long',
    color:   '#4A7C59',
    description: 'Potencia de ultra resistencia en 25–50 km. Tu punto más fuerte.'
  },
  endurance: {
    key:     'endurance',
    label:   'Resistencia',
    cardLabel: 'ENDURANCE',
    barClass:  'bar-endurance',
    color:   '#8B5CF6',
    description: 'Capacidad para 50 km+. Mejora con tiradas largas acumuladas y desnivel.'
  }
};

export class ProfileManager {
  constructor() {
    this._stats = null;
  }

  // Calculate stats from Strava activities
  calculate(activities, config) {
    if (!activities || !activities.length) {
      return this._defaultStats(config);
    }

    const runs = activities.filter(a => {
      const t = (a.sport_type || a.type || '').toLowerCase();
      return t.includes('run') || t.includes('trail') || t.includes('hike');
    });

    if (!runs.length) return this._defaultStats(config);

    // Group by distance buckets
    const short  = runs.filter(a => a.distance < 10000);   // < 10 km
    const mid    = runs.filter(a => a.distance >= 10000 && a.distance < 25000); // 10-25 km
    const longR  = runs.filter(a => a.distance >= 25000 && a.distance < 50000); // 25-50 km
    const ultra  = runs.filter(a => a.distance >= 50000);  // 50+ km

    const goalDist = (config?.goalDistance || 65) * 1000;

    const sprint    = this._calcSprint(short, runs);
    const middle    = this._calcMiddle(mid, runs);
    const longScore = this._calcLong(longR, runs, goalDist);
    const endurance = this._calcEndurance(ultra, longR, goalDist);
    const overall   = Math.round(sprint * 0.20 + middle * 0.20 + longScore * 0.40 + endurance * 0.20);

    this._stats = { sprint, middle, long: longScore, endurance, overall };
    return this._stats;
  }

  _calcSprint(short, allRuns) {
    // Best average speed on short activities, relative to elite pace
    const elitePace = 220; // sec/km for elite (3:40/km)
    if (!short.length) {
      // Extrapolate from fastest activity
      const fastest = allRuns.reduce((best, a) => a.average_speed > best.average_speed ? a : best, allRuns[0]);
      const pace = 1000 / Math.max(fastest.average_speed, 1);
      return Math.max(5, Math.round(Math.min(100, (elitePace / pace) * 40)));
    }
    const best = short.reduce((b, a) => a.average_speed > b.average_speed ? a : b, short[0]);
    const pace = 1000 / Math.max(best.average_speed, 1);
    return Math.max(5, Math.round(Math.min(100, (elitePace / pace) * 40)));
  }

  _calcMiddle(mid, allRuns) {
    const elitePace = 270; // sec/km (4:30/km) adjusted for trail
    if (!mid.length) {
      const candidates = allRuns.filter(a => a.distance >= 5000 && a.distance < 30000);
      if (!candidates.length) return 15;
      const best = candidates.reduce((b, a) => a.average_speed > b.average_speed ? a : b, candidates[0]);
      const pace = 1000 / Math.max(best.average_speed, 1);
      return Math.max(5, Math.round(Math.min(100, (elitePace / pace) * 38)));
    }
    const best = mid.reduce((b, a) => a.average_speed > b.average_speed ? a : b, mid[0]);
    const pace = 1000 / Math.max(best.average_speed, 1);
    return Math.max(5, Math.round(Math.min(100, (elitePace / pace) * 38)));
  }

  _calcLong(longRuns, allRuns, goalDist) {
    // Combine pace quality + longest distance achievement
    const longestRun = allRuns.reduce((b, a) => a.distance > b.distance ? a : b, allRuns[0]);
    const distanceScore = Math.min(65, Math.round((longestRun.distance / goalDist) * 65));

    const elitePace = 340; // sec/km (5:40/km) for 30+ km trail
    let paceScore = 0;
    if (longRuns.length) {
      const best = longRuns.reduce((b, a) => a.average_speed > b.average_speed ? a : b, longRuns[0]);
      const pace = 1000 / Math.max(best.average_speed, 1);
      paceScore = Math.round(Math.min(35, (elitePace / pace) * 15));
    } else if (longestRun.distance > 15000) {
      const pace = 1000 / Math.max(longestRun.average_speed, 1);
      paceScore = Math.round(Math.min(35, (elitePace / pace) * 10));
    }

    return Math.max(5, Math.min(100, distanceScore + paceScore));
  }

  _calcEndurance(ultra, longRuns, goalDist) {
    if (!ultra.length && !longRuns.length) return Math.max(5, 10);

    const elitePace = 400; // sec/km (6:40/km) for ultra
    if (ultra.length) {
      const best = ultra.reduce((b, a) => a.distance > b.distance ? a : b, ultra[0]);
      const pace = 1000 / Math.max(best.average_speed, 1);
      const pScore = Math.round(Math.min(60, (elitePace / pace) * 25));
      const dScore = Math.round(Math.min(40, (best.distance / goalDist) * 40));
      return Math.max(5, pScore + dScore);
    }

    // Extrapolate from long runs — predict ultra performance
    if (longRuns.length) {
      const best = longRuns.reduce((b, a) => a.distance > b.distance ? a : b, longRuns[0]);
      const paceDegradation = 1.15; // typical degradation from 30km to 65km
      const estimatedUltraPace = (1000 / Math.max(best.average_speed, 1)) * paceDegradation;
      const score = Math.round(Math.min(40, (elitePace / estimatedUltraPace) * 20));
      return Math.max(5, score);
    }

    return 10;
  }

  _defaultStats(config) {
    return { sprint: 20, middle: 20, long: 20, endurance: 15, overall: 20 };
  }

  getStats() {
    return this._stats;
  }

  // Build detail data for each stat
  getStatDetails(activities) {
    if (!activities?.length) return {};
    const runs = activities.filter(a => {
      const t = (a.sport_type || a.type || '').toLowerCase();
      return t.includes('run') || t.includes('trail');
    });
    if (!runs.length) return {};

    const longestRun = runs.reduce((b, a) => a.distance > b.distance ? a : b, runs[0]);
    const fastest5   = this._bestInRange(runs, 4000, 6000);
    const best10     = this._bestInRange(runs, 8000, 12000);
    const bestTrail  = this._bestInRange(runs.filter(a => a.total_elevation_gain > 200), 10000, 25000);

    const formatPace = (speedMs) => {
      if (!speedMs) return '—';
      const s = 1000 / speedMs;
      return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,'0')}/km`;
    };

    return {
      sprint:    { best5k: formatPace(fastest5?.average_speed), activities: runs.filter(a=>a.distance<10000).length },
      middle:    { best10k: formatPace(best10?.average_speed), bestTrail: formatPace(bestTrail?.average_speed), activities: runs.filter(a=>a.distance>=10000&&a.distance<25000).length },
      long:      { longestKm: (longestRun.distance/1000).toFixed(1)+' km', bestPace: formatPace(longestRun.average_speed), activities: runs.filter(a=>a.distance>=25000).length },
      endurance: { totalKm: Math.round(runs.reduce((s,a)=>s+a.distance,0)/1000)+' km', ultraRuns: runs.filter(a=>a.distance>=50000).length }
    };
  }

  _bestInRange(runs, minM, maxM) {
    const filtered = runs.filter(a => a.distance >= minM && a.distance <= maxM);
    if (!filtered.length) return null;
    return filtered.reduce((b, a) => a.average_speed > b.average_speed ? a : b, filtered[0]);
  }
}

// Render the player card HTML
export function renderAthleteCard(stats, config, athlete) {
  const name    = config?.athleteName || athlete?.firstname || 'Atleta';
  const overall = stats?.overall || 20;
  const spr     = stats?.sprint    || 20;
  const mid     = stats?.middle    || 20;
  const lng     = stats?.long      || 20;
  const end     = stats?.endurance || 15;

  const photoHtml = (athlete?.profile && !athlete.profile.includes('avatar'))
    ? `<img src="${athlete.profile}" alt="${name}" loading="lazy">`
    : `<svg class="card-photo-placeholder" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  return `
    <div class="athlete-card">
      <div class="card-stars">${_stars()}</div>
      <div class="card-top-bar">
        <div class="card-overall">
          <span class="card-overall-num">${overall}</span>
          <span class="card-overall-label">SPR</span>
        </div>
        <span class="card-brand">PRORUN</span>
      </div>
      <div class="card-photo">${photoHtml}</div>
      <div class="card-name">${_esc(name)}</div>
      <div class="card-stats">
        <div class="card-stat">
          <span class="card-stat-value">${spr}</span>
          <span class="card-stat-label">SPRINT</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-value">${mid}</span>
          <span class="card-stat-label">MIDDLE</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-value">${lng}</span>
          <span class="card-stat-label">LONG</span>
        </div>
        <div class="card-stat">
          <span class="card-stat-value">${end}</span>
          <span class="card-stat-label">ENDUR.</span>
        </div>
      </div>
    </div>`;
}

// Render the stats list rows
export function renderStatsList(stats, details) {
  const rows = [
    { meta: STAT_META.sprint,    score: stats?.sprint    || 20, detail: details?.sprint    },
    { meta: STAT_META.middle,    score: stats?.middle    || 20, detail: details?.middle    },
    { meta: STAT_META.long,      score: stats?.long      || 20, detail: details?.long      },
    { meta: STAT_META.endurance, score: stats?.endurance || 15, detail: details?.endurance }
  ];

  return rows.map(({ meta, score, detail }) => {
    const pct = Math.round(score);
    const detailHtml = detail ? _buildDetailGrid(meta.key, detail) : '';

    return `
      <div class="stat-row" data-stat="${meta.key}">
        <div class="stat-row-header">
          <span class="stat-row-name">${meta.label}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="stat-row-score">${score}</span>
            <svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="stat-bar">
          <div class="stat-bar-fill ${meta.barClass}" style="width:0%" data-target="${pct}%"></div>
        </div>
        <div class="stat-row-detail" id="detail-${meta.key}">
          <p>${meta.description}</p>
          ${detailHtml}
        </div>
      </div>`;
  }).join('');
}

function _buildDetailGrid(key, detail) {
  const items = [];
  if (key === 'sprint') {
    if (detail.best5k)      items.push({ label: 'Mejor ritmo ~5K', value: detail.best5k });
    if (detail.activities)  items.push({ label: 'Actividades cortas', value: detail.activities });
  } else if (key === 'middle') {
    if (detail.best10k)     items.push({ label: 'Mejor ritmo ~10K', value: detail.best10k });
    if (detail.bestTrail)   items.push({ label: 'Mejor trail técnico', value: detail.bestTrail });
    if (detail.activities)  items.push({ label: 'Actividades 10-25km', value: detail.activities });
  } else if (key === 'long') {
    if (detail.longestKm)   items.push({ label: 'Distancia máxima', value: detail.longestKm });
    if (detail.bestPace)    items.push({ label: 'Ritmo tirada larga', value: detail.bestPace });
    if (detail.activities)  items.push({ label: 'Salidas 25-50km', value: detail.activities });
  } else if (key === 'endurance') {
    if (detail.totalKm)     items.push({ label: 'Total acumulado', value: detail.totalKm });
    if (detail.ultraRuns !== undefined) items.push({ label: 'Salidas 50km+', value: detail.ultraRuns });
  }

  if (!items.length) return '';
  return `<div class="stat-row-detail-grid">${
    items.map(i => `<div class="stat-detail-item"><span class="stat-detail-label">${i.label}</span><span class="stat-detail-value">${i.value}</span></div>`).join('')
  }</div>`;
}

function _stars() {
  let svg = '';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 220;
    const y = Math.random() * 240;
    const r = Math.random() * 1.2 + 0.3;
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="white"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="290" viewBox="0 0 220 290">${svg}</svg>`;
}

function _esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
