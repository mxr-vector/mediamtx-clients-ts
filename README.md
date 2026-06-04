# webrtc-mediamtx

基于 **Vue 3 + Vite + TypeScript** 的 MediaMTX 浏览器读流示例，用来验证 RTSP/RTMP 等源经 MediaMTX 转换后，是否能在浏览器中稳定播放。

支持两种接收方式：

- **WebRTC/WHEP**：浏览器直接向 MediaMTX `/{path}/whep` 发起 SDP offer/answer 协商，并将收到的 `MediaStream` 绑定到 `<video>`。
- **QUIC/MoQ**：浏览器通过 WebTransport 连接 MediaMTX `/{path}/moq`，再用 WebCodecs 解码并渲染到 `canvas`。

![效果图-webrtc](src/assets/webrtc.jpg)

![效果图-quic](src/assets/quic.png)

## 功能

- 不依赖自建 WebSocket / Socket.io 信令服务。
- 支持多路 stream path 同屏展示。
- 支持 WebRTC STUN/TURN 配置，TURN 可按 `off` / `fallback` / `include` 控制成本。
- 支持 MediaMTX v1.19.0+ MoQ / Media-over-QUIC 浏览器读流。
- 页面可切换 WebRTC/WHEP 与 QUIC/MoQ；切换时自动卸载接收器并释放连接资源。
- 组件卸载时自动清理 `RTCPeerConnection`、媒体轨道、WebTransport、WebCodecs 和渲染资源。

## 快速开始

| 端口       | 协议  | 功能              | 是否必须公网开放  | 说明                        |
| -------- | --- | --------------- | --------- | ------------------------- |
| **1935** | TCP | RTMP            | 推流时需要     | OBS、FFmpeg、摄像头等通过 RTMP 推流 |
| **8554** | TCP | RTSP            | RTSP客户端需要 | VLC、FFplay、NVR等拉流         |
| **8888** | TCP | HTTP API / HLS  | HLS播放需要   | HLS播放器访问 `.m3u8`          |
| **8889** | TCP | WebRTC HTTP信令   | WebRTC需要  | WHEP/WHIP 请求、SDP交换        |
| **8892** | TCP | MoQ HTTPS/HTTP2 | 使用MoQ时需要  | Media over QUIC 控制连接      |
| **8189** | UDP | WebRTC ICE Host | WebRTC需要  | ICE Candidate 数据传输        |
| **8890** | UDP | WebRTC ICE Host | WebRTC需要  | RTP/RTCP媒体流传输             |
| **8892** | UDP | MoQ HTTP3/QUIC  | 使用MoQ时需要  | MoQ媒体传输                   |

