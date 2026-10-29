"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

const ROOM_ID_LENGTH = 10;

export default function CreateRoom() {
  const router = useRouter();
  const [joinId, setJoinId] = useState("");

  function handleCreate() {
    const roomId = nanoid(ROOM_ID_LENGTH);
    router.push(`/room/${roomId}`);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = joinId.trim();
    if (!trimmed) return;

    const match = trimmed.match(/\/room\/([a-zA-Z0-9_-]+)/);
    const id = match ? match[1] : trimmed;
    router.push(`/room/${id}`);
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-md">
      <button
        onClick={handleCreate}
        className="btn-accent rounded-xl px-10 py-3.5 text-lg font-semibold tracking-wide"
      >
        Create Room
      </button>

      <div className="flex items-center gap-4 w-full text-muted">
        <div className="flex-1 h-px bg-tertiary" />
        <span className="text-xs uppercase tracking-wider">or join existing</span>
        <div className="flex-1 h-px bg-tertiary" />
      </div>

      <form onSubmit={handleJoin} className="flex gap-2 w-full">
        <input
          type="text"
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          placeholder="Paste room link or ID"
          className="input-base flex-1 rounded-lg px-4 py-2.5 text-sm outline-none"
        />
        <button
          type="submit"
          className="btn-ghost rounded-lg px-6 py-2.5 text-sm font-medium"
        >
          Join
        </button>
      </form>
    </div>
  );
}
