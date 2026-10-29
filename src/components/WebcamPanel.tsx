"use client";

import WebcamFeed from "./WebcamFeed";

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
  return (
    <div className="flex flex-col gap-1.5 h-full p-1.5 bg-secondary">
      {/* Remote webcam (top) */}
      <div className="relative flex-1 min-h-0">
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
      <div className="relative flex-1 min-h-0">
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
