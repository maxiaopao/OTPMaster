import type { VerificationCode } from './types'
import { VERIFICATION_CODE } from './constants'

/**
 * 从文本中提取验证码
 * @param text 要检查的文本
 * @param source 消息来源
 * @returns 验证码对象或 null
 */
export function extractVerificationCode(text: string, source: string = ''): VerificationCode | null {
  if (!text || typeof text !== 'string') {
    return null
  }

  const normalizedText = text.toLowerCase()
  
  // 检查是否包含验证码关键词
  const hasKeyword = VERIFICATION_CODE.KEYWORDS.some(keyword => 
    normalizedText.includes(keyword.toLowerCase())
  )

  if (!hasKeyword) {
    return null
  }

  let bestMatch: VerificationCode | null = null
  let highestConfidence = 0

  // 尝试所有正则表达式模式
  for (const pattern of VERIFICATION_CODE.PATTERNS) {
    const matches = text.match(pattern)
    if (matches) {
      for (const match of matches) {
        const code = match.trim()
        const confidence = calculateConfidence(code, text)
        
        if (confidence > highestConfidence && confidence >= VERIFICATION_CODE.MIN_CONFIDENCE) {
          highestConfidence = confidence
          bestMatch = {
            code,
            confidence,
            timestamp: new Date(),
            source,
          }
        }
      }
    }
  }

  return bestMatch
}

/**
 * 计算验证码的置信度
 * @param code 提取的验证码
 * @param originalText 原始文本
 * @returns 置信度分数 (0-1)
 */
function calculateConfidence(code: string, originalText: string): number {
  let confidence = 0

  // 长度检查
  if (code.length >= VERIFICATION_CODE.MIN_LENGTH && code.length <= VERIFICATION_CODE.MAX_LENGTH) {
    confidence += 0.3
  }

  // 数字验证码通常置信度更高
  if (/^\d+$/.test(code)) {
    confidence += 0.2
  }

  // 混合字母数字
  if (/^[A-Z0-9]+$/.test(code)) {
    confidence += 0.1
  }

  // 关键词上下文检查
  const lowerText = originalText.toLowerCase()
  const codeIndex = lowerText.indexOf(code.toLowerCase())
  
  if (codeIndex !== -1) {
    const beforeCode = lowerText.substring(Math.max(0, codeIndex - 20), codeIndex)
    const afterCode = lowerText.substring(codeIndex + code.length, codeIndex + code.length + 20)
    
    // 检查前后文是否有验证码相关词汇
    const contextKeywords = ['验证码', 'code', 'verification', '是', 'is', ':', '：']
    for (const keyword of contextKeywords) {
      if (beforeCode.includes(keyword) || afterCode.includes(keyword)) {
        confidence += 0.1
        break
      }
    }
  }

  // 常见验证码长度奖励
  if (code.length === 4 || code.length === 6) {
    confidence += 0.2
  }

  return Math.min(confidence, 1)
}

/**
 * 格式化时间戳
 * @param timestamp 时间戳
 * @returns 格式化的时间字符串
 */
export function formatTimestamp(timestamp: Date): string {
  return timestamp.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 检查是否为有效的验证码
 * @param code 验证码字符串
 * @returns 是否有效
 */
export function isValidVerificationCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false
  }

  const trimmedCode = code.trim()
  
  // 长度检查
  if (trimmedCode.length < VERIFICATION_CODE.MIN_LENGTH || 
      trimmedCode.length > VERIFICATION_CODE.MAX_LENGTH) {
    return false
  }

  // 格式检查：只允许字母和数字
  return /^[A-Z0-9]+$/i.test(trimmedCode)
}

/**
 * 清理和标准化验证码
 * @param code 原始验证码
 * @returns 清理后的验证码
 */
export function normalizeVerificationCode(code: string): string {
  if (!code) return ''
  
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/**
 * 延迟执行
 * @param ms 延迟毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 安全地解析 JSON
 * @param jsonString JSON 字符串
 * @param defaultValue 默认值
 * @returns 解析后的对象或默认值
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T
  } catch {
    return defaultValue
  }
}

/**
 * 获取错误消息
 * @param error 错误对象
 * @returns 错误消息字符串
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return String(error)
}

/**
 * 检查是否为 macOS
 * @returns 是否为 macOS
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin'
}

/**
 * 生成唯一 ID
 * @returns 唯一 ID 字符串
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}