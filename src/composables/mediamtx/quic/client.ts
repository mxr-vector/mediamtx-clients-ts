/**
 * MediaMTX QUIC/MoQ 接收器客户端
 *
 * 基于 MediaMTX v1.19.0 的浏览器 MoQ reader：HTTPS2 提供 fingerprint，
 * HTTPS3/UDP 通过 WebTransport 连接 /{path}/moq，媒体使用 WebCodecs 解码。
 *
 * @module mediamtx/quic/client
 */

import { buildMediaMtxQuicFingerprintUrl, buildMediaMtxQuicMoqUrl, getMediaMtxQuicConfig } from "./config";
import { MediaMTXMoQReader } from "./reader";
import type { MediaMtxQuicReceiverOptions, MediaMtxReceiverStatus } from "./types";

/**
 * MediaMTX QUIC/MoQ 接收器配置接口
 *
 * 扩展自 {@link MediaMtxQuicReceiverOptions}，增加 `videoElement` 字段。
 * 注意：QUIC/MoQ 接收器的 `videoElement` 是一个容器 `HTMLElement`（非 `<video>`），
 * MoQ reader 会在容器内创建 `<canvas>` 并使用 WebGL2/2D 渲染解码后的视频帧。
 *
 * @interface MediaMtxQuicReceiverConfig
 * @extends MediaMtxQuicReceiverOptions
 * @property videoElement - 用于渲染视频 canvas 的容器元素
 */
export interface MediaMtxQuicReceiverConfig extends MediaMtxQuicReceiverOptions {
  videoElement: HTMLElement;
}

interface BrowserWithQuicApis extends Window {
  WebTransport?: unknown;
  VideoDecoder?: unknown;
  AudioDecoder?: unknown;
}

/**
 * 检测浏览器是否支持 QUIC/MoQ 所需的 API
 *
 * MoQ 读流依赖以下浏览器 API：
 * - `WebTransport`：用于 QUIC 连接和数据传输
 * - `VideoDecoder`（WebCodecs）：用于视频帧解码
 * - `AudioDecoder`（WebCodecs）：用于音频帧解码
 *
 * @throws 如果浏览器不支持任一必需 API
 */
function assertQuicBrowserSupport(): void {
  const browser = window as BrowserWithQuicApis;
  if (!browser.WebTransport) throw new Error("MediaMTX MoQ requires browser WebTransport support");
  if (!browser.VideoDecoder) throw new Error("MediaMTX MoQ requires browser WebCodecs VideoDecoder support");
  if (!browser.AudioDecoder) throw new Error("MediaMTX MoQ requires browser WebCodecs AudioDecoder support");
}

/**
 * MediaMTX QUIC/MoQ 接收器类
 *
 * 封装 MediaMTX v1.19.0 的 MoQ（Media over QUIC）浏览器读流功能。
 * 与 WebRTC 接收器不同，QUIC 接收器通过 WebTransport 连接服务端，
 * 使用 WebCodecs API 解码音视频，并渲染到容器内的 `<canvas>` 元素。
 *
 * 主要职责：
 * - 检查浏览器 QUIC/WebCodecs API 支持
 * - 构建 fingerprint 和 MoQ endpoint URL
 * - 创建并管理 {@link MediaMTXMoQReader} 实例
 * - 维护连接状态并触发生命周期回调
 *
 * 连接流程：
 * 1. 检测浏览器 API 支持（WebTransport、VideoDecoder、AudioDecoder）
 * 2. 获取服务端自签证书 fingerprint（用于 WebTransport 安全连接）
 * 3. 通过 WebTransport 连接 `/{path}/moq`
 * 4. 执行 MoQT SETUP 握手
 * 5. 订阅 catalog 获取轨道信息
 * 6. 订阅视频/音频轨道并使用 WebCodecs 解码渲染
 *
 * @class MediaMtxQuicReceiver
 */
