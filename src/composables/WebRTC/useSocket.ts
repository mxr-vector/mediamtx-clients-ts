/**
 * useSocket.ts
 * Vue3 Composable — 封装 SocketClient 的响应式状态与生命周期管理
 */

import { ref, onMounted, onUnmounted, readonly, type Ref } from "vue";
import {
  SocketClient,
  createSocketClient,
  type SocketConfig,
  type SocketStatus,
  type EventMap,
  type DefaultEventMap,
} from "./socket";

export interface UseSocketReturn<T extends EventMap> {
  /** 响应式连接状态 */
  status: Readonly<Ref<SocketStatus>>;
  /** 是否已连接 */
  connected: Readonly<Ref<boolean>>;
  /** 底层 SocketClient 实例 */
  client: SocketClient<T>;
  /** 手动发起连接 */
  connect: () => void;
  /** 手动断开连接 */
  disconnect: () => void;
  /** 发送事件 */
  emit: SocketClient<T>["emit"];
  /** 注册事件监听 */
  on: SocketClient<T>["on"];
  /** 移除事件监听 */
  off: SocketClient<T>["off"];
  /** 注册一次性事件 */
  once: SocketClient<T>["once"];
  /** 等待某事件（Promise） */
  waitFor: SocketClient<T>["waitFor"];
}

export interface UseSocketOptions<T extends EventMap> extends SocketConfig {
  /**
   * 实例名称（用于单例复用），不填则每次创建新实例
   */
  instanceName?: string;
  /**
   * 是否在 onMounted 时自动连接，默认 true
   */
  autoConnect?: boolean;
  /**
   * 是否在 onUnmounted 时自动断开，默认 true
   * 若使用具名单例，建议设置为 false 以跨组件复用连接
   */
  autoDisconnect?: boolean;
  /**
   * 初始事件监听器（挂载前预注册，避免错过早期消息）
   */
  listeners?: Partial<{ [K in keyof T & string]: (data: T[K]) => void }>;
}

/**
 * useSocket — Vue3 响应式 Socket.io 封装
 *
 * @example
 * ```ts
 * const { status, connected, emit, on } = useSocket({
 *   url: 'https://api.example.com',
 *   instanceName: 'main',
 * })
 *
 * on('message', (data) => console.log(data))
 * emit('hello', { name: 'Vue' })
 * ```
 */
export function useSocket<T extends EventMap = DefaultEventMap>(
  options: UseSocketOptions<T>
): UseSocketReturn<T> {
  const {
    instanceName,
    autoConnect = true,
    autoDisconnect = !instanceName, // 具名单例默认不自动断开
    listeners = {},
    ...socketConfig
  } = options;

  // 创建或复用 SocketClient 实例
  const client: SocketClient<T> = instanceName
    ? createSocketClient<T>(instanceName, socketConfig)
    : new SocketClient<T>(socketConfig);

  const status = ref<SocketStatus>(client.getStatus());
  const connected = ref(client.isConnected());

  // 同步状态到响应式引用
  const unsubStatus = client.onStatusChange((s) => {
    status.value = s;
    connected.value = s === "connected";
  });

  // 预注册业务监听器
  Object.entries(listeners).forEach(([event, handler]) => {
    if (handler) {
      client.on(event, handler as (data: unknown) => void);
    }
  });

  onMounted(() => {
    if (autoConnect && !client.isConnected()) {
      client.connect();
    }
  });

  onUnmounted(() => {
    unsubStatus();

    // 移除本次注册的监听器，避免具名单例跨组件复用时残留回调
    Object.entries(listeners).forEach(([event, handler]) => {
      if (handler) {
        client.off(event, handler as (data: unknown) => void);
      }
    });

    if (autoDisconnect) {
      client.disconnect();
    }
  });

  return {
    status: readonly(status),
    connected: readonly(connected),
    client,
    connect: () => client.connect(),
    disconnect: () => client.disconnect(),
    emit: client.emit.bind(client) as SocketClient<T>["emit"],
    on: client.on.bind(client) as SocketClient<T>["on"],
    off: client.off.bind(client) as SocketClient<T>["off"],
    once: client.once.bind(client) as SocketClient<T>["once"],
    waitFor: client.waitFor.bind(client) as SocketClient<T>["waitFor"],
  };
}
