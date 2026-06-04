/**
 * MediaMTX QUIC/MoQ 配置管理模块
 *
 * 服务端 MoQ 配置示例：
 * - moqHTTPS2Address: :8892  承载网页、fingerprint 等 HTTPS2 接口
 * - moqHTTPS3Address: :8892  承载 WebTransport /{path}/moq 接口(UDP)
 *
 * @module mediamtx/quic/config
 */

import {
  buildMediaMtxHttpUrl,
  buildPathFromTemplate,
  getFirstEnv,
  parseList,
  parseProtocol,
  parseTimeout,
} from "../config";
import type { MediaMtxQuicEndpointOptions, MediaMtxQuicEnvConfig } from "./types";

const DEFAULT_CONFIG: MediaMtxQuicEnvConfig = {
  protocol: "https",
  host: "198.18.0.1",
  https2Port: "8892",
  https3Port: "8892",
  defaultPath: "camera1",
  streamPaths: ["camera1", "camera2"],
  requestTimeoutMs: 10_000,
  enableAudio: false,
  maxVideoFps: 15,
  maxRenderWidth: 960,
  maxRenderHeight: 540,
  maxVideoDecodeQueueSize: 2,
  debug: false,
  readPathTemplate: "/{path}/",
  moqPathTemplate: "/{path}/moq",
  fingerprintPathTemplate: "/{path}/fingerprint",
};

/**
 * 解析 QUIC/MoQ 协议
 *
 * QUIC/MoQ 的 WebTransport 要求安全上下文，因此协议强制为 `https`。
 * 即使环境变量配置了 `http`，也会回退为 `https`。
 *
 * @param value - 环境变量中的协议值
 * @returns 始终返回 `"https"`
 */
function parseQuicProtocol(value: string | undefined): "https" {
  return parseProtocol(value, DEFAULT_CONFIG.protocol) === "https" ? "https" : "https";
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return fallback;
}

function parseNonNegativeNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * 获取 MediaMTX QUIC/MoQ 配置
 *
 * 按优先级读取环境变量：
 * - QUIC 专有变量（如 `VITE_MEDIAMTX_QUIC_HOST`）优先
 * - 回退到公共变量（如 `VITE_MEDIAMTX_HOST`）
 * - 最终使用内置默认值
 *
 * @param overrides - 手动覆盖的配置项，优先级最高
 * @returns 合并后的完整 QUIC/MoQ 配置
 */
export function getMediaMtxQuicConfig(overrides: Partial<MediaMtxQuicEnvConfig> = {}): MediaMtxQuicEnvConfig {
  const defaultPath = getFirstEnv("VITE_MEDIAMTX_DEFAULT_PATH", "VITE_MEDIAMTX_QUIC_DEFAULT_PATH")
    ?? DEFAULT_CONFIG.defaultPath;
  const streamPaths = parseList(getFirstEnv("VITE_MEDIAMTX_QUIC_STREAM_PATHS", "VITE_MEDIAMTX_STREAM_PATHS"));

  return {
    protocol: parseQuicProtocol(getFirstEnv("VITE_MEDIAMTX_QUIC_PROTOCOL", "VITE_MEDIAMTX_PROTOCOL")),
    host: getFirstEnv("VITE_MEDIAMTX_QUIC_HOST", "VITE_MEDIAMTX_HOST") ?? DEFAULT_CONFIG.host,
    https2Port: getFirstEnv("VITE_MEDIAMTX_QUIC_HTTPS2_PORT", "VITE_MEDIAMTX_MOQ_HTTPS2_PORT")
      ?? DEFAULT_CONFIG.https2Port,
    https3Port: getFirstEnv("VITE_MEDIAMTX_QUIC_HTTPS3_PORT", "VITE_MEDIAMTX_MOQ_HTTPS3_PORT")
      ?? DEFAULT_CONFIG.https3Port,
    defaultPath,
    streamPaths: streamPaths.length > 0 ? streamPaths : [defaultPath],
    requestTimeoutMs: parseTimeout(
      getFirstEnv("VITE_MEDIAMTX_QUIC_REQUEST_TIMEOUT_MS", "VITE_MEDIAMTX_REQUEST_TIMEOUT_MS"),
      DEFAULT_CONFIG.requestTimeoutMs
    ),
    enableAudio: parseBoolean(getFirstEnv("VITE_MEDIAMTX_QUIC_ENABLE_AUDIO"), DEFAULT_CONFIG.enableAudio),
    maxVideoFps: parseNonNegativeNumber(getFirstEnv("VITE_MEDIAMTX_QUIC_MAX_VIDEO_FPS"), DEFAULT_CONFIG.maxVideoFps),
    maxRenderWidth: parseNonNegativeNumber(
      getFirstEnv("VITE_MEDIAMTX_QUIC_MAX_RENDER_WIDTH"),
      DEFAULT_CONFIG.maxRenderWidth
    ),
    maxRenderHeight: parseNonNegativeNumber(
      getFirstEnv("VITE_MEDIAMTX_QUIC_MAX_RENDER_HEIGHT"),
      DEFAULT_CONFIG.maxRenderHeight
    ),
    maxVideoDecodeQueueSize: parseTimeout(
      getFirstEnv("VITE_MEDIAMTX_QUIC_MAX_VIDEO_DECODE_QUEUE_SIZE"),
      DEFAULT_CONFIG.maxVideoDecodeQueueSize
    ),
    debug: parseBoolean(getFirstEnv("VITE_MEDIAMTX_QUIC_DEBUG"), DEFAULT_CONFIG.debug),
    readPathTemplate: getFirstEnv("VITE_MEDIAMTX_QUIC_READ_PATH_TEMPLATE") ?? DEFAULT_CONFIG.readPathTemplate,
    moqPathTemplate: getFirstEnv("VITE_MEDIAMTX_QUIC_MOQ_PATH_TEMPLATE") ?? DEFAULT_CONFIG.moqPathTemplate,
    fingerprintPathTemplate: getFirstEnv("VITE_MEDIAMTX_QUIC_FINGERPRINT_PATH_TEMPLATE")
      ?? DEFAULT_CONFIG.fingerprintPathTemplate,
    ...overrides,
  };
}

