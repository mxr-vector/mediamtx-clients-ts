/**
 * useWebRTC.ts
 * Vue3 Composable — 封装 WebRTCPlayer 的响应式状态与生命周期管理
 * 支持单路 / 多路流并行管理
 */

import { ref, shallowRef, triggerRef, onUnmounted, readonly, type Ref, type ShallowRef } from "vue";
import { WebRTCPlayer, type WebRTCConfig, type RTCStatus, type SignalingChannel } from "./webrtc";

// ─── 单路 useWebRTC ──────────────────────────────────────────────────────────

export interface UseWebRTCOptions extends Omit<
  WebRTCConfig,
  "videoElement" | "signaling" | "onStatusChange" | "onConnected" | "onDisconnected" | "onError"
> {
  signaling: SignalingChannel;
  /**
   * 是否在 onUnmounted 时自动销毁，默认 true
   */
  autoDestroy?: boolean;
}

export interface UseWebRTCReturn {
  /** 响应式状态 */
  status: Readonly<Ref<RTCStatus>>;
  /** 当前媒体流 */
  stream: Readonly<ShallowRef<MediaStream | null>>;
  /** 错误信息 */
  error: Readonly<Ref<Error | null>>;
  /** 绑定 video 元素并启动播放 */
  attach: (el: HTMLVideoElement) => void;
  /** 停止播放，解绑 video 元素 */
  detach: () => void;
  /** 手动重启 */
  restart: () => void;
  /** 底层 WebRTCPlayer 实例 */
  player: ShallowRef<WebRTCPlayer | null>;
}

/**
 * useWebRTC — 单路 WebRTC 流的响应式封装
 *
 * @example
 * ```vue
 * <template>
 *   <video ref="videoRef" autoplay muted playsinline />
 * </template>
 *
 * <script setup lang="ts">
 * import { ref, onMounted } from 'vue'
 * import { useWebRTC } from './useWebRTC'
 * import { createSocketSignaling } from './webrtc'
 * import { useSocket } from './useSocket'
 *
 * const videoRef = ref<HTMLVideoElement>()
 * const { client } = useSocket({ url: 'https://api.example.com' })
 * const signaling = createSocketSignaling(client)
 *
 * const { status, stream, attach } = useWebRTC({
 *   signaling,
 *   taskId: 'cam-01',
 * })
 *
 * onMounted(() => {
 *   if (videoRef.value) attach(videoRef.value)
 * })
 * </script>
 * ```
 */
export function useWebRTC(options: UseWebRTCOptions): UseWebRTCReturn {
  const { autoDestroy = true, ...playerConfig } = options;

  const status = ref<RTCStatus>("idle");
  const stream = shallowRef<MediaStream | null>(null);
  const error = ref<Error | null>(null);
  const player = shallowRef<WebRTCPlayer | null>(null);

  let videoEl: HTMLVideoElement | null = null;

  const _createPlayer = () => {
    if (!videoEl) return;

    player.value?.stop();

    player.value = new WebRTCPlayer({
      ...playerConfig,
      videoElement: videoEl,
      onStatusChange(s) {
        status.value = s;
      },
      onConnected(s) {
        stream.value = s;
        error.value = null;
      },
      onDisconnected(reason) {
        console.warn(`[useWebRTC:${playerConfig.taskId}] 断开: ${reason}`);
      },
      onError(err) {
        error.value = err;
      },
    });

    player.value.start();
  };

  const attach = (el: HTMLVideoElement) => {
    videoEl = el;
    _createPlayer();
  };

  const detach = () => {
    player.value?.stop();
    player.value = null;
    stream.value = null;
    status.value = "idle";
    videoEl = null;
  };

  const restart = () => {
    player.value?.stop();
    _createPlayer();
  };

  onUnmounted(() => {
    if (autoDestroy) detach();
  });

  return {
    status: readonly(status),
    stream: readonly(stream) as Readonly<ShallowRef<MediaStream | null>>,
    error: readonly(error),
    attach,
    detach,
    restart,
    player,
  };
}

// ─── 多路 useMultiWebRTC ─────────────────────────────────────────────────────

/** 多路流的单条配置 */
export interface StreamConfig {
  /** 流唯一标识 */
  taskId: string;
  /** 信令通道 */
  signaling: SignalingChannel;
  /** 其他 WebRTC 配置 */
  rtcConfig?: RTCConfiguration;
  streamKind?: WebRTCConfig["streamKind"];
}

