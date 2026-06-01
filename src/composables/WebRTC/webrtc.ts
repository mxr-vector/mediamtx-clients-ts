/**
 * webrtc.ts
 * 基于 WebRTC API + Socket.io 信令的 TypeScript 客户端封装
 * 支持：SDP Offer/Answer、ICE Candidate、媒体流管理、指数退避重连、心跳
 */

import type { EventMap, SocketClient } from "./socket";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

/** WebRTC 连接状态 */
export type RTCStatus =
  | "idle" // 初始
  | "signaling" // 信令交换中
  | "connecting" // ICE 连接建立中
  | "connected" // 已连接，流媒体传输中
  | "reconnecting" // 重连中
  | "disconnected" // 已断开
  | "failed" // 连接失败
  | "closed"; // 已关闭

/** 媒体流类型 */
export type StreamKind = "video" | "audio" | "both";

/** WebRTC 信令消息 */
export interface SignalingMessage {
  type: "offer" | "answer" | "ice_candidate" | "request_stream" | "ping" | "pong" | "bye";
  sdp?: string;
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  task_id?: string;
  [key: string]: unknown;
}

/** WebRTC 播放器配置 */
export interface WebRTCConfig {
  /** 视频渲染的 HTMLVideoElement */
  videoElement: HTMLVideoElement;
  /**
   * 信令通道：提供 send 方法发送消息、onMessage 注册消息回调
   * 可以是封装好的 SocketClient，也可以是原生 WebSocket 适配器
   */
  signaling: SignalingChannel;
  /** 用于标识视频流的任务 ID */
  taskId: string;
  /** ICE/STUN/TURN 配置，默认使用 Google 公共 STUN */
  rtcConfig?: RTCConfiguration;
  /** 最大重连次数，默认 20 */
  maxRetry?: number;
  /** 心跳间隔（ms），默认 15000，0 关闭 */
  heartbeatInterval?: number;
  /** 媒体流类型，默认 'both' */
  streamKind?: StreamKind;
  /** 连接成功回调 */
  onConnected?: (stream: MediaStream) => void;
  /** 连接断开回调 */
  onDisconnected?: (reason: string) => void;
  /** 状态变化回调 */
  onStatusChange?: (status: RTCStatus) => void;
  /** 错误回调 */
  onError?: (err: Error) => void;
}

/** 信令通道抽象接口（解耦传输层） */
export interface SignalingChannel {
  /** 发送信令消息 */
  send(msg: SignalingMessage): void;
  /** 注册接收消息的回调，返回取消函数 */
  onMessage(handler: (msg: SignalingMessage) => void): () => void;
  /** 是否已就绪（可发送消息） */
  isReady(): boolean;
}

// ─── Socket.io 信令适配器 ────────────────────────────────────────────────────

/**
 * 将 SocketClient 适配为 SignalingChannel
 * @param client  SocketClient 实例
 * @param inEvent  服务器→客户端的事件名，默认 'webrtc_signal'
 * @param outEvent 客户端→服务器的事件名，默认 'webrtc_signal'
 */
export function createSocketSignaling<TEvents extends EventMap>(
  client: SocketClient<TEvents>,
  inEvent = "webrtc_signal",
  outEvent = "webrtc_signal"
): SignalingChannel {
  return {
    send(msg) {
      client.emit(outEvent, msg);
    },
    onMessage(handler) {
      client.on(inEvent, handler as (data: unknown) => void);
      return () => client.off(inEvent, handler as (data: unknown) => void);
    },
    isReady() {
      return client.isConnected();
    },
  };
}

/**
 * 将原生 WebSocket 适配为 SignalingChannel
 * @param url  WebSocket 服务器地址
 */
