import express from "express";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import next from "next";
import { registerRoomHandlers } from "./rooms";

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

function getIceServers() {
  const servers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ];

  const turnUrls = process.env.TURN_URLS;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUrls && turnUsername && turnCredential) {
    // Support comma-separated TURN URLs
    const urls = turnUrls.split(",").map((u) => u.trim());
    servers.push({
      urls,
      username: turnUsername,
      credential: turnCredential,
    });
    console.log(`[ice] TURN configured with ${urls.length} URL(s)`);
  } else {
    console.log("[ice] No TURN server configured — STUN only (set TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL for production)");
  }

  return servers;
}

nextApp.prepare().then(() => {
  const app = express();
  const server = createServer(app);

  const io = new SocketServer(server, {
    cors: dev ? { origin: "http://localhost:3000" } : undefined,
  });

  registerRoomHandlers(io);

  // --- API: ICE server config ---
  // Serves TURN credentials to the client without baking them into the JS bundle.
  const iceServers = getIceServers();

  app.get("/api/ice-config", (_req, res) => {
    res.json({ iceServers });
  });

  // --- All other routes handled by Next.js ---
  app.all("*", (req, res) => {
    return handle(req, res);
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`> Bunny running on http://localhost:${port} (${dev ? "development" : "production"})`);
  });
});
