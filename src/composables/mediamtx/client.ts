/**
 * MediaMTX WHEP 接收器客户端
 * 
 * 本模块实现了 MediaMTX WebRTC WHEP 接收器的核心功能。
 * WHEP (WebRTC-HTTP Egress Protocol) 是一种用于 WebRTC 媒体流传输的协议，
 * 通过 HTTP 请求实现 WebRTC 信令交换。
 * 
 * 主要功能：
 * 1. 建立 WebRTC 对等连接
 * 2. 通过 WHEP 协议与 MediaMTX 服务器交互
 * 3. 接收远程媒体流并绑定到视频元素
 * 4. 管理连接生命周期和状态
 * 
 * 连接流程：
 * 1. 创建 RTCPeerConnection
 * 2. 添加接收器 transceiver(仅接收)
 * 3. 创建 SDP offer
 * 4. 等待 ICE 候选收集
 * 5. 将 offer 发送到 MediaMTX 服务器
 * 6. 接收 SDP answer 并设置远程描述
 * 7. 建立 ICE 连接并接收媒体流
 * 
 * @module client
 */

import { buildMediaMtxWhepUrl, getMediaMtxConfig } from "./config";
import type { MediaMtxReceiverOptions, MediaMtxReceiverStatus } from "./types";

/**
 * MediaMTX WHEP 接收器配置接口
 * 
 * 扩展自 MediaMtxReceiverOptions，添加了视频元素配置。
 * 
 * @interface MediaMtxWhepReceiverConfig
 * @extends MediaMtxReceiverOptions
 * @property videoElement - 用于显示远程媒体流的 HTML 视频元素
 */
export interface MediaMtxWhepReceiverConfig extends MediaMtxReceiverOptions {
  videoElement: HTMLVideoElement;
}

/**
 * MediaMTX WHEP 接收器类
 * 
 * 实现完整的 WebRTC WHEP 接收器功能。
 * 该类封装了 WebRTC 连接的建立、管理和销毁过程。
 * 
 * 主要职责：
 * - 管理 RTCPeerConnection 生命周期
 * - 处理 WebRTC 信令交换
 * - 接收和绑定远程媒体流
 * - 监控连接状态变化
 * - 错误处理和恢复
 * 
 * @class MediaMtxWhepReceiver
 */
export class MediaMtxWhepReceiver {
  /** WebRTC 对等连接实例 */
  private pc: RTCPeerConnection | null = null;
  /** 用于取消进行中的请求 */
  private abortController: AbortController | null = null;
  /** 当前连接状态 */
  private status: MediaMtxReceiverStatus = "idle";
  /** 远程媒体流 */
  private remoteStream: MediaStream | null = null;
  /** 合并后的配置(包含默认值) */
  private readonly config: Required<Pick<MediaMtxWhepReceiverConfig, "autoplay" | "muted">> &
    MediaMtxWhepReceiverConfig;

  /**
   * 创建 MediaMTX WHEP 接收器实例
   * 
   * @param config - 接收器配置
   */
  constructor(config: MediaMtxWhepReceiverConfig) {
    this.config = {
      autoplay: true,
      muted: true,
      ...config,
    };
  }

  /**
   * 启动 WebRTC 连接
   * 
   * 执行完整的 WebRTC 连接流程：
   * 1. 停止之前的连接(如果有)
   * 2. 创建新的 RTCPeerConnection
   * 3. 设置媒体接收器
   * 4. 执行信令交换
   * 5. 建立 ICE 连接
   * 
   * @returns Promise，连接成功时解析
   * @throws 连接过程中出现的错误
   */
  async start(): Promise<void> {
    // 停止之前的连接（如果是重连）
    this.stop("restart");
    this._setStatus("preparing");

    // 获取配置并创建 WebRTC 连接
    const envConfig = getMediaMtxConfig(this.config.config);
    const endpointUrl = buildMediaMtxWhepUrl(this.config);
    const rtcConfig = this.config.rtcConfig ?? { iceServers: envConfig.iceServers };
    const pc = new RTCPeerConnection(rtcConfig);

    // 初始化实例变量
    this.pc = pc;
    this.remoteStream = new MediaStream();
    this.abortController = new AbortController();

    // 添加视频和音频接收器（仅接收模式）
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    /**
     * 处理远程轨道事件
     * 当接收到远程媒体轨道时触发
     */
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? this.remoteStream;
      // 如果事件没有提供流，则将轨道添加到自定义流
      if (!event.streams[0] && this.remoteStream) {
        this.remoteStream.addTrack(event.track);
      }
      // 绑定流到视频元素并更新状态
      this._attachStream(stream);
      this._setStatus("connected");
      this.config.onConnected?.(stream);
    };

