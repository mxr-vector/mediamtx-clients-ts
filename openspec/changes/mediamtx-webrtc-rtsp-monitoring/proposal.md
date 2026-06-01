## Why

当前项目已有 WebRTC 与 WebSocket 的基础封装，但缺少面向 MediaMTX WebRTC 播放 RTSP 监控流的完整接收端能力，导致无法快速验证服务器 `198.18.0.1` 上已部署的 MediaMTX 实时视频传输链路。

本次变更将明确使用 MediaMTX 的 WebRTC HTTP/WHEP 播放方式作为主链路，补齐接收端 composable、配置示例和文档，减少此前基于自建 WebSocket 信令方案遗留的冗余代码。

## What Changes

- 新增或完善 `src/composables/` 下的 MediaMTX WebRTC 接收端封装，便于页面或测试代码通过统一 API 播放 RTSP 转 WebRTC 监控流。
- 将 MediaMTX 地址、协议、默认流名称、超时等可变配置整理到 `.env.example`，供 `.env` 复制使用。
- 评估现有 WebSocket 信令代码：如果 MediaMTX WebRTC 播放不依赖自建 WebSocket，则删除或隔离无用的 socket/signaling 代码路径。
- 按功能重新分包命名 WebRTC、MediaMTX、配置和测试辅助代码，提升可读性和后续扩展性。
- 完善 `README.md`：增加 MediaMTX WebRTC 播放说明、环境变量、运行/测试步骤，以及 RTSP→MediaMTX→WebRTC Client 的流程图。
- 不引入破坏性外部 API；若现有页面依赖旧 composable，将通过兼容导出或迁移说明降低影响。

## Capabilities

### New Capabilities
- `mediamtx-webrtc-receiver`: 覆盖基于 MediaMTX WebRTC/WHEP 接收 RTSP 转 WebRTC 视频流的配置、连接、播放、状态管理、错误处理和文档化测试能力。

### Modified Capabilities

## Impact

- Affected code: `src/composables/`, 可能的 WebSocket/signaling 相关封装文件、页面调用方、配置读取逻辑。
- Affected configuration: `.env.example` 新增 MediaMTX/WebRTC 相关变量。
- Affected documentation: `README.md` 新增运行说明、配置示例、链路流程图和故障排查。
- External systems: 依赖已部署的 MediaMTX 服务，默认地址为 `198.18.0.1`，并参考 MediaMTX 官方 WebRTC 文档。
- Dependencies: 优先复用浏览器原生 WebRTC API 和项目现有依赖；除非现有项目确有需要，不新增自建 WebSocket 信令依赖。
