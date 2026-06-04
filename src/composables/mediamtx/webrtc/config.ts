/**
 * MediaMTX WebRTC 配置管理模块
 *
 * @module mediamtx/webrtc/config
 */

import {
  buildMediaMtxHttpUrl,
  buildPathFromTemplate,
  getEnv,
  parseList,
  parseProtocol,
  parseTimeout,
} from "../config";
import type { MediaMtxEndpointOptions, MediaMtxEnvConfig, MediaMtxTurnMode } from "./types";

/** 默认 STUN ICE 服务器配置 */
const DEFAULT_STUN_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/** WebRTC 模块内置默认配置 */
const DEFAULT_CONFIG: MediaMtxEnvConfig = {
  protocol: "http",
  host: "198.18.0.1",
  port: "8889",
  defaultPath: "camera1",
  streamPaths: ["camera1", "camera2"],
  whepPathTemplate: "/{path}/whep",
  requestTimeoutMs: 10_000,
  turnMode: "off",
  stunIceServers: DEFAULT_STUN_ICE_SERVERS,
  turnIceServers: [],
  iceServers: DEFAULT_STUN_ICE_SERVERS,
};

/**
 * 解析 TURN 使用模式
 *
 * 支持三种模式：`off`（默认）、`fallback`（失败后重试）、`include`（首次即包含）。
 * 无效值回退为 `off`。
 */
function parseTurnMode(value: string | undefined): MediaMtxTurnMode {
  return value === "fallback" || value === "include" ? value : "off";
}

/**
 * 解析 STUN ICE 服务器配置
 *
 * 从逗号分隔的 URL 列表中解析 STUN 服务器。
 * 为空时回退到内置默认 STUN 配置。
 */
function parseStunIceServers(value: string | undefined): RTCIceServer[] {
  const urls = parseList(value);
  return urls.length > 0 ? [{ urls }] : DEFAULT_STUN_ICE_SERVERS;
}

/**
 * 解析 TURN ICE 服务器配置
 *
 * 从环境变量中解析 TURN URL、用户名和凭证。
 * URL 为空时返回空数组（不启用 TURN）。
 */
function parseTurnIceServers(
  urlsValue: string | undefined,
  username: string | undefined,
  credential: string | undefined
): RTCIceServer[] {
  const urls = parseList(urlsValue);
  if (urls.length === 0) return [];

  const server: RTCIceServer = { urls };
  if (username && credential) {
    server.username = username;
    server.credential = credential;
  }

  return [server];
}

/**
 * 构建合并后的 ICE 服务器列表
 *
 * 当 TURN 模式为 `include` 且有 TURN 服务器时，将 STUN 和 TURN 合并；
 * 否则仅返回 STUN 服务器（`fallback` 模式的 TURN 合并在 client.ts 中处理）。
 */
function buildIceServers(
  turnMode: MediaMtxTurnMode,
  stunIceServers: RTCIceServer[],
  turnIceServers: RTCIceServer[]
): RTCIceServer[] {
  return turnMode === "include" && turnIceServers.length > 0
    ? [...stunIceServers, ...turnIceServers]
    : stunIceServers;
}

/**
 * 获取 MediaMTX WebRTC 配置
 *
 * 按优先级读取环境变量，缺失时使用内置默认值。
 * `overrides` 参数优先级最高，可用于编程式覆盖。
 *
 * @param overrides - 手动覆盖的配置项
 * @returns 合并后的完整 WebRTC 配置
 */
export function getMediaMtxConfig(overrides: Partial<MediaMtxEnvConfig> = {}): MediaMtxEnvConfig {
  const defaultPath = getEnv("VITE_MEDIAMTX_DEFAULT_PATH") ?? DEFAULT_CONFIG.defaultPath;
  const streamPaths = parseList(getEnv("VITE_MEDIAMTX_STREAM_PATHS"));
  const turnMode = parseTurnMode(getEnv("VITE_WEBRTC_TURN_MODE"));
  const stunIceServers = parseStunIceServers(getEnv("VITE_WEBRTC_STUN_URLS"));
  const turnIceServers = parseTurnIceServers(
    getEnv("VITE_WEBRTC_TURN_URLS"),
    getEnv("VITE_WEBRTC_TURN_USERNAME"),
    getEnv("VITE_WEBRTC_TURN_CREDENTIAL")
  );

  return {
    protocol: parseProtocol(getEnv("VITE_MEDIAMTX_PROTOCOL"), DEFAULT_CONFIG.protocol),
    host: getEnv("VITE_MEDIAMTX_HOST") ?? DEFAULT_CONFIG.host,
    port: getEnv("VITE_MEDIAMTX_WEBRTC_PORT") ?? DEFAULT_CONFIG.port,
    defaultPath,
    streamPaths: streamPaths.length > 0 ? streamPaths : [defaultPath],
    whepPathTemplate: getEnv("VITE_MEDIAMTX_WHEP_PATH_TEMPLATE") ?? DEFAULT_CONFIG.whepPathTemplate,
    requestTimeoutMs: parseTimeout(getEnv("VITE_MEDIAMTX_REQUEST_TIMEOUT_MS"), DEFAULT_CONFIG.requestTimeoutMs),
    turnMode,
    stunIceServers,
    turnIceServers,
    iceServers: buildIceServers(turnMode, stunIceServers, turnIceServers),
    ...overrides,
  };
}

/**
 * 构建 MediaMTX WHEP 端点 URL
 *
 * URL 优先级：`endpointUrl` > 模板构建。
 * 模板构建使用 `whepPathTemplate`（默认 `/{path}/whep`）和 WebRTC 端口。
 *
 * @param options - 端点选项，可指定完整 URL 或路径
 * @returns 完整的 WHEP 端点 URL
 */
export function buildMediaMtxWhepUrl(options: MediaMtxEndpointOptions = {}): string {
  if (options.endpointUrl) return options.endpointUrl;

  const config = getMediaMtxConfig(options.config);
  const endpointPath = buildPathFromTemplate(config.whepPathTemplate, options.path ?? config.defaultPath);

  return buildMediaMtxHttpUrl({
    protocol: config.protocol,
    host: config.host,
    port: config.port,
    path: endpointPath,
  });
}

/**
 * 获取默认的 MediaMTX WebRTC 流路径列表
 *
 * 读取 `VITE_MEDIAMTX_STREAM_PATHS` 环境变量，为空时回退到 `[defaultPath]`。
 *
 * @returns 流路径字符串数组
 */
export function getDefaultMediaMtxStreams(): string[] {
  return getMediaMtxConfig().streamPaths;
}
