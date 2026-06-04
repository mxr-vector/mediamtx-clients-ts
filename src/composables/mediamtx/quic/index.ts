/**
 * MediaMTX QUIC/MoQ 接收器模块入口
 *
 * @module mediamtx/quic
 */

export {
  buildMediaMtxQuicFingerprintUrl,
  buildMediaMtxQuicMoqUrl,
  buildMediaMtxQuicReadUrl,
  getDefaultMediaMtxQuicStreams,
  getMediaMtxQuicConfig,
} from "./config";
export { MediaMtxQuicReceiver } from "./client";
export { MediaMTXMoQReader } from "./reader";
export { useMediaMtxQuicReceiver } from "./useMediaMtxQuicReceiver";
export { useMediaMtxQuicReceivers } from "./useMediaMtxQuicReceivers";

export type {
  MediaMtxQuicAuthOptions,
  MediaMtxQuicConnectedInfo,
  MediaMtxQuicEndpointOptions,
  MediaMtxQuicEnvConfig,
  MediaMtxQuicReceiverEntry,
  MediaMtxQuicReceiverOptions,
  MediaMtxQuicStreamConfig,
  MediaMtxReceiverStatus,
} from "./types";
export type { MediaMtxQuicReceiverConfig } from "./client";
