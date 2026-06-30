"use client";

type CreateAdminPeerConnectionOptions = {
  onTrack: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onConnectionFailed?: () => void;
  onConnected?: () => void;
};

export function createAdminPeerConnection({
  onTrack,
  onIceCandidate,
  onConnectionFailed,
  onConnected
}: CreateAdminPeerConnectionOptions): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.info("[admin-webrtc] local ICE candidate", {
        candidateType: event.candidate.type,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex
      });
      onIceCandidate(event.candidate.toJSON());
    }
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    console.info("[admin-webrtc] remote track received", {
      kind: event.track.kind,
      id: event.track.id,
      readyState: event.track.readyState,
      streams: event.streams.length
    });
    onTrack(stream ?? new MediaStream([event.track]));
  };

  pc.onconnectionstatechange = () => {
    console.info("[admin-webrtc] connection state", pc.connectionState);
    if (pc.connectionState === "connected") {
      onConnected?.();
    }

    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      onConnectionFailed?.();
    }
  };

  return pc;
}

export async function acceptRemoteOfferAndCreateAnswer(pc: RTCPeerConnection, sdp: string) {
  await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
  console.info("[admin-webrtc] offer applied");
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  console.info("[admin-webrtc] answer created");
  return answer.sdp ?? "";
}

export async function addRemoteIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit) {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
  console.info("[admin-webrtc] remote ICE candidate added", {
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex
  });
}

export function closePeerConnection(pc: RTCPeerConnection | null) {
  if (!pc) return;
  pc.onicecandidate = null;
  pc.ontrack = null;
  pc.onconnectionstatechange = null;
  pc.getSenders().forEach((sender) => sender.track?.stop());
  pc.getReceivers().forEach((receiver) => receiver.track?.stop());
  pc.close();
}
