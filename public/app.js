const TIER_LABEL = {
  IRON: 'Hierro', BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro',
  PLATINUM: 'Platino', EMERALD: 'Esmeralda', DIAMOND: 'Diamante',
  MASTER: 'Maestro', GRANDMASTER: 'Gran Maestro', CHALLENGER: 'Aspirante',
};

function emblemUrl(tier) {
  if (!tier) return '';
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
}

function profileIconUrl(profileIconId) {
  if (!profileIconId) return '';
  return `https://ddragon.leagueoflegends.com/cdn/14.23.1/img/profileicon/${profileIconId}.png`;
}

function formatRank(entry) {
  if (entry.unranked || !entry.tier) return 'Sin clasificar';
  const label = TIER_LABEL[entry.tier] || entry.tier;
  const apex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(entry.tier);
  return apex ? label : `${label} ${entry.rank}`;
}

function winrate(entry) {
  const total = (entry.wins || 0) + (entry.losses || 0);
  if (!total) return 0;
  return Math.round((entry.wins / total) * 100);
}

function formatLpToday(entry) {
  const v = entry.lpToday ?? 0;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v}`;
}

function lpTodayColor(entry) {
  const v = entry.lpToday ?? 0;
  if (v > 0) return '#3ddc84';
  if (v < 0) return '#ff6b6b';
  return 'var(--muted)';
}

const ROLE_ICON_KEY = {
  TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'middle', BOTTOM: 'bottom', UTILITY: 'utility',
};

function roleIconUrl(role) {
  if (!role || !ROLE_ICON_KEY[role]) return '';
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-${ROLE_ICON_KEY[role]}.svg`;
}

function roleBadge(entry) {
  if (!entry.mainRole) return '';
  return `<img class="role-icon" src="${roleIconUrl(entry.mainRole)}" alt="${entry.mainRoleLabel}" title="${entry.mainRoleLabel}" onerror="this.style.display='none'" />`;
}

const MEDAL_ICON = ['&#128081;', '&#129352;', '&#129353;'];

function renderPodium(top3) {
  const podium = document.getElementById('podium');
  if (!top3.length) {
    podium.innerHTML = '';
    return;
  }
  podium.innerHTML = top3.map((entry, i) => {
    const wr = winrate(entry);
    const games = entry.gamesToday ?? 0;
    return `
      <div class="podium-card place-${i + 1}" data-game-name="${entry.gameName}" data-tag-line="${entry.tagLine}">
        <div class="podium-header">
          <div class="podium-avatar-wrap">
            ${entry.profileIconId ? `<img class="podium-avatar" src="${profileIconUrl(entry.profileIconId)}" alt="" onerror="this.style.visibility='hidden'" />` : '<div class="podium-avatar podium-avatar--placeholder"></div>'}
            <div class="podium-medal">${MEDAL_ICON[i]}</div>
          </div>
          <div class="podium-name-block">
            <div class="podium-name">${entry.gameName}#${entry.tagLine}</div>
            ${entry.mainRoleLabel ? `<div class="podium-role">${roleBadge(entry)} ${entry.mainRoleLabel}</div>` : ''}
          </div>
        </div>
        <div class="podium-body">
          ${entry.tier ? `<img src="${emblemUrl(entry.tier)}" alt="${formatRank(entry)}" onerror="this.style.display='none'" />` : ''}
          <div>
            <div class="podium-lp">${entry.unranked ? '-' : entry.leaguePoints}<span> LP</span></div>
            <div class="podium-rank-label">${formatRank(entry)}</div>
          </div>
        </div>
        <div class="podium-record">
          <span>${entry.unranked ? '-' : `${entry.wins ?? 0}V ${entry.losses ?? 0}D`}</span>
          <span>${entry.unranked ? '-' : wr + '% WR'}</span>
          <span>${entry.unranked ? '-' : (entry.wins ?? 0) + (entry.losses ?? 0)} partidas</span>
        </div>
        <div class="podium-stats">
          <span style="color:${lpTodayColor(entry)}">Hoy: ${entry.unranked ? '-' : formatLpToday(entry)}</span>
          <span>${games}/10 partidas${entry.dailyCapped ? ' &#10003;' : ''}</span>
        </div>
        <div class="podium-bar"><div class="podium-bar-fill" style="width:${(games / 10) * 100}%"></div></div>
      </div>
    `;
  }).join('');
}

