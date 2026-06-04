/**
 * MediaMTX WebRTC 接收器类型定义
 *
 * @module mediamtx/webrtc/types
 */

import type {
  MediaMtxBaseEnvConfig,
  MediaMtxEndpointOptions as BaseMediaMtxEndpointOptions,
  MediaMtxReceiverEntry as BaseMediaMtxReceiverEntry,
  MediaMtxReceiverStatus,
} from "../types";

export type { MediaMtxReceiverStatus } from "../types";

/**
 * WebRTC TURN 使用模式
 */
export type MediaMtxTurnMode = "off" | "fallback" | "include";

/**
 * MediaMTX WebRTC 环境配置接口
 */
export interface MediaMtxEnvConfig extends MediaMtxBaseEnvConfig {
  port: string;
  whepPathTemplate: string;
  requestTimeoutMs: number;
  turnMode?: MediaMtxTurnMode;
  stunIceServers?: RTCIceServer[];
  turnIceServers?: RTCIceServer[];
  iceServers: RTCIceServer[];
}

/**
 * MediaMTX WebRTC 端点选项接口
 */
export interface MediaMtxEndpointOptions extends BaseMediaMtxEndpointOptions<MediaMtxEnvConfig> { }

/**
 * MediaMTX WebRTC 接收器选项接口
 */
export interface MediaMtxReceiverOptions extends MediaMtxEndpointOptions {
  rtcConfig?: RTCConfiguration;
  autoplay?: boolean;
  muted?: boolean;
  onStatusChange?: (status: MediaMtxReceiverStatus) => void;
  onConnected?: (stream: MediaStream) => void;
  onDisconnected?: (reason: string) => void;
  onError?: (error: Error) => void;
}

/**
 * MediaMTX WebRTC 流配置接口
 */
export interface MediaMtxStreamConfig extends MediaMtxReceiverOptions {
  id?: string;
  label?: string;
}

/**
 * MediaMTX WebRTC 接收器条目接口
 */
export interface MediaMtxReceiverEntry extends BaseMediaMtxReceiverEntry<MediaStream | null> { }
