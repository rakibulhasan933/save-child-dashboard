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

  pc.addTransceiver("video", { direction: "recvonly" });

  pc.onicecandidate = (event) => {
    if (event.candidate) onIceCandidate(event.candidate.toJSON());
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    onTrack(stream ?? new MediaStream([event.track]));
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      onConnected?.();
    }

    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      onConnectionFailed?.();
    }
  };

  return pc;
}

export async function createAndSetLocalOffer(pc: RTCPeerConnection) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer.sdp ?? "";
}

export async function setRemoteAnswer(pc: RTCPeerConnection, sdp: string) {
  await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
}

export async function addRemoteIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit) {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
