"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useMediaStream } from "@/hooks/useMediaStream";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useChat } from "@/hooks/useChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import JoinPrompt from "@/components/JoinPrompt";
import WebcamPanel from "@/components/WebcamPanel";
import SharedScreen from "@/components/SharedScreen";
import type { SharedScreenHandle } from "@/components/SharedScreen";
import TextChat from "@/components/TextChat";
import ToastContainer, { useToasts } from "@/components/Toast";
import PermissionError from "@/components/PermissionError";

interface PeerInfo {
  socketId: string;
  displayName: string;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  // --- Room state ---
  const [joined, setJoined] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [polite, setPolite] = useState(false);
  const [partner, setPartner] = useState<PeerInfo | null>(null);
  const [partnerDisconnected, setPartnerDisconnected] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [mediaReady, setMediaReady] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [remoteSharerName, setRemoteSharerName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Refs ---
  const sharedScreenRef = useRef<SharedScreenHandle>(null);
  const displayNameRef = useRef("");

  // --- Toasts ---
  const { toasts, addToast, dismissToast } = useToasts();

  // --- Hooks ---
  const { socket, isConnected, isReconnecting } = useSocket();
  const {
    localStream,
    error: mediaHookError,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    start: startMedia,
    stop: stopMedia,
  } = useMediaStream();

  const {
    remoteStream,
    remoteScreenStream,
    connectionState,
    addScreenTracks,
    removeScreenTracks,
  } = useWebRTC({
    socket,
    roomId,
    localStream,
    polite,
    enabled: joined && mediaReady,
  });

  const {
    isSharing: isLocalSharing,
    screenStream: localScreenStream,
    noAudioWarning,
    error: screenShareError,
    startSharing,
    stopSharing,
  } = useScreenShare({
    socket,
    roomId,
    addScreenTracks,
    removeScreenTracks,
    enabled: joined && mediaReady,
  });

  const { messages, sendMessage } = useChat({
    socket,
    roomId,
    enabled: joined,
  });

  // Determine which screen stream to display and who is sharing
  const partnerIsSharing = !!remoteScreenStream && !isLocalSharing;
  const displayedScreenStream = isLocalSharing
    ? localScreenStream
    : remoteScreenStream;
  const sharerName = isLocalSharing
    ? displayName
    : partnerIsSharing
      ? remoteSharerName ?? partner?.displayName ?? null
      : null;

  // --- Show toasts for warnings/errors from hooks ---
  useEffect(() => {
    if (noAudioWarning) {
      addToast(
        "Tab audio not supported in this browser. Use Chrome or Edge for audio sharing.",
        "warning",
        6000
      );
    }
  }, [noAudioWarning, addToast]);

  useEffect(() => {
    if (screenShareError) {
      addToast(screenShareError, "error");
    }
  }, [screenShareError, addToast]);

  // --- Keyboard shortcuts ---
  const handleToggleFullscreen = useCallback(() => {
    sharedScreenRef.current?.toggleFullscreen();
  }, []);

  useKeyboardShortcuts({
    onToggleMute: toggleAudio,
    onToggleVideo: toggleVideo,
    onToggleFullscreen: handleToggleFullscreen,
    enabled: joined,
  });

  // --- Join handler ---
  const handleJoin = useCallback(
    async (name: string) => {
      setDisplayName(name);
      displayNameRef.current = name;
      setPermissionError(null);

      const stream = await startMedia();
      if (!stream) {
        setPermissionError(
          mediaHookError || "Could not access camera or microphone."
        );
        return;
      }
      setMediaReady(true);

      if (!socket.connected) {
        socket.connect();
      }

      if (socket.connected) {
        socket.emit("join-room", { roomId, displayName: name });
      } else {
        socket.once("connect", () => {
          socket.emit("join-room", { roomId, displayName: name });
        });
      }
    },
    [roomId, socket, startMedia, mediaHookError]
  );

  // --- Retry after permission error ---
  const handleRetry = useCallback(() => {
    setPermissionError(null);
    if (displayNameRef.current) {
      handleJoin(displayNameRef.current);
    }
  }, [handleJoin]);

  // --- Socket event listeners for room state ---
  useEffect(() => {
    function onRoomJoined(data: { users: PeerInfo[]; polite: boolean }) {
      setJoined(true);
      setPolite(data.polite);
      if (data.users.length > 0) {
        setPartner(data.users[0]);
      }
    }

    function onRoomFull() {
      setRoomFull(true);
    }

    function onUserJoined(data: PeerInfo) {
      setPartner(data);
      setPartnerDisconnected(false);
      addToast(`${data.displayName} joined`, "info", 3000);
    }

    function onUserLeft(data: { socketId: string; gracePeriod: boolean }) {
      if (data.gracePeriod) {
        setPartnerDisconnected(true);
      } else {
        const name = partner?.displayName;
        setPartner(null);
        setPartnerDisconnected(false);
        setRemoteSharerName(null);
        if (name) {
          addToast(`${name} left the room`, "info", 3000);
        }
      }
    }

    function onShareStarted(data: { socketId: string; displayName: string }) {
      setRemoteSharerName(data.displayName);
    }

    function onShareStopped() {
      setRemoteSharerName(null);
    }

    socket.on("room-joined", onRoomJoined);
    socket.on("room-full", onRoomFull);
    socket.on("user-joined", onUserJoined);
    socket.on("user-left", onUserLeft);
    socket.on("share-started", onShareStarted);
    socket.on("share-stopped", onShareStopped);

    return () => {
      socket.off("room-joined", onRoomJoined);
      socket.off("room-full", onRoomFull);
      socket.off("user-joined", onUserJoined);
      socket.off("user-left", onUserLeft);
      socket.off("share-started", onShareStarted);
      socket.off("share-stopped", onShareStopped);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, addToast]);

  // --- Re-join room on socket reconnect ---
  useEffect(() => {
    if (!joined || !displayNameRef.current) return;

    function onReconnect() {
      console.log("[room] socket reconnected, re-joining room");
      socket.emit("join-room", {
        roomId,
        displayName: displayNameRef.current,
      });
    }

    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.io.off("reconnect", onReconnect);
    };
  }, [socket, roomId, joined]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      stopMedia();
      if (socket.connected) {
        socket.emit("leave-room", { roomId });
        socket.disconnect();
      }
    };
  }, [roomId, socket, stopMedia]);

  // --- Actions ---
  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLeave() {
    stopMedia();
    socket.emit("leave-room", { roomId });
    socket.disconnect();
    router.push("/");
  }

  // --- Room Full ---
  if (roomFull) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4">
        <h2 className="text-2xl font-bold" style={{ color: "var(--danger)" }}>
          Room Full
        </h2>
        <p className="text-secondary text-sm">
          This room already has 2 people in it.
        </p>
        <button
          onClick={() => router.push("/")}
          className="btn-ghost rounded-lg px-6 py-2.5 text-sm font-medium"
        >
          Back to Home
        </button>
      </main>
    );
  }

  // --- Permission Error ---
  if (permissionError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <PermissionError error={permissionError} onRetry={handleRetry} />
      </main>
    );
  }

  // --- Join Prompt ---
  if (!joined) {
    return <JoinPrompt roomId={roomId} onJoin={handleJoin} />;
  }

  // --- Room UI ---
  return (
    <div className="flex flex-col h-screen bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-11 shrink-0 bg-secondary" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-tight text-accent">Bunny</span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-tertiary text-muted">
            {roomId}
          </span>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor:
                connectionState === "connected"
                  ? "var(--success)"
                  : connectionState === "connecting" || connectionState === "new"
                    ? "var(--warning)"
                    : "var(--danger)",
            }}
            title={`WebRTC: ${connectionState}`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleCopyLink} className="btn-ghost rounded px-2.5 py-1 text-[11px]">
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button onClick={handleLeave} className="btn-danger rounded px-2.5 py-1 text-[11px]">
            Leave
          </button>
        </div>
      </header>

      {/* Main content: 3-column layout */}
      <div className="flex-1 flex min-h-0">
        {/* Shared content area */}
        <div className="flex-1 min-w-0">
          <SharedScreen
            ref={sharedScreenRef}
            stream={displayedScreenStream}
            sharerName={sharerName}
            isLocalSharing={isLocalSharing}
          />
        </div>

        {/* Webcam panel */}
        <div className="w-56 shrink-0">
          <WebcamPanel
            localStream={localStream}
            remoteStream={remoteStream}
            localName={displayName}
            remoteName={partner?.displayName ?? null}
            isLocalVideoEnabled={isVideoEnabled}
            partnerDisconnected={partnerDisconnected}
          />
        </div>

        {/* Chat panel */}
        <div className="w-72 shrink-0">
          <TextChat
            messages={messages}
            onSend={sendMessage}
            localSocketId={socket.id}
          />
        </div>
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-center gap-2 px-4 h-14 shrink-0 bg-secondary" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Mute */}
        <button
          onClick={toggleAudio}
          className={`ctrl-btn ${isAudioEnabled ? "active" : "danger"}`}
          title={isAudioEnabled ? "Mute (M)" : "Unmute (M)"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
            {!isAudioEnabled && <line x1="2" y1="2" x2="22" y2="22" />}
          </svg>
        </button>

        {/* Camera */}
        <button
          onClick={toggleVideo}
          className={`ctrl-btn ${isVideoEnabled ? "active" : "danger"}`}
          title={isVideoEnabled ? "Camera off (V)" : "Camera on (V)"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" />
            <path d="m22 8-5 3 5 3V8Z" />
            {!isVideoEnabled && <line x1="2" y1="2" x2="22" y2="22" />}
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-6 mx-1" style={{ backgroundColor: "var(--border)" }} />

        {/* Share Screen */}
        <button
          onClick={isLocalSharing ? stopSharing : startSharing}
          disabled={partnerIsSharing}
          className={`ctrl-btn ${isLocalSharing ? "sharing" : "active"}`}
          title={
            partnerIsSharing
              ? "Partner is sharing"
              : isLocalSharing
                ? "Stop sharing"
                : "Share screen"
          }
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>

        {/* Fullscreen */}
        <button
          onClick={handleToggleFullscreen}
          className="ctrl-btn active"
          title="Fullscreen (F)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>

      {/* Reconnecting banner */}
      {isReconnecting && (
        <div className="fixed top-0 inset-x-0 py-1.5 text-center text-xs font-medium z-50" style={{ backgroundColor: "var(--warning)", color: "#000" }}>
          Reconnecting to server...
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
