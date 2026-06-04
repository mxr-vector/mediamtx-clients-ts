/**
 * MediaMTX QUIC/MoQ 单接收器 Composable
 *
 * MoQ 浏览器 reader 会在容器元素中创建 canvas，并通过 WebTransport + WebCodecs
 * 接收和渲染媒体。
 *
 * @module mediamtx/quic/useMediaMtxQuicReceiver
 */

import { onUnmounted, readonly, ref, shallowRef, type Ref, type ShallowRef } from "vue";
import { MediaMtxQuicReceiver } from "./client";
import type { MediaMtxQuicConnectedInfo, MediaMtxQuicReceiverOptions, MediaMtxReceiverStatus } from "./types";

/**
 * useMediaMtxQuicReceiver 选项接口
 *
 * 扩展自 {@link MediaMtxQuicReceiverOptions}，增加 `autoDestroy` 字段。
 *
 * @interface UseMediaMtxQuicReceiverOptions
 * @extends MediaMtxQuicReceiverOptions
 * @property autoDestroy - 是否在组件卸载时自动销毁接收器（默认 `true`）
 */
export interface UseMediaMtxQuicReceiverOptions extends MediaMtxQuicReceiverOptions {
  autoDestroy?: boolean;
}

/**
 * useMediaMtxQuicReceiver 返回值接口
 *
 * 提供响应式状态和操作方法。
 *
 * @interface UseMediaMtxQuicReceiverReturn
 * @property status - 只读的连接状态引用
 * @property info - 只读的连接信息引用（包含 hasAudio 等）
 * @property error - 只读的错误信息引用
 * @property audioMuted - 只读的音频静音状态引用
 * @property receiver - 接收器实例引用（可用于高级操作）
 * @property attach - 绑定容器元素并启动连接
 * @property detach - 解绑容器元素并停止连接
 * @property restart - 重启连接
 * @property unmute - 用户手势触发音频解静音
 */
export interface UseMediaMtxQuicReceiverReturn {
  status: Readonly<Ref<MediaMtxReceiverStatus>>;
  info: Readonly<ShallowRef<MediaMtxQuicConnectedInfo | null>>;
  error: Readonly<Ref<Error | null>>;
  audioMuted: Readonly<Ref<boolean>>;
  receiver: ShallowRef<MediaMtxQuicReceiver | null>;
  attach: (el: HTMLElement) => Promise<void>;
  detach: () => void;
  restart: () => Promise<void>;
  unmute: () => void;
}

/**
 * MediaMTX QUIC/MoQ 单接收器 Composable 函数
 *
 * 管理单个 MediaMTX QUIC/MoQ 接收器的生命周期和状态。
 * 与 WebRTC 接收器不同，QUIC 接收器绑定的是容器元素（非 `<video>`），
 * MoQ reader 会在容器内创建 `<canvas>` 渲染视频帧。
 *
 * @param options - 配置选项
 * @returns 包含响应式状态和操作方法的对象
 *
 * @example
 * ```vue
 * <script setup>
 * import { useMediaMtxQuicReceiver } from './composables/mediamtx/quic'
 *
 * const { status, info, error, audioMuted, attach, restart, unmute } = useMediaMtxQuicReceiver({
 *   path: 'camera1',
 * })
 * </script>
 *
 * <template>
 *   <div :ref="(el) => el && attach(el as HTMLElement)" class="moq-video" />
 *   <button type="button" @click="restart">重连</button>
 *   <button v-if="audioMuted" type="button" @click="unmute">开启声音</button>
 *   <p>状态：{{ status }}</p>
 *   <p v-if="info">音频：{{ info.hasAudio ? '有' : '无' }}</p>
 *   <p v-if="error">{{ error.message }}</p>
 * </template>
 * ```
 */
export function useMediaMtxQuicReceiver(
  options: UseMediaMtxQuicReceiverOptions = {}
): UseMediaMtxQuicReceiverReturn {
  const { autoDestroy = true, ...receiverOptions } = options;

  const status = ref<MediaMtxReceiverStatus>("idle");
  const info = shallowRef<MediaMtxQuicConnectedInfo | null>(null);
  const error = ref<Error | null>(null);
  const audioMuted = ref(false);
  const receiver = shallowRef<MediaMtxQuicReceiver | null>(null);

  let containerEl: HTMLElement | null = null;

  const createReceiver = () => {
    if (!containerEl) return null;

    const nextReceiver = new MediaMtxQuicReceiver({
      ...receiverOptions,
      videoElement: containerEl,
      onStatusChange(nextStatus) {
        status.value = nextStatus;
        receiverOptions.onStatusChange?.(nextStatus);
      },
      onConnected(nextInfo) {
        info.value = nextInfo;
        error.value = null;
        receiverOptions.onConnected?.(nextInfo);
      },
      onDisconnected(reason) {
        if (status.value !== "closed") info.value = null;
        receiverOptions.onDisconnected?.(reason);
      },
      onAudioMuted(muted) {
        audioMuted.value = muted;
        receiverOptions.onAudioMuted?.(muted);
      },
      onError(nextError) {
        error.value = nextError;
        receiverOptions.onError?.(nextError);
      },
    });

    return nextReceiver;
  };

  const start = async () => {
    const nextReceiver = createReceiver();
    if (!nextReceiver) return;

    receiver.value?.stop("restart");
    receiver.value = nextReceiver;

    try {
      await nextReceiver.start();
    } catch (nextError) {
      const normalized = nextError instanceof Error ? nextError : new Error(String(nextError));
      error.value = normalized;
      status.value = "failed";
      receiverOptions.onError?.(normalized);
    }
  };

  const attach = async (el: HTMLElement) => {
    containerEl = el;
    await start();
  };

  const detach = () => {
    receiver.value?.stop();
    receiver.value = null;
    info.value = null;
    error.value = null;
    audioMuted.value = false;
    status.value = "idle";
    containerEl = null;
  };

  const restart = async () => {
    receiver.value?.stop("restart");
    info.value = null;
    error.value = null;
    audioMuted.value = false;
    await start();
  };

  const unmute = () => {
    receiver.value?.unmute();
  };

  onUnmounted(() => {
    if (autoDestroy) detach();
  });

  return {
    status: readonly(status),
    info: readonly(info) as Readonly<ShallowRef<MediaMtxQuicConnectedInfo | null>>,
    error: readonly(error),
    audioMuted: readonly(audioMuted),
    receiver,
    attach,
    detach,
    restart,
    unmute,
  };
}
