// Modulo simple de "pub-sub" para las conexiones WebSocket.
// server.js registra cada cliente nuevo aqui; updateLeaderboard.js llama a
// broadcastLeaderboard() cada vez que termina un refresh, y este modulo se
// encarga de reenviar los datos a todos los navegadores conectados en ese momento.

const clients = new Set();

function registerClient(ws) {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
}

function broadcastLeaderboard(data) {
  const message = JSON.stringify({ type: 'leaderboard', data });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

function clientCount() {
  return clients.size;
}

module.exports = { registerClient, broadcastLeaderboard, clientCount };