function lpTodayArrow(entry) {
  const v = entry.lpToday ?? 0;
  if (v > 0) return '&#9650;'; // triangulo arriba
  if (v < 0) return '&#9660;'; // triangulo abajo
  return '';
}

function renderTable(rest, offset) {
  const tbody = document.getElementById('leaderboardBody');
  if (!rest.length) {
    tbody.innerHTML = offset === 0
      ? '<tr><td colspan="7" class="empty">Aun no hay participantes cargados.</td></tr>'
      : '';
    return;
  }
  tbody.innerHTML = rest.map((entry, i) => {
    const wr = entry.unranked ? 0 : winrate(entry);
    const avatarHtml = entry.profileIconId
      ? `<img class="row-avatar" src="${profileIconUrl(entry.profileIconId)}" alt="" onerror="this.style.visibility='hidden'" />`
      : '<div class="row-avatar row-avatar--placeholder"></div>';
    return `
    <tr class="player-row" data-game-name="${entry.gameName}" data-tag-line="${entry.tagLine}">
      <td>${i + 1 + offset}</td>
      <td>
        <div class="row-player">
          ${avatarHtml}
          <div class="row-player-text">
            <div class="row-name">${entry.gameName} ${roleBadge(entry)}</div>
            <div class="row-tag">${entry.gameName}#${entry.tagLine}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="row-rank">
          ${entry.tier ? `<img class="row-rank-icon" src="${emblemUrl(entry.tier)}" alt="" onerror="this.style.display='none'" />` : ''}
          <span class="rank-badge">${formatRank(entry)}</span>
        </div>
      </td>
      <td><strong>${entry.unranked ? '-' : entry.leaguePoints}</strong></td>
      <td style="color:${lpTodayColor(entry)}">${entry.unranked ? '-' : `${lpTodayArrow(entry)} ${formatLpToday(entry)}`}</td>
      <td>${entry.unranked ? '-' : `${entry.gamesToday ?? 0}/10`}</td>
      <td>
        ${entry.unranked ? '-' : `
          <div class="row-wr">
            <span class="row-wr-pct">${wr}%</span>
            <span class="row-wr-record">${entry.wins ?? 0}V - ${entry.losses ?? 0}D</span>
            <div class="row-wr-bar"><div class="row-wr-bar-fill" style="width:${wr}%"></div></div>
          </div>
        `}
      </td>
    </tr>
    <tr class="detail-row hidden" data-detail-for="${entry.gameName}#${entry.tagLine}">
      <td colspan="7"><div class="history-body"></div></td>
    </tr>
  `;
  }).join('');
}

function applyLeaderboardData(data) {
  const lastUpdatedEl = document.getElementById('lastUpdated');

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);
  renderPodium(top3);
  renderTable(rest, 3);

  if (!data.length) {
    document.getElementById('leaderboardBody').innerHTML =
      '<tr><td colspan="7" class="empty">Aun no hay participantes cargados.</td></tr>';
  }

  const mostRecent = data.map((e) => e.lastUpdated).filter(Boolean).sort().pop();
  const hasApiErrors = data.some((e) => e.apiError);
  let statusText = mostRecent ? `Ultima actualizacion: ${new Date(mostRecent).toLocaleString('es-EC')}` : '';
  if (hasApiErrors) {
    statusText += statusText ? ' \u00b7 ' : '';
    statusText += '\u26a0\ufe0f Hay datos desactualizados (problema temporal consultando a Riot)';
  }
  lastUpdatedEl.textContent = statusText;
}

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    applyLeaderboardData(data);
  } catch (err) {
    document.getElementById('leaderboardBody').innerHTML =
      '<tr><td colspan="7" class="empty">Error cargando el leaderboard.</td></tr>';
    console.error(err);
  }
}

