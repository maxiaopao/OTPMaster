// 简单的剪贴板测试脚本
const { clipboard } = require('electron')

console.log('测试剪贴板功能...')

// 测试写入
try {
  const testText = '测试文本123456'
  clipboard.writeText(testText)
  console.log('✅ 写入剪贴板成功:', testText)
  
  // 测试读取
  const readText = clipboard.readText()
  console.log('✅ 从剪贴板读取:', readText)
  
  if (readText === testText) {
    console.log('✅ 剪贴板功能正常工作')
  } else {
    console.log('❌ 剪贴板读写不一致')
  }
} catch (error) {
  console.error('❌ 剪贴板测试失败:', error)
}