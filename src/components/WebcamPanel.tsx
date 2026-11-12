"use client";

import { useState } from "react";
import WebcamFeed from "./WebcamFeed";

type AspectMode = "square" | "portrait" | "landscape";

const aspectClass: Record<AspectMode, string> = {
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  landscape: "aspect-video",
};

const nextMode: Record<AspectMode, AspectMode> = {
  square: "portrait",
  portrait: "landscape",
  landscape: "square",
};

const modeIcon: Record<AspectMode, { w: number; h: number }> = {
  square: { w: 12, h: 12 },
  portrait: { w: 9, h: 13 },
  landscape: { w: 14, h: 9 },
};

interface WebcamPanelProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localName: string;
  remoteName: string | null;
  isLocalVideoEnabled: boolean;
  partnerDisconnected: boolean;
}

export default function WebcamPanel({
  localStream,
  remoteStream,
  localName,
  remoteName,
  isLocalVideoEnabled,
  partnerDisconnected,
}: WebcamPanelProps) {
  const [aspect, setAspect] = useState<AspectMode>("square");
  const icon = modeIcon[aspect];

  return (
    <div className="flex flex-col gap-1.5 h-full p-1.5 bg-secondary overflow-y-auto">
      {/* Aspect toggle */}
      <button
        onClick={() => setAspect(nextMode[aspect])}
        className="self-end flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted hover:text-primary bg-tertiary hover:bg-elevated transition-colors shrink-0"
        title={`Switch to ${nextMode[aspect]}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect
            x={(16 - icon.w) / 2}
            y={(16 - icon.h) / 2}
            width={icon.w}
            height={icon.h}
            rx="1.5"
          />
        </svg>
        {aspect}
      </button>

      {/* Remote webcam (top) */}
      <div className={`relative w-full ${aspectClass[aspect]} shrink-0`}>
        {remoteName ? (
          <>
            <WebcamFeed
              stream={remoteStream}
              displayName={remoteName}
              isLocal={false}
            />
            {partnerDisconnected && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/75">
                <div className="text-center">
                  <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: "var(--warning)", borderTopColor: "transparent" }} />
                  <p className="text-xs" style={{ color: "var(--warning)" }}>
                    Reconnecting...
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center rounded-lg bg-tertiary gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <p className="text-[11px] text-center px-2 text-muted">
              Waiting for partner...
            </p>
          </div>
        )}
      </div>

      {/* Local webcam (bottom) */}
      <div className={`relative w-full ${aspectClass[aspect]} shrink-0`}>
        <WebcamFeed
          stream={localStream}
          displayName={localName}
          isLocal
          isVideoEnabled={isLocalVideoEnabled}
        />
      </div>
    </div>
  );
}
