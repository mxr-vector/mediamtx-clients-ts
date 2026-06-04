/**
 * MediaMTX 协议模块入口
 *
 * 本入口保留现有 WebRTC API 的兼容导出；新增协议实现按子模块命名空间导出，
 * 避免不同协议之间的类型或函数命名冲突。
 *
 * @module mediamtx
 */

export * from "./webrtc";
export * as webrtc from "./webrtc";
export * as quic from "./quic";
