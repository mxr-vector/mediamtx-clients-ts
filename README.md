# webrtc-mediamtx

一个基于 **Vue 3 + Vite + 浏览器原生 WebRTC API** 的 MediaMTX RTSP 监控接收端示例。项目用于验证 RTSP 摄像头、编码器或其他 RTSP 源经 MediaMTX 转换为 WebRTC 后，能否在浏览器中以多路视频墙形式稳定播放。

![MediaMTX WebRTC 链路图](src/assets/mediamtx-webrtc-flow.png)

## 项目定位

本项目只实现浏览器接收端，不包含 RTSP 推流端，也不自建 WebSocket / Socket.io 信令服务。客户端直接调用 MediaMTX 暴露的 WebRTC/WHEP HTTP 读流接口：

1. 浏览器创建 receive-only `RTCPeerConnection`。
2. 客户端向 MediaMTX 的 `/{path}/whep` endpoint 发送 SDP offer。
3. MediaMTX 返回 SDP answer。
4. WebRTC ICE/DTLS/SRTP 建链后，浏览器接收媒体流。
5. Vue composable 将 `MediaStream` 绑定到页面 `<video>` 元素。

适合以下场景：

- 快速测试 RTSP 摄像头是否能通过 MediaMTX 转 WebRTC 播放。
- 验证 MediaMTX WHEP endpoint、端口、path 与 ICE/STUN 配置。
- 作为 Vue 项目中接入 MediaMTX WebRTC 播放能力的最小参考实现。

## 功能特性

- 基于 MediaMTX WebRTC/WHEP HTTP 接口完成 SDP offer/answer 协商。
- 不依赖自建信令服务器，浏览器直接和 MediaMTX 交互。
- 支持多路 RTSP path 同屏展示，默认示例为 `camera1,camera2`。
- 提供单路与多路 Vue composable：
  - `useMediaMtxReceiver`：管理单个视频流。
  - `useMediaMtxReceivers`：管理多个视频流。
- 支持通过 `.env` 配置 MediaMTX 协议、主机、端口、流 path、WHEP endpoint 模板、请求超时和 STUN/TURN。
- 页面展示每路视频的连接状态、错误信息和手动重连按钮。
- 自动在组件卸载时释放 `RTCPeerConnection`、媒体轨道和视频元素资源。

## 技术栈

- Vue 3 Composition API
- Vite
- TypeScript
- MediaMTX WebRTC / WHEP
- Browser `RTCPeerConnection`

职责划分：

| 模块       | 职责                                                         |
| ---------- | ------------------------------------------------------------ |
| RTSP 源    | 摄像头、编码器或文件流，向 MediaMTX 推流或被 MediaMTX 拉流。 |
| MediaMTX   | 管理 RTSP path，并将其暴露为 WebRTC/WHEP 可读流。            |
| Vue 客户端 | 创建 `RTCPeerConnection`，发起 WHEP 协商，维护连接状态。     |
| `<video>`  | 播放 composable 绑定的 `MediaStream`。                       |

## 环境要求

- Node.js
- pnpm
- 可访问的 MediaMTX 服务，WebRTC HTTP 端口通常为 `8889`
- MediaMTX 中已存在与 `.env` 一致的 stream path，例如 `camera1`、`camera2`

> 代码内置回退地址为 `http://198.18.0.1:8889`；当前 `.env.example` 示例主机为 `198.168.245.213`。实际运行时请以你本机 `.env` 或 `.env.development` 中的配置为准。

## 快速开始

安装依赖：

```bash
pnpm install
```

复制并调整环境变量：

```bash
cp .env.example .env
```

启动开发服务器：

```bash
pnpm dev
```

打开 Vite 输出的本地地址。页面加载后会自动尝试连接 `VITE_MEDIAMTX_STREAM_PATHS` 中配置的所有流。

## 环境变量

`.env.example` 提供了最小配置：

```dotenv
# MediaMTX server used by the WebRTC receiver demo
VITE_MEDIAMTX_PROTOCOL=http
VITE_MEDIAMTX_HOST=198.168.245.213
VITE_MEDIAMTX_WEBRTC_PORT=8889

# MediaMTX stream path. It must match a path configured in mediamtx.yml.
VITE_MEDIAMTX_DEFAULT_PATH=camera1
# Multiple paths for the demo grid. Separate with commas.
VITE_MEDIAMTX_STREAM_PATHS=camera1,camera2

VITE_MEDIAMTX_REQUEST_TIMEOUT_MS=10000

# Comma-separated STUN/TURN URLs passed to RTCPeerConnection.
VITE_WEBRTC_STUN_URLS=stun:stun.l.google.com:19302
```

