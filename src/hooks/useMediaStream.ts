"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WEBCAM_CONSTRAINTS } from "@/lib/constants";

interface UseMediaStreamReturn {
  localStream: MediaStream | null;
  error: string | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  start: () => Promise<MediaStream | null>;
  stop: () => void;
}

function getPermissionErrorMessage(err: unknown): string {
  if (!(err instanceof DOMException)) return "Failed to access camera/microphone.";

  switch (err.name) {
    case "NotAllowedError":
      return "Camera/microphone access was denied. Please allow access in your browser settings.";
    case "NotFoundError":
      return "No camera or microphone found on this device.";
    case "NotReadableError":
      return "Your camera or microphone is in use by another application.";
    case "OverconstrainedError":
      return "Your camera doesn't support the requested settings.";
    default:
      return `Media error: ${err.message}`;
  }
}

export function useMediaStream(): UseMediaStreamReturn {
  const streamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const start = useCallback(async (): Promise<MediaStream | null> => {
    // Already have a stream
    if (streamRef.current) return streamRef.current;

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia(
        WEBCAM_CONSTRAINTS
      );
      streamRef.current = stream;
      setLocalStream(stream);
      setIsAudioEnabled(true);
      setIsVideoEnabled(true);
      return stream;
    } catch (err) {
      const message = getPermissionErrorMessage(err);
      setError(message);
      console.error("[media] getUserMedia failed:", err);
      return null;
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  const toggleAudio = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    localStream,
    error,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    start,
    stop,
  };
}