// --- Cuenta regresiva hasta el final del challenge ---
const CHALLENGE_END = new Date('2026-11-01T00:00:00-05:00');

function updateCountdown() {
  const el = document.getElementById('countdown');
  const diff = Math.max(0, CHALLENGE_END - new Date());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const units = [[d, 'dias'], [h, 'hrs'], [m, 'min'], [s, 'seg']];
  el.innerHTML = units.map(([value, label]) => `
    <div class="unit">
      <div class="value">${String(value).padStart(2, '0')}</div>
      <div class="label">${label}</div>
    </div>
  `).join('');
}

updateCountdown();
setInterval(updateCountdown, 1000);

// Primera carga inmediata via HTTP (para que la pagina no quede vacia mientras conecta el WebSocket)
loadLeaderboard();

// --- Modal de normas ---
const rulesButton = document.getElementById('rulesButton');
const rulesModal = document.getElementById('rulesModal');
const rulesCloseButton = document.getElementById('rulesCloseButton');

function openRulesModal() { rulesModal.classList.remove('hidden'); }
function closeRulesModal() { rulesModal.classList.add('hidden'); }

rulesButton.addEventListener('click', openRulesModal);
rulesCloseButton.addEventListener('click', closeRulesModal);
rulesModal.addEventListener('click', (event) => {
  if (event.target === rulesModal) closeRulesModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeRulesModal();
  }
});

// --- Historial de partidas (acordeon inline, no modal) ---
let ddragonVersion = null;
async function getDdragonVersion() {
  if (ddragonVersion) return ddragonVersion;
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await res.json();
    ddragonVersion = versions[0];
  } catch (err) {
    ddragonVersion = '14.23.1';
  }
  return ddragonVersion;
}

function championIconUrl(version, championName) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`;
}

function itemIconUrl(version, itemId) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

function renderItemIcons(version, items) {
  return (items || []).map((itemId) => {
    if (!itemId) return '<span class="match-item-icon match-item-icon--empty"></span>';
    return `<img class="match-item-icon" src="${itemIconUrl(version, itemId)}" alt="" onerror="this.style.visibility='hidden'" />`;
  }).join('');
}

function timeAgo(epochMs) {
  const diffMs = Date.now() - epochMs;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function renderMatchHistoryInto(containerEl, gameName, tagLine) {
  containerEl.innerHTML = 'Cargando historial...';
  try {
    const [matches, version] = await Promise.all([
      fetch(`/api/participants/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/matches`).then((r) => r.json()),
      getDdragonVersion(),
    ]);

    if (matches.error) {
      containerEl.innerHTML = `<div class="history-empty">${matches.error}</div>`;
      return;
    }
    if (!matches.length) {
      containerEl.innerHTML = '<div class="history-empty">No se encontraron partidas recientes de SoloQ.</div>';
      return;
    }

    containerEl.innerHTML = matches.map((m) => {
      const roleIcon = m.position && ROLE_ICON_KEY[m.position]
        ? `<img class="match-role-icon" src="${roleIconUrl(m.position)}" alt="" onerror="this.style.visibility='hidden'" />`
        : '';
      return `
      <div class="match-row ${m.win ? 'win' : 'loss'}">
        <div class="match-result-col">
          <div class="match-result">${m.win ? 'Victoria' : 'Derrota'}</div>
          <div class="match-meta">${timeAgo(m.gameCreation)}</div>
        </div>
        ${roleIcon}
        <div class="match-vs">
          <img class="match-champion-icon" src="${championIconUrl(version, m.championName)}" alt="${m.championName}" onerror="this.style.visibility='hidden'" />
          ${m.opponentChampionName ? `
            <span class="match-vs-label">vs</span>
            <img class="match-champion-icon match-champion-icon--opponent" src="${championIconUrl(version, m.opponentChampionName)}" alt="${m.opponentChampionName}" onerror="this.style.visibility='hidden'" />
          ` : ''}
        </div>
        <div class="match-kda-col">
          <div class="match-kda">${m.kills}<span class="match-kda-sep">/</span><span class="match-kda-deaths">${m.deaths}</span><span class="match-kda-sep">/</span>${m.assists}</div>
          <div class="match-meta">${m.killParticipation}% KP &middot; ${m.cs} CS</div>
        </div>
        <div class="match-items">${renderItemIcons(version, m.items)}</div>
      </div>
    `;
    }).join('');
  } catch (err) {
    containerEl.innerHTML = '<div class="history-empty">Error cargando el historial.</div>';
    console.error(err);
  }
}

document.getElementById('leaderboardBody').addEventListener('click', (event) => {
  const row = event.target.closest('tr.player-row');
  if (!row) return;

  const { gameName, tagLine } = row.dataset;
  const key = `${gameName}#${tagLine}`;
  const detailRow = document.querySelector(`tr.detail-row[data-detail-for="${CSS.escape(key)}"]`);
  if (!detailRow) return;

  const isHidden = detailRow.classList.contains('hidden');
  document.querySelectorAll('tr.detail-row').forEach((el) => el.classList.add('hidden'));

  if (isHidden) {
    detailRow.classList.remove('hidden');
    const container = detailRow.querySelector('.history-body');
    renderMatchHistoryInto(container, gameName, tagLine);
  }
});

