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
      </div>
    </div>

    <!-- 实时监控状态区域 -->
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">📡 实时监控</h2>
      </div>
      <div class="card-content">
        <div class="monitor-status">
          <div class="status-indicator">
            <div class="status-dot active"></div>
            <span class="status-text">正在监控最新短信...</span>
          </div>
          <div class="monitor-description">
            <p>应用正在实时监控您的短信，当收到包含验证码的新短信时，将自动解析验证码并复制到剪贴板。</p>
          </div>
          
          <!-- 最新短信显示区域 -->
          <div v-if="latestMessage" class="latest-message">
            <div class="message-header">
              <span class="message-label">📱 最新短信</span>
              <span class="message-time">{{ formatTime(latestMessage.timestamp) }}</span>
            </div>
            <div class="message-content">{{ latestMessage.text }}</div>
            <div class="message-sender">来自: {{ latestMessage.sender }}</div>
            <div v-if="latestMessageVerificationCode" class="verification-code-display">
              <span class="code-label">🔑 验证码:</span>
              <span class="code-value">{{ latestMessageVerificationCode.code }}</span>
              <span class="code-status">已复制到剪贴板</span>
            </div>
          </div>
          
          <div v-else class="no-message">
            <span class="no-message-text">等待新短信...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '../stores/app'
import type { SMSMessage, VerificationCode } from '@shared/types'

const appStore = useAppStore()

// 最新短信和验证码状态
const latestMessage = ref<SMSMessage | null>(null)
const latestVerificationCode = ref<VerificationCode | null>(null)

// 计算属性：检查最新短信是否包含验证码
const latestMessageVerificationCode = computed(() => {
  if (!latestMessage.value) return null
  
  // 使用与后端相同的验证码提取逻辑
  const text = latestMessage.value.text
  const patterns = [
    /\b\d{4,8}\b/g,
    /\b[A-Z0-9]{4,8}\b/g,
    /(?:验证码|code|verification)[\s\u00a0]*[:：]?\s*([A-Z0-9]{4,8})/gi,
    /(?:您的|your)\s*(?:验证码|code)\s*(?:是|is)[\s\u00a0]*[:：]?\s*([A-Z0-9]{4,8})/gi,
  ]
  
  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) {
      // 返回最可能的验证码（通常是4-8位数字或字母数字组合）
      const code = matches[0].replace(/[^A-Z0-9]/gi, '')
      if (code.length >= 4 && code.length <= 8) {
        return {
          code,
          confidence: 0.9,
          timestamp: new Date(),
          source: latestMessage.value.sender
        }
      }
    }
  }
  return null
})

const allPermissionsGranted = computed(() => 
  appStore.permissions.fullDiskAccess && appStore.permissions.accessibility
)

const showDiskAccessGuide = () => {
  appStore.showPermissionGuide('disk-access')
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

// 监听事件
if (typeof window !== 'undefined' && window.electronAPI) {
  // 监听验证码提取事件
  window.electronAPI.onVerificationCodeExtracted((code: VerificationCode) => {
    latestVerificationCode.value = code
    console.log('收到验证码:', code)
  })
  
  // 监听最新短信事件
  window.electronAPI.onLatestMessageReceived((message: SMSMessage) => {
    latestMessage.value = message
    console.log('收到最新短信:', message)
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

.monitor-status {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #34C759;
  animation: pulse 2s infinite;
}

.status-dot.active {
  background: #34C759;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.status-text {
  font-size: 16px;
  font-weight: 600;
  color: #1D1D1F;
}

.monitor-description {
  padding: 12px;
  background: #F8F9FA;
  border-radius: 6px;
  border-left: 4px solid #34C759;
}

.monitor-description p {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.latest-message {
  margin-top: 20px;
  padding: 16px;
  background: #F8F9FA;
  border-radius: 8px;
  border-left: 4px solid #007AFF;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.message-label {
  font-size: 14px;
  font-weight: 600;
  color: #1D1D1F;
}

.message-time {
  font-size: 12px;
  color: #666;
}

.message-content {
  font-size: 14px;
  color: #1D1D1F;
  line-height: 1.4;
  margin-bottom: 8px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #E5E5EA;
}

.message-sender {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
}

.verification-code-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #E7F5E7;
  border-radius: 6px;
  border: 1px solid #34C759;
}

.code-label {
  font-size: 14px;
  font-weight: 600;
  color: #1D7324;
}

.code-value {
  font-size: 16px;
  font-weight: 700;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  color: #1D7324;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #34C759;
}

.code-status {
  font-size: 12px;
  color: #1D7324;
  background: #D1F2D1;
  padding: 2px 6px;
  border-radius: 3px;
}

.no-message {
  margin-top: 20px;
  padding: 20px;
  text-align: center;
  background: #F8F9FA;
  border-radius: 8px;
  border: 2px dashed #E5E5EA;
}

.no-message-text {
  font-size: 14px;
  color: #666;
  font-style: italic;
}
</style>