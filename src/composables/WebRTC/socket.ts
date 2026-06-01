/**
 * socket.ts
 * 基于 socket.io-client 的 TypeScript 封装
 * 支持：自动重连、心跳检测、事件队列、命名空间、类型安全的事件系统
 */

import { io, type Socket, type ManagerOptions, type SocketOptions } from "socket.io-client";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

/** Socket 连接状态 */
export type SocketStatus =
  | "idle" // 初始状态
  | "connecting" // 连接中
  | "connected" // 已连接
  | "reconnecting" // 重连中
  | "disconnected" // 已断开
  | "error"; // 错误

/** 内置生命周期事件 */
export type SocketLifecycleEvent =
  | "connect"
  | "disconnect"
  | "connect_error"
  | "reconnect"
  | "reconnect_attempt"
  | "reconnect_error"
  | "reconnect_failed";

/** 消息队列项 */
interface QueuedMessage {
  event: string;
  args: unknown[];
  timestamp: number;
}

/** Socket 配置项 */
export interface SocketConfig {
  /** 服务器地址 */
  url: string;
  /** 命名空间，默认 '/' */
  namespace?: string;
  /** socket.io 连接选项 */
  options?: Partial<ManagerOptions & SocketOptions>;
  /** 心跳间隔（ms），0 表示关闭，默认 25000 */
  heartbeatInterval?: number;
  /** 心跳超时（ms），默认 10000 */
  heartbeatTimeout?: number;
  /** 离线消息队列最大长度，默认 50 */
  maxQueueSize?: number;
  /** 连接超时（ms），默认 10000 */
  connectTimeout?: number;
  /** 是否在断线时自动清空队列，默认 false */
  clearQueueOnDisconnect?: boolean;
}

/** 事件监听器类型 */
type EventListener<T = unknown> = (data: T) => void;
type AnyEventListener = (data: any) => void;

/** 泛型事件映射（用于类型安全的 on/emit） */
export type EventMap = object;
export type DefaultEventMap = Record<string, unknown>;

// ─── SocketClient 核心类 ─────────────────────────────────────────────────────

export class SocketClient<TEvents extends EventMap = DefaultEventMap> {
  private socket: Socket | null = null;
  private config: Required<SocketConfig>;
  private status: SocketStatus = "idle";
  private connecting = false;
  private messageQueue: QueuedMessage[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private statusListeners: Set<(status: SocketStatus) => void> = new Set();
  private eventListeners: Map<string, Set<AnyEventListener>> = new Map();
  private readonly handlePong = () => {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  };

  constructor(config: SocketConfig) {
    this.config = {
      namespace: "/",
      heartbeatInterval: 25_000,
      heartbeatTimeout: 10_000,
      maxQueueSize: 50,
      connectTimeout: 10_000,
      clearQueueOnDisconnect: false,
      options: {},
      ...config,
    };
  }

  // ── 公共 API ────────────────────────────────────────────────────────────────

  /** 建立连接 */
  connect(): void {
    if (this.socket?.connected || this.connecting || this.status === "connecting") return;
    this.connecting = true;
    this._setStatus("connecting");

    const fullUrl = this.config.url.replace(/\/$/, "") + this.config.namespace;
    this.socket = io(fullUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      timeout: this.config.connectTimeout,
      transports: ["websocket", "polling"],
      ...this.config.options,
    });

    this._bindLifecycle();
    this._rehydrateListeners();
  }

  /** 断开连接 */
  disconnect(): void {
    this.connecting = false;
    this._stopHeartbeat();
    if (this.config.clearQueueOnDisconnect) this.messageQueue = [];
    this.socket?.disconnect();
    this.socket = null;
    this._setStatus("disconnected");
  }

