"use client";

interface PermissionErrorProps {
  error: string;
  onRetry: () => void;
}

export default function PermissionError({ error, onRetry }: PermissionErrorProps) {
  // Detect browser for specific instructions
  const isChrome =
    typeof navigator !== "undefined" && /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
  const isFirefox =
    typeof navigator !== "undefined" && /Firefox/.test(navigator.userAgent);
  const isSafari =
    typeof navigator !== "undefined" && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  let browserTip = "";
  if (error.includes("denied")) {
    if (isChrome) {
      browserTip = "Click the camera icon in the address bar, or go to Settings > Privacy > Site Settings > Camera/Microphone.";
    } else if (isFirefox) {
      browserTip = "Click the permissions icon (lock) in the address bar and allow camera/microphone access.";
    } else if (isSafari) {
      browserTip = "Go to Safari > Settings > Websites > Camera/Microphone and set this site to Allow.";
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 max-w-sm text-center px-6 py-8 rounded-xl bg-secondary mx-auto">
      {/* Icon */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "var(--accent-dim)" }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--danger)" }}
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      </div>

      {/* Error message */}
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1.5">
          Camera or Microphone Unavailable
        </h3>
        <p className="text-xs text-secondary leading-relaxed">
          {error}
        </p>
      </div>

      {/* Browser-specific tip */}
      {browserTip && (
        <p className="text-[11px] text-muted leading-relaxed bg-tertiary rounded-lg px-3 py-2">
          {browserTip}
        </p>
      )}

      {/* Retry button */}
      <button
        onClick={onRetry}
        className="btn-accent rounded-lg px-6 py-2.5 text-sm font-medium"
      >
        Try Again
      </button>
    </div>
  );
}
