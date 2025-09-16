// 应用配置接口
export interface AppConfig {
  version: string
  settings: AppSettings
  monitoring: MonitoringConfig
}

// 应用设置接口
export interface AppSettings {
  auto_paste: boolean
  auto_return: boolean
  hide_icon_forever: boolean
  launch_at_login: boolean
  language: 'auto' | 'zh-CN' | 'en'
}

// 监控配置接口
export interface MonitoringConfig {
  check_interval: number
  message_lookback_minutes: number
}

// 托盘菜单状态接口
export interface TrayMenuState {
  autoPaste: boolean
  autoReturn: boolean
  launchAtLogin: boolean
  hideIconForever: boolean
}

// 短信消息接口
export interface SMSMessage {
  id: string
  text: string
  sender: string
  timestamp: Date
  guid: string
}

// 验证码接口
export interface VerificationCode {
  code: string
  confidence: number
  timestamp: Date
  source: string
}

// 权限状态接口
export interface PermissionStatus {
  fullDiskAccess: boolean
  accessibility: boolean
}

// 权限检查结果接口
export interface PermissionCheckResult {
  hasPermission: boolean
  errorMessage?: string
}

// IPC 通信事件类型
export interface IPCEvents {
  // 主进程到渲染进程
  'permission-status-changed': PermissionStatus
  'config-updated': AppConfig
  'verification-code-extracted': VerificationCode
  'tray-menu-clicked': string

  // 渲染进程到主进程
  'request-permission-check': void
  'update-config': Partial<AppSettings>
  'show-permission-guide': 'disk-access' | 'accessibility'
  'simulate-paste': void
  'simulate-enter': void
}

// 数据库查询结果接口
export interface DatabaseQueryResult {
  success: boolean
  data?: SMSMessage[]
  error?: string
}

// 自动化操作结果接口
export interface AutomationResult {
  success: boolean
  action: 'paste' | 'enter' | 'copy'
  error?: string
}

// 文件监控事件接口
export interface FileWatchEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  timestamp: Date
}

// 语言配置接口
export interface LocaleConfig {
  code: string
  name: string
  flag: string
}

// 应用状态接口
export interface AppState {
  isMonitoring: boolean
  permissions: PermissionStatus
  config: AppConfig
  lastVerificationCode?: VerificationCode
}