export function createNativeWsSignaling(url: string): SignalingChannel & { close(): void } {
  let ws: WebSocket | null = null;
  const handlers: Set<(msg: SignalingMessage) => void> = new Set();
  let ready = false;

  const connect = () => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      ready = true;
    };
    ws.onclose = () => {
      ready = false;
    };
    ws.onmessage = (e) => {
      try {
        const msg: SignalingMessage = JSON.parse(e.data);
        handlers.forEach((h) => h(msg));
      } catch (_) {}
    };
  };

  connect();

  return {
    send(msg) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    },
    onMessage(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    isReady() {
      return ready;
    },
    close() {
      ready = false;
      handlers.clear();
      if (ws) {
        ws.onopen = null;
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
      }
      ws?.close();
      ws = null;
    },
  };
}

// ─── WebRTCPlayer 核心类 ─────────────────────────────────────────────────────

export class WebRTCPlayer {
  private pc: RTCPeerConnection | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private status: RTCStatus = "idle";

  private retryCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private signalingOff: (() => void) | null = null;

  private readonly config: Required<WebRTCConfig>;
  private readonly defaultRtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  constructor(config: WebRTCConfig) {
    this.config = {
      rtcConfig: this.defaultRtcConfig,
      maxRetry: 20,
      heartbeatInterval: 15_000,
      streamKind: "both",
      onConnected: () => {},
      onDisconnected: () => {},
      onStatusChange: () => {},
      onError: () => {},
      ...config,
    };
  }

  // ── 公共 API ────────────────────────────────────────────────────────────────

  /** 启动播放 */
  start(): void {
    this.retryCount = 0;
    this._register();
    this._requestStream();
  }

  /** 停止播放，释放所有资源 */
  stop(): void {
    this._clearReconnect();
    this._stopHeartbeat();
    this._unregister();
    this._closePeer();
    this._setStatus("closed");
  }

  /** 获取当前状态 */
  getStatus(): RTCStatus {
    return this.status;
  }

  /** 获取当前 RTCPeerConnection 实例（调试用） */
  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  // ── 信令注册 ────────────────────────────────────────────────────────────────

  private _register(): void {
    this._unregister();
    this.signalingOff = this.config.signaling.onMessage((msg) => {
      this._handleSignaling(msg).catch((e) => {
        console.error("[WebRTCPlayer] 信令处理错误:", e);
        this.config.onError?.(e as Error);
      });
    });
  }

  private _unregister(): void {
    this.signalingOff?.();
    this.signalingOff = null;
  }

  private _requestStream(): void {
    this._setStatus("signaling");
    this.config.signaling.send({
      type: "request_stream",
      task_id: this.config.taskId,
    });
  }

  // ── 信令处理 ────────────────────────────────────────────────────────────────

  private async _handleSignaling(msg: SignalingMessage): Promise<void> {
    if (!this._isMessageForCurrentTask(msg)) return;

    switch (msg.type) {
      case "offer":
        await this._handleOffer(msg);
        break;
      case "ice_candidate":
        await this._handleIceCandidate(msg);
        break;
      case "pong":
        // 心跳响应，无需处理
        break;
      case "bye":
        this._scheduleReconnect("服务端主动关闭");
        break;
    }
  }

  private _isMessageForCurrentTask(msg: SignalingMessage): boolean {
    return msg.task_id === undefined || msg.task_id === this.config.taskId;
  }

  /** 处理服务端 Offer */
  private async _handleOffer(msg: SignalingMessage): Promise<void> {
    if (!msg.sdp) return;

    try {
      this._createPeer();
      const pc = this.pc!;

      await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.config.signaling.send({
        type: "answer",
        sdp: answer.sdp ?? "",
        task_id: this.config.taskId,
      });

      // 补发暂存的 ICE 候选
      while (this.pendingCandidates.length > 0) {
        const c = this.pendingCandidates.shift()!;
        await this._addIceCandidate(c);
      }
    } catch (e) {
      this._closePeer();
      throw e;
    }
  }

