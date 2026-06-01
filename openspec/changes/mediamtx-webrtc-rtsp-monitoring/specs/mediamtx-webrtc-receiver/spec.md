## ADDED Requirements

### Requirement: Configurable MediaMTX WebRTC endpoint
The system SHALL read MediaMTX WebRTC receiver settings from Vite environment variables and SHALL allow runtime callers to override the stream path or endpoint URL for testing individual cameras.

#### Scenario: Default endpoint from environment
- **WHEN** the receiver starts without an explicit endpoint URL
- **THEN** it SHALL build the MediaMTX WebRTC endpoint from the configured protocol, host, port, path template, and default stream path

#### Scenario: Stream path override
- **WHEN** the caller provides a stream path
- **THEN** the receiver SHALL use that stream path instead of the default path from environment variables

#### Scenario: Full endpoint override
- **WHEN** the caller provides a full endpoint URL
- **THEN** the receiver SHALL use that URL without applying the host, port, or path template settings

### Requirement: Single-stream MediaMTX receiver composable
The system SHALL provide a Vue composable under `src/composables/` that attaches a MediaMTX WebRTC receiver to an `HTMLVideoElement` and exposes reactive connection state, current media stream, and error information.

#### Scenario: Attach video and start playback
- **WHEN** a caller invokes `attach(videoElement)` for a configured stream
- **THEN** the composable SHALL create a WebRTC peer connection, negotiate with MediaMTX, assign the remote media stream to the video element, and update the status to connected after media is received

#### Scenario: Detach receiver
- **WHEN** a caller invokes `detach()` or the owning Vue component unmounts
- **THEN** the composable SHALL close the peer connection, stop local resource timers or requests, clear the video element source, clear the current stream, and update the status to closed or idle

#### Scenario: Restart receiver
- **WHEN** a caller invokes `restart()` after a failure or disconnect
- **THEN** the composable SHALL release the current connection and start a fresh MediaMTX WebRTC negotiation using the same stream configuration

### Requirement: MediaMTX WebRTC negotiation
The system SHALL implement MediaMTX-compatible WebRTC read negotiation using browser WebRTC APIs and the configured HTTP/WHEP endpoint, without requiring a project-owned WebSocket signaling server for the receive-only path.

#### Scenario: Successful negotiation
- **WHEN** the browser creates a local WebRTC offer for a receive-only stream and MediaMTX returns a valid SDP answer
- **THEN** the receiver SHALL set the local and remote descriptions and wait for remote media tracks

#### Scenario: Negotiation timeout or HTTP error
- **WHEN** the MediaMTX endpoint does not respond before the configured timeout or returns an error response
- **THEN** the receiver SHALL set status to failed and expose an Error containing actionable context for debugging

#### Scenario: WebSocket signaling not required
- **WHEN** the application uses the MediaMTX receiver composable
- **THEN** it SHALL NOT require `socket.io-client`, `useSocket`, or custom WebSocket signaling code to complete playback

### Requirement: Multi-stream testing support
The system SHALL make it straightforward to test one or more MediaMTX stream paths from the client application.

#### Scenario: Single default stream test
- **WHEN** the developer starts the Vite app with `.env` copied from `.env.example`
- **THEN** the app SHALL provide a documented way to play the default MediaMTX stream from `198.18.0.1`

#### Scenario: Multiple stream paths
- **WHEN** the caller supplies multiple stream path configurations
- **THEN** the receiver utilities SHALL support independently attaching each path to its own video element and reporting per-stream status

### Requirement: Documentation and flow diagram
The system SHALL document the MediaMTX WebRTC receiver setup, configuration, runtime flow, and troubleshooting in `README.md`.

#### Scenario: Developer follows README setup
- **WHEN** a developer reads the README from a fresh checkout
- **THEN** they SHALL be able to configure `.env`, start the Vite client, identify the expected MediaMTX stream path, and understand how RTSP reaches the browser through MediaMTX WebRTC

#### Scenario: Flow diagram explains data path
- **WHEN** a developer views the README flow diagram
- **THEN** it SHALL show the RTSP source, MediaMTX server at `198.18.0.1`, WebRTC HTTP/WHEP negotiation, RTP media transport, and Vue WebRTC client receiver responsibilities

### Requirement: Functional package naming and redundant code cleanup
The system SHALL organize receiver code by feature names and SHALL remove or isolate redundant WebSocket signaling code that is not required by the MediaMTX receive-only playback path.

#### Scenario: Import receiver APIs
- **WHEN** application code imports MediaMTX receiver utilities
- **THEN** it SHALL import them from clearly named MediaMTX receiver modules or an index export rather than from socket-oriented WebRTC signaling modules

#### Scenario: Remove unused socket dependency
- **WHEN** no remaining source file imports the Socket.io wrapper after the MediaMTX migration
- **THEN** the project SHALL remove unused Socket.io wrapper code and dependency entries from package metadata
