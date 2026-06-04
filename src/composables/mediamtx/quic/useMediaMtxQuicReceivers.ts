/**
 * MediaMTX QUIC/MoQ 多接收器 Composable
 *
 * @module mediamtx/quic/useMediaMtxQuicReceivers
 */

import { onUnmounted, readonly, shallowRef, triggerRef, type Ref } from "vue";
import { getMediaMtxQuicConfig } from "./config";
import { MediaMtxQuicReceiver } from "./client";
import type { MediaMtxQuicReceiverEntry, MediaMtxQuicReceiverOptions, MediaMtxQuicStreamConfig } from "./types";

/**
 * useMediaMtxQuicReceivers 返回值接口
 *
 * 提供响应式状态和批量操作方法。
 *
 * @interface UseMediaMtxQuicReceiversReturn
 * @property entries - 只读的接收器条目映射（key 为接收器 ID）
 * @property attach - 绑定容器元素并启动指定接收器
 * @property detach - 停止指定接收器
 * @property detachAll - 停止所有接收器
 * @property restart - 重启指定接收器
 * @property unmute - 用户手势触发指定接收器的音频解静音
 */
export interface UseMediaMtxQuicReceiversReturn {
  entries: Readonly<Ref<Map<string, MediaMtxQuicReceiverEntry>>>;
  attach: (id: string, el: HTMLElement) => Promise<void>;
  detach: (id: string) => void;
  detachAll: () => void;
  restart: (id: string) => Promise<void>;
  unmute: (id: string) => void;
}

/**
 * 标准化 QUIC/MoQ 流配置
 *
 * 将用户提供的流配置转换为标准格式。
 * 如果未提供配置，使用环境变量中的默认配置（`VITE_MEDIAMTX_QUIC_STREAM_PATHS`
 * 或回退到 `VITE_MEDIAMTX_STREAM_PATHS`）。
 *
 * @param streams - 用户提供的流配置数组
 * @returns 标准化后的流配置数组，每项保证 `id`、`label`、`path` 均有值
 */
function normalizeStreams(
  streams?: MediaMtxQuicStreamConfig[]
): Required<Pick<MediaMtxQuicStreamConfig, "id" | "label" | "path">>[] {
  const config = getMediaMtxQuicConfig();
  const configured = streams?.length
    ? streams
    : config.streamPaths.map((path) => ({ path, id: path, label: path }));

  return configured.map((item) => {
    const path = item.path ?? config.defaultPath;
    return {
      id: item.id ?? path,
      label: item.label ?? path,
      path,
    };
  });
}

/**
 * MediaMTX QUIC/MoQ 多接收器 Composable 函数
 *
 * 管理多个 MediaMTX QUIC/MoQ 接收器的生命周期和状态。
 * 提供统一的响应式状态管理和批量操作接口。
 *
 * @param streams - 流配置数组（可选，默认使用环境变量配置）
 * @param sharedOptions - 共享的接收器选项（应用于所有接收器，排除路径和 URL 字段）
 * @returns 包含响应式状态和操作方法的对象
 *
 * @example
 * ```vue
 * <script setup>
 * import { useMediaMtxQuicReceivers } from './composables/mediamtx/quic'
 *
 * const { entries, attach, restart, unmute, detachAll } = useMediaMtxQuicReceivers([
 *   { id: 'camera1', path: 'camera1', label: '正面' },
 *   { id: 'camera2', path: 'camera2', label: '背面' },
 * ])
 * </script>
 *
 * <template>
 *   <div v-for="entry in entries.values()" :key="entry.id">
 *     <div :ref="(el) => el && attach(entry.id, el as HTMLElement)" class="moq-video" />
 *     <p>{{ entry.label }} - {{ entry.status }}</p>
 *     <button @click="restart(entry.id)">重连</button>
 *     <button v-if="entry.audioMuted" @click="unmute(entry.id)">开启声音</button>
 *   </div>
 * </template>
 * ```
 */
