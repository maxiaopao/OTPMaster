import { app, BrowserWindow, Tray, Menu, dialog, shell, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { TrayManager } from './tray'
import { ConfigManager } from './config'
import { PermissionManager } from './permissions'
import { SMSMonitor } from './monitor'
import { AutomationService } from './automation'
import { isMacOS } from '@shared/utils'

class MainApplication {
  private mainWindow: BrowserWindow | null = null
  private trayManager: TrayManager | null = null
  private configManager: ConfigManager | null = null
  private permissionManager: PermissionManager | null = null
  private smsMonitor: SMSMonitor | null = null
  private automationService: AutomationService | null = null
  private isQuitting = false

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
      // 当用户尝试启动第二个实例时，显示主窗口
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore()
        }
        this.mainWindow.show()
        this.mainWindow.focus()
      }
    })

    // 初始化各种事件监听器
    this.setupAppEventListeners()

    // 应用准备就绪时初始化
    app.whenReady().then(() => {
      this.onAppReady()
    })
  }

  private setupAppEventListeners(): void {
    // macOS 特有：当应用被激活时
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow()
      }
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

      // 根据配置决定是否显示主窗口
      const config = this.configManager?.getConfig()
      if (!config?.settings.hide_icon_forever) {
        this.createWindow()
      }

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
    this.automationService = new AutomationService(this.configManager)

    // 初始化短信监控器
    this.smsMonitor = new SMSMonitor(
      this.configManager,
      this.permissionManager,
      this.automationService
    )

    // 设置服务间的事件监听
    this.setupServiceEventListeners()
  }

  private setupServiceEventListeners(): void {
    if (!this.smsMonitor || !this.configManager) return

    // 监听验证码提取事件
    this.smsMonitor.on('verification-code-extracted', (code) => {
      console.log('提取到验证码:', code)
      
      // 发送到渲染进程
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('verification-code-extracted', code)
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
    } else if (!permissions.accessibility) {
      this.showPermissionDialog('accessibility')
    } else {
      // 权限都已获得，开始监控
      this.smsMonitor?.startMonitoring()
    }
  }

  private createWindow(): void {
    // 创建浏览器窗口
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      autoHideMenuBar: true,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    this.mainWindow.on('ready-to-show', () => {
      if (this.mainWindow) {
        this.mainWindow.show()
      }
    })

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
      if (!app.isQuitting) {
        event.preventDefault()
        this.mainWindow?.hide()
      }
    })
  }

  private createTray(): void {
    if (!this.configManager) return

    this.trayManager = new TrayManager(
      trayIcon,
      this.configManager,
      this.onTrayMenuClick.bind(this)
    )
  }

  private onTrayMenuClick(menuId: string): void {
    switch (menuId) {
      case 'auto_paste':
        this.toggleAutoPaste()
        break
      case 'auto_return':
        this.toggleAutoReturn()
        break
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

  private async toggleAutoPaste(): Promise<void> {
    if (!this.configManager) return

    const config = this.configManager.getConfig()
    const newValue = !config.settings.auto_paste

    await this.configManager.updateSettings({
      auto_paste: newValue,
      // 如果关闭自动粘贴，也关闭自动回车
      auto_return: newValue ? config.settings.auto_return : false,
    })
  }

  private async toggleAutoReturn(): Promise<void> {
    if (!this.configManager) return

    const config = this.configManager.getConfig()
    
    // 自动回车依赖于自动粘贴
    if (!config.settings.auto_paste) {
      this.showInfoDialog('提示', '自动回车功能需要先启用自动粘贴功能')
      return
    }

    await this.configManager.updateSettings({
      auto_return: !config.settings.auto_return,
    })
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
    if (this.mainWindow) {
      this.mainWindow.show()
      this.mainWindow.focus()
    } else {
      this.createWindow()
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
    app.isQuitting = true
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
}

// 创建应用实例
new MainApplication()