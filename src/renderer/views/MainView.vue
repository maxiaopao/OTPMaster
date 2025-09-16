<template>
  <div class="main-view">
    <!-- 权限检查区域 -->
    <div v-if="!allPermissionsGranted" class="card">
      <div class="card-header">
        <h2 class="card-title">⚠️ 权限设置</h2>
      </div>
      <div class="card-content">
        <div v-if="!appStore.permissions.fullDiskAccess" class="permission-item">
          <div class="permission-info">
            <h3>完全磁盘访问权限</h3>
            <p>需要此权限来读取 Messages 数据库以提取短信验证码</p>
          </div>
          <button class="btn btn-primary" @click="showDiskAccessGuide">
            授予权限
          </button>
        </div>
        
        <div v-if="!appStore.permissions.accessibility" class="permission-item">
          <div class="permission-info">
            <h3>辅助功能权限</h3>
            <p>需要此权限来执行自动粘贴和回车操作</p>
          </div>
          <button class="btn btn-primary" @click="showAccessibilityGuide">
            授予权限
          </button>
        </div>
      </div>
    </div>

    <!-- 功能设置区域 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">⚙️ 功能设置</h2>
      </div>
      <div class="card-content">
        <div class="list">
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">自动粘贴</div>
              <div class="list-item-description">提取到验证码后自动粘贴到活动窗口</div>
            </div>
            <label class="switch">
              <input 
                type="checkbox" 
                :checked="appStore.config.settings.auto_paste"
                @change="toggleAutoPaste"
              >
              <span class="switch-slider"></span>
            </label>
          </div>
          
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">自动回车</div>
              <div class="list-item-description">粘贴后自动按回车键（需要先启用自动粘贴）</div>
            </div>
            <label class="switch">
              <input 
                type="checkbox" 
                :checked="appStore.config.settings.auto_return"
                :disabled="!appStore.config.settings.auto_paste"
                @change="toggleAutoReturn"
              >
              <span class="switch-slider"></span>
            </label>
          </div>
          
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-title">登录时启动</div>
              <div class="list-item-description">系统启动时自动启动 MessAuto</div>
            </div>
            <label class="switch">
              <input 
                type="checkbox" 
                :checked="appStore.config.settings.launch_at_login"
                @change="toggleLaunchAtLogin"
              >
              <span class="switch-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- 验证码历史区域 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">📋 验证码历史</h2>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" @click="testPaste">
            测试粘贴
          </button>
          <button class="btn btn-secondary btn-sm" @click="testEnter">
            测试回车
          </button>
        </div>
      </div>
      <div class="card-content">
        <div v-if="appStore.verificationCodes.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-text">暂无验证码记录</div>
          <div class="empty-description">当检测到新的短信验证码时，会在这里显示</div>
        </div>
        
        <div v-else class="verification-codes">
          <div 
            v-for="code in appStore.verificationCodes" 
            :key="`${code.code}-${code.timestamp}`"
            class="verification-code-item"
          >
            <div class="code-info">
              <div class="code-value">{{ code.code }}</div>
              <div class="code-meta">
                <span class="code-time">{{ formatTime(code.timestamp) }}</span>
                <span class="code-source">来源: {{ code.source }}</span>
                <span class="code-confidence">可信度: {{ Math.round(code.confidence * 100) }}%</span>
              </div>
            </div>
            <div class="code-actions">
              <button class="btn btn-secondary btn-sm" @click="copyCode(code.code)">
                复制
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="appStore.error" class="card card-error">
      <div class="card-content">
        <div class="error-content">
          <div class="error-icon">❌</div>
          <div class="error-text">{{ appStore.error }}</div>
          <button class="btn btn-secondary btn-sm" @click="appStore.clearError()">
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()

const allPermissionsGranted = computed(() => 
  appStore.permissions.fullDiskAccess && appStore.permissions.accessibility
)

const showDiskAccessGuide = () => {
  appStore.showPermissionGuide('disk-access')
}

const showAccessibilityGuide = () => {
  appStore.showPermissionGuide('accessibility')
}

const toggleAutoPaste = async () => {
  await appStore.updateSettings({
    auto_paste: !appStore.config.settings.auto_paste,
  })
}

const toggleAutoReturn = async () => {
  await appStore.updateSettings({
    auto_return: !appStore.config.settings.auto_return,
  })
}

const toggleLaunchAtLogin = async () => {
  await appStore.updateSettings({
    launch_at_login: !appStore.config.settings.launch_at_login,
  })
}

const testPaste = () => {
  appStore.simulatePaste()
}

const testEnter = () => {
  appStore.simulateEnter()
}

const copyCode = async (code: string) => {
  try {
    await navigator.clipboard.writeText(code)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

const formatTime = (timestamp: Date) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<style scoped>
.main-view {
  max-width: 800px;
  margin: 0 auto;
}

.permission-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #F2F2F7;
}

.permission-item:last-child {
  border-bottom: none;
}

.permission-info h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1D1D1F;
  margin-bottom: 4px;
}

.permission-info p {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 18px;
  font-weight: 600;
  color: #1D1D1F;
  margin-bottom: 8px;
}

.empty-description {
  font-size: 14px;
  color: #666;
}

.verification-codes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.verification-code-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #F8F9FA;
  border-radius: 8px;
  border: 1px solid #E9ECEF;
}

.code-info {
  flex: 1;
}

.code-value {
  font-size: 18px;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  color: #007AFF;
  margin-bottom: 4px;
}

.code-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.code-actions {
  margin-left: 16px;
}

.card-error {
  border-left: 4px solid #FF3B30;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-icon {
  font-size: 20px;
}

.error-text {
  flex: 1;
  color: #FF3B30;
  font-weight: 500;
}
</style>