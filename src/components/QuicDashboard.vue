/**
 * MediaMTX QUIC/MoQ 仪表板组件
 *
 * 本组件负责 QUIC/MoQ 协议下的多路视频接收、容器绑定、重连和音频解静音。
 * QUIC/MoQ 接收器绑定的是普通 HTMLElement，reader 会在容器内部创建 canvas 渲染视频。
 *
 * @component QuicDashboard
 */

<script lang="ts" setup>
import { computed } from "vue";
import {
  buildMediaMtxQuicFingerprintUrl,
  buildMediaMtxQuicMoqUrl,
  buildMediaMtxQuicReadUrl,
  getMediaMtxQuicConfig,
  useMediaMtxQuicReceivers,
  type MediaMtxQuicStreamConfig,
} from "../composables/mediamtx/quic";

interface BrowserWithQuicApis {
  WebTransport?: unknown;
  VideoDecoder?: unknown;
  AudioDecoder?: unknown;
}

interface QuicCompatibility {
  supported: boolean;
  missing: string[];
}

function getQuicCompatibility(): QuicCompatibility {
  if (typeof window === "undefined") {
    return { supported: false, missing: ["浏览器运行环境"] };
  }

  const browser = window as Window & BrowserWithQuicApis;
  const missing: string[] = [];

  if (!window.isSecureContext) missing.push("安全上下文(HTTPS 或 localhost)");
  if (!browser.WebTransport) missing.push("WebTransport");
  if (!browser.VideoDecoder) missing.push("WebCodecs VideoDecoder");
  if (!browser.AudioDecoder) missing.push("WebCodecs AudioDecoder");

  return { supported: missing.length === 0, missing };
}

const mediaMtxConfig = getMediaMtxQuicConfig();

const isLocalPage = typeof window !== "undefined"
  && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const cameraConfigs: MediaMtxQuicStreamConfig[] = mediaMtxConfig.streamPaths.map((path, index) => ({
  id: path,
  path,
  label: `CAM-${String(index + 1).padStart(2, "0")} ${path}`,
}));

const quicCompatibility = getQuicCompatibility();
const { entries, attach, restart, unmute } = useMediaMtxQuicReceivers(cameraConfigs, {
  enableAudio: mediaMtxConfig.enableAudio,
  maxVideoFps: mediaMtxConfig.maxVideoFps,
  maxRenderWidth: mediaMtxConfig.maxRenderWidth,
  maxRenderHeight: mediaMtxConfig.maxRenderHeight,
  maxVideoDecodeQueueSize: mediaMtxConfig.maxVideoDecodeQueueSize,
  debug: mediaMtxConfig.debug,
});

const endpointPreviews = computed(() =>
  cameraConfigs.map((camera) => ({
    id: camera.id ?? camera.path,
    label: camera.label ?? camera.path,
    moqEndpoint: buildMediaMtxQuicMoqUrl({ path: camera.path }),
    fingerprintEndpoint: buildMediaMtxQuicFingerprintUrl({ path: camera.path }),
    readEndpoint: buildMediaMtxQuicReadUrl({ path: camera.path }),
  }))
);

const quicTuningSummary = computed(() => [
  `音频：${mediaMtxConfig.enableAudio ? "开启" : "关闭"}`,
  `帧率上限：${mediaMtxConfig.maxVideoFps > 0 ? `${mediaMtxConfig.maxVideoFps}fps` : "不限"}`,
  `渲染上限：${mediaMtxConfig.maxRenderWidth || "原始"}×${mediaMtxConfig.maxRenderHeight || "原始"}`,
  `解码队列：${mediaMtxConfig.maxVideoDecodeQueueSize}`,
]);

const entriesList = computed(() => Array.from(entries.value.values()));

const attached = new Set<string>();

function onVideoMounted(id: string, el: HTMLElement | null) {
  if (el && quicCompatibility.supported && !attached.has(id)) {
    attached.add(id);
    attach(id, el);
  }
}

async function restartVideo(id: string) {
  if (!quicCompatibility.supported) return;
  await restart(id);
}

function unmuteVideo(id: string) {
  if (!quicCompatibility.supported) return;
  unmute(id);
}
</script>

