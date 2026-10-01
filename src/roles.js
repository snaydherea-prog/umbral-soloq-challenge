const { getRecentSoloQueueMatchIds, getMatchDetails } = require('./riot');

const ROLE_LABEL = {
  TOP: 'Top',
  JUNGLE: 'Jungla',
  MIDDLE: 'Medio',
  BOTTOM: 'Tirador',
  UTILITY: 'Soporte',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function computeMainRole(puuid, matchesToCheck = 15) {
  const matchIds = await getRecentSoloQueueMatchIds(puuid, matchesToCheck);
  const counts = {};

  for (const matchId of matchIds) {
    try {
      const match = await getMatchDetails(matchId);
      const participant = match.info.participants.find((p) => p.puuid === puuid);
      const position = participant?.teamPosition;
      if (position && ROLE_LABEL[position]) {
        counts[position] = (counts[position] || 0) + 1;
      }
    } catch (err) {
      console.error(`[roles] Error leyendo partida ${matchId}:`, err.response?.status, err.message);
    }
    await sleep(80);
  }

  const entries = Object.entries(counts);
  if (!entries.length) return null;

  entries.sort((a, b) => b[1] - a[1]);
  const [topRole, gamesInRole] = entries[0];

  return {
    role: topRole,
    roleLabel: ROLE_LABEL[topRole],
    gamesInRole,
    gamesChecked: matchIds.length,
  };
}

module.exports = { computeMainRole, ROLE_LABEL };
