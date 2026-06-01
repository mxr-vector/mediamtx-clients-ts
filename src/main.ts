/**
 * Vue 应用入口文件
 * 
 * 本文件是 Vue 3 应用的启动入口，负责：
 * 1. 导入 Vue 的 createApp 工厂函数
 * 2. 导入根组件 App.vue
 * 3. 创建 Vue 应用实例并挂载到 DOM 元素
 * 
 * 技术栈：
 * - Vue 3.5.34(使用 Composition API)
 * - Vite 8.0.14(构建工具)
 * 
 * @module main
 */

import { createApp } from 'vue'
import App from './App.vue'

/**
 * 创建 Vue 应用实例
 * 
 * createApp() 是 Vue 3 的应用创建方法，接收根组件作为参数
 * 返回的应用实例可用于：
 * - 注册全局组件
 * - 注册全局指令
 * - 注册全局插件
 * - 配置应用级选项
 */
const app = createApp(App)

/**
 * 挂载应用到 DOM
 * 
 * mount('#app') 将 Vue 应用挂载到 HTML 中 id="app" 的元素
 * 挂载后，Vue 将接管该 DOM 元素及其子元素的渲染
 * 
 * 注意：index.html 中需要有 <div id="app"></div> 元素
 */
app.mount('#app')
