// Fallback config used if the API call fails
const FALLBACK_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

let cachedConfig: RTCConfiguration | null = null;

/**
 * Fetches ICE server config (including TURN credentials) from the server.
 * Caches the result so subsequent calls don't make extra requests.
 */
export async function getRTCConfig(): Promise<RTCConfiguration> {
  if (cachedConfig) return cachedConfig;

  try {
    const res = await fetch("/api/ice-config");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    cachedConfig = {
      iceServers: data.iceServers,
      iceCandidatePoolSize: 10,
    };

    return cachedConfig;
  } catch (err) {
    console.warn("[webrtc] Failed to fetch ICE config, using STUN-only fallback:", err);
    return FALLBACK_CONFIG;
  }
}