export class MediaMtxQuicReceiver {
  /** 当前 MoQ reader 实例，每次连接创建新的 reader */
  private reader: MediaMTXMoQReader | null = null;
  /** 当前连接状态 */
  private status: MediaMtxReceiverStatus = "idle";
  /** 合并后的配置（包含默认值） */
  private readonly config: MediaMtxQuicReceiverConfig;

  constructor(config: MediaMtxQuicReceiverConfig) {
    this.config = config;
  }

  /**
   * 启动 QUIC/MoQ 读流
   *
   * 执行流程：
   * 1. 停止之前的连接（如果是重连）
   * 2. 检测浏览器 WebTransport/WebCodecs 支持
   * 3. 构建 fingerprint URL 和 MoQ endpoint URL
   * 4. 创建 {@link MediaMTXMoQReader} 实例并自动开始连接
   *
   * reader 内部会自动完成：fingerprint 获取 → WebTransport 连接 →
   * MoQT SETUP → catalog 订阅 → 轨道订阅 → 数据流解码渲染。
   *
   * @returns Promise，创建 reader 后解析（reader 异步连接）
   * @throws 浏览器不支持必需 API 时抛出错误
   */
  async start(): Promise<void> {
    this.stop("restart");
    assertQuicBrowserSupport();

    this._setStatus("preparing");

    const runtimeConfig = getMediaMtxQuicConfig(this.config.config);
    const fingerprintUrl = buildMediaMtxQuicFingerprintUrl(this.config);
    const url = buildMediaMtxQuicMoqUrl(this.config);

    this._setStatus("connecting");
    this.reader = new MediaMTXMoQReader({
      fingerprintUrl,
      url,
      user: this.config.user,
      pass: this.config.pass,
      token: this.config.token,
      videoElement: this.config.videoElement,
      enableAudio: this.config.enableAudio ?? runtimeConfig.enableAudio,
      maxVideoFps: this.config.maxVideoFps ?? runtimeConfig.maxVideoFps,
      maxRenderWidth: this.config.maxRenderWidth ?? runtimeConfig.maxRenderWidth,
      maxRenderHeight: this.config.maxRenderHeight ?? runtimeConfig.maxRenderHeight,
      maxVideoDecodeQueueSize: this.config.maxVideoDecodeQueueSize ?? runtimeConfig.maxVideoDecodeQueueSize,
      debug: this.config.debug ?? runtimeConfig.debug,
      onError: (message: string) => {
        if (message.includes("retrying in")) {
          this._setStatus("disconnected");
          this.config.onDisconnected?.(message);
        }
        this.config.onError?.(new Error(message));
      },
      onSubscribed: (hasAudio: boolean) => {
        this._setStatus("connected");
        this.config.onConnected?.({ hasAudio });
      },
      onAudioMuted: (muted: boolean) => {
        this.config.onAudioMuted?.(muted);
      },
    });
  }

  /**
   * 停止 QUIC/MoQ 读流
   *
   * 销毁当前 reader 实例，清理 WebTransport 连接、WebCodecs 解码器、
   * canvas 和 AudioContext 等资源。
   *
   * @param reason - 停止原因，`"restart"` 表示重启前的停止，其他值表示最终关闭
   */
  stop(reason = "closed"): void {
    this.reader?.destroy();
    this.reader = null;
    this.config.onDisconnected?.(reason);
    this._setStatus(reason === "restart" ? "idle" : "closed");
  }

  /**
   * 用户手势触发的音频解静音
   *
   * 浏览器 autoplay 策略可能阻止音频自动播放，导致 AudioContext 处于 `suspended` 状态。
   * 此方法需要在用户交互（如点击按钮）事件处理函数中调用，以恢复 AudioContext。
   */
  unmute(): void {
    this.reader?.unmute();
  }

  /**
   * 获取当前连接状态
   *
   * @returns 当前 {@link MediaMtxReceiverStatus} 状态值
   */
  getStatus(): MediaMtxReceiverStatus {
    return this.status;
  }

  private _setStatus(status: MediaMtxReceiverStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.config.onStatusChange?.(status);
  }
}