可选配置项：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `VITE_MEDIAMTX_PROTOCOL` | MediaMTX WebRTC HTTP 协议，支持 `http` / `https`。 | `http` |
| `VITE_MEDIAMTX_HOST` | MediaMTX 主机或 IP。 | `198.18.0.1` |
| `VITE_MEDIAMTX_WEBRTC_PORT` | MediaMTX WebRTC HTTP 端口。 | `8889` |
| `VITE_MEDIAMTX_DEFAULT_PATH` | 单路或未指定 path 时使用的默认流路径。 | `camera1` |
| `VITE_MEDIAMTX_STREAM_PATHS` | 页面多路视频网格使用的流 path，逗号分隔。 | `camera1,camera2` |
| `VITE_MEDIAMTX_WHEP_PATH_TEMPLATE` | WHEP endpoint 模板，`{path}` 会替换为流路径。 | `/{path}/whep` |
| `VITE_MEDIAMTX_REQUEST_TIMEOUT_MS` | SDP offer HTTP 请求超时时间。 | `10000` |
| `VITE_WEBRTC_STUN_URLS` | 传给 `RTCPeerConnection` 的 STUN/TURN URL，逗号分隔。 | `stun:stun.l.google.com:19302` |

常用调整：

```dotenv
# 单路测试
VITE_MEDIAMTX_DEFAULT_PATH=your-path
VITE_MEDIAMTX_STREAM_PATHS=your-path

# 多路视频墙
VITE_MEDIAMTX_STREAM_PATHS=front-door,back-door,parking-lot

# 旧版或自定义 MediaMTX endpoint
VITE_MEDIAMTX_WHEP_PATH_TEMPLATE=/{path}/webrtc
```

## MediaMTX 侧检查项

本项目不修改 MediaMTX 配置，但运行前需要确认：

1. MediaMTX WebRTC HTTP 服务已监听，例如 `http://<host>:8889`。
2. `mediamtx.yml` 中存在与前端 `.env` 一致的 path。
3. RTSP 源可被 MediaMTX 正常读取，且至少包含视频轨道。
4. 浏览器所在机器能访问 MediaMTX WebRTC 端口和 ICE 候选地址。

一个典型 path 形态如下，实际配置请按你的 MediaMTX 版本和部署方式调整：

```yaml
paths:
  stream/live:
    source: rtsp://user:password@192.168.1.10/stream1
  stream/camera1:
    source: rtsp://user:password@192.168.1.11/stream1
```

### OBS推流到mediaMTX

