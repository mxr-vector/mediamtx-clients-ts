/**
 * MediaMTX WebRTC 接收器类型定义
 * 
 * 本文件定义了 MediaMTX WebRTC 接收器相关的所有 TypeScript 类型。
 * MediaMTX 是一个开源的实时媒体服务器，支持 RTSP、WebRTC 等协议。
 * 
 * 主要类型分类：
 * 1. 接收器状态类型
 * 2. 环境配置类型
 * 3. 端点选项类型
 * 4. 接收器选项类型
 * 5. 流配置类型
 * 6. 接收器条目类型
 * 
 * @module types
 */

/**
 * MediaMTX 接收器状态类型
 * 
 * 表示 WebRTC 接收器的连接状态，用于跟踪连接生命周期：
 * - idle: 空闲状态，未开始连接
 * - preparing: 准备中，正在初始化 WebRTC 连接
 * - signaling: 信令中，正在交换 SDP 信息
 * - connecting: 连接中，正在建立 ICE 连接
 * - connected: 已连接，成功接收媒体流
 * - disconnected: 已断开，连接意外中断
 * - failed: 失败，连接过程中出现错误
 * - closed: 已关闭，连接已主动关闭
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
 * MediaMTX 环境配置接口
 * 
 * 定义 MediaMTX 服务器的连接配置参数。
 * 这些参数通常从环境变量中读取，用于构建 WHEP 端点 URL。
 * 
 * @interface MediaMtxEnvConfig
 * @property protocol - 通信协议(http 或 https)
 * @property host - MediaMTX 服务器主机地址
 * @property port - WebRTC 服务端口
 * @property defaultPath - 默认流路径
 * @property streamPaths - 要连接的流路径列表
 * @property whepPathTemplate - WHEP 端点路径模板
 * @property requestTimeoutMs - 请求超时时间(毫秒)
 * @property iceServers - ICE 服务器配置(STUN/TURN)
 */
export interface MediaMtxEnvConfig {
  protocol: "http" | "https";
  host: string;
  port: string;
  defaultPath: string;
  streamPaths: string[];
  whepPathTemplate: string;
  requestTimeoutMs: number;
  iceServers: RTCIceServer[];
}

/**
 * MediaMTX 端点选项接口
 * 
 * 用于构建 MediaMTX WHEP 端点 URL 的选项。
 * 可以指定具体的流路径，或提供完整的端点 URL。
 * 
 * @interface MediaMtxEndpointOptions
 * @property path - 流路径(用于构建 URL)
 * @property endpointUrl - 完整的端点 URL(优先级高于 path)
 * @property config - 自定义环境配置(覆盖默认配置)
 */
export interface MediaMtxEndpointOptions {
  path?: string;
  endpointUrl?: string;
  config?: Partial<MediaMtxEnvConfig>;
}

/**
 * MediaMTX 接收器选项接口
 * 
 * 配置 WebRTC 接收器的行为参数。
 * 继承自 MediaMtxEndpointOptions，添加了 WebRTC 和媒体播放相关选项。
 * 
 * @interface MediaMtxReceiverOptions
 * @extends MediaMtxEndpointOptions
 * @property rtcConfig - WebRTC 连接配置(ICE 服务器等)
 * @property autoplay - 是否自动播放(默认 true)
 * @property muted - 是否静音(默认 true，避免自动播放限制)
 * @property onStatusChange - 状态变化回调函数
 * @property onConnected - 连接成功回调函数
 * @property onDisconnected - 连接断开回调函数
 * @property onError - 错误发生回调函数
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
 * MediaMTX 流配置接口
 * 
 * 定义单个视频流的完整配置。
 * 继承自 MediaMtxReceiverOptions，添加了流标识和显示标签。
 * 
 * @interface MediaMtxStreamConfig
 * @extends MediaMtxReceiverOptions
 * @property id - 流的唯一标识符(可选，默认使用 path)
 * @property label - 流的显示标签(用于 UI 显示)
 */
export interface MediaMtxStreamConfig extends MediaMtxReceiverOptions {
  id?: string;
  label?: string;
}

/**
 * MediaMTX 接收器条目接口
 * 
 * 表示一个活跃的 WebRTC 接收器实例的状态信息。
 * 用于在 UI 中显示接收器的状态和媒体流。
 * 
 * @interface MediaMtxReceiverEntry
 * @property id - 接收器的唯一标识符
 * @property label - 显示标签
 * @property path - 流路径
 * @property status - 当前连接状态
 * @property stream - 媒体流对象(连接成功时存在)
 * @property error - 错误信息(连接失败时存在)
 */
export interface MediaMtxReceiverEntry {
  id: string;
  label: string;
  path: string;
  status: MediaMtxReceiverStatus;
  stream: MediaStream | null;
  error: Error | null;
}
