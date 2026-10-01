const {
  getPuuidByRiotId, getLeagueEntriesByPuuid, extractSoloQueueEntry, getSoloQueueMatchIdsSince, getSummonerByPuuid,
} = require('./riot');
const { computeMainRole } = require('./roles');
const { getParticipants, saveParticipants, getLeaderboard, saveLeaderboard } = require('./store');
const { broadcastLeaderboard } = require('./ws');

const DAILY_GAME_CAP = 10;
// Desfase horario respecto a UTC de la zona donde vive el challenge.
// Ecuador/Peru/Colombia (LAN) = -5. Ajusta si tus jugadores son de otra zona.
const TIMEZONE_OFFSET_HOURS = parseInt(process.env.TIMEZONE_OFFSET_HOURS || '-5', 10);

const TIER_ORDER = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD',
  'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER',
];
const RANK_ORDER = { IV: 0, III: 1, II: 2, I: 3 };
const APEX_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

/**
 * Convierte tier + rango + LP en un puntaje continuo que SI refleja correctamente
 * los ascensos y descensos de division (el LP crudo se resetea cerca de 0 al subir
 * de division, lo que sin este ajuste se veria como una perdida de LP en vez de un avance).
 */
function computeRankScore(tier, rank, leaguePoints) {
  const tierIndex = TIER_ORDER.indexOf(tier);
  if (tierIndex === -1) return leaguePoints;
  if (APEX_TIERS.has(tier)) {
    return tierIndex * 400 + leaguePoints;
  }
  const rankIndex = RANK_ORDER[rank] ?? 0;
  return tierIndex * 400 + rankIndex * 100 + leaguePoints;
}

/**
 * Calcula el timestamp (segundos epoch) de la medianoche local de HOY,
 * segun el desfase horario configurado, y el string de fecha local "YYYY-MM-DD".
 *
 * Usa Date.now() (siempre UTC absoluto) y getUTC*(), nunca getTimezoneOffset() ni
 * "new Date()" local, para que el resultado sea el mismo sin importar en que zona
 * horaria este configurado el reloj del sistema operativo donde corre el servidor.
 */
function getLocalDayBoundary() {
  const nowUtcMs = Date.now();
  const shiftedMs = nowUtcMs + TIMEZONE_OFFSET_HOURS * 3600000;
  const shifted = new Date(shiftedMs);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const midnightShiftedMs = Date.UTC(y, m, d, 0, 0, 0, 0);
  const midnightUtcMs = midnightShiftedMs - TIMEZONE_OFFSET_HOURS * 3600000;
  const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { midnightEpochSeconds: Math.floor(midnightUtcMs / 1000), dateStr };
}

// Version del esquema de "daily". Se sube cuando cambia como se calcula currentLP,
// para poder detectar y descartar datos guardados con una escala vieja.
const DAILY_STATE_VERSION = 2;

/**
 * Actualiza el estado "diario" de un participante y su total acumulado del challenge.
 *
 * - Cada dia se le permite sumar/restar LP solo con sus primeras 10 partidas (se congela al llegar a 10).
 * - Al pasar de un dia a otro, el resultado FINAL de ese dia se suma al acumulado del challenge
 *   (participant.challengeTotalLP), y el contador diario se reinicia.
 * - El total del challenge NUNCA se resetea; solo se resetea el margen de partidas de cada dia.
 */
