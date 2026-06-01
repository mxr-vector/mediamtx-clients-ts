import { onUnmounted, readonly, ref, shallowRef, triggerRef, type Ref } from "vue";
import { getMediaMtxConfig } from "./config";
import { MediaMtxWhepReceiver } from "./client";
import type { MediaMtxReceiverEntry, MediaMtxReceiverOptions, MediaMtxStreamConfig } from "./types";

export interface UseMediaMtxReceiversReturn {
  entries: Readonly<Ref<Map<string, MediaMtxReceiverEntry>>>;
  attach: (id: string, el: HTMLVideoElement) => Promise<void>;
  detach: (id: string) => void;
  detachAll: () => void;
  restart: (id: string) => Promise<void>;
}

function normalizeStreams(streams?: MediaMtxStreamConfig[]): Required<Pick<MediaMtxStreamConfig, "id" | "label" | "path">>[] {
  const config = getMediaMtxConfig();
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

export function useMediaMtxReceivers(
  streams?: MediaMtxStreamConfig[],
  sharedOptions: Omit<MediaMtxReceiverOptions, "path" | "endpointUrl"> = {}
): UseMediaMtxReceiversReturn {
  const normalized = normalizeStreams(streams);
  const configById = new Map(normalized.map((item) => [item.id, item]));
  const streamOptionsById = new Map((streams ?? []).map((item) => [item.id ?? item.path ?? "", item]));
  const receivers = new Map<string, MediaMtxWhepReceiver>();
  const videoEls = new Map<string, HTMLVideoElement>();

  const entries = shallowRef<Map<string, MediaMtxReceiverEntry>>(new Map());
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

  const updateEntry = (id: string, patch: Partial<MediaMtxReceiverEntry>) => {
    const entry = entries.value.get(id);
    if (!entry) return;
    entries.value.set(id, { ...entry, ...patch });
    triggerRef(entries);
  };

  const createReceiver = (id: string, el: HTMLVideoElement) => {
    const baseConfig = configById.get(id);
    if (!baseConfig) throw new Error(`MediaMTX stream config not found: ${id}`);
    const streamOptions = streamOptionsById.get(id) ?? streamOptionsById.get(baseConfig.path) ?? {};

    return new MediaMtxWhepReceiver({
      ...sharedOptions,
      ...streamOptions,
      path: baseConfig.path,
      videoElement: el,
      onStatusChange(status) {
        updateEntry(id, { status });
        streamOptions.onStatusChange?.(status);
        sharedOptions.onStatusChange?.(status);
      },
      onConnected(stream) {
        updateEntry(id, { stream, error: null });
        streamOptions.onConnected?.(stream);
        sharedOptions.onConnected?.(stream);
      },
      onDisconnected(reason) {
        updateEntry(id, { stream: null });
        streamOptions.onDisconnected?.(reason);
        sharedOptions.onDisconnected?.(reason);
      },
      onError(error) {
        updateEntry(id, { error, status: "failed" });
        streamOptions.onError?.(error);
        sharedOptions.onError?.(error);
      },
    });
  };

  const attach = async (id: string, el: HTMLVideoElement) => {
    videoEls.set(id, el);
    receivers.get(id)?.stop("restart");

    const receiver = createReceiver(id, el);
    receivers.set(id, receiver);
    await receiver.start().catch(() => undefined);
  };

  const detach = (id: string) => {
    receivers.get(id)?.stop();
    receivers.delete(id);
    videoEls.delete(id);
    updateEntry(id, { status: "closed", stream: null });
  };

  const detachAll = () => {
    receivers.forEach((receiver) => receiver.stop());
    receivers.clear();
    videoEls.clear();
    entries.value.forEach((_, id) => updateEntry(id, { status: "closed", stream: null }));
  };

  const restart = async (id: string) => {
    const el = videoEls.get(id);
    if (!el) return;
    await attach(id, el);
  };

  onUnmounted(detachAll);

  return {
    entries: readonly(entries) as Readonly<Ref<Map<string, MediaMtxReceiverEntry>>>,
    attach,
    detach,
    detachAll,
    restart,
  };
}
