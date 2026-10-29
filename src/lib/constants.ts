export const MAX_ROOM_USERS = 2;
export const ROOM_ID_LENGTH = 10;
export const DISCONNECT_GRACE_PERIOD_MS = 20_000; // 20 seconds
export const STALE_ROOM_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
export const STALE_ROOM_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const MAX_DISPLAY_NAME_LENGTH = 20;

export const WEBCAM_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user",
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

export const DISPLAY_MEDIA_CONSTRAINTS: DisplayMediaStreamOptions = {
  video: {
    displaySurface: "browser",
  } as MediaTrackConstraints,
  audio: true,
};
