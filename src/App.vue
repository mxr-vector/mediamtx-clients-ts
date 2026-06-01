/** * Vue 应用根组件 * * 本文件是 Vue 应用的根组件，作为整个应用的顶层容器。 * 主要职责： * 1.
导入并渲染 ExampleDashboard 组件 * 2. 提供应用的基础布局结构 * * 组件特点： * - 使用 Vue 3 的 script
setup 语法（Composition API） * - 简洁的组件结构，专注于布局和组件组合 * -
无复杂逻辑，主要作为路由入口或组件容器 * * @component App */

<script setup>
/**
 * 导入示例仪表板组件
 *
 * ExampleDashboard 是应用的主要功能组件，
 * 包含 MediaMTX WebRTC 视频监控的完整功能
 */
import ExampleDashboard from "./components/ExampleDashboard.vue";
</script>

<template>
  <!--
    根组件模板
    渲染 ExampleDashboard 组件作为应用主界面
    该组件提供了完整的 RTSP 视频监控功能
  -->
  <ExampleDashboard />
</template>