<template>
  <section class="config-panel">
    <div class="config-block">
      <dt class="config-label">MoQ Endpoints</dt>
      <dd class="config-value">
        <div v-for="item in endpointPreviews" :key="item.id" class="endpoint-item">
          <strong>{{ item.label }}</strong>
          <span>moq: {{ item.moqEndpoint }}</span>
          <span>fingerprint: {{ item.fingerprintEndpoint }}</span>
          <span>read: {{ item.readEndpoint }}</span>
        </div>
      </dd>
    </div>

    <div class="config-block">
      <dt class="config-label">QUIC 优化</dt>
      <dd class="config-value">{{ quicTuningSummary.join(" / ") }}</dd>
    </div>
  </section>

  <section class="notice-panel">
    <strong>QUIC/MoQ 浏览器限制</strong>
    <span>本地测试请使用 <code>localhost</code> 打开页面；用局域网 IP 打开时 WebTransport 常会因为安全上下文或证书策略失败。</span>
    <span>
      如果 MediaMTX 使用自签 TLS，请先手动打开 fingerprint 地址并接受风险，浏览器才可能允许后续 WebTransport 长连接。
    </span>
    <a v-if="endpointPreviews[0]" :href="endpointPreviews[0].fingerprintEndpoint" target="_blank" rel="noreferrer">
      打开第一个 fingerprint 地址
    </a>
    <span v-if="!isLocalPage" class="warning-text">当前页面不是 localhost，建议切回 localhost 验证 QUIC。</span>
  </section>

  <section v-if="!quicCompatibility.supported" class="compatibility-panel">
    <strong>当前浏览器环境暂不支持 MediaMTX MoQ 播放</strong>
    <span>缺少：{{ quicCompatibility.missing.join("、") }}</span>
    <span>MoQ 浏览器播放需要 HTTPS、安全上下文、WebTransport 和 WebCodecs。</span>
    <span>如果使用自签名证书，还需要浏览器支持 WebTransport 证书 fingerprint 校验；iOS Safari 不适合该场景。</span>
  </section>

  <section class="video-grid">
    <article v-for="entry in entriesList" :key="entry.id" class="video-card">
      <div
        :id="`video-${entry.id}`"
        :ref="(el) => onVideoMounted(entry.id, el as HTMLElement | null)"
        class="video-el"
      >
        <div v-if="!quicCompatibility.supported" class="video-placeholder">
          当前环境不支持 QUIC/MoQ 浏览器播放
        </div>
      </div>

      <div class="video-overlay">
        <div>
          <strong>{{ entry.label }}</strong>
          <span>path: {{ entry.path }}</span>
          <span v-if="entry.stream">audio: {{ entry.stream.hasAudio ? "yes" : "no" }}</span>
        </div>
        <span class="rtc-badge" :class="entry.status">{{ entry.status }}</span>
      </div>

      <p v-if="entry.error" class="error-message">{{ entry.error.message }}</p>

      <div class="card-actions">
        <button v-if="entry.audioMuted" class="btn-card" type="button" @click="unmuteVideo(entry.id)">
          🔊 开启声音
        </button>
        <button class="btn-card" type="button" :disabled="!quicCompatibility.supported" @click="restartVideo(entry.id)">
          ↺ 重连
        </button>
      </div>
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

.config-block {
  min-width: 0;
}

.config-label {
  color: #8b949e;
  font-size: 12px;
  margin-bottom: 4px;
}

.config-value {
  margin: 0;
  overflow-wrap: anywhere;
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 13px;
}

.endpoint-item {
  display: grid;
  gap: 2px;
}

.endpoint-item + .endpoint-item {
  margin-top: 10px;
}

.endpoint-item strong,
.endpoint-item span {
  display: block;
}

.notice-panel {
  display: grid;
  gap: 6px;
  margin: 0 0 24px;
  padding: 14px 16px;
  color: #dbeafe;
  background: rgba(12, 45, 92, 0.84);
  border: 1px solid rgba(56, 139, 253, 0.45);
  border-radius: 12px;
  line-height: 1.6;
}

.notice-panel span,
.notice-panel a {
  font-size: 13px;
}

.notice-panel a {
  color: #79c0ff;
}

.warning-text {
  color: #ffd8a8;
}

/* 兼容性提示面板 */
.compatibility-panel {
  display: grid;
  gap: 6px;
  margin: 0 0 24px;
  padding: 14px 16px;
  color: #ffdcd7;
  background: rgba(63, 13, 13, 0.84);
  border: 1px solid rgba(248, 81, 73, 0.45);
  border-radius: 12px;
  line-height: 1.6;
}

.compatibility-panel span {
  color: #ffb8b0;
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

/* MoQ canvas 容器样式 */
.video-el {
  width: 100%;
  height: 100%;
  display: block;
}

.video-el :deep(canvas) {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.video-placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  padding: 24px;
  color: #8b949e;
  text-align: center;
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
  pointer-events: none;
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
  bottom: 54px;
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

/* 卡片操作区样式 */
.card-actions {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.btn-card {
  padding: 6px 12px;
  color: #e6edf3;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #30363d;
  border-radius: 6px;
  cursor: pointer;
}

.btn-card:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.16);
}

.btn-card:disabled {
  color: #8b949e;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
