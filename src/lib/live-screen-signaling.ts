"use client";

import { SAVE_GARD_WS_BASE_URL, SAVE_GARD_WS_PATH } from "@/config/saveGard";

export type ChildLiveScreenState =
  | "IDLE"
  | "PAIRED_IDLE"
  | "MONITORING_ACTIVE"
  | "LIVE_SCREEN_ACTIVE"
  | "LIVE_SCREEN_ENDING"
  | "ERROR";

export type SignalingMessage =
  | { type: "PING"; payload?: Record<string, never> }
  | { type: "PONG"; payload?: Record<string, never> }
  | {
      type: "STATUS_UPDATE";
      payload: {
        childId: string;
        deviceUuid: string;
        state: ChildLiveScreenState | string;
        timestamp: string;
      };
    }
  | {
      type: "LIVE_SCREEN_REQUEST";
      payload: {
        sessionId: string;
        childId: string;
        adminId: string;
        quality: "low" | "medium" | "high";
        maxDurationSec: number;
      };
    }
  | { type: "LIVE_SCREEN_ACCEPTED"; payload: { sessionId: string; childId: string } }
  | { type: "LIVE_SCREEN_REJECTED"; payload: { sessionId: string; childId: string; reason: string } }
  | { type: "LIVE_SCREEN_ENDED"; payload: { sessionId: string; childId: string; reason?: string } }
  | { type: "WEBRTC_OFFER"; payload: { sessionId: string; fromRole: "admin" | "child"; sdp: string } }
  | { type: "WEBRTC_ANSWER"; payload: { sessionId: string; fromRole: "admin" | "child"; sdp: string } }
  | {
      type: "WEBRTC_ICE_CANDIDATE";
      payload: { sessionId: string; fromRole: "admin" | "child"; candidate: RTCIceCandidateInit };
    }
  | { type: "ERROR"; payload: { code: string; message: string } };

export type ClientSignalingMessage = Exclude<SignalingMessage, { type: "LIVE_SCREEN_REQUEST" | "ERROR" }>;

type Listener = (message: SignalingMessage) => void;

export type AdminSignalingClient = {
  connect: () => Promise<void>;
  close: () => void;
  send: (message: ClientSignalingMessage) => boolean;
  isOpen: () => boolean;
};

type CreateAdminSignalingClientOptions = {
  adminToken: string;
  onMessage: Listener;
  onConnecting?: () => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
};

export function createAdminSignalingClient({
  adminToken,
  onMessage,
  onConnecting,
  onOpen,
  onClose,
  onError
}: CreateAdminSignalingClientOptions): AdminSignalingClient {
  let ws: WebSocket | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let connectPromise: Promise<void> | null = null;

  function clearPingTimer() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
  }

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (ws?.readyState === WebSocket.CONNECTING && connectPromise) return connectPromise;

    connectPromise = new Promise<void>(async (resolve, reject) => {
      const url = await buildWebSocketUrl(adminToken);
      if (!url) {
        console.info("[admin-ws] No admin token; cannot connect");
        connectPromise = null;
        reject(new Error("Please log in again"));
        return;
      }

      console.info("[admin-ws] Connecting", redactWebSocketUrl(url));
      onConnecting?.();

      const socket = new WebSocket(url);
      ws = socket;
      let settled = false;

      socket.addEventListener("open", () => {
        console.info("[admin-ws] Opened", redactWebSocketUrl(url));
        settled = true;
        connectPromise = null;
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            const message = { type: "PING", payload: {} } satisfies SignalingMessage;
            console.info("[client-ws] sending", message);
            socket.send(JSON.stringify(message));
          }
        }, 25_000);
        onOpen?.();
        resolve();
      });

      socket.addEventListener("message", (event) => {
        const message = parseSignalingMessage(event.data);
        if (message) {
          console.info("[admin-ws] received", summarizeSignalingMessage(message));
          if (message.type === "WEBRTC_OFFER") {
            console.info("[admin-ws] received offer", {
              sessionId: message.payload.sessionId,
              fromRole: message.payload.fromRole,
              sdpLength: message.payload.sdp.length
            });
          }
          onMessage(message);
        }
      });

      socket.addEventListener("close", (event) => {
        console.info("[admin-ws] Closed", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        clearPingTimer();
        if (ws === socket) ws = null;
        connectPromise = null;
        onClose?.(event);
        if (!settled) {
          settled = true;
          reject(new Error(closeErrorMessage(event)));
        }
      });

      socket.addEventListener("error", (event) => {
        console.error("[admin-ws] Error", describeWebSocketEvent(event, redactWebSocketUrl(url)));
        onError?.(event);
        if (!settled) {
          settled = true;
          connectPromise = null;
          reject(new Error("Unable to connect to signaling server"));
        }
      });
    });

    return connectPromise;
  }

  return {
    connect,
    close: () => {
      clearPingTimer();
      ws?.close();
      ws = null;
    },
    send: (message) => {
      if (ws?.readyState !== WebSocket.OPEN) return false;
      console.info("[client-ws] sending", message);
      ws.send(JSON.stringify(message));
      return true;
    },
    isOpen: () => ws?.readyState === WebSocket.OPEN
  };
}
async function buildWebSocketUrl(adminToken: string) {
  if (!adminToken) return null;

  const url = new URL(SAVE_GARD_WS_PATH, SAVE_GARD_WS_BASE_URL);
  url.searchParams.set("role", "admin");
  url.searchParams.set("token", adminToken);
  return url.toString();
}

