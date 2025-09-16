<template>
  <header class="header">
    <div class="header-content">
      <div class="header-left">
        <h1 class="app-title">📨 MessAuto</h1>
        <span class="app-version">v{{ appInfo.version }}</span>
      </div>
      
      <div class="header-right">
        <div class="permission-status">
          <div class="status-item">
            <span class="status-dot" :class="diskAccessStatus"></span>
            <span class="status-text">磁盘访问</span>
          </div>
          <div class="status-item">
            <span class="status-dot" :class="accessibilityStatus"></span>
            <span class="status-text">辅助功能</span>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()

const appInfo = computed(() => appStore.getAppInfo())

const diskAccessStatus = computed(() => 
  appStore.permissions.fullDiskAccess ? 'status-success' : 'status-error'
)

const accessibilityStatus = computed(() => 
  appStore.permissions.accessibility ? 'status-success' : 'status-error'
)
</script>

<style scoped>
.header {
  background: white;
  border-bottom: 1px solid #E5E5EA;
  padding: 16px 20px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-title {
  font-size: 20px;
  font-weight: 600;
  color: #1D1D1F;
  margin: 0;
}

.app-version {
  font-size: 12px;
  color: #666;
  background: #F2F2F7;
  padding: 2px 6px;
  border-radius: 4px;
}

.permission-status {
  display: flex;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.status-success {
  background-color: #34C759;
}

.status-dot.status-error {
  background-color: #FF3B30;
}

.status-text {
  font-size: 12px;
  color: #666;
}
</style>