默认使用x264，mediamtx不接受b帧
x264opts   bframes=0:keyint=30:no-scenecut  强制无 B 帧
![obs推流到mediaMTX](src/assets//obs.png)

### FFmpeg推流到mediaMTX

```
ffmpeg -re -stream_loop -1 -i 1.mp4 \
-c:v libx264 -profile:v baseline -pix_fmt yuv420p -b:v 1500k -maxrate 1500k -bufsize 3000k -g 30 -preset veryfast -tune zerolatency \
-c:a aac -b:a 128k -ar 44100 -ac 2 \
-fflags +genpts -use_wallclock_as_timestamps 1 \
-f flv rtmp://127.0.0.1:1935/stream/live

```

## Composable 使用

### 单路接收

```ts
import { useMediaMtxReceiver } from "./composables/mediamtx";

const { status, stream, error, attach, restart, detach } = useMediaMtxReceiver({
  path: "camera1",
});
```

模板中绑定视频元素：

```vue
<video :ref="(el) => el && attach(el as HTMLVideoElement)" autoplay muted playsinline />
<button type="button" @click="restart">重连</button>
<p>状态：{{ status }}</p>
<p v-if="error">{{ error.message }}</p>
```

### 多路接收

```ts
import { useMediaMtxReceivers } from "./composables/mediamtx";

const { entries, attach, restart, detachAll } = useMediaMtxReceivers([
  { id: "camera1", path: "camera1", label: "正面" },
  { id: "camera2", path: "camera2", label: "背面" },
]);
```

### 完整 endpoint 覆盖

当 endpoint 不适合用模板生成时，可以直接指定完整地址：

```ts
useMediaMtxReceiver({
  endpointUrl: "http://198.18.0.1:8889/camera1/whep",
});
```

### 自定义 ICE / TURN

```ts
useMediaMtxReceiver({
  path: "camera1",
  rtcConfig: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:turn.example.com:3478",
        username: "user",
        credential: "password",
      },
    ],
  },
});
```

## 页面状态说明

每个视频卡片右上角会显示当前连接状态：

| 状态           | 含义                                              |
| -------------- | ------------------------------------------------- |
| `idle`         | 尚未开始连接。                                    |
| `preparing`    | 正在创建 WebRTC 连接与内部资源。                  |
| `signaling`    | 正在创建 SDP offer 并向 MediaMTX 发起 WHEP 请求。 |
| `connecting`   | 已收到 SDP answer，正在等待 ICE / 媒体连接。      |
| `connected`    | 已收到媒体流并绑定到 `<video>`。                  |
| `disconnected` | WebRTC 连接中断。                                 |
| `failed`       | 协商、HTTP 请求或 ICE 连接失败。                  |
| `closed`       | 连接已主动关闭。                                  |

点击“↺ 重连”会释放当前连接并重新发起协商。

## 构建与预览

```bash
pnpm build
pnpm preview
```

如果没有可用的 live MediaMTX / RTSP 源，仍可运行 `pnpm build` 验证前端代码和打包流程；实际播放验证需要可访问的 MediaMTX 服务与有效 stream path。

## 项目结构

```text
.
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   │   └── mediamtx-webrtc-flow.svg   # README 架构图
│   ├── components/
│   │   └── ExampleDashboard.vue       # 多路视频监控示例页面
│   ├── composables/
│   │   └── mediamtx/
│   │       ├── client.ts              # MediaMTX WHEP/WebRTC 协商客户端
│   │       ├── config.ts              # Vite 环境变量解析与 WHEP URL 构建
│   │       ├── index.ts               # 对外导出
│   │       ├── types.ts               # 类型定义
│   │       ├── useMediaMtxReceiver.ts # 单路 Vue composable
│   │       └── useMediaMtxReceivers.ts# 多路 Vue composable
│   ├── App.vue
│   └── main.ts
├── .env.example
├── package.json
└── vite.config.js
```

## 故障排查

### 404 或 HTTP 错误

- 检查 `VITE_MEDIAMTX_STREAM_PATHS` 是否与 MediaMTX path 完全一致。
- 检查 WHEP endpoint 模板。新版本通常为 `/{path}/whep`，旧版本可尝试 `/{path}/webrtc`。
- 确认 MediaMTX WebRTC HTTP 端口是否为 `8889`，以及浏览器是否能访问该端口。

### Mixed content / CORS / HTTPS 问题

- 如果前端页面通过 HTTPS 打开，而 MediaMTX endpoint 是 HTTP，浏览器可能拦截请求。
- 内网测试建议前端和 MediaMTX 都使用 HTTP。
- 生产环境建议为 MediaMTX 配置 HTTPS，或通过同源反向代理转发 WHEP 请求。

### 视频未自动播放

- 浏览器通常要求自动播放的视频静音。
- 示例页面已设置 `autoplay muted playsinline webkit-playsinline`。
- 如果仍无法播放，可先手动点击页面，再查看浏览器控制台中的 autoplay 错误。

### 一直停留在 `connecting`

- 检查浏览器与 MediaMTX 之间的 UDP/TCP WebRTC 通路。
- 检查 MediaMTX 公网/NAT 场景下的 ICE 地址发布配置。
- 内网通常只需 STUN 或无需 TURN；跨公网/NAT 时可能需要 TURN。
- 确认 RTSP 源本身有视频轨道，并且 MediaMTX 能正常读取。

### 连接成功但画面黑屏

- 检查 RTSP 源编码格式是否被浏览器支持。
- 优先使用浏览器普遍支持的 H.264 配置。
- 打开浏览器 WebRTC internals / 媒体面板，确认是否收到 video track 和数据包。

## 许可证

见 [LICENSE](LICENSE)。
