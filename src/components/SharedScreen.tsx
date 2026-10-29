"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";

export interface SharedScreenHandle {
  toggleFullscreen: () => void;
}

interface SharedScreenProps {
  stream: MediaStream | null;
  sharerName: string | null;
  isLocalSharing: boolean;
}

const SharedScreen = forwardRef<SharedScreenHandle, SharedScreenProps>(
  function SharedScreen({ stream, sharerName, isLocalSharing }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream ?? null;
    }, [stream]);

    useEffect(() => {
      function onFullscreenChange() {
        setIsFullscreen(!!document.fullscreenElement);
      }
      document.addEventListener("fullscreenchange", onFullscreenChange);
      return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen();
      }
    }, []);

    // Expose toggleFullscreen to parent
    useImperativeHandle(ref, () => ({ toggleFullscreen }), [toggleFullscreen]);

    // --- No one sharing ---
    if (!stream || !sharerName) {
      return (
        <div
          ref={containerRef}
          className="w-full h-full flex flex-col items-center justify-center gap-3"
          style={{ backgroundColor: "#000" }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
            style={{ opacity: 0.3 }}
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <p className="text-sm text-muted">
            Share your screen to start watching together
          </p>
        </div>
      );
    }

    // --- Showing shared content ---
    return (
      <div
        ref={containerRef}
        className="group relative w-full h-full"
        style={{ backgroundColor: "#000" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocalSharing}
          className="w-full h-full"
          style={{ objectFit: "contain" }}
        />

        {/* Sharing indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded text-xs" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "var(--text-secondary)" }}>
          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--danger)" }} />
          {isLocalSharing ? "You are sharing" : `${sharerName} is sharing`}
        </div>

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 rounded p-1.5 cursor-pointer transition-opacity opacity-0 group-hover:opacity-70 hover:!opacity-100 focus:opacity-100"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "var(--text-primary)" }}
          title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isFullscreen ? (
              <>
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            ) : (
              <>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            )}
          </svg>
        </button>
      </div>
    );
  }
);

export default SharedScreen;
