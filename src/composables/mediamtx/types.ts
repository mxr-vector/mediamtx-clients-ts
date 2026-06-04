/**
 * MediaMTX 协议公共类型定义
 *
 * 本文件只放 WebRTC、QUIC/MoQ 等协议都能复用的基础类型。
 * 各协议的专有配置与回调类型放在对应子目录中。
 *
 * @module mediamtx/types
 */

export type MediaMtxProtocol = "http" | "https";

/**
 * MediaMTX 接收器状态类型
 *
 * 表示一个接收器的连接生命周期。
 */
export type MediaMtxReceiverStatus =
  | "idle"
  | "preparing"
  | "signaling"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

/**
 * MediaMTX 基础环境配置
 */
export interface MediaMtxBaseEnvConfig {
  protocol: MediaMtxProtocol;
  host: string;
  defaultPath: string;
  streamPaths: string[];
}

/**
 * MediaMTX 基础端点选项
 */
export interface MediaMtxEndpointOptions<TConfig extends MediaMtxBaseEnvConfig = MediaMtxBaseEnvConfig> {
  path?: string;
  endpointUrl?: string;
  config?: Partial<TConfig>;
}

/**
 * MediaMTX 流标识配置
 */
export interface MediaMtxStreamIdentity {
  id?: string;
  label?: string;
  path?: string;
}

/**
 * MediaMTX 接收器条目基础结构
 */
export interface MediaMtxReceiverEntry<TStream = unknown> {
  id: string;
  label: string;
  path: string;
  status: MediaMtxReceiverStatus;
  stream: TStream;
  error: Error | null;
}
