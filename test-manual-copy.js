// 手动测试复制功能的脚本
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

// 创建测试窗口
function createTestWindow() {
  const testWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // 加载测试HTML
  testWindow.loadFile(path.join(__dirname, 'test-copy.html'))

  return testWindow
}

app.whenReady().then(() => {
  const testWindow = createTestWindow()
  
  // 处理复制测试请求
  ipcMain.handle('test-copy', async () => {
    try {
      // 模拟验证码
      const testCode = '123456'
      console.log('开始测试复制功能...')
      
      // 使用主进程的复制功能
      const { clipboard } = require('electron')
      clipboard.writeText(testCode)
      
      // 验证复制结果
      const clipboardContent = clipboard.readText()
      console.log(`复制的内容: "${clipboardContent}"`)
      
      if (clipboardContent === testCode) {
        console.log('✅ 复制功能正常工作！')
        return { success: true, message: '复制成功' }
      } else {
        console.log('❌ 复制功能异常！')
        return { success: false, message: '复制失败' }
      }
    } catch (error) {
      console.error('复制测试失败:', error)
      return { success: false, error: error.message }
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})