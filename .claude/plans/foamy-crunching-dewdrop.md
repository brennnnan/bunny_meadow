# Bunny — Watch-Together App for Couples

## Context

Bunny is a web app inspired by the defunct Rabb.it service. It lets couples in long-distance relationships watch TV together while video chatting. One user shares their browser tab (e.g., Amazon Prime), both see each other via webcam, and they have a text chat — all in a single room accessed via a shareable link.

**Why tab sharing instead of a remote browser:** Amazon Prime uses Widevine DRM, which only works at L3 (software, max 1080p) on virtual Linux browsers and may fail entirely. WebRTC tab sharing (`getDisplayMedia`) works natively with DRM because the user's real browser handles decryption. A remote browser (neko/Docker) is planned as Phase 2 for non-DRM content with shared control.

---

## Tech Stack

- **Next.js 14+** (App Router) — React frontend
- **Express** — Custom server wrapping Next.js (required for Socket.IO)
- **Socket.IO** — Real-time signaling, chat, room management
- **WebRTC** — Peer-to-peer video chat + tab sharing (native browser APIs)
- **Tailwind CSS v4** — Styling (dark theme)
- **TypeScript** — Strict mode throughout
- **nanoid** — Room ID generation

---

## Architecture

### Single PeerConnection, Multiple Tracks

Both users connect via one `RTCPeerConnection` carrying all media:
- Webcam video + audio (both users)
- Screen share video + audio (one user at a time, added/removed dynamically)

This avoids bandwidth estimator conflicts and simplifies the codebase vs. multiple connections.

### Perfect Negotiation Pattern

Required because tracks are added/removed dynamically (screen sharing). The server assigns each user a role on join:
- **First user = impolite** — on offer collision, ignores the incoming offer
- **Second user = polite** — on offer collision, rolls back its own offer and accepts

### Signaling via Socket.IO

Events: `join-room`, `leave-room`, `user-joined`, `user-left`, `room-full`, `room-joined`, `send-offer`, `receive-offer`, `send-answer`, `receive-answer`, `send-ice-candidate`, `receive-ice-candidate`, `chat-message`, `share-started`, `share-stopped`

### Track Identification (Screen vs. Webcam)

When a user starts screen sharing, they emit `share-started` via Socket.IO with the transceiver `mid` values of the screen tracks. The receiver uses these `mid` values to route incoming tracks to either the webcam stream or the screen stream. Fallback heuristics: `contentHint`, `displaySurface` settings, track label keywords.

### Volume Control

Web Audio API `GainNode` chains give independent volume for partner's mic vs. shared content audio:
```
Remote mic track   -> GainNode (mic slider)    -> AudioContext.destination
Remote tab track   -> GainNode (content slider) -> AudioContext.destination
```
Chrome requires a hidden muted `<audio>` element to activate the audio pipeline.

---

## Layout

```
+--------------------------------------------------------------+
|  [Bunny]  Room: abc123  [Copy Link]           [Leave Room]   |
+--------------------------------------------------------------+
|                          |  Partner  |                       |
|                          |  Webcam   |   Chat messages       |
|     Shared Content       |-----------|   ...                 |
|     (tab stream)         |   Your    |   ...                 |
|                          |  Webcam   |   [type here] [send]  |
|       ~65% width         |  ~15%     |       ~20%            |
+--------------------------------------------------------------+
|   [Mute] [Camera] [Share Screen] [Fullscreen]  [Vol sliders] |
+--------------------------------------------------------------+
```

- Dark theme (near-black `#0a0a0f` background, pink accent `#f472b6`)
- Desktop-focused
- Shared content: `object-fit: contain` (preserves aspect ratio with letterboxing)
- Webcams: `object-fit: cover`, stacked vertically, local feed mirrored

---

## Implementation Steps

### Step 1: Project Scaffolding

Create the Next.js project with custom Express server for Socket.IO.

**Files:**
- `package.json` — deps: next, react, react-dom, express, socket.io, socket.io-client, nanoid
- `tsconfig.json` — standard Next.js strict config with `@/*` path alias
- `tsconfig.server.json` — CommonJS target for server, includes `server/**/*.ts`
- `next.config.ts` — minimal
- `postcss.config.mjs` — `@tailwindcss/postcss` plugin
- `src/app/globals.css` — `@import "tailwindcss"` + dark theme CSS variables
- `src/app/layout.tsx` — root layout with dark class, metadata
- `src/app/page.tsx` — placeholder landing page
- `server/index.ts` — Express + Socket.IO + Next.js custom server
- `server/rooms.ts` — placeholder `registerRoomHandlers(io)`