export function useMediaMtxQuicReceivers(
  streams?: MediaMtxQuicStreamConfig[],
  sharedOptions: Omit<MediaMtxQuicReceiverOptions, "path" | "endpointUrl" | "moqUrl" | "fingerprintUrl"> = {}
): UseMediaMtxQuicReceiversReturn {
  const normalized = normalizeStreams(streams);
  const configById = new Map(normalized.map((item) => [item.id, item]));
  const streamOptionsById = new Map((streams ?? []).map((item) => [item.id ?? item.path ?? "", item]));

  const receivers = new Map<string, MediaMtxQuicReceiver>();
  const containerEls = new Map<string, HTMLElement>();
  const startupTimers = new Map<string, number>();
  const entries = shallowRef<Map<string, MediaMtxQuicReceiverEntry>>(new Map());

  normalized.forEach((item) => {
    entries.value.set(item.id, {
      id: item.id,
      label: item.label,
      path: item.path,
      status: "idle",
      stream: null,
      audioMuted: false,
      error: null,
    });
  });

  const clearStartupTimer = (id: string) => {
    const timer = startupTimers.get(id);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    startupTimers.delete(id);
  };

  const getStartupDelay = (id: string) => {
    const baseDelay = sharedOptions.startupStaggerMs ?? getMediaMtxQuicConfig().startupStaggerMs;
    if (baseDelay <= 0) return 0;
    return Math.max(0, normalized.findIndex((item) => item.id === id)) * baseDelay;
  };

  const updateEntry = (id: string, patch: Partial<MediaMtxQuicReceiverEntry>) => {
    const entry = entries.value.get(id);
    if (!entry) return;
    entries.value.set(id, { ...entry, ...patch });
    triggerRef(entries);
  };

  const createReceiver = (id: string, el: HTMLElement) => {
    const baseConfig = configById.get(id);
    if (!baseConfig) throw new Error(`MediaMTX QUIC stream config not found: ${id}`);

    const streamOptions = streamOptionsById.get(id) ?? streamOptionsById.get(baseConfig.path) ?? {};

    return new MediaMtxQuicReceiver({
      ...sharedOptions,
      ...streamOptions,
      path: baseConfig.path,
      videoElement: el,
      onStatusChange(status) {
        updateEntry(id, { status });
        streamOptions.onStatusChange?.(status);
        sharedOptions.onStatusChange?.(status);
      },
      onConnected(info) {
        updateEntry(id, { stream: info, error: null });
        streamOptions.onConnected?.(info);
        sharedOptions.onConnected?.(info);
      },
      onDisconnected(reason) {
        updateEntry(id, { stream: null });
        streamOptions.onDisconnected?.(reason);
        sharedOptions.onDisconnected?.(reason);
      },
      onAudioMuted(muted) {
        updateEntry(id, { audioMuted: muted });
        streamOptions.onAudioMuted?.(muted);
        sharedOptions.onAudioMuted?.(muted);
      },
      onError(error) {
        updateEntry(id, { error });
        streamOptions.onError?.(error);
        sharedOptions.onError?.(error);
      },
    });
  };

  const startReceiver = async (id: string, el: HTMLElement) => {
    receivers.get(id)?.stop("restart");

    const receiver = createReceiver(id, el);
    receivers.set(id, receiver);
    await receiver.start().catch((error) => {
      updateEntry(id, { status: "failed", error: error instanceof Error ? error : new Error(String(error)) });
    });
  };

  const attach = async (id: string, el: HTMLElement) => {
    containerEls.set(id, el);
    clearStartupTimer(id);

    const delay = getStartupDelay(id);
    if (delay <= 0) {
      await startReceiver(id, el);
      return;
    }

    updateEntry(id, { status: "preparing" });
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        startupTimers.delete(id);
        startReceiver(id, el).finally(resolve);
      }, delay);
      startupTimers.set(id, timer);
    });
  };

  const detach = (id: string) => {
    clearStartupTimer(id);
    receivers.get(id)?.stop();
    receivers.delete(id);
    containerEls.delete(id);
    updateEntry(id, { status: "closed", stream: null, audioMuted: false });
  };

  const detachAll = () => {
    startupTimers.forEach((timer) => window.clearTimeout(timer));
    startupTimers.clear();
    receivers.forEach((receiver) => receiver.stop());
    receivers.clear();
    containerEls.clear();
    entries.value.forEach((_, id) => updateEntry(id, { status: "closed", stream: null, audioMuted: false }));
  };

  const restart = async (id: string) => {
    const el = containerEls.get(id);
    if (!el) return;
    clearStartupTimer(id);
    await startReceiver(id, el);
  };

  const unmute = (id: string) => {
    receivers.get(id)?.unmute();
  };

  onUnmounted(detachAll);

  return {
    entries: readonly(entries) as Readonly<Ref<Map<string, MediaMtxQuicReceiverEntry>>>,
    attach,
    detach,
    detachAll,
    restart,
    unmute,
  };
}
