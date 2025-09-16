import { LocaleConfig } from './types'

// 应用常量
export const APP_CONFIG = {
  NAME: 'MessAuto',
  VERSION: '1.0.0',
  BUNDLE_ID: 'com.messauto.electron',
} as const

// 默认配置
export const DEFAULT_CONFIG = {
  version: '1.0.0',
  settings: {
    auto_paste: false,
    auto_return: false,
    hide_icon_forever: false,
    launch_at_login: false,
    language: 'auto' as const,
  },
  monitoring: {
    check_interval: 1000,
    message_lookback_minutes: 1,
  },
} as const

// 文件路径常量
export const PATHS = {
  CONFIG_DIR: '~/.config/messauto',
  CONFIG_FILE: '~/.config/messauto/messauto.json',
  MESSAGES_DB: '~/Library/Messages/chat.db',
  MESSAGES_DB_WAL: '~/Library/Messages/chat.db-wal',
} as const

// 验证码提取相关常量
export const VERIFICATION_CODE = {
  // 验证码关键词
  KEYWORDS: ['验证码', 'verification', 'code', '인증', 'verify', '驗證', 'OTP'],
  
  // 验证码正则表达式
  PATTERNS: [
    /\b\d{4,8}\b/g,                    // 4-8位数字
    /\b[A-Z0-9]{4,8}\b/g,              // 4-8位字母数字组合
    /(?:验证码|code|verification)[\s\u00a0]*[:：]?\s*([A-Z0-9]{4,8})/gi, // 带关键词的验证码
    /(?:您的|your)\s*(?:验证码|code)\s*(?:是|is)[\s\u00a0]*[:：]?\s*([A-Z0-9]{4,8})/gi, // 完整句式
  ],
  
  // 最小置信度
  MIN_CONFIDENCE: 0.6,
  
  // 最大验证码长度
  MAX_LENGTH: 8,
  
  // 最小验证码长度
  MIN_LENGTH: 4,
} as const

// 数据库查询常量
export const DATABASE = {
  // 查询间隔（毫秒）
  QUERY_INTERVAL: 1000,
  
  // 查看历史消息的时间范围（分钟）
  LOOKBACK_MINUTES: 1,
  
  // SQLite 查询超时时间（毫秒）
  QUERY_TIMEOUT: 5000,
  
  // 消息表名
  MESSAGE_TABLE: 'message',
  
  // 聊天表名
  CHAT_TABLE: 'chat',
  
  // 处理表名
  HANDLE_TABLE: 'handle',
} as const

// 自动化操作常量
export const AUTOMATION = {
  // 操作间延迟（毫秒）
  ACTION_DELAY: 100,
  
  // 粘贴快捷键
  PASTE_SHORTCUT: ['command', 'v'],
  
  // 回车键
  ENTER_KEY: 'enter',
  
  // 操作超时时间（毫秒）
  OPERATION_TIMEOUT: 3000,
} as const

// 权限相关常量
export const PERMISSIONS = {
  // 权限检查间隔（毫秒）
  CHECK_INTERVAL: 5000,
  
  // 系统偏好设置路径
  SYSTEM_PREFERENCES_PATHS: {
    PRIVACY: 'x-apple.systempreferences:com.apple.preference.security?Privacy',
    ACCESSIBILITY: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    FULL_DISK_ACCESS: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
  },
} as const

// 支持的语言配置
export const SUPPORTED_LOCALES: LocaleConfig[] = [
  {
    code: 'auto',
    name: 'Auto',
    flag: '🌐',
  },
  {
    code: 'zh-CN',
    name: '简体中文',
    flag: '🇨🇳',
  },
  {
    code: 'en',
    name: 'English',
    flag: '🇺🇸',
  },
] as const

// IPC 通信频道名称
export const IPC_CHANNELS = {
  // 配置相关
  GET_CONFIG: 'get-config',
  UPDATE_CONFIG: 'update-config',
  CONFIG_UPDATED: 'config-updated',
  
  // 权限相关
  CHECK_PERMISSIONS: 'check-permissions',
  PERMISSION_STATUS_CHANGED: 'permission-status-changed',
  SHOW_PERMISSION_GUIDE: 'show-permission-guide',
  
  // 验证码相关
  VERIFICATION_CODE_EXTRACTED: 'verification-code-extracted',
  SIMULATE_PASTE: 'simulate-paste',
  SIMULATE_ENTER: 'simulate-enter',
  
  // 应用状态
  APP_STATE_CHANGED: 'app-state-changed',
  TRAY_MENU_CLICKED: 'tray-menu-clicked',
  
  // 窗口管理
  SHOW_WINDOW: 'show-window',
  HIDE_WINDOW: 'hide-window',
  CLOSE_WINDOW: 'close-window',
} as const

// 托盘菜单项 ID
export const TRAY_MENU_IDS = {
  AUTO_PASTE: 'auto_paste',
  AUTO_RETURN: 'auto_return',
  HIDE_ICON_TEMP: 'hide_icon_temp',
  HIDE_ICON_FOREVER: 'hide_icon_forever',
  LAUNCH_AT_LOGIN: 'launch_at_login',
  SETTINGS: 'settings',
  ABOUT: 'about',
  QUIT: 'quit',
} as const

// 错误代码
export const ERROR_CODES = {
  // 权限错误
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DISK_ACCESS_REQUIRED: 'DISK_ACCESS_REQUIRED',
  ACCESSIBILITY_REQUIRED: 'ACCESSIBILITY_REQUIRED',
  
  // 数据库错误
  DATABASE_NOT_FOUND: 'DATABASE_NOT_FOUND',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  
  // 自动化错误
  AUTOMATION_FAILED: 'AUTOMATION_FAILED',
  CLIPBOARD_ACCESS_FAILED: 'CLIPBOARD_ACCESS_FAILED',
  
  // 配置错误
  CONFIG_LOAD_FAILED: 'CONFIG_LOAD_FAILED',
  CONFIG_SAVE_FAILED: 'CONFIG_SAVE_FAILED',
  
  // 通用错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
} as const