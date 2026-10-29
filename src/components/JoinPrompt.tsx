"use client";

import { useState } from "react";

interface JoinPromptProps {
  roomId: string;
  onJoin: (displayName: string) => void;
}

export default function JoinPrompt({ roomId, onJoin }: JoinPromptProps) {
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onJoin(trimmed.slice(0, 20));
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-accent">
          Bunny
        </h1>
        <p className="mt-3 text-sm text-secondary">
          Joining room{" "}
          <span className="font-mono bg-tertiary px-1.5 py-0.5 rounded text-xs text-primary">
            {roomId}
          </span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-4 w-full max-w-xs"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your display name"
          maxLength={20}
          autoFocus
          className="input-base w-full rounded-lg px-4 py-3 text-center text-sm outline-none"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="btn-accent w-full rounded-lg px-6 py-3 text-sm font-semibold"
        >
          Join Room
        </button>
      </form>
    </main>
  );
}
