import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import { AppConfig, AppSettings, PermissionStatus, VerificationCode } from '@shared/types'
import { DEFAULT_CONFIG } from '@shared/constants'

export const useAppStore = defineStore('app', () => {
  // 状态
  const config = ref<AppConfig>({ ...DEFAULT_CONFIG })
  const permissions = ref<PermissionStatus>({
    fullDiskAccess: false,
    accessibility: false,
  })
  const verificationCodes = ref<VerificationCode[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 清理函数列表
  const cleanupFunctions: (() => void)[] = []

  // 初始化
  const initialize = async () => {
    try {
      isLoading.value = true
      
      // 获取初始配置
      await loadConfig()
      
      // 检查权限状态
      await checkPermissions()
      
      // 设置事件监听器
      setupEventListeners()
      
    } catch (err) {
      error.value = String(err)
      console.error('应用初始化失败:', err)
    } finally {
      isLoading.value = false
    }
  }

  // 加载配置
  const loadConfig = async () => {
    try {
      const newConfig = await window.electronAPI.getConfig()
      config.value = newConfig
    } catch (err) {
      console.error('加载配置失败:', err)
      throw err
    }
  }

  // 更新配置
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      await window.electronAPI.updateConfig(newSettings)
      // 配置会通过事件监听器自动更新
    } catch (err) {
      error.value = '更新设置失败'
      console.error('更新设置失败:', err)
      throw err
    }
  }

  // 检查权限
  const checkPermissions = async () => {
    try {
      const status = await window.electronAPI.checkPermissions()
      permissions.value = status
    } catch (err) {
      console.error('检查权限失败:', err)
    }
  }

  // 显示权限引导
  const showPermissionGuide = (type: 'disk-access' | 'accessibility') => {
    window.electronAPI.showPermissionGuide(type)
  }

  // 模拟粘贴
  const simulatePaste = async () => {
    try {
      await window.electronAPI.simulatePaste()
    } catch (err) {
      error.value = '粘贴操作失败'
      console.error('粘贴操作失败:', err)
    }
  }

  // 模拟回车
  const simulateEnter = async () => {
    try {
      await window.electronAPI.simulateEnter()
    } catch (err) {
      error.value = '回车操作失败'
      console.error('回车操作失败:', err)
    }
  }

  // 设置事件监听器
  const setupEventListeners = () => {
    // 监听配置更新
    const unsubscribeConfig = window.electronAPI.onConfigUpdated((newConfig) => {
      config.value = newConfig
    })
    cleanupFunctions.push(unsubscribeConfig)

    // 监听权限状态变更
    const unsubscribePermissions = window.electronAPI.onPermissionStatusChanged((status) => {
      permissions.value = status
    })
    cleanupFunctions.push(unsubscribePermissions)

    // 监听验证码提取
    const unsubscribeVerificationCode = window.electronAPI.onVerificationCodeExtracted((code) => {
      verificationCodes.value.unshift(code)
      
      // 限制历史记录数量
      if (verificationCodes.value.length > 50) {
        verificationCodes.value = verificationCodes.value.slice(0, 50)
      }
    })
    cleanupFunctions.push(unsubscribeVerificationCode)

    // 监听托盘菜单点击
    const unsubscribeTrayMenu = window.electronAPI.onTrayMenuClicked((menuId) => {
      console.log('托盘菜单点击:', menuId)
    })
    cleanupFunctions.push(unsubscribeTrayMenu)
  }

  // 清理资源
  const cleanup = () => {
    cleanupFunctions.forEach(fn => fn())
    cleanupFunctions.length = 0
  }

  // 清除错误
  const clearError = () => {
    error.value = null
  }

  // 获取应用信息
  const getAppInfo = () => {
    return {
      version: window.electronAPI.getAppVersion(),
      platform: window.electronAPI.getPlatform(),
    }
  }

  return {
    // 状态
    config,
    permissions,
    verificationCodes,
    isLoading,
    error,

    // 方法
    initialize,
    loadConfig,
    updateSettings,
    checkPermissions,
    showPermissionGuide,
    simulatePaste,
    simulateEnter,
    cleanup,
    clearError,
    getAppInfo,
  }
})