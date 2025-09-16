<template>
  <div id="app" class="app">
    <HeaderComponent />
    
    <main class="main-content">
      <router-view v-if="$route" />
      <MainView v-else />
    </main>
    
    <FooterComponent />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import HeaderComponent from './components/HeaderComponent.vue'
import FooterComponent from './components/FooterComponent.vue'
import MainView from './views/MainView.vue'
import { useAppStore } from './stores/app'

const appStore = useAppStore()

onMounted(() => {
  // 初始化应用
  appStore.initialize()
})

onUnmounted(() => {
  // 清理资源
  appStore.cleanup()
})
</script>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}
</style>