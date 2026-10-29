import { Server as SocketServer, Socket } from "socket.io";

// --- Types (server-side only, mirrors client types) ---

interface RoomUser {
  socketId: string;
  displayName: string;
  joinedAt: number;
}

interface ServerRoom {
  id: string;
  users: Map<string, RoomUser>; // socketId -> RoomUser
  createdAt: number;
  sharingUser: string | null; // socketId of whoever is screen-sharing
  disconnectTimers: Map<string, NodeJS.Timeout>; // socketId -> grace period timer
}

const MAX_ROOM_USERS = 2;
const DISCONNECT_GRACE_PERIOD_MS = 20_000;
const STALE_ROOM_MAX_AGE_MS = 60 * 60 * 1000;
const STALE_ROOM_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_CHAT_MESSAGE_LENGTH = 500;

// --- State ---

const rooms = new Map<string, ServerRoom>();
// Track which room each socket is in for cleanup on disconnect
const socketToRoom = new Map<string, string>();

// --- Helpers ---

function getOrCreateRoom(roomId: string): ServerRoom {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      users: new Map(),
      createdAt: Date.now(),
      sharingUser: null,
      disconnectTimers: new Map(),
    };
    rooms.set(roomId, room);
    console.log(`[room] created: ${roomId}`);
  }
  return room;
}

function removeUserFromRoom(
  io: SocketServer,
  socketId: string,
  roomId: string,
  gracePeriod: boolean
): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.users.delete(socketId);
  socketToRoom.delete(socketId);

  // Clear sharing state if the sharer left
  if (room.sharingUser === socketId) {
    room.sharingUser = null;
    io.to(roomId).emit("share-stopped", { socketId });
  }

  // Notify remaining users
  io.to(roomId).emit("user-left", { socketId, gracePeriod });

  console.log(
    `[room] ${socketId} left ${roomId} (grace: ${gracePeriod}, remaining: ${room.users.size})`
  );

  // Clean up empty rooms
  if (room.users.size === 0) {
    rooms.delete(roomId);
    console.log(`[room] deleted empty room: ${roomId}`);
  }
}

function cleanupStaleRooms(): void {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (room.users.size === 0 && now - room.createdAt > STALE_ROOM_MAX_AGE_MS) {
      rooms.delete(roomId);
      console.log(`[room] cleaned up stale room: ${roomId}`);
    }
  }
}

// --- Main handler ---

export function registerRoomHandlers(io: SocketServer): void {
  // Periodic stale room cleanup
  setInterval(cleanupStaleRooms, STALE_ROOM_CLEANUP_INTERVAL_MS);

  io.on("connection", (socket: Socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // --- Join Room ---
    socket.on("join-room", ({ roomId, displayName }) => {
      const room = getOrCreateRoom(roomId);

      // Check if this socket was disconnecting (grace period reconnect)
      const existingTimer = room.disconnectTimers.get(socket.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        room.disconnectTimers.delete(socket.id);
        console.log(`[room] ${socket.id} reconnected within grace period`);
      }

      // Enforce 2-user limit (don't count this socket if already in room)
      if (!room.users.has(socket.id) && room.users.size >= MAX_ROOM_USERS) {
        socket.emit("room-full");
        console.log(`[room] ${socket.id} rejected from full room ${roomId}`);
        return;
      }

      // Add user to room
      const user: RoomUser = {
        socketId: socket.id,
        displayName: displayName.trim().slice(0, 20) || "Anonymous",
        joinedAt: Date.now(),
      };
      room.users.set(socket.id, user);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);

      // Determine polite role: first user is impolite, second is polite
      const polite = room.users.size === 2;

      // Send room state to the joining user
      const existingUsers = Array.from(room.users.values())
        .filter((u) => u.socketId !== socket.id)
        .map((u) => ({ socketId: u.socketId, displayName: u.displayName }));

      socket.emit("room-joined", { users: existingUsers, polite });

      // Notify other users
      socket.to(roomId).emit("user-joined", {
        socketId: socket.id,
        displayName: user.displayName,
      });

      console.log(
        `[room] ${socket.id} (${user.displayName}) joined ${roomId} as ${polite ? "polite" : "impolite"} (${room.users.size}/${MAX_ROOM_USERS})`
      );
    });

    // --- Leave Room ---
    socket.on("leave-room", ({ roomId }) => {
      socket.leave(roomId);
      removeUserFromRoom(io, socket.id, roomId, false);
    });

    // --- WebRTC Signaling: forward to other user(s) in room ---
    socket.on("send-offer", ({ roomId, description }) => {
      if (!description) return;
      socket.to(roomId).emit("receive-offer", { description });
    });

    socket.on("send-answer", ({ roomId, description }) => {
      if (!description) return;
      socket.to(roomId).emit("receive-answer", { description });
    });

    socket.on("send-ice-candidate", ({ roomId, candidate }) => {
      if (!candidate) return;
      socket.to(roomId).emit("receive-ice-candidate", { candidate });
    });

    // --- Chat ---
    socket.on("chat-message", ({ roomId, text }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;

      const trimmed = text.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
      if (!trimmed) return;

      const message = {
        id: `${socket.id}-${Date.now()}`,
        senderSocketId: socket.id,
        senderName: user.displayName,
        text: trimmed,
        timestamp: Date.now(),
      };

      io.to(roomId).emit("chat-message", message);
    });

    // --- Screen Sharing ---
    socket.on("share-started", ({ roomId, mids }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;

      room.sharingUser = socket.id;
      socket.to(roomId).emit("share-started", {
        socketId: socket.id,
        displayName: user.displayName,
        mids,
      });
    });

    socket.on("share-stopped", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      if (room.sharingUser === socket.id) {
        room.sharingUser = null;
      }
      socket.to(roomId).emit("share-stopped", { socketId: socket.id });
    });

    // --- Disconnect (grace period) ---
    socket.on("disconnect", () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) {
        console.log(`[socket] disconnected (no room): ${socket.id}`);
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socketToRoom.delete(socket.id);
        return;
      }

      console.log(
        `[room] ${socket.id} disconnected from ${roomId}, starting ${DISCONNECT_GRACE_PERIOD_MS / 1000}s grace period`
      );

      // Notify partner immediately so they can show "reconnecting" UI
      socket.to(roomId).emit("user-left", {
        socketId: socket.id,
        gracePeriod: true,
      });

      // Start grace period timer
      const timer = setTimeout(() => {
        room.disconnectTimers.delete(socket.id);
        removeUserFromRoom(io, socket.id, roomId, false);
        console.log(
          `[room] ${socket.id} grace period expired, removed from ${roomId}`
        );
      }, DISCONNECT_GRACE_PERIOD_MS);

      room.disconnectTimers.set(socket.id, timer);
    });
  });
}
