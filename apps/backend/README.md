# OPTIMIST LUDO backend + Mini App

This backend serves the integrated Classic Ludo Mini App and its API from one Node.js process. The UI uses the supplied board artwork, positions tokens on the artwork, and renders only server-authoritative room snapshots.

## Requirements

- Node.js 22.9+
- `npm install` (installs the `ws` runtime dependency)
- `BOT_TOKEN` from BotFather for Telegram deployments

## Local setup

```bash
npm install
cp .env.example .env
# For local browser testing without Telegram, set ALLOW_DEV_AUTH=1.
npm start
```

Open `http://localhost:3000`. Use two browser profiles/tabs to create a room, join by room code, start a match and play. Local dev auth is accepted only when explicitly enabled and never in production.

## Connected UI

- `/` — lobby, room view, board art, player panels, dice, room chat and voice-message controls.
- `src/main.js` — Mini App state/rendering, lobby actions and UI event wiring.
- `src/board-render.js` — maps authoritative token positions to image coordinates; base slots are calibrated independently from the 15x15 logical grid.
- `src/client/room-client.js` — room WebSocket, snapshots, reconnect and chat.
- `src/client/voice-chat.js` — hold-to-record / release-to-send / swipe-left-to-cancel and playback.

## API overview

- `GET /api/rooms` — list public waiting rooms.
- `POST /api/rooms` — create a room. Auth: `x-telegram-init-data`; local-only dev auth: `x-dev-user`.
- `GET /api/rooms/:roomId` — full room snapshot for a member.
- `GET /healthz` — process and voice-cache health data.
- `GET /ws` — authenticated gameplay socket. First message: `{ "type":"AUTH", "roomId":"…", "initData":"…" }`.
- WebSocket commands: `START_GAME`, `ROLL_DICE`, `MOVE_TOKEN`, `SEND_CHAT`. `ROOM_SYNC` includes full state and server-computed `legalTokenIds`, including after reconnect.
- `POST /api/rooms/:roomId/voice` — binary voice upload; headers `x-room-session`, `x-voice-duration`, `content-type`.
- `GET /api/rooms/:roomId/voice/:voiceId` — playback; same room session header.

## Voice limits

30 seconds, 512 KiB per file, 8 MiB total RAM, 40 files per process, six-hour TTL. Voice bytes never travel through WebSocket. The voice session token is issued after room authentication, bound to that user and room, and membership is rechecked on upload and playback.

## Persistence boundary

Rooms, resume tokens and voice files are process-local. A process restart clears live rooms and voice cache. WebSocket reconnect during the same process receives a full room snapshot; persistence across host restarts is a later milestone.

## Validation

```bash
npm test
npm run smoke
```

Unit tests cover the engine, renderer, room rules, auth, reconnect and voice limits. The smoke test uses a real local HTTP/WebSocket server and needs `ws` installed.