    /**
     * 处理 ICE 连接状态变化
     * 监控 ICE 连接的建立和断开
     */
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") this._setStatus("connected");
      if (state === "disconnected") {
        this._setStatus("disconnected");
        this.config.onDisconnected?.("ICE disconnected");
      }
      if (state === "failed") this._fail(new Error("WebRTC ICE connection failed"));
    };

    /**
     * 处理对等连接状态变化
     * 监控整体连接状态
     */
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") this._setStatus("connected");
      if (state === "disconnected") {
        this._setStatus("disconnected");
        this.config.onDisconnected?.("Peer connection disconnected");
      }
      if (state === "failed") this._fail(new Error("WebRTC peer connection failed"));
      if (state === "closed") this._setStatus("closed");
    };

    try {
      // 开始信令交换
      this._setStatus("signaling");

      // 创建 SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 等待 ICE 候选收集完成
      await this._waitForIceGathering(pc);

      // 验证本地描述
      const localDescription = pc.localDescription;
      if (!localDescription?.sdp) {
        throw new Error("WebRTC local SDP offer is empty");
      }

      // 发送 offer 到 MediaMTX 服务器并获取 answer
      const answerSdp = await this._postOffer(endpointUrl, localDescription.sdp, envConfig.requestTimeoutMs);
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      this._setStatus("connecting");
    } catch (error) {
      // 处理连接错误
      this._fail(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 停止 WebRTC 连接
   * 
   * 清理所有 WebRTC 资源，包括：
   * 1. 取消进行中的请求
   * 2. 关闭对等连接
   * 3. 停止媒体轨道
   * 4. 清理视频元素
   * 
   * @param reason - 停止原因（用于状态回调）
   */
  stop(reason = "closed"): void {
    // 取消进行中的请求
    this.abortController?.abort();
    this.abortController = null;

    // 关闭 WebRTC 连接
    if (this.pc) {
      // 移除事件监听器
      this.pc.ontrack = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onconnectionstatechange = null;

      // 停止所有 transceiver
      this.pc.getTransceivers().forEach((transceiver) => {
        try {
          transceiver.stop();
        } catch (_) { }
      });

      // 关闭连接
      this.pc.close();
      this.pc = null;
    }

    // 停止远程媒体流轨道
    this.remoteStream?.getTracks().forEach((track) => track.stop());
    this.remoteStream = null;

    // 清理视频元素
    const video = this.config.videoElement;
    if (video.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }

    // 触发断开连接回调
    this.config.onDisconnected?.(reason);
    this._setStatus(reason === "restart" ? "idle" : "closed");
  }

  /**
   * 获取当前连接状态
   * 
   * @returns 当前 MediaMTX 接收器状态
   */
  getStatus(): MediaMtxReceiverStatus {
    return this.status;
  }

  /**
   * 获取 WebRTC 对等连接实例
   * 
   * @returns RTCPeerConnection 实例或 null（如果未连接）
   */
  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  /**
   * 发送 SDP offer 到 MediaMTX 服务器
   * 
   * 使用 WHEP 协议通过 HTTP POST 发送 SDP offer。
   * 服务器返回 SDP answer 完成信令交换。
   * 
   * @param url - WHEP 端点 URL
   * @param sdp - SDP offer 内容
   * @param timeoutMs - 请求超时时间（毫秒）
   * @returns SDP answer 内容
   * @throws 请求失败或超时错误
   */
  private async _postOffer(url: string, sdp: string, timeoutMs: number): Promise<string> {
    // 设置请求超时
    const timeout = window.setTimeout(() => this.abortController?.abort(), timeoutMs);

    try {
      // 发送 HTTP POST 请求
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Accept: "application/sdp",
        },
        body: sdp,
        signal: this.abortController?.signal,
      });

      // 处理响应
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`MediaMTX WHEP request failed: ${response.status} ${response.statusText} ${body}`.trim());
      }
      if (!body.trim()) {
        throw new Error("MediaMTX WHEP response did not contain an SDP answer");
      }
      return body;
    } catch (error) {
      // 处理超时错误
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`MediaMTX WHEP request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      // 清除超时定时器
      window.clearTimeout(timeout);
    }
  }

  /**
   * 等待 ICE 候选收集完成
   * 
   * 在发送 offer 之前，需要等待 ICE 候选收集完成。
   * 设置了 1500ms 超时，避免长时间等待。
   * 
   * @param pc - RTCPeerConnection 实例
   * @returns Promise，收集完成时解析
   */
  private async _waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    // 如果已经完成，直接返回
    if (pc.iceGatheringState === "complete") return;

    await new Promise<void>((resolve) => {
      // 设置超时定时器
      const timeout = window.setTimeout(done, 1500);

      /**
       * 完成处理函数
       * 清理事件监听器和定时器
       */
      function done() {
        window.clearTimeout(timeout);
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }

      /**
       * ICE 收集状态变化处理
       * 当收集完成时调用 done
       */
      function onStateChange() {
        if (pc.iceGatheringState === "complete") done();
      }

      // 监听 ICE 收集状态变化
      pc.addEventListener("icegatheringstatechange", onStateChange);
    });
  }

  /**
   * 绑定媒体流到视频元素
   * 
   * 将远程媒体流绑定到配置的视频元素，并设置播放参数。
   * 
   * @param stream - 要绑定的媒体流
   */
  private _attachStream(stream: MediaStream): void {
    const video = this.config.videoElement;
    // 设置媒体流
    if (video.srcObject !== stream) video.srcObject = stream;
    // 设置播放参数
    video.muted = this.config.muted;
    video.autoplay = this.config.autoplay;
    video.playsInline = true;

    // 如果设置了自动播放，尝试播放
    if (this.config.autoplay) {
      video.play().catch((error) => {
        this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      });
    }
  }

  /**
   * 处理连接失败
   * 
   * 设置失败状态并触发错误回调。
   * 
   * @param error - 错误对象
   */
  private _fail(error: Error): void {
    this._setStatus("failed");
    this.config.onError?.(error);
  }

  /**
   * 更新连接状态
   * 
   * 仅在状态实际发生变化时触发回调。
   * 
   * @param status - 新状态
   */
  private _setStatus(status: MediaMtxReceiverStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.config.onStatusChange?.(status);
  }
}
