"use client";

import { useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { DISPLAY_MEDIA_CONSTRAINTS } from "@/lib/constants";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseScreenShareParams {
  socket: TypedSocket;
  roomId: string;
  addScreenTracks: (stream: MediaStream) => string[];
  removeScreenTracks: () => void;
  enabled: boolean;
}

interface UseScreenShareReturn {
  isSharing: boolean;
  screenStream: MediaStream | null;
  noAudioWarning: boolean;
  error: string | null;
  startSharing: () => Promise<void>;
  stopSharing: () => void;
}

export function useScreenShare({
  socket,
  roomId,
  addScreenTracks,
  removeScreenTracks,
  enabled,
}: UseScreenShareParams): UseScreenShareReturn {
  const streamRef = useRef<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [noAudioWarning, setNoAudioWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopSharing = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    // Stop all tracks
    stream.getTracks().forEach((t) => t.stop());

    // Remove from PeerConnection
    removeScreenTracks();

    // Notify partner
    socket.emit("share-stopped", { roomId });

    streamRef.current = null;
    setScreenStream(null);
    setIsSharing(false);
    setNoAudioWarning(false);
    setError(null);

    console.log("[screen] stopped sharing");
  }, [removeScreenTracks, socket, roomId]);

  const startSharing = useCallback(async () => {
    if (!enabled) return;
    if (streamRef.current) return; // already sharing

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia(
        DISPLAY_MEDIA_CONSTRAINTS
      );

      streamRef.current = stream;
      setScreenStream(stream);
      setIsSharing(true);

      // Check if audio was captured (Chrome/Edge only)
      const hasAudio = stream.getAudioTracks().length > 0;
      if (!hasAudio) {
        setNoAudioWarning(true);
        console.log("[screen] no audio track — browser may not support tab audio capture");
      }

      // Tag video track for receiver identification
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.contentHint = "detail";

        // Handle browser's native "Stop sharing" button or tab close
        videoTrack.onended = () => {
          console.log("[screen] track ended (user stopped or tab closed)");
          stopSharing();
        };
      }

      // Add tracks to PeerConnection — returns transceiver mids
      const mids = addScreenTracks(stream);

      // Notify partner with mids for track identification
      // mids may be empty initially if negotiation hasn't assigned them yet.
      // We use a short delay to let onnegotiationneeded fire and assign mids,
      // then emit with whatever we have. The receiver also uses heuristics as fallback.
      setTimeout(() => {
        // Re-read mids in case they got assigned during negotiation
        socket.emit("share-started", { roomId, mids });
      }, 500);

      console.log("[screen] started sharing, audio:", hasAudio, "mids:", mids);
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(null); // not an error, user just cancelled
        return;
      }
      setError("Failed to share screen.");
      console.error("[screen] getDisplayMedia error:", err);
    }
  }, [enabled, addScreenTracks, socket, roomId, stopSharing]);

  return {
    isSharing,
    screenStream,
    noAudioWarning,
    error,
    startSharing,
    stopSharing,
  };
}
