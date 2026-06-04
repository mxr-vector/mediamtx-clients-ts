/**
 * MediaMTX 协议公共配置工具
 *
 * 本文件提供环境变量解析、URL 构建等协议无关工具。
 *
 * @module mediamtx/config
 */

import type { MediaMtxProtocol } from "./types";

/**
 * 获取环境变量值
 */
export function getEnv(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * 按顺序读取多个环境变量，返回第一个非空值。
 */
export function getFirstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return undefined;
}

/**
 * 解析协议类型。
 */
export function parseProtocol(value: string | undefined, fallback: MediaMtxProtocol = "http"): MediaMtxProtocol {
  if (value === "http" || value === "https") return value;
  return fallback;
}

/**
 * 解析逗号分隔的列表。
 */
export function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 解析正数毫秒超时时间。
 */
export function parseTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 规范化路径模板并替换 {path}。
 */
export function buildPathFromTemplate(template: string, path: string): string {
  const normalized = template.startsWith("/") ? template : `/${template}`;
  return normalized.replace("{path}", encodeURIComponent(path));
}

/**
 * 构建 HTTP/HTTPS URL。
 */
export function buildMediaMtxHttpUrl(options: {
  protocol: MediaMtxProtocol;
  host: string;
  port?: string;
  path: string;
}): string {
  const port = options.port ? `:${options.port}` : "";
  return `${options.protocol}://${options.host}${port}${options.path}`;
}
