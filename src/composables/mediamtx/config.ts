import type { MediaMtxEndpointOptions, MediaMtxEnvConfig } from "./types";

const DEFAULT_CONFIG: MediaMtxEnvConfig = {
  protocol: "http",
  host: "198.18.0.1",
  port: "8889",
  defaultPath: "camera1",
  streamPaths: ["camera1", "camera2"],
  whepPathTemplate: "/{path}/whep",
  requestTimeoutMs: 10_000,
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function getEnv(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseProtocol(value: string | undefined): "http" | "https" {
  return value === "https" ? "https" : "http";
}

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTimeout(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONFIG.requestTimeoutMs;
}

function parseIceServers(value: string | undefined): RTCIceServer[] {
  const urls = parseList(value);
  return urls.length > 0 ? [{ urls }] : DEFAULT_CONFIG.iceServers;
}

export function getMediaMtxConfig(overrides: Partial<MediaMtxEnvConfig> = {}): MediaMtxEnvConfig {
  const defaultPath = getEnv("VITE_MEDIAMTX_DEFAULT_PATH") ?? DEFAULT_CONFIG.defaultPath;
  const streamPaths = parseList(getEnv("VITE_MEDIAMTX_STREAM_PATHS"));

  return {
    protocol: parseProtocol(getEnv("VITE_MEDIAMTX_PROTOCOL")),
    host: getEnv("VITE_MEDIAMTX_HOST") ?? DEFAULT_CONFIG.host,
    port: getEnv("VITE_MEDIAMTX_WEBRTC_PORT") ?? DEFAULT_CONFIG.port,
    defaultPath,
    streamPaths: streamPaths.length > 0 ? streamPaths : [defaultPath],
    whepPathTemplate: getEnv("VITE_MEDIAMTX_WHEP_PATH_TEMPLATE") ?? DEFAULT_CONFIG.whepPathTemplate,
    requestTimeoutMs: parseTimeout(getEnv("VITE_MEDIAMTX_REQUEST_TIMEOUT_MS")),
    iceServers: parseIceServers(getEnv("VITE_WEBRTC_STUN_URLS")),
    ...overrides,
  };
}

export function buildMediaMtxWhepUrl(options: MediaMtxEndpointOptions = {}): string {
  if (options.endpointUrl) return options.endpointUrl;

  const config = getMediaMtxConfig(options.config);
  const path = encodeURIComponent(options.path ?? config.defaultPath);
  const template = config.whepPathTemplate.startsWith("/")
    ? config.whepPathTemplate
    : `/${config.whepPathTemplate}`;
  const endpointPath = template.replace("{path}", path);
  const port = config.port ? `:${config.port}` : "";

  return `${config.protocol}://${config.host}${port}${endpointPath}`;
}

export function getDefaultMediaMtxStreams(): string[] {
  return getMediaMtxConfig().streamPaths;
}
