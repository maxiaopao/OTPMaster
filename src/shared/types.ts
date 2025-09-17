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

// 自动化操作结果接口
export interface AutomationResult {
  success: boolean
  action: 'copy'
  error?: string
}