const podiumHistoryPanel = document.getElementById('podiumHistoryPanel');
const podiumHistoryTitle = document.getElementById('podiumHistoryTitle');
const podiumHistoryBody = document.getElementById('podiumHistoryBody');
const podiumHistoryClose = document.getElementById('podiumHistoryClose');
let openPodiumKey = null;

document.getElementById('podium').addEventListener('click', (event) => {
  const card = event.target.closest('.podium-card');
  if (!card) return;

  const { gameName, tagLine } = card.dataset;
  const key = `${gameName}#${tagLine}`;

  if (openPodiumKey === key) {
    podiumHistoryPanel.classList.add('hidden');
    openPodiumKey = null;
    return;
  }

  openPodiumKey = key;
  podiumHistoryTitle.textContent = key;
  podiumHistoryPanel.classList.remove('hidden');
  renderMatchHistoryInto(podiumHistoryBody, gameName, tagLine);
});

podiumHistoryClose.addEventListener('click', () => {
  podiumHistoryPanel.classList.add('hidden');
  openPodiumKey = null;
});

// --- WebSocket: reemplaza el polling por HTTP. El servidor empuja los datos
// apenas termina cada ciclo de actualizacion (cada 45s por defecto), en vez de
// que el navegador tenga que estar preguntando "¿hay algo nuevo?" repetidamente. ---
let ws = null;
let wsReconnectTimeout = null;

function setConnectionStatus(isLive) {
  const el = document.getElementById('lastUpdated');
  if (!el) return;
  el.dataset.live = isLive ? '1' : '0';
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}`;

  try {
    ws = new WebSocket(url);
  } catch (err) {
    console.error('[ws] No se pudo crear la conexion:', err);
    scheduleReconnect();
    return;
  }

  ws.addEventListener('open', () => {
    console.log('[ws] Conectado, recibiendo actualizaciones en vivo.');
    setConnectionStatus(true);
  });

  ws.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'leaderboard') {
        applyLeaderboardData(msg.data);
      }
    } catch (err) {
      console.error('[ws] Mensaje invalido:', err);
    }
  });

  ws.addEventListener('close', () => {
    setConnectionStatus(false);
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    ws.close();
  });
}

function scheduleReconnect() {
  if (wsReconnectTimeout) return;
  wsReconnectTimeout = setTimeout(() => {
    wsReconnectTimeout = null;
    connectWebSocket();
  }, 3000);
}

connectWebSocket();
