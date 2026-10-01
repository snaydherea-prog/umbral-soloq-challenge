const axios = require('axios');

const API_KEY = process.env.RIOT_API_KEY;
const REGIONAL_ROUTE = process.env.RIOT_REGIONAL_ROUTE || 'americas';
const PLATFORM_ROUTE = process.env.RIOT_PLATFORM_ROUTE || 'la1';

if (!API_KEY) {
  console.warn('[riot.js] ADVERTENCIA: RIOT_API_KEY no esta definida en el .env');
}

const regionalClient = axios.create({
  baseURL: `https://${REGIONAL_ROUTE}.api.riotgames.com`,
  headers: { 'X-Riot-Token': API_KEY },
  timeout: 10000,
});

const platformClient = axios.create({
  baseURL: `https://${PLATFORM_ROUTE}.api.riotgames.com`,
  headers: { 'X-Riot-Token': API_KEY },
  timeout: 10000,
});

async function getPuuidByRiotId(gameName, tagLine) {
  const url = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const { data } = await regionalClient.get(url);
  return data.puuid;
}

async function getLeagueEntriesByPuuid(puuid) {
  const url = `/lol/league/v4/entries/by-puuid/${puuid}`;
  const { data } = await platformClient.get(url);
  return data;
}

function extractSoloQueueEntry(leagueEntries) {
  return leagueEntries.find((e) => e.queueType === 'RANKED_SOLO_5x5') || null;
}

async function getSoloQueueMatchIdsSince(puuid, startTimeEpochSeconds) {
  const url = `/lol/match/v5/matches/by-puuid/${puuid}/ids`;
  const { data } = await regionalClient.get(url, {
    params: { startTime: startTimeEpochSeconds, queue: 420, count: 100 },
  });
  return data;
}

async function getRecentSoloQueueMatchIds(puuid, count = 15) {
  const url = `/lol/match/v5/matches/by-puuid/${puuid}/ids`;
  const { data } = await regionalClient.get(url, {
    params: { queue: 420, count },
  });
  return data;
}

async function getMatchDetails(matchId) {
  const url = `/lol/match/v5/matches/${matchId}`;
  const { data } = await regionalClient.get(url);
  return data;
}

async function getSummonerByPuuid(puuid) {
  const url = `/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  const { data } = await platformClient.get(url);
  return data;
}

module.exports = {
  getPuuidByRiotId,
  getLeagueEntriesByPuuid,
  extractSoloQueueEntry,
  getSoloQueueMatchIdsSince,
  getRecentSoloQueueMatchIds,
  getMatchDetails,
  getSummonerByPuuid,
  REGIONAL_ROUTE,
  PLATFORM_ROUTE,
};
