// 简单的测试脚本，验证复制功能
const { clipboard } = require('electron')

console.log('🧪 测试复制功能...')

// 清空剪贴板
clipboard.clear()
console.log('清空剪贴板完成')

// 复制测试文本
const testCode = '123456'
clipboard.writeText(testCode)
console.log(`已复制测试验证码: ${testCode}`)

// 验证剪贴板内容
const clipboardContent = clipboard.readText()
console.log(`剪贴板当前内容: "${clipboardContent}"`)

if (clipboardContent === testCode) {
  console.log('✅ 复制功能正常工作！')
} else {
  console.log('❌ 复制功能异常！')
}