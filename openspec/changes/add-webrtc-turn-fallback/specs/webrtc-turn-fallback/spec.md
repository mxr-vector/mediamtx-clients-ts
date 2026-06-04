## ADDED Requirements

### Requirement: Configure TURN servers from environment
The system SHALL allow MediaMTX WebRTC receivers to configure TURN server URLs and optional TURN credentials through Vite environment variables while preserving the existing STUN URL configuration.

#### Scenario: TURN server with credentials is configured
- **WHEN** `VITE_WEBRTC_TURN_URLS`, `VITE_WEBRTC_TURN_USERNAME`, and `VITE_WEBRTC_TURN_CREDENTIAL` are configured
- **THEN** the parsed TURN ICE server includes the configured URLs, username, and credential

#### Scenario: TURN server without credentials is configured
- **WHEN** `VITE_WEBRTC_TURN_URLS` is configured without username or credential values
- **THEN** the parsed TURN ICE server includes the configured URLs without rejecting the configuration

#### Scenario: No TURN server is configured
- **WHEN** `VITE_WEBRTC_TURN_URLS` is empty or unset
- **THEN** the receiver does not add a TURN ICE server from environment configuration

### Requirement: Support explicit TURN usage modes
The system SHALL support `off`, `fallback`, and `include` TURN usage modes for environment-configured TURN servers.

#### Scenario: TURN mode is off
- **WHEN** `VITE_WEBRTC_TURN_MODE` is `off` or unset
- **THEN** the receiver uses STUN/default ICE servers without adding environment TURN servers

#### Scenario: TURN mode is include
- **WHEN** `VITE_WEBRTC_TURN_MODE` is `include` and TURN URLs are configured
- **THEN** the first WebRTC connection attempt includes both STUN/default ICE servers and TURN ICE servers

#### Scenario: TURN mode is fallback
- **WHEN** `VITE_WEBRTC_TURN_MODE` is `fallback` and TURN URLs are configured
- **THEN** the first WebRTC connection attempt uses STUN/default ICE servers without TURN ICE servers

#### Scenario: TURN mode is invalid
- **WHEN** `VITE_WEBRTC_TURN_MODE` contains an unsupported value
- **THEN** the receiver treats the mode as `off`

### Requirement: Retry with TURN after STUN-only failure
The system SHALL retry a MediaMTX WebRTC receiver connection once with TURN servers when TURN mode is `fallback`, TURN URLs are configured, no caller `rtcConfig` override is provided, and the initial STUN/default attempt fails before successful connection.

#### Scenario: STUN-only attempt succeeds in fallback mode
- **WHEN** TURN mode is `fallback` and the first STUN/default connection attempt reaches `connected`
- **THEN** the receiver does not retry with TURN servers

#### Scenario: STUN-only attempt fails in fallback mode
- **WHEN** TURN mode is `fallback` and the first STUN/default connection attempt fails before reaching `connected`
- **THEN** the receiver stops the failed attempt and retries once with STUN/default ICE servers plus TURN ICE servers

#### Scenario: TURN retry also fails
- **WHEN** the fallback TURN retry fails
- **THEN** the receiver reports the connection failure through the existing failed status and error callback behavior

### Requirement: Preserve manual rtcConfig override behavior
The system SHALL use a caller-provided `rtcConfig` exactly as the WebRTC receiver configuration and SHALL NOT merge environment TURN servers or perform environment TURN fallback retries for that receiver.

#### Scenario: Caller provides rtcConfig
- **WHEN** `useMediaMtxReceiver` or `useMediaMtxReceivers` passes a `rtcConfig` option
- **THEN** the receiver creates `RTCPeerConnection` with that configuration instead of environment-derived STUN or TURN configuration

#### Scenario: Caller rtcConfig connection fails
- **WHEN** a receiver using caller-provided `rtcConfig` fails to connect
- **THEN** the receiver reports the failure without retrying with environment TURN servers

### Requirement: Document TURN cost-aware configuration
The system SHALL document TURN environment variables, TURN usage modes, and the media relay cost implications of TURN.

#### Scenario: Developer reads environment example
- **WHEN** a developer opens `.env.example`
- **THEN** the file shows STUN configuration, optional TURN mode, TURN URLs, username, and credential variables

#### Scenario: Developer reads README configuration docs
- **WHEN** a developer reads the README ICE/TURN configuration section
- **THEN** the documentation explains that TURN can relay media traffic and that `off`, `fallback`, and `include` have different cost and connectivity trade-offs
