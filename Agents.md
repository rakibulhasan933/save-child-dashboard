In this Next.js dashboard project, I already have a working authentication system and database using Drizzle ORM.

Important:
- All existing auth + Drizzle ORM logic must stay as it is.
- Do NOT change or remove the current authentication or DB models.

I only want to change the WebSocket part:

- WebSocket signaling for child presence and live-screen should now connect to the external backend:
  - WebSocket base URL: wss://save-gard-api.duckdns.org
  - Path: /ws

Your tasks:

1) Find existing WebSocket client code:
   - Search where the dashboard currently uses WebSocket (e.g. `new WebSocket(...)`, socket.io, or any ws client).
   - Identify the current WebSocket URL (probably pointing to localhost or some internal host).

2) Update WebSocket URL:
   - Change it so that the dashboard connects to:
     - `wss://save-gard-api.duckdns.org/ws`
   - For admin role, use a URL like:
     - `wss://save-gard-api.duckdns.org/ws?role=admin&token=ADMIN_TOKEN`
   - Keep the existing message handling logic (STATUS_UPDATE, LIVE_SCREEN_*, WEBRTC_*, ERROR) the same, just change the host/URL.

3) Config:
   - Add or update a central config constant, for example:
     - `SAVE_GARD_WS_BASE_URL = "wss://save-gard-api.duckdns.org"`
   - Use this constant everywhere instead of hard-coding ws URLs.

4) Do NOT touch:
   - Drizzle ORM setup.
   - Authentication flow (login, sessions, middleware).
   - Local HTTP APIs unless absolutely necessary for the WebSocket change.

5) Comments:
   - Add a short comment near the WebSocket URL:
     - “WebSocket signaling is handled by the external backend at save-gard-api.duckdns.org.”
   - This helps future me understand why the ws host is external.

Goal:

- Dashboard keeps its existing auth + Drizzle ORM as before.
- Only the WebSocket client is switched to use `wss://save-gard-api.duckdns.org/ws` for real-time child presence and live-screen signaling.