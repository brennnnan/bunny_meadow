"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface ToastItem {
  id: string;
  message: string;
  type: "info" | "warning" | "error";
  duration?: number; // ms, default 4000
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function ToastEntry({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 200); // wait for fade out
    }, toast.duration ?? 4000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const bgColor =
    toast.type === "error"
      ? "var(--danger)"
      : toast.type === "warning"
        ? "var(--bg-tertiary)"
        : "var(--bg-elevated)";

  const textColor =
    toast.type === "error"
      ? "#fff"
      : toast.type === "warning"
        ? "var(--warning)"
        : "var(--text-primary)";

  const borderColor =
    toast.type === "warning" ? "var(--warning)" : "transparent";

  return (
    <div
      className="px-4 py-2.5 rounded-lg text-xs max-w-sm text-center transition-all duration-200"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
      }}
    >
      {toast.message}
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50">
      {toasts.map((toast) => (
        <ToastEntry key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// --- Hook for managing toasts ---

let toastCounter = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastItem["type"] = "info", duration?: number) => {
      const id = `toast-${++toastCounter}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}
