<!-- 
  ExampleDashboard.vue
  综合演示：Socket.io 实时状态 + 多路 WebRTC 视频流
-->
<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useSocket } from "../composables/WebRTC/useSocket";
import { createSocketSignaling } from "../composables/WebRTC/webrtc";
import { useMultiWebRTC } from "../composables/WebRTC/useWebRTC";

// ── 1. Socket 连接 ──────────────────────────────────────────────────────────
// 定义服务器推送的事件类型（按需扩展）
interface ServerEvents {
  ai_status: { taskId: string; label: string; confidence: number };
  alarm: { level: "warn" | "error"; message: string };
}

// 订阅 AI 识别状态推送
const logs = ref<string[]>([]);

const {
  status: socketStatus,
  client,
  emit,
} = useSocket<ServerEvents>({
  url: import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000",
  instanceName: "main", // 跨组件单例复用
  autoConnect: true,
  autoDisconnect: false, // 具名单例不自动断开
  heartbeatInterval: 25_000,
  listeners: {
    ai_status({ taskId, label, confidence }) {
      logs.value.unshift(`[${taskId}] ${label} (${(confidence * 100).toFixed(1)}%)`);
      if (logs.value.length > 50) logs.value.length = 50;
    },
    alarm({ level, message }) {
      logs.value.unshift(`[${level.toUpperCase()}] ${message}`);
    },
  },
});

const queueSize = ref(0);
const queueSizeTimer = window.setInterval(() => {
  queueSize.value = client.getQueueSize();
}, 1000);

// ── 2. 信令通道（复用同一个 Socket 连接） ───────────────────────────────────
const signaling = createSocketSignaling(client, "webrtc_signal", "webrtc_signal");

// ── 3. 多路 WebRTC ──────────────────────────────────────────────────────────
const cameraConfigs = [
  { taskId: "cam-front", label: "CAM-01 正面", signaling },
  { taskId: "cam-rear", label: "CAM-02 背面", signaling },
  { taskId: "cam-side", label: "CAM-03 侧面", signaling },
];

const { streams, attach, restart } = useMultiWebRTC(cameraConfigs, {
  maxRetry: 20,
  heartbeatInterval: 15_000,
  rtcConfig: {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  },
});

// ── 4. video 元素挂载时绑定播放器 ───────────────────────────────────────────
// 使用 Set 避免 v-for 中 ref 多次调用时重复 attach
const attached = new Set<string>();
function onVideoMounted(taskId: string, el: HTMLVideoElement | null) {
  if (el && !attached.has(taskId)) {
    attached.add(taskId);
    attach(taskId, el);
  }
}

// ── 5. 示例：向服务器发送心跳业务消息 ───────────────────────────────────────
onMounted(() => {
  emit("client_ready", { version: "1.0.0" });
});

onUnmounted(() => {
  window.clearInterval(queueSizeTimer);
});
</script>

<template>
  <div class="dashboard">
    <!-- Socket 状态指示 -->
    <div class="status-bar">
      <span class="dot" :class="socketStatus" />
      <span>Socket: {{ socketStatus }}</span>
      <span class="sep">|</span>
      <span>消息队列: {{ queueSize }}</span>
    </div>

    <!-- 多路视频区域 -->
    <div class="video-grid">
      <div v-for="cfg in cameraConfigs" :key="cfg.taskId" class="video-card">
        <video
          :ref="(el) => onVideoMounted(cfg.taskId, el as HTMLVideoElement)"
          autoplay
          muted
          playsinline
          webkit-playsinline
          class="video-el"
        />

        <div class="video-overlay">
          <span class="cam-label">{{ cfg.label }}</span>
          <span class="rtc-badge" :class="streams.get(cfg.taskId)?.status">
            {{ streams.get(cfg.taskId)?.status ?? "idle" }}
          </span>
        </div>

        <button class="btn-restart" @click="restart(cfg.taskId)">↺ 重连</button>
      </div>
    </div>

    <!-- 实时事件日志 -->
    <ul class="event-log">
      <li v-for="(log, i) in logs" :key="i">{{ log }}</li>
    </ul>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: #0d1117;
  min-height: 100vh;
  color: #e6edf3;
  font-family: "JetBrains Mono", monospace;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 8px 12px;
  background: #161b22;
  border-radius: 6px;
  border: 1px solid #30363d;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6e7681;
  flex-shrink: 0;
}
.dot.connected {
  background: #3fb950;
  box-shadow: 0 0 6px #3fb950;
}
.dot.connecting,
.dot.reconnecting {
  background: #d29922;
  animation: blink 1s infinite;
}
.dot.error,
.dot.disconnected {
  background: #f85149;
}

.sep {
  color: #30363d;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 12px;
}

.video-card {
  position: relative;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
}

.video-el {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent);
}

.cam-label {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.rtc-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #21262d;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.rtc-badge.connected {
  background: #1a4226;
  color: #3fb950;
}
.rtc-badge.connecting,
.rtc-badge.signaling {
  background: #3d2c00;
  color: #d29922;
}
.rtc-badge.reconnecting {
  background: #3d2c00;
  color: #d29922;
  animation: blink 1s infinite;
}
.rtc-badge.failed,
.rtc-badge.disconnected {
  background: #3d0d0d;
  color: #f85149;
}

.btn-restart {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 4px 10px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.08);
  color: #e6edf3;
  border: 1px solid #30363d;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-restart:hover {
  background: rgba(255, 255, 255, 0.18);
}

.event-log {
  list-style: none;
  margin: 0;
  padding: 12px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.8;
  color: #8b949e;
}
.event-log li:first-child {
  color: #e6edf3;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
