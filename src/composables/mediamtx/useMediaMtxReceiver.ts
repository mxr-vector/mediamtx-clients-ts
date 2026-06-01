import { onUnmounted, readonly, ref, shallowRef, type Ref, type ShallowRef } from "vue";
import { MediaMtxWhepReceiver } from "./client";
import type { MediaMtxReceiverOptions, MediaMtxReceiverStatus } from "./types";

export interface UseMediaMtxReceiverOptions extends MediaMtxReceiverOptions {
  autoDestroy?: boolean;
}

export interface UseMediaMtxReceiverReturn {
  status: Readonly<Ref<MediaMtxReceiverStatus>>;
  stream: Readonly<ShallowRef<MediaStream | null>>;
  error: Readonly<Ref<Error | null>>;
  receiver: ShallowRef<MediaMtxWhepReceiver | null>;
  peerConnection: Readonly<ShallowRef<RTCPeerConnection | null>>;
  attach: (el: HTMLVideoElement) => Promise<void>;
  detach: () => void;
  restart: () => Promise<void>;
}

export function useMediaMtxReceiver(options: UseMediaMtxReceiverOptions = {}): UseMediaMtxReceiverReturn {
  const { autoDestroy = true, ...receiverOptions } = options;

  const status = ref<MediaMtxReceiverStatus>("idle");
  const stream = shallowRef<MediaStream | null>(null);
  const error = ref<Error | null>(null);
  const receiver = shallowRef<MediaMtxWhepReceiver | null>(null);
  const peerConnection = shallowRef<RTCPeerConnection | null>(null);

  let videoEl: HTMLVideoElement | null = null;

  const createReceiver = () => {
    if (!videoEl) return null;

    const nextReceiver = new MediaMtxWhepReceiver({
      ...receiverOptions,
      videoElement: videoEl,
      onStatusChange(nextStatus) {
        status.value = nextStatus;
        receiverOptions.onStatusChange?.(nextStatus);
      },
      onConnected(nextStream) {
        stream.value = nextStream;
        error.value = null;
        peerConnection.value = nextReceiver.getPeerConnection();
        receiverOptions.onConnected?.(nextStream);
      },
      onDisconnected(reason) {
        if (status.value !== "closed") stream.value = null;
        receiverOptions.onDisconnected?.(reason);
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
    peerConnection.value = nextReceiver.getPeerConnection();

    try {
      await nextReceiver.start();
      peerConnection.value = nextReceiver.getPeerConnection();
    } catch (_) {
      peerConnection.value = nextReceiver.getPeerConnection();
    }
  };

  const attach = async (el: HTMLVideoElement) => {
    videoEl = el;
    await start();
  };

  const detach = () => {
    receiver.value?.stop();
    receiver.value = null;
    peerConnection.value = null;
    stream.value = null;
    status.value = "idle";
    videoEl = null;
  };

  const restart = async () => {
    receiver.value?.stop("restart");
    stream.value = null;
    error.value = null;
    await start();
  };

  onUnmounted(() => {
    if (autoDestroy) detach();
  });

  return {
    status: readonly(status),
    stream: readonly(stream) as Readonly<ShallowRef<MediaStream | null>>,
    error: readonly(error),
    receiver,
    peerConnection: readonly(peerConnection) as Readonly<ShallowRef<RTCPeerConnection | null>>,
    attach,
    detach,
    restart,
  };
}
