const { getRecentSoloQueueMatchIds, getMatchDetails } = require('./riot');

async function getRecentMatchSummaries(puuid, count = 10) {
  const matchIds = await getRecentSoloQueueMatchIds(puuid, count);
  const summaries = [];

  for (const matchId of matchIds) {
    try {
      const match = await getMatchDetails(matchId);
      const p = match.info.participants.find((part) => part.puuid === puuid);
      if (!p) continue;

      const opponent = match.info.participants.find(
        (part) => part.teamId !== p.teamId && part.teamPosition === p.teamPosition && p.teamPosition,
      );

      const teamKills = match.info.participants
        .filter((part) => part.teamId === p.teamId)
        .reduce((sum, part) => sum + part.kills, 0);
      const killParticipation = teamKills > 0 ? Math.round(((p.kills + p.assists) / teamKills) * 100) : 0;

      summaries.push({
        matchId,
        win: p.win,
        championName: p.championName,
        opponentChampionName: opponent ? opponent.championName : null,
        position: p.teamPosition || null,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
        killParticipation,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
        gameDurationSeconds: match.info.gameDuration,
        gameCreation: match.info.gameCreation,
      });
    } catch (err) {
      console.error(`[matchHistory] Error leyendo partida ${matchId}:`, err.response?.status, err.message);
    }
  }

  return summaries;
}

module.exports = { getRecentMatchSummaries };
