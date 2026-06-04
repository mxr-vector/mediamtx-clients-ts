## Why

Current WebRTC ICE configuration only supports STUN URLs from environment variables, so common TURN deployments that require credentials cannot be configured without per-call `rtcConfig` overrides. At the same time, enabling TURN for every connection can create unnecessary relay bandwidth cost for multi-stream monitoring, so TURN needs to be available as an explicit fallback strategy rather than an always-on default.

## What Changes

- Add environment-driven TURN configuration alongside the existing STUN configuration.
- Add a TURN usage mode with `off`, `fallback`, and `include` behavior:
  - `off`: use STUN/default ICE only and never add TURN from environment configuration.
  - `fallback`: first attempt STUN-only, then retry with TURN if the initial connection fails.
  - `include`: include TURN servers in the first WebRTC connection attempt.
- Keep the default behavior cost-conscious by using STUN-only unless TURN mode and TURN server details are configured.
- Preserve the existing `rtcConfig` override path for callers that need full manual `RTCPeerConnection` control.
- Update `.env.example` and README documentation to explain TURN cost implications and configuration examples.

## Capabilities

### New Capabilities
- `webrtc-turn-fallback`: Environment-configured TURN support for MediaMTX WebRTC receivers, including cost-aware TURN usage modes.

### Modified Capabilities

## Impact

- Affects MediaMTX WebRTC configuration parsing in `src/composables/mediamtx/config.ts`.
- Affects receiver connection behavior in `src/composables/mediamtx/client.ts` when TURN fallback mode is enabled.
- May require small type additions in `src/composables/mediamtx/types.ts`.
- Updates `.env.example` and README configuration documentation.
- No new runtime dependencies are expected.
