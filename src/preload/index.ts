import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, AppSettings, PermissionStatus, VerificationCode, SMSMessage } from '@shared/types'
import { IPC_CHANNELS } from '@shared/constants'

// 定义暴露给渲染进程的 API
export interface ElectronAPI {
  // 配置相关
  getConfig: () => Promise<AppConfig>
  updateConfig: (settings: Partial<AppSettings>) => Promise<void>
  onConfigUpdated: (callback: (config: AppConfig) => void) => () => void

  // 权限相关
  checkPermissions: () => Promise<PermissionStatus>
  showPermissionGuide: (type: 'disk-access' | 'accessibility') => void
  onPermissionStatusChanged: (callback: (status: PermissionStatus) => void) => () => void

  // 验证码相关
  onVerificationCodeExtracted: (callback: (code: VerificationCode) => void) => () => void
  onLatestMessageReceived: (callback: (message: SMSMessage) => void) => () => void
  copyToClipboard: (text: string) => Promise<{ success: boolean; error?: string }>

  // 窗口管理
  showWindow: () => void
  hideWindow: () => void
  closeWindow: () => void

  // 托盘菜单
  onTrayMenuClicked: (callback: (menuId: string) => void) => () => void

  // 应用信息
  getAppVersion: () => string
  getPlatform: () => string
}

// 实现 API
const electronAPI: ElectronAPI = {
  // 配置相关
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG),
  
  updateConfig: (settings: Partial<AppSettings>) => 
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CONFIG, settings),
  
  onConfigUpdated: (callback: (config: AppConfig) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: AppConfig) => callback(config)
    ipcRenderer.on(IPC_CHANNELS.CONFIG_UPDATED, handler)
    
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_UPDATED, handler)
    }
  },

  // 权限相关
  checkPermissions: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_PERMISSIONS),
  
  showPermissionGuide: (type: 'disk-access' | 'accessibility') => 
    ipcRenderer.send(IPC_CHANNELS.SHOW_PERMISSION_GUIDE, type),
  
  onPermissionStatusChanged: (callback: (status: PermissionStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: PermissionStatus) => callback(status)
    ipcRenderer.on(IPC_CHANNELS.PERMISSION_STATUS_CHANGED, handler)
    
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PERMISSION_STATUS_CHANGED, handler)
    }
  },

  // 验证码相关
  onVerificationCodeExtracted: (callback: (code: VerificationCode) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, code: VerificationCode) => callback(code)
    ipcRenderer.on(IPC_CHANNELS.VERIFICATION_CODE_EXTRACTED, handler)
    
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.VERIFICATION_CODE_EXTRACTED, handler)
    }
  },

  onLatestMessageReceived: (callback: (message: SMSMessage) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: SMSMessage) => callback(message)
    ipcRenderer.on('latest-message-received', handler)
    
    return () => {
      ipcRenderer.removeListener('latest-message-received', handler)
    }
  },

  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.COPY_TO_CLIPBOARD, text),

  // 窗口管理
  showWindow: () => ipcRenderer.send(IPC_CHANNELS.SHOW_WINDOW),
  
  hideWindow: () => ipcRenderer.send(IPC_CHANNELS.HIDE_WINDOW),
  
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.CLOSE_WINDOW),

  // 托盘菜单
  onTrayMenuClicked: (callback: (menuId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, menuId: string) => callback(menuId)
    ipcRenderer.on(IPC_CHANNELS.TRAY_MENU_CLICKED, handler)
    
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TRAY_MENU_CLICKED, handler)
    }
  },

  // 应用信息
  getAppVersion: () => process.env.npm_package_version || '1.0.0',
  
  getPlatform: () => process.platform,
}

// 暴露 API 到渲染进程
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  } catch (error) {
    console.error('Failed to expose electronAPI:', error)
  }
} else {
  // 如果 contextIsolation 被禁用，直接附加到 window 对象
  ;(window as any).electronAPI = electronAPI
}

// 类型声明，供 TypeScript 使用
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}