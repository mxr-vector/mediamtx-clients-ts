## Context

The MediaMTX WebRTC receiver currently reads ICE configuration from `VITE_WEBRTC_STUN_URLS` and converts the configured URLs into a single `RTCIceServer` entry. This supports STUN-only deployments but cannot express typical TURN credentials through environment variables.

TURN is useful for restrictive NAT or firewall environments, but it can relay media traffic when selected by ICE. In a multi-stream monitoring page, relay traffic can multiply quickly across camera streams. The design therefore treats TURN as a configurable cost-aware strategy instead of simply appending TURN servers to every connection by default.

Current receiver behavior creates a new `RTCPeerConnection` per `start()` call, gathers ICE candidates, posts the SDP offer to MediaMTX WHEP, then sets the returned SDP answer. This one-shot WHEP exchange makes TURN fallback easiest to model as a second connection attempt with a new peer connection rather than mutating ICE servers on an existing peer connection.

## Goals / Non-Goals

**Goals:**

- Support TURN URLs and optional credentials from Vite environment variables.
- Preserve the existing STUN-only default to avoid unexpected TURN relay cost.
- Provide explicit TURN modes:
  - `off`: never use environment TURN configuration.
  - `fallback`: first attempt without TURN, retry with TURN after connection failure.
  - `include`: include TURN in the first connection attempt.
- Keep caller-provided `rtcConfig` as the highest-priority escape hatch.
- Document the bandwidth/cost implication of TURN and when to choose each mode.

**Non-Goals:**

- Provisioning or managing a TURN server.
- Implementing dynamic TURN credential issuance.
- Adding runtime UI controls for TURN mode selection.
- Forcing all media through TURN with `iceTransportPolicy: "relay"`.
- Replacing the existing WHEP signaling flow.

## Decisions

### 1. Add TURN-specific environment variables

Use dedicated variables alongside the existing STUN setting:

- `VITE_WEBRTC_TURN_MODE=off|fallback|include`
- `VITE_WEBRTC_TURN_URLS=turn:example.com:3478,turns:example.com:5349`
- `VITE_WEBRTC_TURN_USERNAME=<optional username>`
- `VITE_WEBRTC_TURN_CREDENTIAL=<optional credential>`

Rationale: this keeps `.env` files readable and avoids fragile JSON escaping. It also preserves the current `VITE_WEBRTC_STUN_URLS` variable for compatibility.

Alternatives considered:

- A single `VITE_WEBRTC_ICE_SERVERS_JSON` variable: more flexible but harder to edit correctly in `.env` files.
- Renaming `VITE_WEBRTC_STUN_URLS` to a generic ICE variable: more semantically precise but creates unnecessary migration churn.

### 2. Keep STUN-only as the default

If no TURN mode is configured, or if mode is invalid, the system should behave as `off`. The default `iceServers` remains the current STUN configuration.

Rationale: the common local/LAN test path should not allocate TURN resources or unexpectedly relay camera traffic.

Alternatives considered:

- Defaulting to `fallback`: improves connectivity but may surprise operators who have configured TURN credentials and expect explicit cost control.
- Defaulting to `include`: maximizes connectivity but creates the most TURN server load.

### 3. Represent ICE server sets in config

The config layer should expose enough information for the client to choose between a no-TURN attempt and a with-TURN attempt. A practical shape is:

- `iceServers`: the default server list for the current mode.
- `stunIceServers`: STUN/default servers without TURN.
- `turnIceServers`: configured TURN server entries.
- `turnMode`: parsed mode.

The exact names can be adjusted during implementation, but the important contract is that the client can build one `RTCConfiguration` for STUN-only and another for STUN+TURN.

Rationale: fallback behavior is a connection strategy, not just a static list of ICE servers.

Alternatives considered:

- Only returning a single `iceServers` array: insufficient to express “first try without TURN, then retry with TURN”.
- Encoding mode only in the client: would duplicate environment parsing outside the config module.

### 4. Implement fallback as a second full connection attempt

For `fallback` mode, if no caller `rtcConfig` is provided and TURN URLs exist, the receiver should:

1. Start with STUN/default ICE servers only.
2. If the attempt fails before connection succeeds, stop and clean up that peer connection.
3. Retry once with STUN/default ICE servers plus TURN servers.
4. Surface failure normally if the TURN attempt also fails.

Rationale: the current WHEP flow sends a complete SDP offer after ICE gathering. Rebuilding the peer connection keeps signaling behavior simple and avoids relying on ICE restart behavior that may not map cleanly to this WHEP exchange.

Alternatives considered:

- Calling `restartIce()` on the same peer connection: not a good fit because TURN servers must be present in the peer connection configuration before gathering relay candidates, and the WHEP endpoint expects a coherent offer/answer exchange.
- Always including TURN but relying on ICE priority to avoid relay: media may not relay if a direct pair wins, but TURN allocations and keepalives can still consume TURN resources.

### 5. Caller `rtcConfig` bypasses environment TURN mode

If a caller supplies `rtcConfig`, the receiver should use it directly and should not add or retry with environment TURN configuration.

Rationale: `rtcConfig` is the existing expert override and may include custom ICE policies, TURN credentials, or test behavior. Mutating it would be surprising.

Alternatives considered:

- Merging environment TURN into caller `rtcConfig`: could accidentally change explicit caller behavior and force unwanted relay candidates.

## Risks / Trade-offs

- [Fallback adds latency after initial failure] → The first failed STUN-only attempt must complete or fail before TURN retry begins; document `include` for environments where faster first-connect success matters more than TURN allocation cost.
- [Failure detection timing can be browser-dependent] → Trigger fallback from existing start-time errors and ICE/peer failure paths; keep retry count to one to avoid loops.
- [TURN credentials in Vite env are client-visible] → Document that static Vite TURN credentials are suitable only when acceptable for the deployment; dynamic credential issuance is out of scope.
- [TURN URL without credentials may be misconfigured] → Allow optional credentials because anonymous TURN can exist, but document typical TURN servers require username and credential.
- [Multi-stream fallback can create multiple TURN relays] → Keep default mode `off` and document cost implications for video wall deployments.

## Migration Plan

1. Add TURN mode and credential examples to `.env.example` with empty defaults.
2. Extend config parsing while preserving existing `VITE_WEBRTC_STUN_URLS` behavior.
3. Add receiver fallback retry behavior guarded by mode, configured TURN URLs, and absence of caller `rtcConfig`.
4. Update README configuration table and ICE/TURN section.
5. Verify default STUN-only behavior remains unchanged and fallback/include modes construct expected `RTCPeerConnection` configurations.

Rollback is straightforward: set `VITE_WEBRTC_TURN_MODE=off` or remove TURN environment variables to restore STUN-only behavior.

## Open Questions

- Should the UI eventually expose whether the active connection selected a relay candidate? This is useful for cost visibility but is not required for this change.
