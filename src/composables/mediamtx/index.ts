/**
 * MediaMTX WebRTC 接收器模块入口
 * 
 * 本模块是 MediaMTX WebRTC 接收器功能的统一入口点。
 * 提供所有公共 API 的导出，包括：
 * 
 * 核心功能：
 * - MediaMtxWhepReceiver: WebRTC WHEP 接收器类
 * - useMediaMtxReceiver: 单接收器 Composable
 * - useMediaMtxReceivers: 多接收器 Composable
 * 
 * 配置工具：
 * - getMediaMtxConfig: 获取 MediaMTX 配置
 * - buildMediaMtxWhepUrl: 构建 WHEP 端点 URL
 * - getDefaultMediaMtxStreams: 获取默认流路径
 * 
 * 类型定义：
 * - MediaMtxReceiverStatus: 接收器状态类型
 * - MediaMtxEnvConfig: 环境配置接口
 * - MediaMtxEndpointOptions: 端点选项接口
 * - MediaMtxReceiverOptions: 接收器选项接口
 * - MediaMtxStreamConfig: 流配置接口
 * - MediaMtxReceiverEntry: 接收器条目接口
 * - MediaMtxWhepReceiverConfig: WHEP 接收器配置接口
 * 
 * 使用示例：
 * ```typescript
 * // 单接收器
 * import { useMediaMtxReceiver } from './composables/mediamtx'
 * 
 * const { status, stream, attach } = useMediaMtxReceiver({
 *   path: 'camera1',
 *   autoplay: true
 * })
 * 
 * // 多接收器
 * import { useMediaMtxReceivers } from './composables/mediamtx'
 * 
 * const { entries, attach, restart } = useMediaMtxReceivers([
 *   { id: 'cam1', path: 'camera1', label: 'CAM-01' },
 *   { id: 'cam2', path: 'camera2', label: 'CAM-02' }
 * ])
 * 
 * // 配置工具
 * import { buildMediaMtxWhepUrl, getMediaMtxConfig } from './composables/mediamtx'
 * 
 * const url = buildMediaMtxWhepUrl({ path: 'camera1' })
 * const config = getMediaMtxConfig()
 * ```
 * 
 * @module mediamtx
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
} from "./types";
export type { MediaMtxWhepReceiverConfig } from "./client";
