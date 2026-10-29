"use client";

import { useEffect, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import type { ChatMessage, ServerToClientEvents, ClientToServerEvents } from "@/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseChatParams {
  socket: TypedSocket;
  roomId: string;
  enabled: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
}

export function useChat({ socket, roomId, enabled }: UseChatParams): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!enabled) return;

    function onChatMessage(message: ChatMessage) {
      setMessages((prev) => [...prev, message]);
    }

    socket.on("chat-message", onChatMessage);

    return () => {
      socket.off("chat-message", onChatMessage);
    };
  }, [socket, enabled]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !enabled) return;
      socket.emit("chat-message", { roomId, text: trimmed });
    },
    [socket, roomId, enabled]
  );

  return { messages, sendMessage };
}
