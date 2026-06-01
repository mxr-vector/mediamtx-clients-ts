## Context

项目是 Vue 3 + Vite 客户端，当前 `src/composables/WebRTC/` 中存在两类封装：

- `socket.ts` / `useSocket.ts`：基于 `socket.io-client` 的业务事件与信令通道。
- `webrtc.ts` / `useWebRTC.ts`：基于自建 WebSocket 或 Socket.io 信令的 WebRTC 播放器，流程是服务端主动下发 offer，客户端创建 answer。

目标服务器已部署 MediaMTX，地址为 `198.18.0.1`。MediaMTX 官方 WebRTC 播放链路通常通过 HTTP API（WHEP / WebRTC read endpoint）完成 SDP offer/answer 交换，不需要项目自建 Socket.io 信令来播放 RTSP 转 WebRTC 流。因此接收端应围绕 MediaMTX WebRTC HTTP 播放接口重新组织，而不是继续把 socket 信令作为必需依赖。

## Goals / Non-Goals

**Goals:**

- 提供一个可直接用于测试的 MediaMTX WebRTC 接收端 composable，可绑定 `<video>` 并播放指定 path/stream。
- 将 MediaMTX 主机、协议、默认流 path、WebRTC endpoint、超时、ICE/STUN 等配置暴露到 Vite 环境变量，并在 `.env.example` 中说明。
- 将 WebRTC 播放、MediaMTX API、配置解析、演示页面/测试辅助按功能拆包命名。
- 对不再参与 MediaMTX 播放链路的 Socket.io 信令代码进行删除、隔离或停止导出，避免误导接入方。
- 在 README 中说明端到端链路、环境配置、启动方式、MediaMTX path 对应关系和故障排查。

**Non-Goals:**

- 不实现 MediaMTX 服务端部署、RTSP 源采集或 MediaMTX 配置文件管理。
- 不实现录像、回放、云台控制、AI 识别告警等业务能力。
- 不实现自定义 WebSocket 信令服务器，除非后续明确有 MediaMTX 以外的信令需求。
- 不保证跨公网 NAT 场景可用；TURN 服务配置只预留扩展点。

## Decisions

### 1. MediaMTX 播放链路使用 HTTP/WHEP，不再以 Socket.io 信令为主路径

MediaMTX 已提供 WebRTC read API，客户端只需要创建 `RTCPeerConnection`、生成本地 offer、POST 到 MediaMTX 对应 path 的 WebRTC/WHEP endpoint，并使用返回的 SDP answer 设置远端描述。这样可以直接对接 MediaMTX，避免维护额外 WebSocket 信令协议。

Alternatives considered:

- 继续使用现有 `WebRTCPlayer` + `SignalingChannel`：与 MediaMTX 官方读流流程不匹配，且要求额外服务端适配 socket 信令。
- 在浏览器中直接播放 RTSP：主流浏览器不支持原生 RTSP 播放，仍需 MediaMTX 转 WebRTC/HLS/LL-HLS。

### 2. 新增 MediaMTX 专用模块，旧 WebRTC/socket 模块按兼容性处理

建议新增结构：

```text
src/composables/
  mediamtx/
    config.ts              # 环境变量解析与默认值
    client.ts              # MediaMTX WebRTC/WHEP HTTP 交互
    useMediaMtxReceiver.ts # 单路接收端 composable
    useMediaMtxReceivers.ts# 多路接收端 composable（如需要）
    types.ts               # 状态、选项、流配置类型
    index.ts               # 对外导出
```

旧 `src/composables/WebRTC/` 中与自建信令强绑定的代码应按使用情况处理：

- 若当前 App/示例页面只需要 MediaMTX 播放，则移除 Socket.io 示例和不再使用的导出。
- 若仍需保留业务 socket 推送，可迁移到 `src/composables/socket/` 并与 MediaMTX 播放模块解耦。

Alternatives considered:

