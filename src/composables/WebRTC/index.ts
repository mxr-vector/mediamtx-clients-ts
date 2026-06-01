/**
 * index.ts
 * 统一导出入口
 */

// Socket.io 封装
export { SocketClient, createSocketClient, destroySocketClient } from "./socket";
export type { SocketConfig, SocketStatus, EventMap } from "./socket";

// WebRTC 封装
export {
  WebRTCPlayer,
  createWebRTCPlayer,
  createSocketSignaling,
  createNativeWsSignaling,
} from "./webrtc";
export type {
  RTCStatus,
  StreamKind,
  SignalingMessage,
  SignalingChannel,
  WebRTCConfig,
} from "./webrtc";

// Vue Composables
export { useSocket } from "./useSocket";
export type { UseSocketReturn, UseSocketOptions } from "./useSocket";

export { useWebRTC, useMultiWebRTC } from "./useWebRTC";
export type {
  UseWebRTCOptions,
  UseWebRTCReturn,
  StreamConfig,
  StreamEntry,
  UseMultiWebRTCReturn,
} from "./useWebRTC";