function updateDailyState(participant, currentLP, gamesPlayedToday) {
  const { dateStr } = getLocalDayBoundary();

  if (typeof participant.challengeTotalLP !== 'number') {
    participant.challengeTotalLP = 0;
  }

  const isStale = !participant.daily
    || participant.daily.date !== dateStr
    || participant.daily.version !== DAILY_STATE_VERSION;

  if (isStale) {
    const sameDayVersionMismatch = participant.daily
      && participant.daily.date === dateStr
      && participant.daily.version !== DAILY_STATE_VERSION;

    if (participant.daily && !sameDayVersionMismatch) {
      participant.challengeTotalLP += participant.daily.lpToday || 0;
    }

    participant.daily = {
      date: dateStr,
      startLP: currentLP,
      gamesToday: 0,
      lpToday: 0,
      frozen: false,
      version: DAILY_STATE_VERSION,
    };
  }

  const daily = participant.daily;

  if (!daily.frozen) {
    if (gamesPlayedToday >= DAILY_GAME_CAP) {
      daily.gamesToday = DAILY_GAME_CAP;
      daily.lpToday = currentLP - daily.startLP;
      daily.frozen = true;
    } else {
      daily.gamesToday = gamesPlayedToday;
      daily.lpToday = currentLP - daily.startLP;
    }
  }

  return {
    ...daily,
    challengeTotalLP: participant.challengeTotalLP,
    totalLP: participant.challengeTotalLP + daily.lpToday,
  };
}

async function resolveMissingPuuids() {
  const participants = getParticipants();
  let changed = false;

  for (const p of participants) {
    if (!p.puuid) {
      try {
        p.puuid = await getPuuidByRiotId(p.gameName, p.tagLine);
        changed = true;
        console.log(`[updateLeaderboard] PUUID resuelto para ${p.gameName}#${p.tagLine}`);
      } catch (err) {
        console.error(`[updateLeaderboard] No se pudo resolver PUUID de ${p.gameName}#${p.tagLine}:`, err.response?.status, err.message);
        continue;
      }
      try {
        const roleInfo = await computeMainRole(p.puuid);
        if (roleInfo) {
          p.mainRole = roleInfo;
          changed = true;
          console.log(`[updateLeaderboard] Rol principal de ${p.gameName}#${p.tagLine}: ${roleInfo.roleLabel} (${roleInfo.gamesInRole}/${roleInfo.gamesChecked})`);
        }
      } catch (err) {
        console.error(`[updateLeaderboard] No se pudo calcular el rol de ${p.gameName}#${p.tagLine}:`, err.response?.status, err.message);
      }
    }
    if (p.puuid && !p.profileIconId) {
      try {
        const summoner = await getSummonerByPuuid(p.puuid);
        p.profileIconId = summoner.profileIconId;
        changed = true;
      } catch (err) {
        console.error(`[updateLeaderboard] No se pudo obtener el icono de perfil de ${p.gameName}#${p.tagLine}:`, err.response?.status, err.message);
      }
    }
  }

  if (changed) saveParticipants(participants);
  return participants;
}

async function refreshAllRoles() {
  const participants = getParticipants();
  for (const p of participants) {
    if (!p.puuid) continue;
    try {
      const roleInfo = await computeMainRole(p.puuid);
      if (roleInfo) {
        p.mainRole = roleInfo;
        console.log(`[updateLeaderboard] Rol principal de ${p.gameName}#${p.tagLine}: ${roleInfo.roleLabel}`);
        saveParticipants(participants);
      }
    } catch (err) {
      console.error(`[updateLeaderboard] Error calculando rol de ${p.gameName}#${p.tagLine}:`, err.response?.status, err.message);
    }
  }
  return participants;
}

