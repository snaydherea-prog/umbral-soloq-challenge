require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const {
  getParticipants, addParticipant, removeParticipant, getLeaderboard, saveParticipants,
} = require('./store');
const { refreshLeaderboard, scheduleLeaderboardRefresh, refreshAllRoles } = require('./updateLeaderboard');
const { getRecentMatchSummaries } = require('./matchHistory');
const { getPuuidByRiotId, getSummonerByPuuid } = require('./riot');
const { computeMainRole } = require('./roles');
const { registerClient, clientCount } = require('./ws');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'cambia-esto-por-algo-secreto';
const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || '50', 10);
const MIN_SUMMONER_LEVEL = parseInt(process.env.MIN_SUMMONER_LEVEL || '30', 10);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// --- Rutas publicas ---

app.get('/api/leaderboard', (req, res) => {
  res.json(getLeaderboard());
});

app.get('/api/participants', (req, res) => {
  const participants = getParticipants().map(({ gameName, tagLine }) => ({ gameName, tagLine }));
  res.json(participants);
});

app.get('/api/participants/:gameName/:tagLine/matches', async (req, res) => {
  const { gameName, tagLine } = req.params;
  const participants = getParticipants();
  const participant = participants.find(
    (p) => p.gameName.toLowerCase() === gameName.toLowerCase()
      && p.tagLine.toLowerCase() === tagLine.toLowerCase(),
  );

  if (!participant) {
    return res.status(404).json({ error: 'Participante no encontrado' });
  }
  if (!participant.puuid) {
    return res.status(409).json({ error: 'Aun no se resolvio el PUUID de este participante, intenta en unos minutos' });
  }

  try {
    const matches = await getRecentMatchSummaries(participant.puuid, 10);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo obtener el historial de partidas' });
  }
});

/**
 * Endpoint publico: cualquiera puede unirse al challenge llenando su Riot ID.
 * Verificamos contra la API de Riot que la cuenta exista y que cumpla el nivel minimo.
 */
app.post('/api/participants', async (req, res) => {
  let { gameName, tagLine } = req.body;

  if (!gameName || !tagLine) {
    return res.status(400).json({ error: 'Debes indicar tu nombre de invocador y tu tag' });
  }
  gameName = String(gameName).trim();
  tagLine = String(tagLine).trim().replace(/^#/, '');

  if (gameName.length > 30 || tagLine.length > 10) {
    return res.status(400).json({ error: 'El nombre o el tag son demasiado largos' });
  }

  const participants = getParticipants();
  if (participants.length >= MAX_PARTICIPANTS) {
    return res.status(403).json({ error: `El challenge ya alcanzo el maximo de ${MAX_PARTICIPANTS} participantes` });
  }

  const alreadyIn = participants.some(
    (p) => p.gameName.toLowerCase() === gameName.toLowerCase()
      && p.tagLine.toLowerCase() === tagLine.toLowerCase(),
  );
  if (alreadyIn) {
    return res.status(409).json({ error: 'Ese Riot ID ya esta registrado en el challenge' });
  }

  let puuid;
  try {
    puuid = await getPuuidByRiotId(gameName, tagLine);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: `No se encontro la cuenta ${gameName}#${tagLine} en Riot. Revisa que este bien escrito.` });
    }
    return res.status(502).json({ error: 'No se pudo verificar tu cuenta con Riot en este momento, intenta de nuevo en un rato' });
  }

  let profileIconId = null;
  try {
    const summoner = await getSummonerByPuuid(puuid);
    profileIconId = summoner.profileIconId;
    if (MIN_SUMMONER_LEVEL > 0 && summoner.summonerLevel < MIN_SUMMONER_LEVEL) {
      return res.status(403).json({
        error: `Tu cuenta es nivel ${summoner.summonerLevel}. El torneo requiere nivel ${MIN_SUMMONER_LEVEL} o mas.`,
      });
    }
  } catch (err) {
    if (MIN_SUMMONER_LEVEL > 0) {
      return res.status(502).json({ error: 'No se pudo verificar el nivel de tu cuenta con Riot en este momento, intenta de nuevo en un rato' });
    }
  }

  let participant;
  try {
    participant = addParticipant({ gameName, tagLine, puuid, profileIconId });
  } catch (err) {
    return res.status(409).json({ error: err.message });
  }

  res.status(201).json({ gameName, tagLine });

  computeMainRole(puuid)
    .then((roleInfo) => {
      if (!roleInfo) return;
      const all = getParticipants();
      const p = all.find((x) => x.puuid === puuid);
      if (p) {
        p.mainRole = roleInfo;
        saveParticipants(all);
      }
    })
    .catch((err) => console.error(`[server] No se pudo calcular el rol de ${gameName}#${tagLine}:`, err.message));
});

