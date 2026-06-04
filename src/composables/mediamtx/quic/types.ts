/**
 * MediaMTX QUIC/MoQ 接收器类型定义
 *
 * MediaMTX v1.19.0 的 MoQ(Media over QUIC) 浏览器读流基于 HTTPS/HTTP3、
 * WebTransport 和 WebCodecs。
 *
 * @module mediamtx/quic/types
 */

import type {
  MediaMtxBaseEnvConfig,
  MediaMtxEndpointOptions as BaseMediaMtxEndpointOptions,
  MediaMtxReceiverEntry as BaseMediaMtxReceiverEntry,
  MediaMtxReceiverStatus,
} from "../types";

export type { MediaMtxReceiverStatus } from "../types";

/**
 * MediaMTX QUIC/MoQ 环境配置接口
 *
 * 扩展公共 {@link MediaMtxBaseEnvConfig}，增加 QUIC/MoQ 专有字段：
 * - 协议强制为 `https`（WebTransport 要求安全上下文）
 * - HTTPS2 端口承载 fingerprint、读流页面等 HTTP/2 接口
 * - HTTPS3 端口承载 WebTransport `/{path}/moq` 接口（基于 UDP）
 * - 三种路径模板分别对应读流页面、MoQ endpoint 和证书 fingerprint
 *
 * @interface MediaMtxQuicEnvConfig
 */
export interface MediaMtxQuicEnvConfig extends MediaMtxBaseEnvConfig {
  /** 协议，QUIC/MoQ 强制使用 https */
  protocol: "https";
  /** HTTPS2 端口，承载 fingerprint、读流页面等 HTTP/2 接口，默认 `8892` */
  https2Port: string;
  /** HTTPS3 端口，承载 WebTransport MoQ endpoint（UDP），默认 `8892` */
  https3Port: string;
  /** 请求超时时间（毫秒） */
  requestTimeoutMs: number;
  /** 是否订阅音频轨道；多路监控默认关闭以降低 WebCodecs/AudioContext 开销 */
  enableAudio: boolean;
  /** 视频渲染帧率上限，`0` 表示不限制 */
  maxVideoFps: number;
  /** canvas 内部渲染宽度上限，`0` 表示按原始视频宽度渲染 */
  maxRenderWidth: number;
  /** canvas 内部渲染高度上限，`0` 表示按原始视频高度渲染 */
  maxRenderHeight: number;
  /** VideoDecoder 等待队列上限，越小越偏低延迟 */
  maxVideoDecodeQueueSize: number;
  /** 多路 QUIC 首次启动错峰间隔（毫秒），降低同时初始化 decoder 的峰值压力 */
  startupStaggerMs: number;
  /** 是否输出 QUIC reader 调试日志 */
  debug: boolean;
  /** MoQ 读流页面路径模板，`{path}` 会被替换为流路径，默认 `/{path}/` */
  readPathTemplate: string;
  /** MoQ WebTransport endpoint 路径模板，默认 `/{path}/moq` */
  moqPathTemplate: string;
  /** 证书 fingerprint 路径模板，默认 `/{path}/fingerprint` */
  fingerprintPathTemplate: string;
}

/**
 * MediaMTX QUIC/MoQ 端点选项接口
 *
 * 扩展公共 {@link BaseMediaMtxEndpointOptions}，增加 QUIC 专有 URL 覆盖：
 * - `moqUrl`：直接指定 WebTransport MoQ URL，跳过模板构建
 * - `fingerprintUrl`：直接指定 fingerprint URL，跳过模板构建
 *
 * @interface MediaMtxQuicEndpointOptions
 */
export interface MediaMtxQuicEndpointOptions extends BaseMediaMtxEndpointOptions<MediaMtxQuicEnvConfig> {
  /** 直接指定 MoQ WebTransport URL，优先级高于 endpointUrl 和模板 */
  moqUrl?: string;
  /** 直接指定证书 fingerprint URL，优先级高于模板 */
  fingerprintUrl?: string;
}

/**
 * MediaMTX QUIC/MoQ 认证选项接口
 *
 * 支持两种认证方式（互斥，user/pass 优先）：
 * - Basic Auth：提供 `user` 和 `pass`
 * - Bearer Token：提供 `token`
 *
 * @interface MediaMtxQuicAuthOptions
 */
export interface MediaMtxQuicAuthOptions {
  /** Basic Auth 用户名 */
  user?: string;
  /** Basic Auth 密码 */
  pass?: string;
  /** Bearer Token */
  token?: string;
}

/**
 * MediaMTX QUIC/MoQ 接收器选项接口
 *
 * 合并端点选项和认证选项，并添加生命周期回调。
 *
 * @interface MediaMtxQuicReceiverOptions
 */
export interface MediaMtxQuicReceiverOptions extends MediaMtxQuicEndpointOptions, MediaMtxQuicAuthOptions {
  /** 是否订阅音频轨道；多路监控默认建议关闭以降低解码和混音开销 */
  enableAudio?: boolean;
  /** 视频渲染帧率上限，`0` 或未设置表示不限制 */
  maxVideoFps?: number;
  /** canvas 内部渲染宽度上限，`0` 或未设置表示按原始视频宽度渲染 */
  maxRenderWidth?: number;
  /** canvas 内部渲染高度上限，`0` 或未设置表示按原始视频高度渲染 */
  maxRenderHeight?: number;
  /** VideoDecoder 等待队列上限，越小越偏低延迟 */
  maxVideoDecodeQueueSize?: number;
  /** 多路 QUIC 首次启动错峰间隔（毫秒），降低同时初始化 decoder 的峰值压力 */
  startupStaggerMs?: number;
  /** 是否输出 QUIC reader 调试日志 */
  debug?: boolean;
  /** 连接状态变化回调 */
  onStatusChange?: (status: MediaMtxReceiverStatus) => void;
  /** 连接成功回调，携带音频轨道信息 */
  onConnected?: (info: MediaMtxQuicConnectedInfo) => void;
  /** 连接断开回调，携带断开原因 */
  onDisconnected?: (reason: string) => void;
  /** 音频静音状态变化回调（浏览器自动静音或用户手动解静音时触发） */
  onAudioMuted?: (muted: boolean) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * MediaMTX QUIC/MoQ 流配置接口
 *
 * 扩展接收器选项，增加流标识字段，用于多路接收场景。
 *
 * @interface MediaMtxQuicStreamConfig
 */
export interface MediaMtxQuicStreamConfig extends MediaMtxQuicReceiverOptions {
  /** 流唯一标识，缺省时使用 path */
  id?: string;
  /** 流显示标签，缺省时使用 path */
  label?: string;
}

/**
 * MediaMTX QUIC/MoQ 连接成功信息
 *
 * @interface MediaMtxQuicConnectedInfo
 * @property hasAudio - 是否成功订阅了音频轨道
 */
export interface MediaMtxQuicConnectedInfo {
  hasAudio: boolean;
}

/**
 * MediaMTX QUIC/MoQ 接收器条目接口
 *
 * 扩展公共 {@link BaseMediaMtxReceiverEntry}，`stream` 类型为 {@link MediaMtxQuicConnectedInfo}，
 * 并增加 `audioMuted` 字段追踪音频静音状态。
 *
 * @interface MediaMtxQuicReceiverEntry
 */
export interface MediaMtxQuicReceiverEntry extends BaseMediaMtxReceiverEntry<MediaMtxQuicConnectedInfo | null> {
  /** 音频是否处于静音状态（浏览器 autoplay 策略可能导致初始静音） */
  audioMuted: boolean;
}
