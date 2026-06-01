/**
 * MediaMTX 多接收器 Composable
 * 
 * 本模块提供 Vue 3 Composition API 风格的多路 MediaMTX WebRTC 接收器管理。
 * 用于同时管理多个视频流的 WebRTC 连接。
 * 
 * 主要功能：
 * 1. 管理多个 MediaMTX WebRTC 接收器
 * 2. 提供统一的响应式状态管理
 * 3. 支持批量操作（全部断开、全部重连等）
 * 4. 自动清理资源（组件卸载时）
 * 
 * 使用场景：
 * - 多路视频监控
 * - 视频墙/仪表板
 * - 需要同时显示多个摄像头的场景
 * 
 * @module useMediaMtxReceivers
 */

import { onUnmounted, readonly, ref, shallowRef, triggerRef, type Ref } from "vue";
import { getMediaMtxConfig } from "./config";
import { MediaMtxWhepReceiver } from "./client";
import type { MediaMtxReceiverEntry, MediaMtxReceiverOptions, MediaMtxStreamConfig } from "./types";

/**
 * useMediaMtxReceivers 返回值接口
 * 
 * 提供响应式状态和批量操作方法。
 * 
 * @interface UseMediaMtxReceiversReturn
 * @property entries - 只读的接收器条目映射（key 为接收器 ID）
 * @property attach - 绑定视频元素并启动指定接收器
 * @property detach - 停止指定接收器
 * @property detachAll - 停止所有接收器
 * @property restart - 重启指定接收器
 */
export interface UseMediaMtxReceiversReturn {
  entries: Readonly<Ref<Map<string, MediaMtxReceiverEntry>>>;
  attach: (id: string, el: HTMLVideoElement) => Promise<void>;
  detach: (id: string) => void;
  detachAll: () => void;
  restart: (id: string) => Promise<void>;
}

/**
 * 标准化流配置
 * 
 * 将用户提供的流配置转换为标准格式。
 * 如果未提供配置，使用环境变量中的默认配置。
 * 
 * @param streams - 用户提供的流配置数组
 * @returns 标准化后的流配置数组
 */
