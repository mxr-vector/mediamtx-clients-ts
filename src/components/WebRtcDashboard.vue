/**
 * MediaMTX WebRTC/WHEP 仪表板组件
 *
 * 本组件负责 WebRTC/WHEP 协议下的多路视频接收、视频元素绑定和重连。
 * 父组件切换协议导致本组件卸载时，useMediaMtxReceivers 会自动清理连接。
 *
 * @component WebRtcDashboard
 */

<script lang="ts" setup>
import { computed } from "vue";
import {
  buildMediaMtxWhepUrl,
  getMediaMtxConfig,
  useMediaMtxReceivers,
  type MediaMtxStreamConfig,
} from "../composables/mediamtx/webrtc";

const mediaMtxConfig = getMediaMtxConfig();

const cameraConfigs: MediaMtxStreamConfig[] = mediaMtxConfig.streamPaths.map((path, index) => ({
  id: path,
  path,
  label: `CAM-${String(index + 1).padStart(2, "0")} ${path}`,
}));

const { entries, attach, restart } = useMediaMtxReceivers(cameraConfigs, {
  autoplay: true,
  muted: true,
});

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

async function restartVideo(id: string) {
  await restart(id);
}
</script>

<template>
  <section class="config-panel">
    <div>
      <dt>WHEP Endpoints</dt>
      <dd>
        <div v-for="item in endpointPreviews" :key="item.id">
          {{ item.label }}: {{ item.endpoint }}
        </div>
      </dd>
    </div>
  </section>

  <section class="video-grid">
    <article v-for="entry in entriesList" :key="entry.id" class="video-card">
      <video
        :id="`video-${entry.id}`"
        :ref="(el) => onVideoMounted(entry.id, el as HTMLVideoElement | null)"
        preload="auto"
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

      <button class="btn-restart" type="button" @click="restartVideo(entry.id)">↺ 重连</button>
    </article>
  </section>
</template>

<style scoped>
/* 配置信息面板样式 */
.config-panel {
  display: grid;
  gap: 12px;
  margin: 0 0 24px;
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

/* 视频网格布局 */
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

/* 视频卡片样式 */
.video-card {
  position: relative;
  min-height: 240px;
  overflow: hidden;
  background: #010409;
  border: 1px solid #30363d;
  border-radius: 12px;
  aspect-ratio: 16 / 9;
}

/* 视频元素样式 */
.video-el {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

/* 视频覆盖层样式 */
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

/* 连接状态徽章基础样式 */
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

/* 已连接状态样式 */
.rtc-badge.connected {
  color: #3fb950;
  background: #12351f;
}

/* 连接中状态样式 */
.rtc-badge.signaling,
.rtc-badge.connecting,
.rtc-badge.preparing {
  color: #d29922;
  background: #3d2c00;
}

/* 失败状态样式 */
.rtc-badge.failed,
.rtc-badge.disconnected {
  color: #f85149;
  background: #3d0d0d;
}

/* 错误信息样式 */
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

/* 重连按钮样式 */
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
</style>
