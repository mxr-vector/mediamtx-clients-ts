# MediaMTX WebRTC RTSP Monitor Client

这是一个基于 Vue 3 + Vite 的实时视频监控接收端示例。客户端通过浏览器原生 WebRTC API 对接 MediaMTX 的 WebRTC/WHEP 读流接口，用于测试 RTSP 摄像头或 RTSP 源经 MediaMTX 转 WebRTC 后在浏览器中的播放效果。

当前默认 MediaMTX 地址：`198.18.0.1`。

## 功能

- 使用 MediaMTX WebRTC/WHEP HTTP 接口完成 SDP offer/answer 协商。
- 不依赖自建 WebSocket 或 Socket.io 信令服务器播放视频。
- 提供 `src/composables/mediamtx/` 下的单路与多路 Vue composable。
- 支持通过 `.env` 配置 MediaMTX 主机、端口、流 path、endpoint 模板、超时和 ICE/STUN。
- 页面内展示每路视频的连接状态、错误信息和重连按钮。

## 链路流程

```mermaid
flowchart LR
  A[RTSP 摄像头 / RTSP 源] -->|rtsp://...| B[MediaMTX Server\n198.18.0.1]
  C[Vue WebRTC Client] -->|POST SDP offer\n/{path}/whep| B
  B -->|SDP answer| C
  B -->|WebRTC RTP/RTCP media| D[Browser RTCPeerConnection]
  D -->|MediaStream| E[Vue video element]

  subgraph Browser
    C
    D
    E
  end
```

职责划分：

1. RTSP 源推流或被 MediaMTX 拉流。
2. MediaMTX 将 RTSP path 暴露为 WebRTC 可读流。
3. Vue 客户端创建 receive-only `RTCPeerConnection`，向 MediaMTX WHEP endpoint 发送 SDP offer。
4. MediaMTX 返回 SDP answer，浏览器建立 WebRTC 连接并接收媒体流。
5. composable 将 `MediaStream` 绑定到 `<video>`。

## 环境要求

- Node.js 与 pnpm。
- 可访问的 MediaMTX 服务，默认 `http://198.18.0.1:8889`。
- MediaMTX 中存在与 `.env` 一致的 stream path，例如 `camera1`、`camera2`。

## 配置

复制示例配置：

```bash
cp .env.example .env
```

`.env.example` 默认内容包含：

```dotenv
VITE_MEDIAMTX_PROTOCOL=http
VITE_MEDIAMTX_HOST=198.18.0.1
VITE_MEDIAMTX_WEBRTC_PORT=8889
VITE_MEDIAMTX_DEFAULT_PATH=camera1
VITE_MEDIAMTX_STREAM_PATHS=camera1,camera2
VITE_MEDIAMTX_REQUEST_TIMEOUT_MS=10000
VITE_WEBRTC_STUN_URLS=stun:stun.l.google.com:19302
```

常用调整：

- 单路测试：修改 `VITE_MEDIAMTX_DEFAULT_PATH=your-path` 与 `VITE_MEDIAMTX_STREAM_PATHS=your-path`。
- 当前 MediaMTX 示例：`VITE_MEDIAMTX_STREAM_PATHS=camera1,camera2`。
- WHEP endpoint 默认按 `/{path}/whep` 生成，例如 `camera1` 会请求 `/camera1/whep`。
- 内网测试：通常保持 `VITE_MEDIAMTX_PROTOCOL=http`；如果页面通过 HTTPS 打开，MediaMTX 也应提供 HTTPS 或通过同源代理转发。

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 Vite 输出的本地地址。页面会自动尝试播放 `VITE_MEDIAMTX_STREAM_PATHS` 中配置的流。

## Composable 使用

单路：

```ts
import { useMediaMtxReceiver } from "./composables/mediamtx";

const { status, error, attach, restart, detach } = useMediaMtxReceiver({
  path: "camera1",
});
```

多路：

```ts
import { useMediaMtxReceivers } from "./composables/mediamtx";

const { entries, attach, restart, detachAll } = useMediaMtxReceivers([
  { id: "camera1", path: "camera1", label: "正面" },
  { id: "camera2", path: "camera2", label: "背面" },
]);
```

完整 endpoint 覆盖：

```ts
useMediaMtxReceiver({
  endpointUrl: "http://198.18.0.1:8889/camera1/whep",
});
```

## 手动测试步骤

1. 确认 MediaMTX 正在运行，且 RTSP path 已就绪。
2. 确认 `.env` 中 `VITE_MEDIAMTX_HOST`、`VITE_MEDIAMTX_WEBRTC_PORT`、`VITE_MEDIAMTX_STREAM_PATHS` 与 MediaMTX 配置一致。
3. 启动客户端：`pnpm dev`。
4. 打开页面并观察每个卡片右上角状态：
   - `signaling`：正在向 MediaMTX 发送 offer。
   - `connecting`：已收到 answer，等待 WebRTC 媒体连接。
   - `connected`：已收到媒体并绑定 video。
   - `failed`：协商或连接失败，查看页面错误和浏览器控制台。
5. 点击“重连”可释放当前连接并重新协商。

## 故障排查

### 404 或 HTTP 错误

- 检查 `VITE_MEDIAMTX_STREAM_PATHS` 是否与 MediaMTX path 完全一致。
- 检查 endpoint 模板。新版本通常为 `/{path}/whep`，旧版本可尝试 `/{path}/webrtc`。
- 确认 MediaMTX WebRTC 端口是否为 `8889`。

### Mixed content / CORS / HTTPS 问题

- 如果前端页面是 HTTPS，而 MediaMTX 是 HTTP，浏览器可能阻止请求。
- 本地内网测试建议前端与 MediaMTX 都使用 HTTP；生产环境建议为 MediaMTX 配置 HTTPS 或使用同源反向代理。

### 视频未自动播放

- 浏览器通常要求自动播放的视频静音。示例页面已设置 `autoplay muted playsinline`。
- 如果仍失败，手动点击页面或查看控制台中的 autoplay 错误。

### 一直停留在 connecting

- 检查浏览器与 MediaMTX 间的 UDP/TCP WebRTC 通路。
- 检查 STUN/TURN 配置。内网通常不需要 TURN，跨公网/NAT 时可能需要配置 TURN。
- 确认 RTSP 源本身有视频轨道，并且 MediaMTX 能正常读取。

### 没有 live MediaMTX 可测

仍可运行 `pnpm build` 验证前端代码、类型和打包是否正常。实际播放验证需要可访问的 MediaMTX 服务与有效 RTSP path。

## 项目结构

```text
src/composables/mediamtx/
  config.ts               # Vite 环境变量解析与 WHEP URL 构建
  client.ts               # MediaMTX WHEP/WebRTC 协商客户端
  useMediaMtxReceiver.ts  # 单路 Vue composable
  useMediaMtxReceivers.ts # 多路 Vue composable
  types.ts                # 类型定义
  index.ts                # 对外导出
```
