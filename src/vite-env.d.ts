/**
 * Vite 环境类型声明文件
 * 
 * 本文件为 Vite 项目提供 TypeScript 类型声明，主要功能：
 * 1. 引入 Vite 客户端类型定义
 * 2. 为 .vue 文件声明模块类型
 * 
 * 该文件确保 TypeScript 编译器能够正确识别：
 * - Vite 特有的 API(如 import.meta.env)
 * - Vue 单文件组件的类型信息
 * 
 * @module vite-env
 */

/// <reference types="vite/client" />

/**
 * Vue 单文件组件模块声明
 * 
 * 为所有 .vue 文件提供 TypeScript 类型支持
 * 这使得 TypeScript 能够：
 * - 正确导入 .vue 文件
 * - 为 Vue 组件提供类型推断
 * - 支持 IDE 的智能提示和代码补全
 * 
 * DefineComponent 是 Vue 3 中用于定义组件的类型
 * 泛型参数分别表示：
 * - Props 类型
 * - RawBindings 类型
 * - Data 类型
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
