import type { LocaleConfig } from './types'

// OTPMaster 应用常量
export const APP_CONFIG = {
  NAME: 'OTPMaster',
  VERSION: '1.0.0',
  BUNDLE_ID: 'com.otpmaster.electron',
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