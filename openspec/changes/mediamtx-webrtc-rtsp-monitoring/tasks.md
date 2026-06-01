## 1. Configuration and Module Structure

- [x] 1.1 Add MediaMTX/WebRTC environment variables to `.env.example`, including host `198.18.0.1`, protocol, WebRTC port, default stream path, endpoint template, timeout, and ICE/STUN settings.
- [x] 1.2 Create a feature-named `src/composables/mediamtx/` module with `types.ts`, `config.ts`, `client.ts`, receiver composable files, and `index.ts` exports.
- [x] 1.3 Implement config parsing helpers that build a MediaMTX WebRTC/WHEP endpoint from env defaults and support caller overrides for stream path or full endpoint URL.

## 2. MediaMTX WebRTC Receiver Implementation

- [x] 2.1 Implement the MediaMTX WebRTC HTTP/WHEP negotiation client using browser `RTCPeerConnection`, receive-only transceivers, SDP offer creation, timeout handling, and SDP answer application.
- [x] 2.2 Implement `useMediaMtxReceiver` for a single stream with reactive status, stream, error, `attach`, `detach`, `restart`, and automatic Vue unmount cleanup.
- [x] 2.3 Implement multi-stream testing support, either as `useMediaMtxReceivers` or a documented pattern, with independent video attachment and per-stream status.
- [x] 2.4 Ensure media resources are cleaned up on detach, restart, failure, and component unmount, including peer connection handlers, tracks, abort controllers, and video `srcObject`.

## 3. Application Migration and Redundant Code Cleanup

- [x] 3.1 Replace the current Socket.io/WebRTC example usage with a MediaMTX receiver demo that can play the configured default stream and optionally multiple paths.
- [x] 3.2 Search all source imports for `socket.io-client`, `useSocket`, `createSocketSignaling`, and custom WebSocket signaling APIs, then remove or isolate code that is not needed by the MediaMTX receive-only path.
- [x] 3.3 If Socket.io is no longer imported anywhere, remove the unused Socket.io wrapper files/exports and the `socket.io-client` dependency from package metadata.
- [x] 3.4 Update package/module exports so application code imports MediaMTX receiver APIs from clearly named MediaMTX modules.

## 4. Documentation

- [x] 4.1 Rewrite `README.md` with project purpose, prerequisites, `.env` setup, MediaMTX stream path assumptions, local development commands, and manual test steps.
- [x] 4.2 Add a README flow diagram showing RTSP source → MediaMTX at `198.18.0.1` → WebRTC HTTP/WHEP negotiation → browser `RTCPeerConnection` → Vue video element.
- [x] 4.3 Document troubleshooting for MediaMTX endpoint path differences, mixed HTTP/HTTPS content, autoplay restrictions, ICE/NAT failures, and stream path mismatches.

## 5. Verification

- [x] 5.1 Run the project build or type check available in package scripts and fix any TypeScript/Vite errors.
- [x] 5.2 Verify the demo can be configured with `.env` copied from `.env.example`; if live MediaMTX is unavailable, document the skipped live playback verification and expected manual test command/steps.
- [x] 5.3 Confirm no stale imports or unused dependencies remain after the socket cleanup decision.
