"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";
import type { ServerToClientEvents, ClientToServerEvents } from "@/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketReturn {
  socket: TypedSocket;
  isConnected: boolean;
  isReconnecting: boolean;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<TypedSocket>(getSocket());
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const socket = socketRef.current;

    function onConnect() {
      setIsConnected(true);
      setIsReconnecting(false);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onReconnectAttempt() {
      setIsReconnecting(true);
    }

    function onReconnectFailed() {
      setIsReconnecting(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);

    // Sync initial state
    setIsConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    isReconnecting,
  };
}
