/**
 * MediaMTX 单接收器 Composable
 * 
 * 本模块提供 Vue 3 Composition API 风格的 MediaMTX WebRTC 接收器管理。
 * 用于管理单个视频流的 WebRTC 连接。
 * 
 * 主要功能：
 * 1. 封装 MediaMtxWhepReceiver 类
 * 2. 提供响应式状态管理
 * 3. 自动清理资源(组件卸载时)
 * 4. 简化视频元素绑定
 * 
 * 使用场景：
 * - 单个视频流的显示
 * - 需要精细控制连接状态的场景
 * - 自定义 UI 集成
 * 
 * @module useMediaMtxReceiver
 */

import { onUnmounted, readonly, ref, shallowRef, type Ref, type ShallowRef } from "vue";
import { MediaMtxWhepReceiver } from "./client";
import type { MediaMtxReceiverOptions, MediaMtxReceiverStatus } from "./types";

/**
 * useMediaMtxReceiver 选项接口
 * 
 * 扩展自 MediaMtxReceiverOptions，添加了自动销毁选项。
 * 
 * @interface UseMediaMtxReceiverOptions
 * @extends MediaMtxReceiverOptions
 * @property autoDestroy - 是否在组件卸载时自动销毁(默认 true)
 */
export interface UseMediaMtxReceiverOptions extends MediaMtxReceiverOptions {
  autoDestroy?: boolean;
}

/**
 * useMediaMtxReceiver 返回值接口
 * 
 * 提供响应式状态和操作方法。
 * 
 * @interface UseMediaMtxReceiverReturn
 * @property status - 只读的连接状态引用
 * @property stream - 只读的媒体流引用
 * @property error - 只读的错误信息引用
 * @property receiver - 接收器实例引用(可用于高级操作)
 * @property peerConnection - WebRTC 对等连接引用
 * @property attach - 绑定视频元素并启动连接
 * @property detach - 解绑视频元素并停止连接
 * @property restart - 重启连接
 */
export interface UseMediaMtxReceiverReturn {
  status: Readonly<Ref<MediaMtxReceiverStatus>>;
  stream: Readonly<ShallowRef<MediaStream | null>>;
  error: Readonly<Ref<Error | null>>;
  receiver: ShallowRef<MediaMtxWhepReceiver | null>;
  peerConnection: Readonly<ShallowRef<RTCPeerConnection | null>>;
  attach: (el: HTMLVideoElement) => Promise<void>;
  detach: () => void;
  restart: () => Promise<void>;
}

/**
 * MediaMTX 单接收器 Composable 函数
 * 
 * 管理单个 MediaMTX WebRTC 接收器的生命周期和状态。
 * 
 * @param options - 配置选项
 * @returns 包含响应式状态和操作方法的对象
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useMediaMtxReceiver } from './composables/mediamtx/webrtc'
 * 
 * const { status, stream, error, attach, restart } = useMediaMtxReceiver({
 *   path: 'camera1',
 *   autoplay: true,
 *   muted: true
 * })
 * 
 * const videoRef = ref<HTMLVideoElement>()
 * 
 * onMounted(() => {
 *   if (videoRef.value) {
 *     attach(videoRef.value)
 *   }
 * })
 * </script>
 * 
 * <template>
 *   <video ref="videoRef" autoplay muted />
 *   <div>状态: {{ status }}</div>
 *   <button @click="restart">重连</button>
 * </template>
 * ```
 */
export function useMediaMtxReceiver(options: UseMediaMtxReceiverOptions = {}): UseMediaMtxReceiverReturn {
  // 解构配置选项，设置默认值
  const { autoDestroy = true, ...receiverOptions } = options;

  // 响应式状态
  const status = ref<MediaMtxReceiverStatus>("idle");
  const stream = shallowRef<MediaStream | null>(null);
  const error = ref<Error | null>(null);
  const receiver = shallowRef<MediaMtxWhepReceiver | null>(null);
  const peerConnection = shallowRef<RTCPeerConnection | null>(null);

  // 视频元素引用
  let videoEl: HTMLVideoElement | null = null;

  /**
   * 创建接收器实例
   * 
   * 根据配置创建新的 MediaMtxWhepReceiver 实例。
   * 设置各种回调函数以更新响应式状态。
   * 
   * @returns 新的接收器实例，如果视频元素不存在则返回 null
   */
  const createReceiver = () => {
    if (!videoEl) return null;

    const nextReceiver = new MediaMtxWhepReceiver({
      ...receiverOptions,
      videoElement: videoEl,
      /**
       * 状态变化回调
       * 更新响应式状态并触发用户回调
       */
      onStatusChange(nextStatus) {
        status.value = nextStatus;
        peerConnection.value = nextReceiver.getPeerConnection();
        receiverOptions.onStatusChange?.(nextStatus);
      },
      /**
       * 连接成功回调
       * 更新媒体流、清除错误、更新对等连接引用
       */
      onConnected(nextStream) {
        stream.value = nextStream;
        error.value = null;
        peerConnection.value = nextReceiver.getPeerConnection();
        receiverOptions.onConnected?.(nextStream);
      },
      /**
       * 连接断开回调
       * 清除媒体流(除非是重启)
       */
      onDisconnected(reason) {
        if (status.value !== "closed") stream.value = null;
        receiverOptions.onDisconnected?.(reason);
      },
      /**
       * 错误回调
       * 更新错误状态
       */
      onError(nextError) {
        error.value = nextError;
        receiverOptions.onError?.(nextError);
      },
    });

    return nextReceiver;
  };

  /**
   * 启动连接
   * 
   * 创建接收器并启动 WebRTC 连接。
   * 如果已有连接，会先停止旧连接。
   */
  const start = async () => {
    const nextReceiver = createReceiver();
    if (!nextReceiver) return;

    // 停止旧连接(如果是重启)
    receiver.value?.stop("restart");
    receiver.value = nextReceiver;
    peerConnection.value = nextReceiver.getPeerConnection();

    try {
      await nextReceiver.start();
      peerConnection.value = nextReceiver.getPeerConnection();
    } catch (_) {
      // 即使启动失败，也更新对等连接引用
      peerConnection.value = nextReceiver.getPeerConnection();
    }
  };

  /**
   * 绑定视频元素并启动连接
   * 
   * 将视频元素绑定到接收器并开始接收媒体流。
   * 
   * @param el - HTML 视频元素
   */
  const attach = async (el: HTMLVideoElement) => {
    videoEl = el;
    await start();
  };

  /**
   * 解绑视频元素并停止连接
   * 
   * 停止接收器，清理所有状态。
   */
  const detach = () => {
    receiver.value?.stop();
    receiver.value = null;
    peerConnection.value = null;
    stream.value = null;
    status.value = "idle";
    videoEl = null;
  };

  /**
   * 重启连接
   * 
   * 停止当前连接并重新启动。
   * 保留视频元素绑定。
   */
  const restart = async () => {
    receiver.value?.stop("restart");
    stream.value = null;
    error.value = null;
    await start();
  };

  // 组件卸载时自动清理(如果启用)
  onUnmounted(() => {
    if (autoDestroy) detach();
  });

  // 返回只读状态和操作方法
  return {
    status: readonly(status),
    stream: readonly(stream) as Readonly<ShallowRef<MediaStream | null>>,
    error: readonly(error),
    receiver,
    peerConnection: readonly(peerConnection) as Readonly<ShallowRef<RTCPeerConnection | null>>,
    attach,
    detach,
    restart,
  };
}
