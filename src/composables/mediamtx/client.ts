import { buildMediaMtxWhepUrl, getMediaMtxConfig } from "./config";
import type { MediaMtxReceiverOptions, MediaMtxReceiverStatus } from "./types";

export interface MediaMtxWhepReceiverConfig extends MediaMtxReceiverOptions {
  videoElement: HTMLVideoElement;
}

export class MediaMtxWhepReceiver {
  private pc: RTCPeerConnection | null = null;
  private abortController: AbortController | null = null;
  private status: MediaMtxReceiverStatus = "idle";
  private remoteStream: MediaStream | null = null;
  private readonly config: Required<Pick<MediaMtxWhepReceiverConfig, "autoplay" | "muted">> &
    MediaMtxWhepReceiverConfig;

  constructor(config: MediaMtxWhepReceiverConfig) {
    this.config = {
      autoplay: true,
      muted: true,
      ...config,
    };
  }

  async start(): Promise<void> {
    this.stop("restart");
    this._setStatus("preparing");

    const envConfig = getMediaMtxConfig(this.config.config);
    const endpointUrl = buildMediaMtxWhepUrl(this.config);
    const rtcConfig = this.config.rtcConfig ?? { iceServers: envConfig.iceServers };
    const pc = new RTCPeerConnection(rtcConfig);

    this.pc = pc;
    this.remoteStream = new MediaStream();
    this.abortController = new AbortController();

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? this.remoteStream;
      if (!event.streams[0] && this.remoteStream) {
        this.remoteStream.addTrack(event.track);
      }
      this._attachStream(stream);
      this._setStatus("connected");
      this.config.onConnected?.(stream);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") this._setStatus("connected");
      if (state === "disconnected") {
        this._setStatus("disconnected");
        this.config.onDisconnected?.("ICE disconnected");
      }
      if (state === "failed") this._fail(new Error("WebRTC ICE connection failed"));
    };

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
      this._setStatus("signaling");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this._waitForIceGathering(pc);

      const localDescription = pc.localDescription;
      if (!localDescription?.sdp) {
        throw new Error("WebRTC local SDP offer is empty");
      }

      const answerSdp = await this._postOffer(endpointUrl, localDescription.sdp, envConfig.requestTimeoutMs);
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      this._setStatus("connecting");
    } catch (error) {
      this._fail(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  stop(reason = "closed"): void {
    this.abortController?.abort();
    this.abortController = null;

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onconnectionstatechange = null;
      this.pc.getTransceivers().forEach((transceiver) => {
        try {
          transceiver.stop();
        } catch (_) {}
      });
      this.pc.close();
      this.pc = null;
    }

    this.remoteStream?.getTracks().forEach((track) => track.stop());
    this.remoteStream = null;

    const video = this.config.videoElement;
    if (video.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }

    this.config.onDisconnected?.(reason);
    this._setStatus(reason === "restart" ? "idle" : "closed");
  }

  getStatus(): MediaMtxReceiverStatus {
    return this.status;
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  private async _postOffer(url: string, sdp: string, timeoutMs: number): Promise<string> {
    const timeout = window.setTimeout(() => this.abortController?.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Accept: "application/sdp",
        },
        body: sdp,
        signal: this.abortController?.signal,
      });

      const body = await response.text();
      if (!response.ok) {
        throw new Error(`MediaMTX WHEP request failed: ${response.status} ${response.statusText} ${body}`.trim());
      }
      if (!body.trim()) {
        throw new Error("MediaMTX WHEP response did not contain an SDP answer");
      }
      return body;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`MediaMTX WHEP request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async _waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === "complete") return;

    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(done, 1500);
      function done() {
        window.clearTimeout(timeout);
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }
      function onStateChange() {
        if (pc.iceGatheringState === "complete") done();
      }
      pc.addEventListener("icegatheringstatechange", onStateChange);
    });
  }

  private _attachStream(stream: MediaStream): void {
    const video = this.config.videoElement;
    if (video.srcObject !== stream) video.srcObject = stream;
    video.muted = this.config.muted;
    video.autoplay = this.config.autoplay;
    video.playsInline = true;

    if (this.config.autoplay) {
      video.play().catch((error) => {
        this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      });
    }
  }

  private _fail(error: Error): void {
    this._setStatus("failed");
    this.config.onError?.(error);
  }

  private _setStatus(status: MediaMtxReceiverStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.config.onStatusChange?.(status);
  }
}