![port](src/assets//port.png)

```bash
pnpm install
cp .env.example .env.development
pnpm run dev
```

Vite 默认监听 `0.0.0.0`，可通过以下地址访问：

```text
http://localhost:5173
http://<本机局域网IP>:5173
```

打开页面后，项目会读取 `.env.development` 中的 stream path 并自动连接。

## 环境变量

`.env.example` 提供完整示例，常用项如下：

```dotenv
# WebRTC/WHEP
VITE_MEDIAMTX_PROTOCOL=http
VITE_MEDIAMTX_HOST=198.168.245.213
VITE_MEDIAMTX_WEBRTC_PORT=8889
VITE_MEDIAMTX_DEFAULT_PATH=camera1
VITE_MEDIAMTX_STREAM_PATHS=stream/camera1,stream/camera2
VITE_MEDIAMTX_REQUEST_TIMEOUT_MS=10000
VITE_MEDIAMTX_WHEP_PATH_TEMPLATE=/{path}/whep

# ICE / TURN
VITE_WEBRTC_STUN_URLS=stun:stun.l.google.com:19302
VITE_WEBRTC_TURN_MODE=off
VITE_WEBRTC_TURN_URLS=
VITE_WEBRTC_TURN_USERNAME=
VITE_WEBRTC_TURN_CREDENTIAL=

# QUIC/MoQ
VITE_MEDIAMTX_QUIC_PROTOCOL=https
VITE_MEDIAMTX_QUIC_HOST=198.168.245.213
VITE_MEDIAMTX_QUIC_HTTPS2_PORT=8892
VITE_MEDIAMTX_QUIC_HTTPS3_PORT=8892
VITE_MEDIAMTX_QUIC_STREAM_PATHS=
VITE_MEDIAMTX_QUIC_ENABLE_AUDIO=false
VITE_MEDIAMTX_QUIC_MAX_VIDEO_FPS=30
VITE_MEDIAMTX_QUIC_MAX_RENDER_WIDTH=960
VITE_MEDIAMTX_QUIC_MAX_RENDER_HEIGHT=540
VITE_MEDIAMTX_QUIC_MAX_VIDEO_DECODE_QUEUE_SIZE=8
VITE_MEDIAMTX_QUIC_STARTUP_STAGGER_MS=350
VITE_MEDIAMTX_QUIC_DEBUG=false
```

说明：

| 变量 | 说明 |
| --- | --- |
| `VITE_MEDIAMTX_HOST` | MediaMTX 主机或 IP，必须是浏览器能访问的地址。 |
| `VITE_MEDIAMTX_STREAM_PATHS` | 多路视频墙使用的 path，逗号分隔。 |
| `VITE_MEDIAMTX_WHEP_PATH_TEMPLATE` | WebRTC/WHEP endpoint 模板，`{path}` 会替换为 stream path。 |
| `VITE_WEBRTC_TURN_MODE` | `off` 不用 TURN；`fallback` 失败后用 TURN 重试；`include` 首次即带 TURN。 |
| `VITE_MEDIAMTX_QUIC_STREAM_PATHS` | QUIC/MoQ path；为空时回退到 `VITE_MEDIAMTX_STREAM_PATHS`。 |
| `VITE_MEDIAMTX_QUIC_*` | MoQ 端口、渲染上限、帧率、启动错峰和调试配置。 |

> Vite 环境变量会打包进前端代码。生产环境如需 TURN 凭证，建议使用限时凭证。

## MediaMTX 侧检查

运行前确认：

1. WebRTC HTTP 服务可访问，通常为 `http://<host>:8889`。
2. `mediamtx.yml` 中存在与 `VITE_MEDIAMTX_STREAM_PATHS` 一致的 path。
3. RTSP/RTMP 源能被 MediaMTX 正常读取，且至少包含视频轨道。
4. 浏览器所在机器能访问 MediaMTX HTTP/WHEP 端口和 WebRTC ICE 候选地址。
5. 使用 QUIC/MoQ 时，MediaMTX 版本为 v1.19.0+，并放行 HTTPS2/TCP `8892` 与 HTTPS3/UDP `8892`。

WebRTC path 示例：

```yaml
paths:
  stream/camera1:
    source: rtsp://user:password@192.168.1.11/stream1
  stream/camera2:
    source: publisher
```

MoQ 示例配置：

```yaml
moq: true
moqHTTPS2Address: :8892
moqHTTPS3Address: :8892
moqServerKey: auto.key
moqServerCert: auto.crt
moqAllowOrigins: ["*"]
```

## Composable 使用

WebRTC/WHEP 单路：

```ts
import { useMediaMtxReceiver } from "./composables/mediamtx/webrtc";

const { status, stream, error, attach, restart, detach } = useMediaMtxReceiver({
  path: "camera1",
});
```

WebRTC/WHEP 多路：

```ts
import { useMediaMtxReceivers } from "./composables/mediamtx/webrtc";

const { entries, attach, restart, detachAll } = useMediaMtxReceivers([
  { id: "camera1", path: "camera1", label: "正面" },
  { id: "camera2", path: "camera2", label: "背面" },
]);
```

QUIC/MoQ 单路：

```ts
import { useMediaMtxQuicReceiver } from "./composables/mediamtx/quic";

const { status, info, error, audioMuted, attach, restart, unmute } = useMediaMtxQuicReceiver({
  path: "camera1",
});
```

QUIC/MoQ 多路：

```ts
import { useMediaMtxQuicReceivers } from "./composables/mediamtx/quic";

const { entries, attach, restart, unmute, detachAll } = useMediaMtxQuicReceivers([
  { id: "camera1", path: "camera1", label: "正面" },
  { id: "camera2", path: "camera2", label: "背面" },
]);
```

## 构建

```bash
pnpm build
pnpm preview
```

`pnpm build` 只验证前端代码和打包流程；实际播放仍需要可访问的 MediaMTX 服务与有效媒体源。

## 项目结构

```text
src/
├── components/
│   ├── ExampleDashboard.vue   # 协议切换和页面外壳
│   ├── WebRtcDashboard.vue    # WebRTC/WHEP 多路示例
│   └── QuicDashboard.vue      # QUIC/MoQ 多路示例
├── composables/
│   └── mediamtx/
│       ├── config.ts          # 协议公共配置工具
│       ├── types.ts           # 协议公共类型
│       ├── webrtc/            # WHEP/WebRTC client 与 composables
│       └── quic/              # MoQ/WebTransport/WebCodecs client 与 composables
├── App.vue
└── main.ts
```

## 常见问题

### 404 或 HTTP 错误

- 检查 stream path 是否与 MediaMTX 配置完全一致。
- 新版 WebRTC endpoint 通常是 `/{path}/whep`；旧版可尝试 `/{path}/webrtc`。
- 确认浏览器能访问 `VITE_MEDIAMTX_HOST:VITE_MEDIAMTX_WEBRTC_PORT`。

### 本机正常，局域网/远程访问失败

前端页面打开后，浏览器仍会直接请求 `.env` 中配置的 MediaMTX 地址。请把 `VITE_MEDIAMTX_HOST` 改为访问端可达的 IP/域名，并确保防火墙、安全组、端口映射和 ICE 候选地址正确。

### QUIC/MoQ 无法连接

- WebTransport 需要安全上下文：优先用 `localhost` 或 HTTPS。
- 自签证书需要先访问 fingerprint/read 页面并让浏览器信任。
- 确认 UDP `8892` 未被防火墙拦截。
- iOS Safari 通常不适合该 MoQ 浏览器播放场景。

### 一直停留在 `connecting`

- 检查浏览器与 MediaMTX 的 UDP/TCP 通路。
- 公网/NAT 场景检查 MediaMTX ICE 地址发布配置。
- 跨 NAT 可尝试 `VITE_WEBRTC_TURN_MODE=fallback`。
- 确认媒体源有浏览器支持的视频编码，优先使用 H.264。

## 参考

- [MediaMTX WebRTC clients](https://mediamtx.org/docs/publish/webrtc-clients)
- [MediaMTX MoQ clients](https://mediamtx.org/docs/publish/moq-clients)
- [WebRTC connectivity issues](https://mediamtx.org/docs/features/webrtc-specific-features#solving-webrtc-connectivity-issues)

## 许可证

见 [LICENSE](LICENSE)。
