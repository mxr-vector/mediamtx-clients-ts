export type MediaMtxReceiverStatus =
  | "idle"
  | "preparing"
  | "signaling"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export interface MediaMtxEnvConfig {
  protocol: "http" | "https";
  host: string;
  port: string;
  defaultPath: string;
  streamPaths: string[];
  whepPathTemplate: string;
  requestTimeoutMs: number;
  iceServers: RTCIceServer[];
}

export interface MediaMtxEndpointOptions {
  path?: string;
  endpointUrl?: string;
  config?: Partial<MediaMtxEnvConfig>;
}

export interface MediaMtxReceiverOptions extends MediaMtxEndpointOptions {
  rtcConfig?: RTCConfiguration;
  autoplay?: boolean;
  muted?: boolean;
  onStatusChange?: (status: MediaMtxReceiverStatus) => void;
  onConnected?: (stream: MediaStream) => void;
  onDisconnected?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export interface MediaMtxStreamConfig extends MediaMtxReceiverOptions {
  id?: string;
  label?: string;
}

export interface MediaMtxReceiverEntry {
  id: string;
  label: string;
  path: string;
  status: MediaMtxReceiverStatus;
  stream: MediaStream | null;
  error: Error | null;
}