function closeErrorMessage(event: CloseEvent) {
  if (event.code === 4001) return "Unable to connect to signaling server: unauthorized";
  if (event.code === 4002) return "Unable to connect to signaling server: invalid auth parameters";
  if (event.reason) return `Unable to connect to signaling server: ${event.reason}`;
  return "Unable to connect to signaling server";
}

function parseSignalingMessage(data: unknown): SignalingMessage | null {
  if (typeof data !== "string") return null;

  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return null;
    const normalized = normalizeSignalingMessage(parsed);
    if (!normalized) {
      console.warn("[admin-ws] Ignored unsupported signaling message", parsed);
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function describeWebSocketEvent(event: Event, url?: string) {
  const socket = event.target instanceof WebSocket ? event.target : null;
  return {
    type: event.type,
    url: url ?? socket?.url,
    readyState: socket?.readyState
  };
}

function redactWebSocketUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.searchParams.has("token")) parsed.searchParams.set("token", "[redacted]");
  return parsed.toString();
}

function normalizeSignalingMessage(raw: unknown): SignalingMessage | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;

  const type = normalizeType(raw.type);
  const payload = isRecord(raw.payload) ? raw.payload : raw;

  if (type === "WEBRTC_OFFER") {
    const sessionId = readString(payload, "sessionId") ?? readString(raw, "sessionId");
    const sdp = readSdp(payload) ?? readSdp(raw);
    if (!sessionId || !sdp) return null;
    return {
      type,
      payload: {
        sessionId,
        fromRole: readRole(payload) ?? readRole(raw) ?? "child",
        sdp
      }
    };
  }

  if (type === "WEBRTC_ANSWER") {
    const sessionId = readString(payload, "sessionId") ?? readString(raw, "sessionId");
    const sdp = readSdp(payload) ?? readSdp(raw);
    if (!sessionId || !sdp) return null;
    return {
      type,
      payload: {
        sessionId,
        fromRole: readRole(payload) ?? readRole(raw) ?? "child",
        sdp
      }
    };
  }

  if (type === "WEBRTC_ICE_CANDIDATE") {
    const sessionId = readString(payload, "sessionId") ?? readString(raw, "sessionId");
    const candidate = readCandidate(payload) ?? readCandidate(raw);
    if (!sessionId || !candidate) return null;
    return {
      type,
      payload: {
        sessionId,
        fromRole: readRole(payload) ?? readRole(raw) ?? "child",
        candidate
      }
    };
  }

  return {
    ...raw,
    type
  } as SignalingMessage;
}

function normalizeType(type: string) {
  const normalized = type.trim().toUpperCase().replaceAll("-", "_");
  if (normalized === "OFFER" || normalized === "RTC_OFFER" || normalized === "WEBRTC_OFFER") {
    return "WEBRTC_OFFER";
  }
  if (normalized === "ANSWER" || normalized === "RTC_ANSWER" || normalized === "WEBRTC_ANSWER") {
    return "WEBRTC_ANSWER";
  }
  if (
    normalized === "ICE" ||
    normalized === "ICE_CANDIDATE" ||
    normalized === "RTC_ICE_CANDIDATE" ||
    normalized === "WEBRTC_ICE" ||
    normalized === "WEBRTC_ICE_CANDIDATE"
  ) {
    return "WEBRTC_ICE_CANDIDATE";
  }
  return normalized as SignalingMessage["type"];
}

function readSdp(source: Record<string, unknown>) {
  const direct = readString(source, "sdp");
  if (direct) return direct;

  const offer = isRecord(source.offer) ? source.offer : null;
  const answer = isRecord(source.answer) ? source.answer : null;
  const description = isRecord(source.description) ? source.description : null;
  const signal = isRecord(source.signal) ? source.signal : null;

  return (
    (offer ? readString(offer, "sdp") : null) ??
    (answer ? readString(answer, "sdp") : null) ??
    (description ? readString(description, "sdp") : null) ??
    (signal ? readString(signal, "sdp") : null)
  );
}

function readCandidate(source: Record<string, unknown>): RTCIceCandidateInit | null {
  const candidate =
    source.candidate ??
    source.iceCandidate ??
    source.rtcIceCandidate ??
    (isRecord(source.signal) ? source.signal.candidate : null);

  if (typeof candidate === "string") {
    return {
      candidate,
      sdpMid: readNullableString(source, "sdpMid"),
      sdpMLineIndex: readNullableNumber(source, "sdpMLineIndex")
    };
  }

  if (!isRecord(candidate)) return null;
  const candidateLine = readString(candidate, "candidate");
  if (!candidateLine) return null;

  return {
    candidate: candidateLine,
    sdpMid: readNullableString(candidate, "sdpMid"),
    sdpMLineIndex: readNullableNumber(candidate, "sdpMLineIndex"),
    usernameFragment: readNullableString(candidate, "usernameFragment")
  };
}

function readRole(source: Record<string, unknown>) {
  const role = readString(source, "fromRole") ?? readString(source, "role") ?? readString(source, "from");
  return role === "admin" || role === "child" ? role : null;
}

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNullableString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function readNullableNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "number" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeSignalingMessage(message: SignalingMessage) {
  if (message.type === "WEBRTC_OFFER" || message.type === "WEBRTC_ANSWER") {
    return {
      type: message.type,
      sessionId: message.payload.sessionId,
      fromRole: message.payload.fromRole,
      sdpLength: message.payload.sdp.length
    };
  }

  if (message.type === "WEBRTC_ICE_CANDIDATE") {
    return {
      type: message.type,
      sessionId: message.payload.sessionId,
      fromRole: message.payload.fromRole,
      sdpMid: message.payload.candidate.sdpMid,
      sdpMLineIndex: message.payload.candidate.sdpMLineIndex
    };
  }

  return message;
}
