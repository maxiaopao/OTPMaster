import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import App from './App.vue'

// 导入样式
import './assets/styles/main.css'

// 创建 Pinia 实例
const pinia = createPinia()

// 创建 i18n 实例
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages: {
    'zh-CN': {},
    'en': {},
  },
})

// 创建 Vue 应用
const app = createApp(App)

// 使用插件
app.use(pinia)
app.use(i18n)

// 挂载应用
app.mount('#app')