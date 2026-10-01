const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PARTICIPANTS_FILE = path.join(DATA_DIR, 'participants.json');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

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

function getParticipants() {
  return readJson(PARTICIPANTS_FILE);
}

function saveParticipants(participants) {
  writeJson(PARTICIPANTS_FILE, participants);
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
  getParticipants,
  saveParticipants,
  addParticipant,
  removeParticipant,
  getLeaderboard,
  saveLeaderboard,
};