async function refreshLeaderboard() {
  console.log('[updateLeaderboard] Iniciando actualizacion del leaderboard...');
  const participants = await resolveMissingPuuids();
  const { midnightEpochSeconds } = getLocalDayBoundary();
  const previousByKey = {};
  for (const entry of getLeaderboard()) {
    previousByKey[`${entry.gameName}#${entry.tagLine}`] = entry;
  }
  const results = [];

  for (const p of participants) {
    const key = `${p.gameName}#${p.tagLine}`;
    if (!p.puuid) {
      results.push({ ...p, unranked: true, error: 'PUUID no resuelto' });
      continue;
    }
    try {
      const entries = await getLeagueEntriesByPuuid(p.puuid);
      const solo = extractSoloQueueEntry(entries);

      if (!solo) {
        p.daily = p.daily || { date: null, startLP: 0, gamesToday: 0, lpToday: 0, frozen: false };
        if (typeof p.challengeTotalLP !== 'number') p.challengeTotalLP = 0;
        results.push({
          gameName: p.gameName, tagLine: p.tagLine, unranked: true,
          tier: null, rank: null, leaguePoints: 0, wins: 0, losses: 0,
          lpToday: 0, gamesToday: 0, challengeTotalLP: p.challengeTotalLP, totalLP: p.challengeTotalLP,
          profileIconId: p.profileIconId || null,
        });
        continue;
      }

      let gamesPlayedToday = 0;
      try {
        const matchIds = await getSoloQueueMatchIdsSince(p.puuid, midnightEpochSeconds);
        gamesPlayedToday = matchIds.length;
      } catch (err) {
        console.error(`[updateLeaderboard] Error consultando partidas de hoy de ${p.gameName}#${p.tagLine}:`, err.response?.status, err.message);
      }

      const rankScore = computeRankScore(solo.tier, solo.rank, solo.leaguePoints);
      const daily = updateDailyState(p, rankScore, gamesPlayedToday);

      results.push({
        gameName: p.gameName,
        tagLine: p.tagLine,
        tier: solo.tier,
        rank: solo.rank,
        leaguePoints: solo.leaguePoints,
        wins: solo.wins,
        losses: solo.losses,
        unranked: false,
        lpToday: daily.lpToday,
        gamesToday: daily.gamesToday,
        dailyCapped: daily.frozen,
        challengeTotalLP: daily.challengeTotalLP,
        totalLP: daily.totalLP,
        mainRole: p.mainRole?.role || null,
        mainRoleLabel: p.mainRole?.roleLabel || null,
        profileIconId: p.profileIconId || null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      const status = err.response?.status;
      console.error(`[updateLeaderboard] Error consultando a ${p.gameName}#${p.tagLine}:`, status, err.message);

      const previous = previousByKey[key];
      if (previous) {
        results.push({ ...previous, apiError: true, apiErrorStatus: status });
      } else {
        results.push({
          gameName: p.gameName, tagLine: p.tagLine, unranked: true,
          apiError: true, apiErrorStatus: status, error: 'Error de consulta',
          lpToday: 0, gamesToday: 0, totalLP: p.challengeTotalLP || 0,
        });
      }
    }
  }

  saveParticipants(participants);

  // El leaderboard se ordena por el RANGO REAL de la cuenta (tier + division + LP actual).
  // "Hoy" y el acumulado del challenge se siguen calculando y mostrando, pero ya no deciden el orden.
  const sorted = [...results].sort((a, b) => {
    if (a.unranked && b.unranked) return 0;
    if (a.unranked) return 1;
    if (b.unranked) return -1;
    const scoreA = computeRankScore(a.tier, a.rank, a.leaguePoints);
    const scoreB = computeRankScore(b.tier, b.rank, b.leaguePoints);
    return scoreB - scoreA;
  });

  saveLeaderboard(sorted);
  console.log(`[updateLeaderboard] Leaderboard actualizado (${sorted.length} participantes).`);
  broadcastLeaderboard(sorted); // avisa en vivo a todos los navegadores conectados por WebSocket
  return sorted;
}

function scheduleLeaderboardRefresh() {
  const seconds = Math.max(5, parseInt(process.env.REFRESH_INTERVAL_SECONDS || '45', 10));
  console.log(`[updateLeaderboard] Programado cada ${seconds} segundo(s)`);
  console.log(`[updateLeaderboard] Reinicio diario a las 00:00 (UTC${TIMEZONE_OFFSET_HOURS >= 0 ? '+' : ''}${TIMEZONE_OFFSET_HOURS}), tope de ${DAILY_GAME_CAP} partidas/dia`);
  setInterval(() => {
    refreshLeaderboard().catch((err) => console.error('[updateLeaderboard] Fallo el refresh programado:', err.message));
  }, seconds * 1000);
}

module.exports = {
  refreshLeaderboard, scheduleLeaderboardRefresh, getLocalDayBoundary, updateDailyState, refreshAllRoles,
  computeRankScore,
};
