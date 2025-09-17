import { app, BrowserWindow, Tray, Menu, dialog, shell, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { TrayManager } from './tray'
import { ConfigManager } from './config'
import { PermissionManager } from './permissions'
import { SMSMonitor } from './monitor'
import { AutomationService } from './automation'
import { isMacOS } from '@shared/utils'
import { extractVerificationCode } from '@shared/utils'
import { IPC_CHANNELS } from '@shared/constants'
import type { VerificationCode } from '@shared/types'

class MainApplication {
  private mainWindow: BrowserWindow | null = null
  private trayManager: TrayManager | null = null
  private configManager: ConfigManager | null = null
  private permissionManager: PermissionManager | null = null
  private smsMonitor: SMSMonitor | null = null
  private automationService: AutomationService | null = null
  private isQuitting = false
  private latestVerificationCode: VerificationCode | null = null

  constructor() {
    this.initializeApp()
  }

  private async initializeApp(): Promise<void> {
    // 确保只有一个应用实例运行
    const gotTheLock = app.requestSingleInstanceLock()
    
    if (!gotTheLock) {
      app.quit()
      return
    }

    app.on('second-instance', () => {
      // 当用户尝试启动第二个实例时，显示设置窗口（如果存在）
      this.showSettings()
    })

    // 初始化各种事件监听器
    this.setupAppEventListeners()

    // 应用准备就绪时初始化
    app.whenReady().then(() => {
      this.onAppReady()
    })
  }

  private setupAppEventListeners(): void {
    // macOS 特有：当应用被激活时（系统托盘应用不自动创建窗口）
    app.on('activate', () => {
      // 系统托盘应用通常不在 activate 时自动显示窗口
      // 用户可以通过托盘菜单显示设置窗口
    })

    // 当所有窗口关闭时
    app.on('window-all-closed', () => {
      // macOS 上通常不退出应用
      if (!isMacOS()) {
        app.quit()
      }
    })

    // 应用即将退出时
    app.on('before-quit', () => {
      this.cleanup()
    })

    // 设置应用的用户模型 ID (Windows)
    electronApp.setAppUserModelId('com.messauto.electron')
  }

  private async onAppReady(): Promise<void> {
    // 为开发工具设置默认打开或关闭
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    try {
      // 初始化核心服务
      await this.initializeServices()

      // 检查权限
      await this.checkPermissions()

      // 创建托盘图标
      this.createTray()

      // 隐藏应用在Dock中的图标，让应用纯后台运行
      if (app.dock) {
        app.dock.hide()
      }

      console.log('✅ 应用已在后台启动，仅在系统托盘中显示')

    } catch (error) {
      console.error('应用初始化失败:', error)
      this.showErrorDialog('应用初始化失败', String(error))
    }
  }

  private async initializeServices(): Promise<void> {
    // 初始化配置管理器
    this.configManager = new ConfigManager()
    await this.configManager.initialize()

    // 初始化权限管理器
    this.permissionManager = new PermissionManager()

    // 初始化自动化服务
    this.automationService = new AutomationService()

    // 初始化短信监控器
    this.smsMonitor = new SMSMonitor(
      this.configManager,
      this.permissionManager,
      this.automationService
    )

    // 设置服务间的事件监听
    this.setupServiceEventListeners()

    // 设置 IPC 处理程序
    this.setupIPCHandlers()
  }

  private setupServiceEventListeners(): void {
    if (!this.smsMonitor || !this.configManager) return

    // 监听验证码提取事件
    this.smsMonitor.on('verification-code-extracted', (code, message) => {
      console.log('提取到验证码:', code)
      
      // 保存最新的验证码
      this.latestVerificationCode = code
      
      // 发送到渲染进程，包含验证码和原始短信信息
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('verification-code-extracted', code)
        if (message) {
          this.mainWindow.webContents.send('latest-message-received', message)
        }
      }
    })
    
    // 监听最新短信更新事件（即使不包含验证码）
    this.smsMonitor.on('latest-message-updated', (message) => {
      console.log('最新短信更新:', message.text.substring(0, 30) + '...')
      
      // 发送到渲染进程
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('latest-message-received', message)
      }
    })

    // 监听配置变更事件
    this.configManager.on('config-changed', (config) => {
      console.log('配置已更新:', config)
      
      // 更新托盘菜单
      this.trayManager?.updateMenu(config.settings)
      
      // 发送到渲染进程
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('config-updated', config)
      }
    })

    // 监听权限状态变更事件
    this.permissionManager?.on('permission-changed', (status) => {
      console.log('权限状态变更:', status)
      
      // 发送到渲染进程
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('permission-status-changed', status)
      }
    })
  }

  private async checkPermissions(): Promise<void> {
    if (!this.permissionManager) return

    const permissions = await this.permissionManager.checkAllPermissions()
    
    if (!permissions.fullDiskAccess) {
      this.showPermissionDialog('disk-access')
    } else {
      // 权限已获得，开始监控
      this.smsMonitor?.startMonitoring()
      
      // 启动后发送最新短信到前端
      this.sendLatestMessageToFrontend()
    }
  }
  
  private async sendLatestMessageToFrontend(): Promise<void> {
    if (!this.smsMonitor) return
    
    try {
      // 获取最新的短信（不管是否包含验证码）
      const messages = await this.smsMonitor.getLatestMessages(1) // 获取最新的1条消息
      if (messages.length > 0) {
        const latestMessage = messages[0]
        console.log('📩 启动时发送最新短信到前端:', latestMessage.text.substring(0, 30) + '...')
        
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('latest-message-received', latestMessage)
        }
        
        // 测试复制功能：尝试复制一次验证码
        console.log('🧪 正在测试复制功能...')
        await this.smsMonitor.testCopyVerificationCode()
      }
    } catch (error) {
      console.error('获取最新短信失败:', error)
    }
  }

  private createWindow(): void {
    // 创建浏览器窗口
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false, // 默认不显示窗口
      autoHideMenuBar: true,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    // 不自动显示窗口，只在用户主动点击托盘菜单时显示
    // this.mainWindow.on('ready-to-show', () => {
    //   if (this.mainWindow) {
    //     this.mainWindow.show()
    //   }
    // })

    this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // 根据环境加载相应的 URL
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    // 监听窗口关闭事件
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault()
        this.mainWindow?.hide()
        
        // 隐藏窗口后再次隐藏Dock图标
        if (app.dock) {
          app.dock.hide()
        }
      }
    })

    console.log('⚙️ 主窗口已创建，但不显示（后台模式）')
  }

  private createTray(): void {
    if (!this.configManager) return

    // 创建托盘管理器
    // 在打包后，资源文件在Resources目录中
    const iconPath = is.dev 
      ? join(__dirname, '../../assets/icons/tray-icon.png')
      : join(process.resourcesPath, 'assets/icons/tray-icon.png')
    
    console.log('托盘图标路径:', iconPath)
    
    this.trayManager = new TrayManager(
      iconPath,
      this.configManager,
      this.onTrayMenuClick.bind(this)
    )
  }

  private onTrayMenuClick(menuId: string): void {
    switch (menuId) {
      case 'hide_icon_temp':
        this.hideIconTemporary()
        break
      case 'hide_icon_forever':
        this.hideIconForever()
        break
      case 'launch_at_login':
        this.toggleLaunchAtLogin()
        break
      case 'settings':
        this.showSettings()
        break
      case 'about':
        this.showAbout()
        break
      case 'quit':
        this.quit()
        break
      default:
        console.log('未知的托盘菜单项:', menuId)
    }
  }

  private hideIconTemporary(): void {
    // 临时隐藏托盘图标（下次启动时恢复）
    this.trayManager?.hide()
  }

  private async hideIconForever(): Promise<void> {
    if (!this.configManager) return

    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['确定', '取消'],
      defaultId: 1,
      message: '永久隐藏托盘图标',
      detail: '这将永久隐藏托盘图标，您可以通过重新启动应用来恢复。确定要继续吗？',
    })

    if (result.response === 0) {
      await this.configManager.updateSettings({
        hide_icon_forever: true,
      })
      this.trayManager?.hide()
    }
  }

  private async toggleLaunchAtLogin(): Promise<void> {
    if (!this.configManager) return

    const config = this.configManager.getConfig()
    const newValue = !config.settings.launch_at_login

    // 设置开机自启
    app.setLoginItemSettings({
      openAtLogin: newValue,
      openAsHidden: true,
    })

    await this.configManager.updateSettings({
      launch_at_login: newValue,
    })
  }

  private showSettings(): void {
    if (!this.mainWindow) {
      this.createWindow()
    }
    
    if (this.mainWindow) {
      // 显示窗口时临时显示Dock图标
      if (app.dock) {
        app.dock.show()
      }
      
      this.mainWindow.show()
      this.mainWindow.focus()
      
      console.log('📝 设置窗口已显示')
    }
  }

  private showAbout(): void {
    dialog.showMessageBox({
      type: 'info',
      title: '关于 MessAuto',
      message: 'MessAuto v1.0.0',
      detail: '一个基于 Electron 的 macOS 桌面应用程序，用于自动提取短信验证码并实现自动粘贴和回车功能。',
      buttons: ['确定'],
    })
  }

  private quit(): void {
    this.isQuitting = true
    app.quit()
  }

  private showPermissionDialog(type: 'disk-access' | 'accessibility'): void {
    const messages = {
      'disk-access': {
        title: '需要完全磁盘访问权限',
        message: '请在系统偏好设置中授予完全磁盘访问权限以读取短信数据库。',
        detail: '系统偏好设置 > 安全性与隐私 > 隐私 > 完全磁盘访问',
      },
      'accessibility': {
        title: '需要辅助功能权限',
        message: '请授予辅助功能权限以启用自动粘贴功能。',
        detail: '系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能',
      },
    }

    const config = messages[type]

    dialog.showMessageBox({
      type: 'warning',
      title: config.title,
      message: config.message,
      detail: config.detail,
      buttons: ['打开系统偏好设置', '稍后'],
    }).then((result) => {
      if (result.response === 0) {
        this.permissionManager?.openSystemPreferences(type)
      }
    })
  }

  private showErrorDialog(title: string, message: string): void {
    dialog.showErrorBox(title, message)
  }

  private showInfoDialog(title: string, message: string): void {
    dialog.showMessageBox({
      type: 'info',
      title,
      message,
      buttons: ['确定'],
    })
  }

  private cleanup(): void {
    // 清理资源
    this.smsMonitor?.stopMonitoring()
    this.trayManager?.destroy()
  }

  private setupIPCHandlers(): void {
    // 配置相关
    ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => {
      return this.configManager?.getConfig()
    })

    ipcMain.handle(IPC_CHANNELS.UPDATE_CONFIG, async (_, settings) => {
      await this.configManager?.updateSettings(settings)
    })

    // 权限相关
    ipcMain.handle(IPC_CHANNELS.CHECK_PERMISSIONS, async () => {
      return await this.permissionManager?.checkAllPermissions()
    })

    ipcMain.on(IPC_CHANNELS.SHOW_PERMISSION_GUIDE, (_, type) => {
      this.showPermissionDialog(type)
    })

    // 自动化操作
    ipcMain.handle(IPC_CHANNELS.COPY_TO_CLIPBOARD, async (_, text: string) => {
      return await this.automationService?.copyToClipboard(text)
    })
    
    // 测试复制功能
    ipcMain.handle(IPC_CHANNELS.TEST_COPY_FROM_SMS, async () => {
      try {
        if (this.smsMonitor) {
          await this.smsMonitor.testCopyVerificationCode()
          return { success: true }
        } else {
          return { success: false, error: '短信监控器未初始化' }
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    // 重置监控状态（清除已处理的消息记录）
    ipcMain.handle('reset-monitor-state', async () => {
      try {
        if (this.smsMonitor) {
          await this.smsMonitor.resetMonitorState()
          // 重置后立即手动触发一次检查，这次会处理最新的验证码短信
          console.log('🔄 重置完成，现在手动触发一次检查...')
          await this.smsMonitor.testCopyVerificationCode()
          return { success: true, message: '重置成功，并尝试复制最新验证码' }
        } else {
          return { success: false, error: '短信监控器未初始化' }
        }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })

    // 窗口管理
    ipcMain.on(IPC_CHANNELS.SHOW_WINDOW, () => {
      this.showSettings()
    })

    ipcMain.on(IPC_CHANNELS.HIDE_WINDOW, () => {
      this.mainWindow?.hide()
    })

    ipcMain.on(IPC_CHANNELS.CLOSE_WINDOW, () => {
      this.mainWindow?.close()
    })
  }
}

// 创建应用实例
new MainApplication()