- 在现有 `WebRTCPlayer` 内增加 MediaMTX 分支：会混合两种信令模型，使状态机和配置更复杂。
- 完全删除所有旧代码：风险是现有页面或业务事件示例仍引用旧模块，实施时应先确认引用并同步迁移。

### 3. 配置集中由 Vite 环境变量驱动

`.env.example` 应包含可复制的 MediaMTX 配置，例如：

- `VITE_MEDIAMTX_HOST=198.18.0.1`
- `VITE_MEDIAMTX_PROTOCOL=http`
- `VITE_MEDIAMTX_WEBRTC_PORT=8889`
- `VITE_MEDIAMTX_DEFAULT_PATH=cam-front`
- `VITE_MEDIAMTX_WHEP_PATH_TEMPLATE=/{path}/whep`
- `VITE_MEDIAMTX_REQUEST_TIMEOUT_MS=10000`
- `VITE_WEBRTC_STUN_URLS=stun:stun.l.google.com:19302`

代码负责将 `protocol + host + port + path template` 拼成 endpoint，并允许调用方覆盖 path 或完整 URL。

Alternatives considered:

- 将地址硬编码到 composable：测试方便但不可迁移。
- 只提供完整 URL：简单但多路摄像头 path 配置不直观。

### 4. 接收端状态与资源释放由 composable 管理

单路 composable 应返回：

- `status`: `idle | preparing | signaling | connecting | connected | disconnected | failed | closed`
- `error`: 最近一次错误
- `stream`: 当前远端 `MediaStream | null`
- `attach(videoElement)` / `detach()` / `restart()`
- 可选 `receiver` 或 `peerConnection` 调试引用

在 `attach` 后创建连接，收到 `track` 后写入 video `srcObject` 并自动播放；在 `detach` 和组件卸载时关闭 `RTCPeerConnection`、停止 media tracks、取消超时请求、清理 video。

Alternatives considered:

- 只提供底层类，不提供 Vue composable：不符合当前项目封装方式，也不便测试页面使用。
- 让调用方自己管理 video 资源：容易造成重复连接和 track 泄漏。

## Risks / Trade-offs

- [MediaMTX endpoint 版本差异] 不同 MediaMTX 版本可能支持 `/path/whep` 或旧的 `/path/webrtc` API → 通过 endpoint path template 配置和 README 说明进行兼容，实施时优先参考当前部署版本验证。
- [浏览器自动播放限制] 未静音视频可能被阻止播放 → video 默认建议 `muted autoplay playsinline`，代码在失败时记录错误并可尝试静音播放。
- [HTTPS 与 mixed content] 如果页面以 HTTPS 打开而 MediaMTX 使用 HTTP，浏览器可能阻止请求 → README 说明本地测试协议选择，生产建议同源代理或 HTTPS。
- [公网/NAT 连接失败] STUN 不足以覆盖所有网络 → 环境变量预留 ICE servers 配置，后续可加 TURN。
- [删除 socket 代码影响旧示例] 旧 `ExampleDashboard.vue` 依赖 `useSocket` 与 socket 信令 → 实施前用全局搜索确认引用，并将示例迁移为 MediaMTX receiver demo 后再移除无用依赖。

## Migration Plan

1. 新增 MediaMTX receiver 模块与配置解析，保持旧模块暂时不动。
2. 将演示页面迁移到 MediaMTX receiver，用默认 `198.18.0.1` 配置快速验证。
3. 搜索并删除不再被引用的 Socket.io 信令代码、导出和依赖；如仍有业务 socket 需求，则移动到独立 socket 模块。
4. 更新 `.env.example` 和 README。
5. 运行 TypeScript/Vite build，必要时使用实际 MediaMTX path 手动验证播放。

Rollback: 若新接收端接入 MediaMTX 失败，可保留旧 `src/composables/WebRTC/` 分支直到验证完成；已更新的 README 和 `.env.example` 可单独回退，不影响运行时。