  /** 处理 ICE Candidate */
  private async _handleIceCandidate(msg: SignalingMessage): Promise<void> {
    if (!msg.candidate) return;

    const candidate: RTCIceCandidateInit = {
      candidate: msg.candidate,
      sdpMid: msg.sdpMid ?? null,
      sdpMLineIndex: msg.sdpMLineIndex ?? null,
    };

    if (this.pc?.remoteDescription) {
      await this._addIceCandidate(candidate);
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  private async _addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.pc?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("[WebRTCPlayer] 添加 ICE 候选失败:", e);
    }
  }

  // ── PeerConnection 管理 ─────────────────────────────────────────────────────

  private _createPeer(): void {
    this._closePeer();

    const pc = new RTCPeerConnection(this.config.rtcConfig);
    this.pc = pc;

    this._setStatus("connecting");

    // 收到远端媒体流
    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;

      const videoEl = this.config.videoElement;
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }

      videoEl.play().catch(() => {
        // 自动播放被阻止时静音重试（浏览器策略）
        videoEl.muted = true;
        videoEl.play().catch(console.error);
      });

      this._setStatus("connected");
      this._startHeartbeat();
      this.retryCount = 0;
      this.config.onConnected?.(stream);

      stream.getTracks().forEach((track) => {
        track.onended = () => this._scheduleReconnect("媒体轨道结束");
      });
    };

    // 发送本地 ICE 候选给服务端
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      this.config.signaling.send({
        type: "ice_candidate",
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        task_id: this.config.taskId,
      });
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.debug(`[WebRTCPlayer:${this.config.taskId}] ICE状态: ${state}`);
      if (state === "failed" || state === "disconnected") {
        this._scheduleReconnect(`ICE 状态: ${state}`);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.debug(`[WebRTCPlayer:${this.config.taskId}] 连接状态: ${state}`);
      if (state === "failed" || state === "disconnected") {
        this._scheduleReconnect(`连接状态: ${state}`);
      }
    };

    pc.onsignalingstatechange = () => {
      console.debug(`[WebRTCPlayer:${this.config.taskId}] 信令状态: ${pc.signalingState}`);
    };
  }

  private _closePeer(): void {
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onconnectionstatechange = null;
      this.pc.onsignalingstatechange = null;
      try {
        this.pc.close();
      } catch (_) {}
      this.pc = null;
    }
    this.pendingCandidates = [];

    const videoEl = this.config.videoElement;
    if (videoEl.srcObject) {
      (videoEl.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoEl.srcObject = null;
    }
  }

  // ── 重连策略（指数退避） ─────────────────────────────────────────────────────

  private _scheduleReconnect(reason: string): void {
    if (this.reconnectTimer) return;
    if (this.retryCount >= this.config.maxRetry) {
      console.error(`[WebRTCPlayer:${this.config.taskId}] 达到最大重连次数，停止重连`);
      this._setStatus("failed");
      this.config.onError?.(new Error("WebRTC 达到最大重连次数"));
      return;
    }

    this._stopHeartbeat();
    this._setStatus("reconnecting");

    // 指数退避：1s → 2s → 4s → … 最大 30s
    const delay = Math.min(30_000, 1_000 * Math.pow(2, this.retryCount));
    this.retryCount++;

    console.warn(
      `[WebRTCPlayer:${this.config.taskId}] 第 ${this.retryCount} 次重连，${delay}ms 后重试，原因: ${reason}`
    );

    this.config.onDisconnected?.(reason);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._closePeer();
      this._requestStream();
    }, delay);
  }

  private _clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── 心跳 ────────────────────────────────────────────────────────────────────

  private _startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) return;
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.config.signaling.send({ type: "ping", task_id: this.config.taskId });
    }, this.config.heartbeatInterval);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── 状态 ────────────────────────────────────────────────────────────────────

  private _setStatus(status: RTCStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.config.onStatusChange?.(status);
  }
}

// ─── 工厂函数 ────────────────────────────────────────────────────────────────

/** 快速创建一个 WebRTCPlayer 并立即启动 */
export function createWebRTCPlayer(config: WebRTCConfig): WebRTCPlayer {
  const player = new WebRTCPlayer(config);
  player.start();
  return player;
}
