export const SAVE_GARD_HTTP_BASE_URL = "https://save-gard-api.duckdns.org";
// WebSocket signaling is handled by the external backend at save-gard-api.duckdns.org.
export const SAVE_GARD_WS_BASE_URL = "wss://save-gard-api.duckdns.org";
export const SAVE_GARD_WS_PATH = "/ws";
export const SAVE_GARD_ADMIN_TOKEN = process.env.NEXT_PUBLIC_SAVE_GARD_ADMIN_TOKEN ?? null;
