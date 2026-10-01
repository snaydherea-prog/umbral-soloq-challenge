# Umbral SoloQ Challenge

Leaderboard en vivo de SoloQ (League of Legends) para el reto de la comunidad **Umbral**, usando la API oficial de Riot Games. Las actualizaciones llegan al navegador por **WebSocket** en tiempo real (no por polling), aunque la consulta a Riot en si sigue corriendo cada 45 segundos por los limites de la API key.

## Instalacion

```bash
npm install
cp .env.example .env
```

Edita `.env` con tu Riot API Key, tu plataforma (`la1` para LAN, `la2` para LAS, etc.), tu `ADMIN_TOKEN`, y ajusta `TIMEZONE_OFFSET_HOURS`, `MAX_PARTICIPANTS` y `MIN_SUMMONER_LEVEL` segun necesites.

## Ejecutar

```bash
npm start
```

Abre `http://localhost:3000`.

## Agregar participantes (via admin)

```bash
curl -X POST http://localhost:3000/api/admin/participants \
  -H "Content-Type: application/json" \
  -H "x-admin-token: TU_ADMIN_TOKEN" \
  -d '{"gameName": "Nombre", "tagLine": "TAG"}'
```

## Forzar actualizacion manual

```bash
curl -X POST http://localhost:3000/api/admin/refresh -H "x-admin-token: TU_ADMIN_TOKEN"
```

## WebSocket

El servidor abre un WebSocket en la misma direccion/puerto del sitio. Cada vez que termina un ciclo de actualizacion (cada `REFRESH_INTERVAL_SECONDS`), transmite el leaderboard actualizado a todos los navegadores conectados, que lo pintan al instante sin necesidad de recargar ni de que el navegador este preguntando repetidamente.