/**
 * 构建 MediaMTX MoQ WebTransport URL
 *
 * URL 优先级：`moqUrl` > `endpointUrl` > 模板构建。
 * 模板构建使用 `moqPathTemplate`（默认 `/{path}/moq`）和 HTTPS3 端口。
 *
 * @param options - 端点选项，可指定完整 URL 或路径
 * @returns 完整的 MoQ WebTransport URL
 */
export function buildMediaMtxQuicMoqUrl(options: MediaMtxQuicEndpointOptions = {}): string {
  if (options.moqUrl) return options.moqUrl;
  if (options.endpointUrl) return options.endpointUrl;

  const config = getMediaMtxQuicConfig(options.config);
  const endpointPath = buildPathFromTemplate(config.moqPathTemplate, options.path ?? config.defaultPath);

  return buildMediaMtxHttpUrl({
    protocol: config.protocol,
    host: config.host,
    port: config.https3Port,
    path: endpointPath,
  });
}

/**
 * 构建 MediaMTX MoQ 证书 fingerprint URL
 *
 * 优先级：`fingerprintUrl` > 模板构建。
 * 模板构建使用 `fingerprintPathTemplate`（默认 `/{path}/fingerprint`）和 HTTPS2 端口。
 * 浏览器通过此 URL 获取服务端自签证书的 SHA-256 fingerprint，
 * 用于 WebTransport 连接的安全验证。
 *
 * @param options - 端点选项，可指定完整 URL 或路径
 * @returns 完整的 fingerprint URL
 */
export function buildMediaMtxQuicFingerprintUrl(options: MediaMtxQuicEndpointOptions = {}): string {
  if (options.fingerprintUrl) return options.fingerprintUrl;

  const config = getMediaMtxQuicConfig(options.config);
  const endpointPath = buildPathFromTemplate(config.fingerprintPathTemplate, options.path ?? config.defaultPath);

  return buildMediaMtxHttpUrl({
    protocol: config.protocol,
    host: config.host,
    port: config.https2Port,
    path: endpointPath,
  });
}

/**
 * 构建 MediaMTX MoQ 浏览器读流页面 URL
 *
 * 使用 `readPathTemplate`（默认 `/{path}/`）和 HTTPS2 端口。
 * MediaMTX 自带的 MoQ 读流页面可用于独立测试。
 *
 * @param options - 端点选项，可指定路径
 * @returns 完整的读流页面 URL
 */
export function buildMediaMtxQuicReadUrl(options: MediaMtxQuicEndpointOptions = {}): string {
  const config = getMediaMtxQuicConfig(options.config);
  const endpointPath = buildPathFromTemplate(config.readPathTemplate, options.path ?? config.defaultPath);

  return buildMediaMtxHttpUrl({
    protocol: config.protocol,
    host: config.host,
    port: config.https2Port,
    path: endpointPath,
  });
}

/**
 * 获取默认的 MediaMTX QUIC/MoQ 流路径列表
 *
 * 读取 `VITE_MEDIAMTX_QUIC_STREAM_PATHS`，回退到 `VITE_MEDIAMTX_STREAM_PATHS`，
 * 最终回退到 `[defaultPath]`。
 *
 * @returns 流路径字符串数组
 */
export function getDefaultMediaMtxQuicStreams(): string[] {
  return getMediaMtxQuicConfig().streamPaths;
}
