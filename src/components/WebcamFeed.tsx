"use client";

import { useEffect, useRef } from "react";

interface WebcamFeedProps {
  stream: MediaStream | null;
  displayName: string;
  isLocal?: boolean;
  isVideoEnabled?: boolean;
}

export default function WebcamFeed({
  stream,
  displayName,
  isLocal = false,
  isVideoEnabled = true,
}: WebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream ?? null;
  }, [stream]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg bg-primary">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
        style={isLocal ? { transform: "scaleX(-1)" } : undefined}
      />

      {/* Name badge */}
      <div className="absolute bottom-0 inset-x-0 px-2.5 py-1.5 text-xs truncate bg-gradient-to-t from-black/70 to-transparent text-primary">
        {displayName}
        {isLocal && <span className="text-muted"> (you)</span>}
      </div>

      {/* Camera off state */}
      {!isVideoEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-tertiary">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center mx-auto mb-1.5 text-lg font-semibold text-secondary">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="text-[11px] text-muted">Camera off</div>
          </div>
        </div>
      )}
    </div>
  );
}
