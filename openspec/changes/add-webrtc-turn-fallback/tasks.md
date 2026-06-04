## 1. Configuration Parsing

- [x] 1.1 Add TURN mode typing/configuration fields for `off`, `fallback`, and `include` while preserving existing STUN defaults.
- [x] 1.2 Parse `VITE_WEBRTC_TURN_URLS`, `VITE_WEBRTC_TURN_USERNAME`, and `VITE_WEBRTC_TURN_CREDENTIAL` into optional TURN `RTCIceServer` entries.
- [x] 1.3 Expose STUN-only and STUN-plus-TURN ICE server lists from MediaMTX config so the receiver can choose per attempt.

## 2. Receiver Connection Strategy

- [x] 2.1 Refactor `MediaMtxWhepReceiver.start()` so a single connection attempt can be run with an explicit `RTCConfiguration`.
- [x] 2.2 Implement `include` mode so the first environment-derived connection attempt includes configured TURN servers.
- [x] 2.3 Implement `fallback` mode so the receiver retries once with TURN after an initial STUN/default attempt fails before connecting.
- [x] 2.4 Preserve caller-provided `rtcConfig` behavior so environment TURN mode and fallback retries are bypassed when `rtcConfig` is supplied.

## 3. Documentation and Examples

- [x] 3.1 Update `.env.example` with `VITE_WEBRTC_TURN_MODE`, `VITE_WEBRTC_TURN_URLS`, `VITE_WEBRTC_TURN_USERNAME`, and `VITE_WEBRTC_TURN_CREDENTIAL` examples.
- [x] 3.2 Update README configuration table and ICE/TURN section with mode behavior and TURN relay cost notes.

## 4. Verification

- [x] 4.1 Verify default configuration still creates STUN-only ICE servers and does not include TURN.
- [x] 4.2 Verify `include` mode builds an initial STUN-plus-TURN connection configuration when TURN URLs are present.
- [x] 4.3 Verify `fallback` mode attempts STUN/default first and retries once with TURN after failure.
- [x] 4.4 Run the project typecheck/build or available tests to catch TypeScript and documentation regressions.
