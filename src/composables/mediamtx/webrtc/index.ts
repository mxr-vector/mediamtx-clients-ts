/**
 * MediaMTX WebRTC 接收器模块入口
 *
 * 本模块提供 MediaMTX WebRTC/WHEP 接收器相关的公共 API。
 *
 * @module mediamtx/webrtc
 */

// 导出配置工具函数
export { buildMediaMtxWhepUrl, getDefaultMediaMtxStreams, getMediaMtxConfig } from "./config";

// 导出 WHEP 接收器类
export { MediaMtxWhepReceiver } from "./client";

// 导出 Vue Composable 函数
export { useMediaMtxReceiver } from "./useMediaMtxReceiver";
export { useMediaMtxReceivers } from "./useMediaMtxReceivers";

// 导出类型定义
export type {
  MediaMtxEndpointOptions,
  MediaMtxEnvConfig,
  MediaMtxReceiverEntry,
  MediaMtxReceiverOptions,
  MediaMtxReceiverStatus,
  MediaMtxStreamConfig,
  MediaMtxTurnMode,
} from "./types";
export type { MediaMtxWhepReceiverConfig } from "./client";