function normalizeStreams(streams?: MediaMtxStreamConfig[]): Required<Pick<MediaMtxStreamConfig, "id" | "label" | "path">>[] {
  const config = getMediaMtxConfig();
  // 如果未提供流配置，使用环境变量中的默认路径
  const configured = streams?.length
    ? streams
    : config.streamPaths.map((path) => ({ path, id: path, label: path }));

  // 标准化每个流配置
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
 * MediaMTX 多接收器 Composable 函数
 * 
 * 管理多个 MediaMTX WebRTC 接收器的生命周期和状态。
 * 
 * @param streams - 流配置数组（可选，默认使用环境变量配置）
 * @param sharedOptions - 共享的接收器选项（应用于所有接收器）
 * @returns 包含响应式状态和操作方法的对象
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useMediaMtxReceivers } from './composables/mediamtx'
 * 
 * const { entries, attach, restart } = useMediaMtxReceivers([
 *   { id: 'cam1', path: 'camera1', label: 'CAM-01 前门' },
 *   { id: 'cam2', path: 'camera2', label: 'CAM-02 后门' }
 * ])
 * 
 * // 视频元素引用映射
 * const videoRefs = ref<Map<string, HTMLVideoElement>>(new Map())
 * 
 * const onVideoMounted = (id: string, el: HTMLVideoElement) => {
 *   videoRefs.value.set(id, el)
 *   attach(id, el)
 * }
 * </script>
 * 
 * <template>
 *   <div v-for="entry in entries.values()" :key="entry.id">
 *     <video :ref="(el) => onVideoMounted(entry.id, el)" autoplay muted />
 *     <div>{{ entry.label }} - {{ entry.status }}</div>
 *     <button @click="restart(entry.id)">重连</button>
 *   </div>
 * </template>
 * ```
 */
export function useMediaMtxReceivers(
  streams?: MediaMtxStreamConfig[],
  sharedOptions: Omit<MediaMtxReceiverOptions, "path" | "endpointUrl"> = {}
): UseMediaMtxReceiversReturn {
  // 标准化流配置
  const normalized = normalizeStreams(streams);

  // 创建配置映射（用于快速查找）
  const configById = new Map(normalized.map((item) => [item.id, item]));
  const streamOptionsById = new Map((streams ?? []).map((item) => [item.id ?? item.path ?? "", item]));

  // 接收器实例映射
  const receivers = new Map<string, MediaMtxWhepReceiver>();
  // 视频元素映射
  const videoEls = new Map<string, HTMLVideoElement>();

  // 响应式的接收器条目映射
  const entries = shallowRef<Map<string, MediaMtxReceiverEntry>>(new Map());

  // 初始化接收器条目
  normalized.forEach((item) => {
    entries.value.set(item.id, {
      id: item.id,
      label: item.label,
      path: item.path,
      status: "idle",
      stream: null,
      error: null,
    });
  });

  /**
   * 更新接收器条目
   * 
   * 更新指定接收器的状态信息并触发响应式更新。
   * 
   * @param id - 接收器 ID
   * @param patch - 要更新的字段
   */
  const updateEntry = (id: string, patch: Partial<MediaMtxReceiverEntry>) => {
    const entry = entries.value.get(id);
    if (!entry) return;
    entries.value.set(id, { ...entry, ...patch });
    // 触发 shallowRef 的响应式更新
    triggerRef(entries);
  };

  /**
   * 创建接收器实例
   * 
   * 根据配置创建新的 MediaMtxWhepReceiver 实例。
   * 合并共享选项和流特定选项。
   * 
   * @param id - 接收器 ID
   * @param el - 视频元素
   * @returns 新的接收器实例
   * @throws 如果找不到流配置
   */
  const createReceiver = (id: string, el: HTMLVideoElement) => {
    const baseConfig = configById.get(id);
    if (!baseConfig) throw new Error(`MediaMTX stream config not found: ${id}`);

    // 获取流特定的选项（如果有）
    const streamOptions = streamOptionsById.get(id) ?? streamOptionsById.get(baseConfig.path) ?? {};

    return new MediaMtxWhepReceiver({
      ...sharedOptions,
      ...streamOptions,
      path: baseConfig.path,
      videoElement: el,
      /**
       * 状态变化回调
       * 更新接收器条目并触发用户回调
       */
      onStatusChange(status) {
        updateEntry(id, { status });
        streamOptions.onStatusChange?.(status);
        sharedOptions.onStatusChange?.(status);
      },
      /**
       * 连接成功回调
       * 更新媒体流并清除错误
       */
      onConnected(stream) {
        updateEntry(id, { stream, error: null });
        streamOptions.onConnected?.(stream);
        sharedOptions.onConnected?.(stream);
      },
      /**
       * 连接断开回调
       * 清除媒体流
       */
      onDisconnected(reason) {
        updateEntry(id, { stream: null });
        streamOptions.onDisconnected?.(reason);
        sharedOptions.onDisconnected?.(reason);
      },
      /**
       * 错误回调
       * 更新错误状态
       */
      onError(error) {
        updateEntry(id, { error, status: "failed" });
        streamOptions.onError?.(error);
        sharedOptions.onError?.(error);
      },
    });
  };

  /**
   * 绑定视频元素并启动接收器
   * 
   * 将视频元素绑定到指定接收器并开始接收媒体流。
   * 如果接收器已存在，会先停止旧连接。
   * 
   * @param id - 接收器 ID
   * @param el - HTML 视频元素
   */
  const attach = async (id: string, el: HTMLVideoElement) => {
    // 保存视频元素引用
    videoEls.set(id, el);
    // 停止旧连接（如果有）
    receivers.get(id)?.stop("restart");

    // 创建新接收器并启动
    const receiver = createReceiver(id, el);
    receivers.set(id, receiver);
    await receiver.start().catch(() => undefined);
  };

  /**
   * 停止指定接收器
   * 
   * 停止接收器并清理相关资源。
   * 
   * @param id - 接收器 ID
   */
  const detach = (id: string) => {
    receivers.get(id)?.stop();
    receivers.delete(id);
    videoEls.delete(id);
    updateEntry(id, { status: "closed", stream: null });
  };

  /**
   * 停止所有接收器
   * 
   * 停止所有接收器并清理所有资源。
   */
  const detachAll = () => {
    receivers.forEach((receiver) => receiver.stop());
    receivers.clear();
    videoEls.clear();
    entries.value.forEach((_, id) => updateEntry(id, { status: "closed", stream: null }));
  };

  /**
   * 重启指定接收器
   * 
   * 停止当前连接并重新启动。
   * 保留视频元素绑定。
   * 
   * @param id - 接收器 ID
   */
  const restart = async (id: string) => {
    const el = videoEls.get(id);
    if (!el) return;
    await attach(id, el);
  };

  // 组件卸载时自动清理所有接收器
  onUnmounted(detachAll);

  // 返回只读状态和操作方法
  return {
    entries: readonly(entries) as Readonly<Ref<Map<string, MediaMtxReceiverEntry>>>,
    attach,
    detach,
    detachAll,
    restart,
  };
}
