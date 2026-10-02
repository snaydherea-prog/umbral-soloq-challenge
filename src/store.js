const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PARTICIPANTS_FILE = path.join(DATA_DIR, 'participants.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'snaydherea-prog/umbral-soloq-challenge';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_PARTICIPANTS_PATH = 'data/participants.json';

let participantsFileSha = null;

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PARTICIPANTS_FILE)) fs.writeFileSync(PARTICIPANTS_FILE, '[]');
  if (!fs.existsSync(LEADERBOARD_FILE)) fs.writeFileSync(LEADERBOARD_FILE, '[]');
}

function readJson(file) {
  ensureDataFiles();
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function initializeStore() {
  ensureDataFiles();

  if (!GITHUB_TOKEN) {
    console.warn('[store] GITHUB_TOKEN no configurado; los participantes no tendran persistencia en GitHub.');
    return;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PARTICIPANTS_PATH}?ref=${encodeURIComponent(GITHUB_BRANCH)}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (response.status === 404) {
      participantsFileSha = null;
      await commitParticipantsToGitHub(readJson(PARTICIPANTS_FILE), 'Inicializar participantes');
      return;
    }

    if (!response.ok) throw new Error(`GitHub respondio ${response.status}`);

    const data = await response.json();
    participantsFileSha = data.sha;
    const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    fs.writeFileSync(PARTICIPANTS_FILE, content);
    console.log(`[store] Participantes cargados desde GitHub: ${JSON.parse(content).length}`);
  } catch (err) {
    console.error('[store] No se pudieron cargar los participantes desde GitHub:', err.message);
  }
}

async function commitParticipantsToGitHub(participants, message) {
  if (!GITHUB_TOKEN) return;

  const content = Buffer.from(JSON.stringify(participants, null, 2) + '\n', 'utf-8').toString('base64');

  const body = {
    message,
    content,
    branch: GITHUB_BRANCH,
  };

  if (participantsFileSha) body.sha = participantsFileSha;

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PARTICIPANTS_PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub respondio ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  participantsFileSha = result.content.sha;
  console.log(`[store] Participantes guardados en GitHub: ${message}`);
}

function getParticipants() {
  return readJson(PARTICIPANTS_FILE);
}

function saveParticipants(participants) {
  writeJson(PARTICIPANTS_FILE, participants);

  commitParticipantsToGitHub(participants, 'Actualizar participantes')
    .catch((err) => console.error('[store] No se pudo guardar participantes en GitHub:', err.message));
}

function addParticipant(participant) {
  const participants = getParticipants();
  const exists = participants.some(
    (p) => p.gameName.toLowerCase() === participant.gameName.toLowerCase() &&
           p.tagLine.toLowerCase() === participant.tagLine.toLowerCase()
  );
  if (exists) {
    throw new Error('Ese participante ya esta registrado');
  }
  participants.push(participant);
  saveParticipants(participants);
  return participant;
}

function removeParticipant(gameName, tagLine) {
  const participants = getParticipants();
  const filtered = participants.filter(
    (p) => !(p.gameName.toLowerCase() === gameName.toLowerCase() &&
             p.tagLine.toLowerCase() === tagLine.toLowerCase())
  );
  saveParticipants(filtered);
  return filtered;
}

function getLeaderboard() {
  return readJson(LEADERBOARD_FILE);
}

function saveLeaderboard(leaderboard) {
  writeJson(LEADERBOARD_FILE, leaderboard);
}

module.exports = {
  initializeStore,
  getParticipants,
  saveParticipants,
  addParticipant,
  removeParticipant,
  getLeaderboard,
  saveLeaderboard,
};