// --- Rutas de administracion (requieren header x-admin-token) ---

app.post('/api/admin/participants', requireAdmin, async (req, res) => {
  const { gameName, tagLine } = req.body;
  if (!gameName || !tagLine) {
    return res.status(400).json({ error: 'gameName y tagLine son requeridos' });
  }

  let puuid = null;
  try {
    puuid = await getPuuidByRiotId(gameName, tagLine);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: `No se encontro la cuenta ${gameName}#${tagLine} en Riot` });
    }
    console.error(`[server] No se pudo resolver PUUID de ${gameName}#${tagLine} al agregarlo:`, err.response?.status, err.message);
  }

  let profileIconId = null;
  if (puuid) {
    try {
      const summoner = await getSummonerByPuuid(puuid);
      profileIconId = summoner.profileIconId;
      if (MIN_SUMMONER_LEVEL > 0 && summoner.summonerLevel < MIN_SUMMONER_LEVEL) {
        return res.status(403).json({
          error: `${gameName}#${tagLine} es nivel ${summoner.summonerLevel}. El torneo requiere nivel ${MIN_SUMMONER_LEVEL} o mas.`,
        });
      }
    } catch (err) {
      console.error(`[server] No se pudo verificar el nivel de ${gameName}#${tagLine}:`, err.response?.status, err.message);
    }
  }

  try {
    const participant = addParticipant({ gameName, tagLine, puuid, profileIconId });
    res.status(201).json(participant);

    if (puuid) {
      computeMainRole(puuid)
        .then((roleInfo) => {
          if (!roleInfo) return;
          const all = getParticipants();
          const p = all.find((x) => x.puuid === puuid);
          if (p) {
            p.mainRole = roleInfo;
            saveParticipants(all);
          }
        })
        .catch((err) => console.error(`[server] No se pudo calcular el rol de ${gameName}#${tagLine}:`, err.message));
    }
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

app.delete('/api/admin/participants', requireAdmin, (req, res) => {
  const { gameName, tagLine } = req.body;
  if (!gameName || !tagLine) {
    return res.status(400).json({ error: 'gameName y tagLine son requeridos' });
  }
  const remaining = removeParticipant(gameName, tagLine);
  res.json(remaining);
});

app.post('/api/admin/refresh', requireAdmin, async (req, res) => {
  try {
    const leaderboard = await refreshLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/refresh-roles', requireAdmin, async (req, res) => {
  try {
    const participants = await refreshAllRoles();
    res.json(participants.map(({ gameName, tagLine, mainRole }) => ({ gameName, tagLine, mainRole })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Servidor HTTP + WebSocket montados juntos ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  registerClient(ws);
  // apenas se conecta, le mandamos el estado actual (sin esperar al proximo ciclo de refresh)
  try {
    ws.send(JSON.stringify({ type: 'leaderboard', data: getLeaderboard() }));
  } catch (err) {
    console.error('[server] Error enviando estado inicial por WebSocket:', err.message);
  }
});

server.listen(PORT, () => {
  console.log(`[server] Umbral SoloQ Challenge escuchando en http://localhost:${PORT}`);
  scheduleLeaderboardRefresh();
});
