/**
 * MediaMTX 配置管理模块
 * 
 * 本模块负责管理 MediaMTX WebRTC 接收器的配置参数。
 * 主要功能：
 * 1. 从环境变量读取配置
 * 2. 提供默认配置值
 * 3. 构建 WHEP 端点 URL
 * 4. 解析和验证配置参数
 * 
 * 环境变量配置(以 VITE_ 前缀开头)：
 * - VITE_MEDIAMTX_PROTOCOL: 通信协议(http/https)
 * - VITE_MEDIAMTX_HOST: 服务器地址
 * - VITE_MEDIAMTX_WEBRTC_PORT: WebRTC 端口
 * - VITE_MEDIAMTX_DEFAULT_PATH: 默认流路径
 * - VITE_MEDIAMTX_STREAM_PATHS: 流路径列表(逗号分隔)
 * - VITE_MEDIAMTX_WHEP_PATH_TEMPLATE: WHEP 路径模板
 * - VITE_MEDIAMTX_REQUEST_TIMEOUT_MS: 请求超时时间
 * - VITE_WEBRTC_STUN_URLS: STUN 服务器 URL
 * - VITE_WEBRTC_TURN_MODE: TURN 使用模式(off/fallback/include)
 * - VITE_WEBRTC_TURN_URLS: TURN 服务器 URL
 * - VITE_WEBRTC_TURN_USERNAME: TURN 用户名
 * - VITE_WEBRTC_TURN_CREDENTIAL: TURN 凭证
 * 
 * @module config
 */

import type { MediaMtxEndpointOptions, MediaMtxEnvConfig, MediaMtxTurnMode } from "./types";

/**
 * 默认配置
 * 
 * 当环境变量未设置时使用的默认值。
 * 这些值适用于本地开发环境。
 */
const DEFAULT_STUN_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

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
 * 获取环境变量值
 * 
 * 从 Vite 的 import.meta.env 中读取环境变量。
 * 返回 undefined 如果变量不存在或为空字符串。
 * 
 * @param name - 环境变量名
 * @returns 环境变量值或 undefined
 */
function getEnv(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * 解析协议类型
 * 
 * 将字符串转换为有效的协议类型。
 * 只接受 "https"，其他值默认为 "http"。
 * 
 * @param value - 协议字符串
 * @returns "http" 或 "https"
 */
function parseProtocol(value: string | undefined): "http" | "https" {
  return value === "https" ? "https" : "http";
}

/**
 * 解析逗号分隔的列表
 * 
 * 将逗号分隔的字符串转换为数组。
 * 自动去除空白项和空字符串。
 * 
 * @param value - 逗号分隔的字符串
 * @returns 字符串数组
 */
function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 解析超时时间
 * 
 * 将字符串转换为有效的超时时间(毫秒)。
 * 如果无效则返回默认值。
 * 
 * @param value - 超时时间字符串
 * @returns 超时时间(毫秒)
 */
function parseTimeout(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONFIG.requestTimeoutMs;
}

/**
 * 解析 TURN 使用模式
 *
 * 只接受 off、fallback、include，其它值按 off 处理。
 *
 * @param value - TURN 模式字符串
 * @returns TURN 使用模式
 */
function parseTurnMode(value: string | undefined): MediaMtxTurnMode {
  return value === "fallback" || value === "include" ? value : "off";
}

/**
 * 解析 STUN ICE 服务器配置
 *
 * 将 STUN 服务器 URL 字符串转换为 RTCIceServer 数组。
 * 如果未配置则使用默认的 Google STUN 服务器。
 *
 * @param value - STUN 服务器 URL 字符串(逗号分隔)
 * @returns RTCIceServer 数组
 */
function parseStunIceServers(value: string | undefined): RTCIceServer[] {
  const urls = parseList(value);
  return urls.length > 0 ? [{ urls }] : DEFAULT_CONFIG.stunIceServers;
}

/**
 * 解析 TURN ICE 服务器配置
 *
 * 将 TURN 服务器 URL 和可选凭证转换为 RTCIceServer 数组。
 * TURN 凭证是可选的，以兼容匿名 TURN 或特殊部署。
 *
 * @param urlsValue - TURN 服务器 URL 字符串(逗号分隔)
 * @param username - TURN 用户名
 * @param credential - TURN 凭证
 * @returns RTCIceServer 数组
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
 * 根据 TURN 模式组合默认 ICE 服务器配置
 *
 * off 和 fallback 的初始默认配置都保持 STUN-only；include 会在首次连接中加入 TURN。
 *
 * @param turnMode - TURN 使用模式
 * @param stunIceServers - STUN/default ICE 服务器
 * @param turnIceServers - TURN ICE 服务器
 * @returns 当前模式的默认 ICE 服务器数组
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
 * 获取 MediaMTX 配置
 * 
 * 合并默认配置、环境变量配置和自定义覆盖配置。
 * 优先级：自定义配置 > 环境变量 > 默认配置
 * 
 * @param overrides - 自定义配置覆盖
 * @returns 完整的 MediaMTX 配置对象
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
    protocol: parseProtocol(getEnv("VITE_MEDIAMTX_PROTOCOL")),
    host: getEnv("VITE_MEDIAMTX_HOST") ?? DEFAULT_CONFIG.host,
    port: getEnv("VITE_MEDIAMTX_WEBRTC_PORT") ?? DEFAULT_CONFIG.port,
    defaultPath,
    streamPaths: streamPaths.length > 0 ? streamPaths : [defaultPath],
    whepPathTemplate: getEnv("VITE_MEDIAMTX_WHEP_PATH_TEMPLATE") ?? DEFAULT_CONFIG.whepPathTemplate,
    requestTimeoutMs: parseTimeout(getEnv("VITE_MEDIAMTX_REQUEST_TIMEOUT_MS")),
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
 * 根据配置和选项构建完整的 WHEP 端点 URL。
 * WHEP (WebRTC-HTTP Egress Protocol) 是用于 WebRTC 媒体流传输的协议。
 * 
 * URL 构建规则：
 * 1. 如果提供了完整的 endpointUrl，直接使用
 * 2. 否则根据配置模板构建 URL
 * 3. 模板中的 {path} 会被实际路径替换
 * 
 * @param options - 端点选项
 * @returns 完整的 WHEP 端点 URL
 * 
 * @example
 * // 基本用法
 * buildMediaMtxWhepUrl({ path: "camera1" })
 * // 返回: "http://198.18.0.1:8889/camera1/whep"
 * 
 * // 使用完整 URL
 * buildMediaMtxWhepUrl({ endpointUrl: "https://example.com/whep" })
 * // 返回: "https://example.com/whep"
 */
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

/**
 * 获取默认的 MediaMTX 流路径列表
 * 
 * 便捷方法，直接返回当前配置中的流路径列表。
 * 
 * @returns 流路径字符串数组
 */
export function getDefaultMediaMtxStreams(): string[] {
  return getMediaMtxConfig().streamPaths;
}
