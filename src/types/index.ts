// --- Room & User types ---

export interface RoomUser {
  socketId: string;
  displayName: string;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  senderSocketId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

// --- Socket.IO event payloads ---

export interface JoinRoomPayload {
  roomId: string;
  displayName: string;
}

export interface SignalPayload {
  roomId: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface ChatMessagePayload {
  roomId: string;
  text: string;
}

export interface ShareStartedPayload {
  roomId: string;
  mids?: string[];
}

// --- Server -> Client events ---

export interface ServerToClientEvents {
  "user-joined": (data: {
    socketId: string;
    displayName: string;
  }) => void;
  "user-left": (data: {
    socketId: string;
    gracePeriod: boolean;
  }) => void;
  "room-full": () => void;
  "room-joined": (data: {
    users: Array<{ socketId: string; displayName: string }>;
    polite: boolean;
  }) => void;
  "receive-offer": (data: {
    description: RTCSessionDescriptionInit;
  }) => void;
  "receive-answer": (data: {
    description: RTCSessionDescriptionInit;
  }) => void;
  "receive-ice-candidate": (data: {
    candidate: RTCIceCandidateInit;
  }) => void;
  "chat-message": (message: ChatMessage) => void;
  "share-started": (data: {
    socketId: string;
    displayName: string;
    mids?: string[];
  }) => void;
  "share-stopped": (data: { socketId: string }) => void;
}

// --- Client -> Server events ---

export interface ClientToServerEvents {
  "join-room": (payload: JoinRoomPayload) => void;
  "leave-room": (payload: { roomId: string }) => void;
  "send-offer": (payload: SignalPayload) => void;
  "send-answer": (payload: SignalPayload) => void;
  "send-ice-candidate": (payload: SignalPayload) => void;
  "chat-message": (payload: ChatMessagePayload) => void;
  "share-started": (payload: ShareStartedPayload) => void;
  "share-stopped": (payload: { roomId: string }) => void;
}