**Custom server pattern:**
```typescript
// server/index.ts
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();
nextApp.prepare().then(() => {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, { cors: { origin: dev ? 'http://localhost:3000' : undefined } });
  registerRoomHandlers(io);
  app.all('*', (req, res) => handle(req, res));
  server.listen(3000);
});
```

**Dev script:** `"dev": "ts-node --project tsconfig.server.json server/index.ts"`

**Verify:** `npm run dev` starts server, `localhost:3000` shows placeholder page, `/socket.io/` responds.

---

### Step 2: Room System

Rooms are ephemeral, in-memory, limited to 2 users, and created on first join.

**Files:**
- `src/types/index.ts` — `RoomUser`, `Room`, `ChatMessage`, Socket event type interfaces (`ServerToClientEvents`, `ClientToServerEvents`)
- `src/lib/constants.ts` — `MAX_ROOM_USERS = 2`, `DISCONNECT_GRACE_PERIOD_MS = 20000`, media constraints
- `src/lib/socket.ts` — Socket.IO client singleton (typed, `autoConnect: false`)
- `server/rooms.ts` — full implementation:
  - In-memory `Map<string, ServerRoom>`
  - `join-room`: create room if needed, enforce 2-user limit (`room-full` event), assign polite/impolite role, emit `room-joined` with user list + `polite` boolean
  - `disconnect`: start 20s grace timer, emit `user-left` immediately to partner
  - Reconnect within grace period: cancel timer, re-add user
  - Periodic cleanup of stale rooms (every 5 min)
- `src/components/CreateRoom.tsx` — "Create Room" button (generates nanoid, navigates to `/room/[id]`), join-by-link input
- `src/components/JoinPrompt.tsx` — display name prompt modal (max 20 chars)
- `src/app/page.tsx` — landing page with CreateRoom
- `src/app/room/[id]/page.tsx` — shows JoinPrompt, then connects socket, emits `join-room`, handles `room-full` / `room-joined`

**Verify:** Create room in tab A, join from tab B with different names. Tab C gets "room full". Close tab B — tab A shows "user left" after 20s.

---

### Step 3: WebRTC Video Chat

Peer-to-peer webcam + mic via a single PeerConnection with Perfect Negotiation.

**Files:**
- `src/lib/webrtc-config.ts` — ICE config (Google STUN servers, TURN placeholder)
- `src/hooks/useSocket.ts` — socket connection lifecycle, typed event helpers
- `src/hooks/useMediaStream.ts` — `getUserMedia` management; returns `localStream`, `toggleAudio` (sets `track.enabled`), `toggleVideo`, error state
- `src/hooks/useWebRTC.ts` — **the most complex file**:
  - Creates `RTCPeerConnection` with ICE config
  - Adds local webcam tracks via `addTrack()`
  - **Perfect Negotiation:**
    - `onnegotiationneeded` → create offer → emit via socket
    - `receive-offer` → collision detection using `polite` flag → set remote description → create answer if offer
    - `receive-answer` → set remote description
    - ICE candidate exchange
  - `ontrack` → route to `remoteStream` (webcam) or `remoteScreenStream` (screen) based on `mid` matching
  - Exposes `addScreenTracks(stream)` and `removeScreenTracks()` for Step 4
  - Connection state monitoring, ICE restart on failure
- `src/components/WebcamFeed.tsx` — renders a `<video>` with `srcObject`, name overlay, mirrored for local
- `src/components/WebcamPanel.tsx` — stacks two WebcamFeeds vertically (remote on top, local on bottom)
- Update `src/app/room/[id]/page.tsx` — wire up hooks, render WebcamPanel

**Key details:**
- `track.enabled = false` for mute/camera-off (NOT `removeTrack`)
- Local video element must have `muted` attribute (prevent echo)
- `addTrack()` triggers `onnegotiationneeded` automatically
- `removeTrack()` does NOT trigger `onnegotiationneeded` (m-line stays as inactive)

**Verify:** Two tabs see each other's webcam and hear audio. Close one tab → connection state changes. Reopen within 20s → reconnects.

---

### Step 4: Tab Sharing

Either user can share a browser tab with audio. Only one sharer at a time.

