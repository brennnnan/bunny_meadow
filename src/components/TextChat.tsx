"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types";

interface TextChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  localSocketId: string | undefined;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TextChat({
  messages,
  onSend,
  localSocketId,
}: TextChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="flex flex-col h-full bg-secondary" style={{ borderLeft: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="px-3 py-2.5 shrink-0 text-xs font-medium tracking-wide uppercase text-muted" style={{ borderBottom: "1px solid var(--border)" }}>
        Chat
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-center mt-8 text-muted">
            No messages yet
          </p>
        )}

        {messages.map((msg) => {
          const isLocal = msg.senderSocketId === localSocketId;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isLocal ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] px-1 mb-0.5 text-muted">
                {isLocal ? "You" : msg.senderName}
              </span>

              <div
                className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[13px] leading-relaxed break-words ${
                  isLocal ? "rounded-br-sm" : "rounded-bl-sm"
                }`}
                style={{
                  backgroundColor: isLocal ? "var(--accent)" : "var(--bg-tertiary)",
                  color: isLocal ? "#fff" : "var(--text-primary)",
                }}
              >
                {msg.text}
              </div>

              <span className="text-[10px] px-1 mt-0.5 text-muted">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 flex gap-2 p-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={500}
          className="input-base flex-1 rounded-lg px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="btn-accent rounded-lg px-3 py-2 text-sm font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
