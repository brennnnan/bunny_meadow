"use client";

import { useEffect } from "react";

interface UseKeyboardShortcutsParams {
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleFullscreen: () => void;
  enabled: boolean;
}

export function useKeyboardShortcuts({
  onToggleMute,
  onToggleVideo,
  onToggleFullscreen,
  enabled,
}: UseKeyboardShortcutsParams): void {
  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      // Don't fire shortcuts when typing in an input or textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "m":
          e.preventDefault();
          onToggleMute();
          break;
        case "v":
          e.preventDefault();
          onToggleVideo();
          break;
        case "f":
          e.preventDefault();
          onToggleFullscreen();
          break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onToggleMute, onToggleVideo, onToggleFullscreen]);
}