**Files:**
- `src/hooks/useScreenShare.ts`:
  - `startSharing()`: calls `getDisplayMedia({ video: { displaySurface: 'browser' }, audio: true })`, sets `contentHint = 'detail'` on video track, calls `addScreenTracks()` on the PeerConnection, emits `share-started` with transceiver `mid` values, listens to `track.onended` (browser's native stop button / tab closed)
  - `stopSharing()`: stops all tracks, calls `removeScreenTracks()`, emits `share-stopped`
  - Checks `stream.getAudioTracks().length` — warns if 0 (Firefox/Safari)
- `src/components/SharedScreen.tsx`:
  - Shows remote screen stream (if partner is sharing) or local screen stream (self-monitor)
  - Placeholder with instructions when nobody is sharing
  - "Who is sharing" indicator
  - Fullscreen toggle (`element.requestFullscreen()`)
- Update `src/hooks/useWebRTC.ts` — `share-started`/`share-stopped` socket listeners for mid-based track routing
- Update `src/app/room/[id]/page.tsx` — wire up screen share, disable "Share" button if partner is sharing

**Edge cases:**
- Shared tab closes/navigates → `track.onended` fires → `stopSharing()` cleans up automatically
- Firefox/Safari → no audio track captured → show warning toast
- Only one sharer at a time → button disabled when partner shares

**Verify:** User A shares a tab with video playing → User B sees it and hears audio (Chrome/Edge). User A stops → placeholder returns. Close shared tab → stops automatically.

---

### Step 5: Text Chat

Real-time messaging via Socket.IO. Can be built in parallel with Steps 3-4.

**Files:**
- `src/hooks/useChat.ts` — message array state, `sendMessage(text)` emits `chat-message`, listener appends incoming messages
- `src/components/TextChat.tsx` — message list (auto-scroll), sender differentiation (right-aligned local / left-aligned remote, different colors), timestamp (HH:MM), input bar with Enter-to-send, empty message prevention
- Update `server/rooms.ts` — `chat-message` handler: attach sender info, truncate to 500 chars, broadcast to room

**Verify:** Both users send and receive messages in real time. Auto-scroll works. Enter sends. Empty blocked.

---

### Step 6: UI Layout and Styling

Dark theme, 3-column grid layout.

**Files:**
- Update `src/app/globals.css` — dark theme CSS variables (`--bg-primary: #0a0a0f`, `--accent: #f472b6`, etc.), scrollbar styling, video element base styles
- Update `src/app/room/[id]/page.tsx` — CSS Grid: `grid-template-columns: 1fr 240px 320px`, full viewport height, header bar (48px), main content (flex-grow), control bar (56px)
- Style all components: SharedScreen (black bg, contain), WebcamPanel (cover, rounded), TextChat (border-left separator, message bubbles), header (room info, copy link, leave)
- `src/components/ConnectionStatus.tsx` — colored dot (green/yellow/red) + text in header

**Verify:** Looks correct at 1920x1080, 1440x900, 1280x720. Dark theme consistent. No overflow.

---

### Step 7: Controls and Polish

**Files:**
- `src/components/RoomControls.tsx` — bottom control bar:
  - Mute button (toggles `track.enabled`, red when muted)
  - Camera button (toggles `track.enabled`, icon change)
  - Share Screen button (disabled when partner is sharing)
  - Fullscreen button (shared content area)
  - Leave Room button
  - Volume sliders (partner mic / content audio) — range 0-100, maps to `GainNode.gain.value`
  - SVG icons inline (no icon library)
- `src/hooks/useKeyboardShortcuts.ts` — M (mute), V (camera), F (fullscreen). Ignored when typing in chat input.
- Update `src/hooks/useWebRTC.ts` — GainNode audio routing for independent volume control (Web Audio API)
- Copy room link button: `navigator.clipboard.writeText()` with "Copied!" feedback

**Verify:** M/V/F shortcuts work and don't fire in chat. Volume sliders independently control mic and content. All buttons have clear visual states.

---

### Step 8: Error Handling

**Files:**
- `src/components/PermissionError.tsx` — specific messages for `NotAllowedError`, `NotFoundError`, `NotReadableError` with retry option and browser-specific instructions
- `src/components/Toast.tsx` — auto-dismissing (3-5s) notification toasts
- Update `src/hooks/useWebRTC.ts` — `ICE restart` on `connectionState: 'failed'`, fresh PeerConnection on partner rejoin
- Update `src/hooks/useSocket.ts` — reconnection config (10 attempts, 1-5s delay), re-emit `join-room` on reconnect, "Reconnecting..." banner
- Update all hooks — consistent error state management

**Edge case handling:**
- Camera denied → clear error + retry
- Network drop → ICE restart → if failed, "Reconnecting..." → fresh PeerConnection on rejoin
- Partner disconnects → "Waiting for reconnection..." overlay → "Partner left" after 20s grace period
- Tab audio unavailable (Firefox/Safari) → toast warning

**Verify:** Block camera → see error with retry. DevTools offline → reconnect. Kill partner tab → reconnecting state → partner left after 20s.

---

## Complete File List (31 files, in implementation order)

| # | File | Purpose |
|---|------|---------|
| 1 | `package.json` | Dependencies and scripts |
| 2 | `tsconfig.json` | Next.js TypeScript config |
| 3 | `tsconfig.server.json` | Server TypeScript config (CommonJS) |
| 4 | `next.config.ts` | Next.js config |
| 5 | `postcss.config.mjs` | Tailwind PostCSS plugin |
| 6 | `src/app/globals.css` | Tailwind + dark theme variables |
| 7 | `src/app/layout.tsx` | Root layout |
| 8 | `src/types/index.ts` | Shared TypeScript types |
| 9 | `src/lib/constants.ts` | Config constants |
| 10 | `src/lib/webrtc-config.ts` | ICE/STUN/TURN config |
| 11 | `src/lib/socket.ts` | Socket.IO client singleton |
| 12 | `server/index.ts` | Custom Express + Socket.IO + Next.js server |
| 13 | `server/rooms.ts` | Room management + all Socket.IO handlers |
| 14 | `src/components/CreateRoom.tsx` | Landing page room creation |
| 15 | `src/components/JoinPrompt.tsx` | Display name prompt |
| 16 | `src/app/page.tsx` | Landing page |
| 17 | `src/app/room/[id]/page.tsx` | Room page (main orchestrator) |
| 18 | `src/hooks/useSocket.ts` | Socket.IO connection hook |
| 19 | `src/hooks/useMediaStream.ts` | getUserMedia hook |
| 20 | `src/hooks/useWebRTC.ts` | PeerConnection + Perfect Negotiation |
| 21 | `src/components/WebcamFeed.tsx` | Single video element |
| 22 | `src/components/WebcamPanel.tsx` | Stacked webcam feeds |
| 23 | `src/hooks/useScreenShare.ts` | getDisplayMedia hook |
| 24 | `src/components/SharedScreen.tsx` | Shared content display |
| 25 | `src/hooks/useChat.ts` | Chat message state |
| 26 | `src/components/TextChat.tsx` | Chat panel |
| 27 | `src/components/RoomControls.tsx` | Control bar |
| 28 | `src/components/ConnectionStatus.tsx` | Connection indicator |
| 29 | `src/hooks/useKeyboardShortcuts.ts` | Keyboard shortcuts |
| 30 | `src/components/PermissionError.tsx` | Permission error display |
| 31 | `src/components/Toast.tsx` | Toast notifications |

## Critical Implementation Notes

1. **`useWebRTC.ts` is the hardest file.** Get Perfect Negotiation right first with just webcam tracks. Then add screen share track management. Then add GainNode volume control. Layer by layer.

2. **Audio context must be created after user gesture** (browser autoplay policy). Create it when the user clicks "Join Room".

3. **Chrome audio quirk:** Remote WebRTC audio routed through Web Audio API may be silent unless a hidden muted `<audio>` element is also attached to the stream. Include this workaround.

4. **Tab audio is Chrome/Edge only.** `getDisplayMedia({ audio: true })` is silently ignored in Firefox and Safari. Always check `stream.getAudioTracks().length` and warn the user.

5. **TURN server is required for production.** STUN alone fails for ~30% of users on mobile/corporate networks. For development, Google STUN servers suffice. For production, self-host coturn or use a service (Twilio, Xirsys, Metered).

6. **`removeTrack()` does NOT trigger `onnegotiationneeded`.** This is fine — the SDP m-line stays as inactive. Don't try to force renegotiation after removing tracks.

7. **PeerConnection is not reusable after `connectionState: 'failed'`.** On partner rejoin, create a fresh PeerConnection and re-add all local tracks.

## Verification (End-to-End)

1. Start dev server (`npm run dev`)
2. Open `localhost:3000` — see landing page
3. Click "Create Room" — navigate to room page, see name prompt
4. Enter name, join — see local webcam feed
5. Copy room link, open in second browser (or incognito tab)
6. Enter name, join — both see each other's webcam, hear audio
7. User A clicks "Share Screen" — selects a tab playing video
8. User B sees shared content in main area, hears tab audio
9. Both send chat messages — appear in real time
10. Test mute (M), camera (V), fullscreen (F) shortcuts
11. Adjust volume sliders — mic and content independently controlled
12. User A stops sharing — placeholder returns
13. Close User B's tab — User A sees "reconnecting..." then "partner left" after 20s
14. Third tab tries to join — gets "room full" message
