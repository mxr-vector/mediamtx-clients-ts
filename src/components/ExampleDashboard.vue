/** * 示例仪表板组件 * * 本组件是 MediaMTX WebRTC 视频监控的示例实现。 * 展示了如何使用
useMediaMtxReceivers composable 管理多路视频流。 * * 主要功能： * 1. 从环境变量读取 MediaMTX 配置 *
2. 动态创建视频流配置 * 3. 显示多个摄像头的实时视频 * 4. 展示连接状态和错误信息 * 5. 提供重连功能 *
* 组件特点： * - 使用 Vue 3 Composition API * - 响应式状态管理 * - 自动资源清理 * - 响应式布局设计 *
* @component ExampleDashboard */

<script lang="ts" setup>
import { computed } from "vue";
import {
  buildMediaMtxWhepUrl,
  getMediaMtxConfig,
  useMediaMtxReceivers,
  type MediaMtxStreamConfig,
} from "../composables/mediamtx";

/**
 * 获取 MediaMTX 配置
 *
 * 从环境变量中读取 MediaMTX 服务器的连接配置。
 * 这些配置在 .env 文件中定义。
 */
const mediaMtxConfig = getMediaMtxConfig();

/**
 * 创建摄像头配置数组
 *
 * 根据环境变量中的流路径配置，动态创建摄像头配置。
 * 每个摄像头配置包含：
 * - id: 唯一标识符(使用路径名)
 * - path: MediaMTX 流路径
 * - label: 显示标签(格式：CAM-01 path)
 */
const cameraConfigs: MediaMtxStreamConfig[] = mediaMtxConfig.streamPaths.map((path, index) => ({
  id: path,
  path,
  label: `CAM-${String(index + 1).padStart(2, "0")} ${path}`,
}));

/**
 * 使用多接收器 composable
 *
 * 管理所有摄像头的 WebRTC 连接。
 * 返回值：
 * - entries: 响应式的接收器状态映射
 * - attach: 绑定视频元素函数
 * - restart: 重启连接函数
 */
const { entries, attach, restart } = useMediaMtxReceivers(cameraConfigs);

/**
 * 计算端点预览信息
 *
 * 生成每个摄像头的 WHEP 端点 URL，用于在界面上显示。
 * 这有助于调试和验证配置是否正确。
 */
const endpointPreviews = computed(() =>
  cameraConfigs.map((camera) => ({
    id: camera.id ?? camera.path,
    label: camera.label ?? camera.path,
    endpoint: buildMediaMtxWhepUrl({ path: camera.path }),
  }))
);

/**
 * 计算接收器条目列表
 *
 * 将响应式 Map 转换为数组，便于在模板中使用 v-for 渲染。
 */
const entriesList = computed(() => Array.from(entries.value.values()));

/**
 * 已绑定的视频元素集合
 *
 * 用于跟踪哪些视频元素已经绑定到接收器，
 * 避免重复绑定。
 */
const attached = new Set<string>();

/**
 * 视频元素挂载回调
 *
 * 当视频元素挂载到 DOM 时调用。
 * 将视频元素绑定到对应的接收器。
 *
 * @param id - 接收器 ID
 * @param el - HTML 视频元素或 null（卸载时）
 */
function onVideoMounted(id: string, el: HTMLVideoElement | null) {
  // 只绑定一次，避免重复绑定
  if (el && !attached.has(id)) {
    attached.add(id);
    attach(id, el);
  }
}
</script>

<template>
  <!--
    仪表板主容器
    使用 CSS Grid 布局，分为头部信息区和视频网格区
  -->
  <main class="dashboard">
    <!-- 头部信息区：标题、描述和配置信息 -->
    <section class="hero">
      <div>
        <p class="eyebrow">MediaMTX WebRTC Receiver</p>
        <h1>RTSP 实时视频监控测试端</h1>
        <p class="description">
          通过 MediaMTX 的 WebRTC/WHEP 读流接口接收 RTSP 转 WebRTC 视频，不依赖自建 WebSocket
          信令服务器。
        </p>
      </div>

      <!-- 配置信息面板：显示 WHEP 端点 URL -->
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

    <!-- 视频网格区：显示所有摄像头的实时视频 -->
    <section class="video-grid">
      <!-- 遍历所有接收器条目，为每个创建视频卡片 -->
      <article v-for="entry in entriesList" :key="entry.id" class="video-card">
        <!--
          视频元素
          - autoplay: 自动播放
          - muted: 静音（避免浏览器自动播放限制）
          - playsinline: 移动端内联播放
          - webkit-playsinline: Webkit 浏览器内联播放
          - ref: 通过回调函数获取 DOM 引用
        -->
        <video
          :ref="(el) => onVideoMounted(entry.id, el as HTMLVideoElement | null)"
          autoplay
          muted
          playsinline
          webkit-playsinline
          class="video-el"
        />

        <!-- 视频覆盖层：显示摄像头信息和状态 -->
        <div class="video-overlay">
          <div>
            <strong>{{ entry.label }}</strong>
            <span>path: {{ entry.path }}</span>
          </div>
          <!-- 连接状态徽章：根据状态显示不同颜色 -->
          <span class="rtc-badge" :class="entry.status">{{ entry.status }}</span>
        </div>

        <!-- 错误信息：连接失败时显示 -->
        <p v-if="entry.error" class="error-message">{{ entry.error.message }}</p>

        <!-- 重连按钮：手动触发重新连接 -->
        <button class="btn-restart" type="button" @click="restart(entry.id)">↺ 重连</button>
      </article>
    </section>
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
h1 {
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

/* 配置信息面板样式 */
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
