/**
 * MediaMTX 协议模块入口
 *
 * 本入口保留现有 WebRTC API 的兼容导出；新增协议实现请放到对应子目录
 * (例如 `webrtc/`、`quic/`) 并在需要时单独导入。
 *
 * @module mediamtx
 */

export * from "./webrtc";