  /**
   * 发送事件
   * 若当前未连接，消息将进入离线队列，连接后自动补发
   */
  emit<K extends keyof TEvents & string>(event: K, data?: TEvents[K]): void;
  emit(event: string, data?: unknown): void;
  emit(event: string, data?: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      this._enqueue(event, data !== undefined ? [data] : []);
    }
  }

  /** 注册事件监听（支持链式调用） */
  on<K extends keyof TEvents & string>(event: K, listener: EventListener<TEvents[K]>): this;
  on(event: string, listener: AnyEventListener): this;
  on(event: string, listener: AnyEventListener): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
    this.socket?.on(event, listener);
    return this;
  }

  /** 注册一次性事件监听 */
  once<K extends keyof TEvents & string>(event: K, listener: EventListener<TEvents[K]>): this;
  once(event: string, listener: AnyEventListener): this;
  once(event: string, listener: AnyEventListener): this {
    const wrapper: AnyEventListener = (data) => {
      listener(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /** 移除事件监听 */
  off<K extends keyof TEvents & string>(event: K, listener?: EventListener<TEvents[K]>): this;
  off(event: string, listener?: AnyEventListener): this;
  off(event: string, listener?: AnyEventListener): this {
    if (listener) {
      this.eventListeners.get(event)?.delete(listener);
      this.socket?.off(event, listener);
    } else {
      this.eventListeners.delete(event);
      this.socket?.removeAllListeners(event);
    }
    return this;
  }

  /** 监听连接状态变化 */
  onStatusChange(listener: (status: SocketStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** 等待某个事件（返回 Promise） */
  waitFor<K extends keyof TEvents & string>(event: K, timeout = 10_000): Promise<TEvents[K]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, handler);
        reject(new Error(`waitFor("${event}") timeout after ${timeout}ms`));
      }, timeout);

      const handler: EventListener<TEvents[K]> = (data) => {
        clearTimeout(timer);
        this.off(event, handler);
        resolve(data);
      };
      this.on(event, handler);
    });
  }

  /** 获取当前连接状态 */
  getStatus(): SocketStatus {
    return this.status;
  }

  /** 获取 socket.id */
  getId(): string | undefined {
    return this.socket?.id;
  }

  /** 是否已连接 */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** 清空离线消息队列 */
  clearQueue(): void {
    this.messageQueue = [];
  }

  /** 获取当前队列长度 */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  // ── 私有方法 ────────────────────────────────────────────────────────────────

  private _setStatus(status: SocketStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  private _bindLifecycle(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      this.connecting = false;
      this._setStatus("connected");
      this._startHeartbeat();
      this._flushQueue();
    });

    this.socket.on("disconnect", (reason) => {
      this.connecting = false;
      this._setStatus("disconnected");
      this._stopHeartbeat();
      console.warn(`[SocketClient] 断开连接: ${reason}`);
    });

    this.socket.on("connect_error", (err) => {
      this.connecting = false;
      this._setStatus("error");
      console.error("[SocketClient] 连接错误:", err.message);
    });

    this.socket.io.on("reconnect_attempt", () => {
      this._setStatus("reconnecting");
    });

    this.socket.io.on("reconnect", () => {
      this._setStatus("connected");
      this._startHeartbeat();
      this._flushQueue();
    });

    this.socket.io.on("reconnect_failed", () => {
      this.connecting = false;
      this._setStatus("error");
    });

    this.socket.off("pong", this.handlePong);
    this.socket.on("pong", this.handlePong);
  }

  /** 将已注册的业务监听器重新绑定到显式 connect() 创建的新 socket 实例 */
  private _rehydrateListeners(): void {
    if (!this.socket) return;
    this.eventListeners.forEach((listeners, event) => {
      listeners.forEach((fn) => this.socket!.on(event, fn));
    });
  }

  private _enqueue(event: string, args: unknown[]): void {
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      this.messageQueue.shift(); // 丢弃最旧的消息（FIFO）
    }
    this.messageQueue.push({ event, args, timestamp: Date.now() });
  }

  private _flushQueue(): void {
    if (!this.socket?.connected || this.messageQueue.length === 0) return;
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    queue.forEach(({ event, args }) => {
      this.socket!.emit(event, ...args);
    });
  }

  private _startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) return;
    this._stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (!this.socket?.connected) return;

      this.socket.emit("ping");

      this.heartbeatTimeoutTimer = setTimeout(() => {
        console.warn("[SocketClient] 心跳超时，主动重连");
        this.socket?.disconnect();
        this.socket?.connect();
      }, this.config.heartbeatTimeout);
    }, this.config.heartbeatInterval);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }
}

// ─── 工厂函数（单例模式） ────────────────────────────────────────────────────

const instances = new Map<string, SocketClient<DefaultEventMap>>();

/**
 * 创建或获取命名的 SocketClient 单例
 * @param name    实例名称（同名复用同一实例）
 * @param config  配置项（仅首次创建时生效）
 *
 * 注意：同一个 name 必须在所有调用点使用相同的事件映射类型。
 */
export function createSocketClient<T extends EventMap = DefaultEventMap>(
  name: string,
  config: SocketConfig
): SocketClient<T> {
  if (!instances.has(name)) {
    instances.set(name, new SocketClient<DefaultEventMap>(config));
  }
  return instances.get(name) as SocketClient<T>;
}

/** 销毁指定名称的 SocketClient 单例 */
export function destroySocketClient(name: string): void {
  const instance = instances.get(name);
  if (instance) {
    instance.disconnect();
    instances.delete(name);
  }
}