/** 多路流状态条目 */
export interface StreamEntry {
  taskId: string;
  status: RTCStatus;
  stream: MediaStream | null;
  error: Error | null;
  player: WebRTCPlayer | null;
}

export interface UseMultiWebRTCReturn {
  /** 所有流的状态映射 (taskId → StreamEntry) */
  streams: Readonly<Ref<Map<string, StreamEntry>>>;
  /** 为指定流绑定 video 元素 */
  attach: (taskId: string, el: HTMLVideoElement) => void;
  /** 停止并移除指定流 */
  detach: (taskId: string) => void;
  /** 停止所有流 */
  detachAll: () => void;
  /** 重启指定流 */
  restart: (taskId: string) => void;
}

/**
 * useMultiWebRTC — 多路 WebRTC 流的统一管理
 *
 * @example
 * ```ts
 * const { streams, attach } = useMultiWebRTC([
 *   { taskId: 'cam-01', signaling },
 *   { taskId: 'cam-02', signaling },
 * ])
 *
 * onMounted(() => {
 *   attach('cam-01', videoEl1)
 *   attach('cam-02', videoEl2)
 * })
 * ```
 */
export function useMultiWebRTC(
  configs: StreamConfig[],
  sharedOptions?: Partial<Omit<UseWebRTCOptions, "taskId" | "signaling">>
): UseMultiWebRTCReturn {
  const streams = shallowRef<Map<string, StreamEntry>>(new Map());
  const configByTaskId = new Map(configs.map((cfg) => [cfg.taskId, cfg]));
  const videoEls = new Map<string, HTMLVideoElement>();
  const players = new Map<string, WebRTCPlayer>();

  // 初始化所有流的状态占位
  configs.forEach(({ taskId }) => {
    streams.value.set(taskId, {
      taskId,
      status: "idle",
      stream: null,
      error: null,
      player: null,
    });
  });

  const _getConfig = (taskId: string): StreamConfig | undefined => configByTaskId.get(taskId);

  const _updateEntry = (taskId: string, patch: Partial<StreamEntry>) => {
    const entry = streams.value.get(taskId);
    if (entry) {
      streams.value.set(taskId, { ...entry, ...patch });
      triggerRef(streams);
    }
  };

  const _getPlayerConfig = (cfg: StreamConfig, el: HTMLVideoElement): WebRTCConfig => ({
    ...sharedOptions,
    ...(cfg.rtcConfig !== undefined ? { rtcConfig: cfg.rtcConfig } : {}),
    ...(cfg.streamKind !== undefined ? { streamKind: cfg.streamKind } : {}),
    videoElement: el,
    signaling: cfg.signaling,
    taskId: cfg.taskId,
    onStatusChange(s) {
      _updateEntry(cfg.taskId, { status: s });
    },
    onConnected(s) {
      _updateEntry(cfg.taskId, { stream: s, error: null });
    },
    onDisconnected() {},
    onError(err) {
      _updateEntry(cfg.taskId, { error: err });
    },
  });

  const attach = (taskId: string, el: HTMLVideoElement) => {
    const cfg = _getConfig(taskId);
    if (!cfg) {
      console.warn(`[useMultiWebRTC] 未找到 taskId="${taskId}" 的配置`);
      return;
    }

    videoEls.set(taskId, el);
    players.get(taskId)?.stop();

    const p = new WebRTCPlayer(_getPlayerConfig(cfg, el));

    players.set(taskId, p);
    _updateEntry(taskId, { player: p });
    p.start();
  };

  const detach = (taskId: string) => {
    players.get(taskId)?.stop();
    players.delete(taskId);
    videoEls.delete(taskId);
    _updateEntry(taskId, { status: "closed", stream: null, player: null });
  };

  const detachAll = () => {
    players.forEach((p) => p.stop());
    players.clear();
    videoEls.clear();
    streams.value.forEach((_, taskId) => {
      _updateEntry(taskId, { status: "closed", stream: null, player: null });
    });
  };

  const restart = (taskId: string) => {
    const el = videoEls.get(taskId);
    if (el) attach(taskId, el);
  };

  onUnmounted(() => {
    detachAll();
  });

  return {
    streams: readonly(streams) as Readonly<Ref<Map<string, StreamEntry>>>,
    attach,
    detach,
    detachAll,
    restart,
  };
}
