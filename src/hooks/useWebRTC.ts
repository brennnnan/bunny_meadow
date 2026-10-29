"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getRTCConfig } from "@/lib/webrtc-config";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseWebRTCParams {
  socket: TypedSocket;
  roomId: string;
  localStream: MediaStream | null;
  polite: boolean;
  enabled: boolean; // only start when both socket and stream are ready
}

interface UseWebRTCReturn {
  remoteStream: MediaStream | null;
  remoteScreenStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  addScreenTracks: (stream: MediaStream) => string[];
  removeScreenTracks: () => void;
}

export function useWebRTC({
  socket,
  roomId,
  localStream,
  polite,
  enabled,
}: UseWebRTCParams): UseWebRTCReturn {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const screenSendersRef = useRef<RTCRtpSender[]>([]);
  const screenMidsRef = useRef<Set<string>>(new Set());
  const politeRef = useRef(polite);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isSettingRemoteAnswerRef = useRef(false);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");

  // Keep polite ref in sync
  politeRef.current = polite;

  // Stable refs for remote streams so ontrack can append to them
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteScreenStreamRef = useRef<MediaStream | null>(null);

  // --- Create PeerConnection and wire up signaling ---
  useEffect(() => {
    if (!enabled || !localStream || !socket.connected) return;

    let cancelled = false;

    async function init() {
      const rtcConfig = await getRTCConfig();
      if (cancelled) return;

      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      // Reset remote streams
      const webcamStream = new MediaStream();
      remoteStreamRef.current = webcamStream;
      setRemoteStream(webcamStream);

    // Add local webcam tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // --- Connection state ---
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "failed") {
        console.log("[webrtc] connection failed, attempting ICE restart");
        pc.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    // --- Perfect Negotiation: onnegotiationneeded ---
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        socket.emit("send-offer", {
          roomId,
          description: pc.localDescription!.toJSON(),
        });
      } catch (err) {
        console.error("[webrtc] negotiationneeded error:", err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    // --- ICE candidates ---
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("send-ice-candidate", {
          roomId,
          candidate: candidate.toJSON(),
        });
      }
    };

    // --- Incoming tracks ---
    pc.ontrack = (event) => {
      const track = event.track;
      const transceiver = event.transceiver;
      const mid = transceiver?.mid;

      // Determine if this is a screen share track
      const isScreen = mid != null && screenMidsRef.current.has(mid);

      if (isScreen) {
        if (!remoteScreenStreamRef.current) {
          remoteScreenStreamRef.current = new MediaStream();
        }
        remoteScreenStreamRef.current.addTrack(track);
        setRemoteScreenStream(new MediaStream(remoteScreenStreamRef.current.getTracks()));
      } else {
        remoteStreamRef.current?.addTrack(track);
        setRemoteStream(new MediaStream(remoteStreamRef.current!.getTracks()));
      }

      track.onended = () => {
        if (isScreen && remoteScreenStreamRef.current) {
          remoteScreenStreamRef.current.removeTrack(track);
          const remaining = remoteScreenStreamRef.current.getTracks();
          if (remaining.length === 0) {
            remoteScreenStreamRef.current = null;
            setRemoteScreenStream(null);
          } else {
            setRemoteScreenStream(new MediaStream(remaining));
          }
        }
      };

      // Also handle mute/unmute to trigger re-renders
      track.onunmute = () => {
        if (isScreen) {
          if (remoteScreenStreamRef.current) {
            setRemoteScreenStream(new MediaStream(remoteScreenStreamRef.current.getTracks()));
          }
        } else {
          if (remoteStreamRef.current) {
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
          }
        }
      };
    };

    // --- Socket signaling handlers ---
    function onReceiveOffer({ description }: { description: RTCSessionDescriptionInit }) {
      handleOffer(description);
    }

    function onReceiveAnswer({ description }: { description: RTCSessionDescriptionInit }) {
      handleAnswer(description);
    }

    function onReceiveIceCandidate({ candidate }: { candidate: RTCIceCandidateInit }) {
      handleIceCandidate(candidate);
    }

    function onShareStarted({ mids }: { socketId: string; displayName: string; mids?: string[] }) {
      if (mids) {
        screenMidsRef.current = new Set(mids);
      }
    }

    function onShareStopped() {
      screenMidsRef.current.clear();
      remoteScreenStreamRef.current = null;
      setRemoteScreenStream(null);
    }

    async function onUserJoined() {
      // The impolite peer (first user) sends a fresh offer when the
      // second user arrives — the original offer was sent to an empty
      // room and lost, so we must explicitly renegotiate here.
      if (!politeRef.current) {
        try {
          makingOfferRef.current = true;
          await pc.setLocalDescription();
          socket.emit("send-offer", {
            roomId,
            description: pc.localDescription!.toJSON(),
          });
        } catch (err) {
          console.error("[webrtc] error sending offer on user-joined:", err);
        } finally {
          makingOfferRef.current = false;
        }
      }
    }

    function onUserLeft({ gracePeriod }: { socketId: string; gracePeriod: boolean }) {
      if (!gracePeriod) {
        // Partner fully gone — clean up remote streams
        remoteStreamRef.current = new MediaStream();
        remoteScreenStreamRef.current = null;
        setRemoteStream(remoteStreamRef.current);
        setRemoteScreenStream(null);
      }
    }

    async function handleOffer(description: RTCSessionDescriptionInit) {
      try {
        const readyForOffer =
          !makingOfferRef.current &&
          (pc.signalingState === "stable" || isSettingRemoteAnswerRef.current);
        const offerCollision = description.type === "offer" && !readyForOffer;

        ignoreOfferRef.current = !politeRef.current && offerCollision;
        if (ignoreOfferRef.current) return;

        isSettingRemoteAnswerRef.current = description.type === "answer";
        await pc.setRemoteDescription(description);
        isSettingRemoteAnswerRef.current = false;

        if (description.type === "offer") {
          await pc.setLocalDescription();
          socket.emit("send-answer", {
            roomId,
            description: pc.localDescription!.toJSON(),
          });
        }
      } catch (err) {
        console.error("[webrtc] error handling offer:", err);
      }
    }

    async function handleAnswer(description: RTCSessionDescriptionInit) {
      try {
        isSettingRemoteAnswerRef.current = true;
        await pc.setRemoteDescription(description);
        isSettingRemoteAnswerRef.current = false;
      } catch (err) {
        console.error("[webrtc] error handling answer:", err);
      }
    }

    async function handleIceCandidate(candidate: RTCIceCandidateInit) {
      try {
        if (!ignoreOfferRef.current) {
          await pc.addIceCandidate(candidate);
        }
      } catch (err) {
        if (!ignoreOfferRef.current) {
          console.error("[webrtc] error adding ICE candidate:", err);
        }
      }
    }

    socket.on("receive-offer", onReceiveOffer);
    socket.on("receive-answer", onReceiveAnswer);
    socket.on("receive-ice-candidate", onReceiveIceCandidate);
    socket.on("share-started", onShareStarted);
    socket.on("share-stopped", onShareStopped);
    socket.on("user-joined", onUserJoined);
    socket.on("user-left", onUserLeft);

    console.log("[webrtc] PeerConnection created, polite:", politeRef.current);
    } // end init()

    init();

    return () => {
      cancelled = true;

      // Remove all socket listeners (these are defined inside init, but
      // socket.off with no fn removes all listeners for the event — so we
      // use removeAllListeners only for our specific events via a broader cleanup)
      socket.off("receive-offer");
      socket.off("receive-answer");
      socket.off("receive-ice-candidate");
      socket.off("share-started");
      socket.off("share-stopped");
      socket.off("user-joined");
      socket.off("user-left");

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      screenSendersRef.current = [];
      screenMidsRef.current.clear();
      remoteStreamRef.current = null;
      remoteScreenStreamRef.current = null;
      setRemoteStream(null);
      setRemoteScreenStream(null);
      setConnectionState("closed");

      console.log("[webrtc] PeerConnection closed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, localStream, socket, roomId]);

  // --- Screen sharing track management (called from useScreenShare) ---

  const addScreenTracks = useCallback(
    (stream: MediaStream): string[] => {
      const pc = pcRef.current;
      if (!pc) return [];

      const senders: RTCRtpSender[] = [];
      stream.getTracks().forEach((track) => {
        if (track.kind === "video") {
          track.contentHint = "detail";
        }
        senders.push(pc.addTrack(track, stream));
      });

      screenSendersRef.current = senders;

      // onnegotiationneeded will fire, then we can get mids
      // Return mids after a short delay to let negotiation set them
      // The caller should emit share-started after getting mids
      const mids = senders
        .map((sender) => {
          const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
          return transceiver?.mid;
        })
        .filter((mid): mid is string => mid != null);

      return mids;
    },
    []
  );

  const removeScreenTracks = useCallback(() => {
    const pc = pcRef.current;
    if (!pc) return;

    screenSendersRef.current.forEach((sender) => {
      try {
        pc.removeTrack(sender);
      } catch {
        // sender may already be removed
      }
    });
    screenSendersRef.current = [];
  }, []);

  return {
    remoteStream,
    remoteScreenStream,
    connectionState,
    addScreenTracks,
    removeScreenTracks,
  };
}
