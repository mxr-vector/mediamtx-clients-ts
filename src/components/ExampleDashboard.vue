<script lang="ts" setup>
import { computed } from "vue";
import {
  buildMediaMtxWhepUrl,
  getMediaMtxConfig,
  useMediaMtxReceivers,
  type MediaMtxStreamConfig,
} from "../composables/mediamtx";

const mediaMtxConfig = getMediaMtxConfig();

const cameraConfigs: MediaMtxStreamConfig[] = mediaMtxConfig.streamPaths.map((path, index) => ({
  id: path,
  path,
  label: `CAM-${String(index + 1).padStart(2, "0")} ${path}`,
}));

const { entries, attach, restart } = useMediaMtxReceivers(cameraConfigs);

const endpointPreviews = computed(() =>
  cameraConfigs.map((camera) => ({
    id: camera.id ?? camera.path,
    label: camera.label ?? camera.path,
    endpoint: buildMediaMtxWhepUrl({ path: camera.path }),
  }))
);
const entriesList = computed(() => Array.from(entries.value.values()));

const attached = new Set<string>();
function onVideoMounted(id: string, el: HTMLVideoElement | null) {
  if (el && !attached.has(id)) {
    attached.add(id);
    attach(id, el);
  }
}
</script>

<template>
  <main class="dashboard">
    <section class="hero">
      <div>
        <p class="eyebrow">MediaMTX WebRTC Receiver</p>
        <h1>RTSP 实时视频监控测试端</h1>
        <p class="description">
          通过 MediaMTX 的 WebRTC/WHEP 读流接口接收 RTSP 转 WebRTC 视频，不依赖自建 WebSocket 信令服务器。
        </p>
      </div>

      <dl class="config-panel">
        <div>
          <dt>WHEP Endpoints</dt>
          <dd>
            <div v-for="item in endpointPreviews" :key="item.id">
              {{ item.label }}: {{ item.endpoint }}
            </div>
          </dd>
        </div>
      </dl>
    </section>

    <section class="video-grid">
      <article v-for="entry in entriesList" :key="entry.id" class="video-card">
        <video
          :ref="(el) => onVideoMounted(entry.id, el as HTMLVideoElement | null)"
          autoplay
          muted
          playsinline
          webkit-playsinline
          class="video-el"
        />

        <div class="video-overlay">
          <div>
            <strong>{{ entry.label }}</strong>
            <span>path: {{ entry.path }}</span>
          </div>
          <span class="rtc-badge" :class="entry.status">{{ entry.status }}</span>
        </div>

        <p v-if="entry.error" class="error-message">{{ entry.error.message }}</p>
        <button class="btn-restart" type="button" @click="restart(entry.id)">↺ 重连</button>
      </article>
    </section>
  </main>
</template>

<style scoped>
.dashboard {
  min-height: 100vh;
  padding: 24px;
  color: #e6edf3;
  background: #0d1117;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
  gap: 24px;
  align-items: stretch;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #58a6ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 12px;
  font-size: clamp(28px, 5vw, 48px);
}

.description {
  max-width: 760px;
  margin: 0;
  color: #8b949e;
  line-height: 1.7;
}

.config-panel {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 16px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
}

.config-panel div {
  min-width: 0;
}

.config-panel dt {
  color: #8b949e;
  font-size: 12px;
  margin-bottom: 4px;
}

.config-panel dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 13px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.video-card {
  position: relative;
  min-height: 240px;
  overflow: hidden;
  background: #010409;
  border: 1px solid #30363d;
  border-radius: 12px;
  aspect-ratio: 16 / 9;
}

.video-el {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.video-overlay {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.72), transparent);
}

.video-overlay strong,
.video-overlay span {
  display: block;
}

.video-overlay span {
  color: #8b949e;
  font-size: 12px;
}

.rtc-badge {
  align-self: flex-start;
  padding: 3px 8px;
  color: #8b949e;
  background: #21262d;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.rtc-badge.connected {
  color: #3fb950;
  background: #12351f;
}

.rtc-badge.signaling,
.rtc-badge.connecting,
.rtc-badge.preparing {
  color: #d29922;
  background: #3d2c00;
}

.rtc-badge.failed,
.rtc-badge.disconnected {
  color: #f85149;
  background: #3d0d0d;
}

.error-message {
  position: absolute;
  right: 12px;
  bottom: 44px;
  left: 12px;
  margin: 0;
  padding: 8px;
  color: #ffdcd7;
  background: rgba(63, 13, 13, 0.84);
  border: 1px solid rgba(248, 81, 73, 0.45);
  border-radius: 6px;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.btn-restart {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 6px 12px;
  color: #e6edf3;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #30363d;
  border-radius: 6px;
  cursor: pointer;
}

.btn-restart:hover {
  background: rgba(255, 255, 255, 0.16);
}

@media (max-width: 820px) {
  .dashboard {
    padding: 16px;
  }

  .hero {
    grid-template-columns: 1fr;
  }
}
</style>
