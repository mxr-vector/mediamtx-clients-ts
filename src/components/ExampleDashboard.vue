/**
 * 示例仪表板组件
 *
 * 本组件作为 MediaMTX 协议切换入口，只负责页面外壳和协议状态。
 * WebRTC/WHEP 与 QUIC/MoQ 的具体接收逻辑分别由子组件管理，
 * 便于在切换协议时通过组件卸载自动清理连接资源。
 *
 * @component ExampleDashboard
 */

<script lang="ts" setup>
import { computed, shallowRef } from "vue";
import QuicDashboard from "./QuicDashboard.vue";
import WebRtcDashboard from "./WebRtcDashboard.vue";

type MediaMtxDashboardProtocol = "webrtc" | "quic";

interface ProtocolOption {
  value: MediaMtxDashboardProtocol;
  label: string;
  eyebrow: string;
  description: string;
}

const protocolOptions: ProtocolOption[] = [
  {
    value: "webrtc",
    label: "WebRTC/WHEP",
    eyebrow: "MediaMTX WebRTC Receiver",
    description: "通过 MediaMTX 的 WebRTC/WHEP 读流接口接收 RTSP 转 WebRTC 视频，不依赖自建 WebSocket 信令服务器。",
  },
  {
    value: "quic",
    label: "QUIC/MoQ",
    eyebrow: "MediaMTX QUIC/MoQ Receiver",
    description: "通过 MediaMTX 的 MoQ over QUIC 接口接收视频，使用 WebTransport 和 WebCodecs 在浏览器中解码渲染。",
  },
];

const protocol = shallowRef<MediaMtxDashboardProtocol>("webrtc");

const activeProtocol = computed(
  () => protocolOptions.find((item) => item.value === protocol.value) ?? protocolOptions[0]
);

function selectProtocol(nextProtocol: MediaMtxDashboardProtocol) {
  protocol.value = nextProtocol;
}
</script>

<template>
  <main class="dashboard">
    <section class="hero">
      <div>
        <p class="eyebrow">{{ activeProtocol.eyebrow }}</p>
        <h1 class="dashboard-title">RTSP 实时视频监控测试端</h1>
        <p class="description">{{ activeProtocol.description }}</p>
      </div>

      <div class="protocol-panel" aria-label="协议切换">
        <p class="protocol-panel-title">协议切换</p>
        <div class="protocol-actions">
          <button
            v-for="item in protocolOptions"
            :key="item.value"
            class="protocol-button"
            :class="{ active: protocol === item.value }"
            type="button"
            @click="selectProtocol(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <p class="protocol-hint">
          当前：{{ activeProtocol.label }}。切换协议会卸载当前接收器组件并释放连接资源。
        </p>
      </div>
    </section>

    <WebRtcDashboard v-if="protocol === 'webrtc'" />
    <QuicDashboard v-else />
  </main>
</template>

<style scoped>
/* 仪表板容器样式 */
.dashboard {
  min-height: 100vh;
  padding: 24px;
  color: #e6edf3;
  background: #0d1117;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 头部信息区布局 */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
  gap: 24px;
  align-items: stretch;
  margin-bottom: 24px;
}

/* 副标题样式 */
.eyebrow {
  margin: 0 0 8px;
  color: #58a6ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

/* 主标题样式 */
.dashboard-title {
  margin: 0 0 12px;
  font-size: clamp(28px, 5vw, 48px);
}

/* 描述文本样式 */
.description {
  max-width: 760px;
  margin: 0;
  color: #8b949e;
  line-height: 1.7;
}

/* 协议切换面板 */
.protocol-panel {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 16px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
}

.protocol-panel-title {
  margin: 0;
  color: #8b949e;
  font-size: 12px;
}

.protocol-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.protocol-button {
  padding: 8px 12px;
  color: #e6edf3;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #30363d;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
}

.protocol-button:hover,
.protocol-button.active {
  color: #0d1117;
  background: #58a6ff;
  border-color: #58a6ff;
}

.protocol-hint {
  margin: 0;
  color: #8b949e;
  font-size: 12px;
  line-height: 1.6;
}

/* 响应式布局：移动端适配 */
@media (max-width: 820px) {
  .dashboard {
    padding: 16px;
  }

  .hero {
    grid-template-columns: 1fr;
  }
}
</style>
