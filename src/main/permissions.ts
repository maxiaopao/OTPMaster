import { EventEmitter } from 'events'
import { shell } from 'electron'
import { existsSync, accessSync, constants } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { PermissionStatus, PermissionCheckResult } from '@shared/types'
import { PERMISSIONS, PATHS } from '@shared/constants'
import { isMacOS } from '@shared/utils'

export class PermissionManager extends EventEmitter {
  private currentStatus: PermissionStatus = {
    fullDiskAccess: false,
    accessibility: true, // 不再需要辅助功能权限，默认为true
  }

  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.startPeriodicCheck()
  }

  public async checkAllPermissions(): Promise<PermissionStatus> {
    const fullDiskAccess = await this.checkFullDiskAccess()

    const newStatus: PermissionStatus = {
      fullDiskAccess: fullDiskAccess.hasPermission,
      accessibility: true, // 不再需要辅助功能权限
    }

    if (this.hasStatusChanged(newStatus)) {
      this.currentStatus = newStatus
      this.emit('permission-changed', this.currentStatus)
    }

    return this.currentStatus
  }

  private async checkFullDiskAccess(): Promise<PermissionCheckResult> {
    if (!isMacOS()) {
      return { hasPermission: true }
    }

    try {
      const messagesDbPath = join(homedir(), 'Library/Messages/chat.db')
      
      if (!existsSync(messagesDbPath)) {
        return { 
          hasPermission: false, 
          errorMessage: 'Messages 数据库文件不存在' 
        }
      }

      accessSync(messagesDbPath, constants.R_OK)
      return { hasPermission: true }
    } catch (error) {
      return { 
        hasPermission: false, 
        errorMessage: `无法访问 Messages 数据库: ${error}` 
      }
    }
  }

  public openSystemPreferences(type: 'disk-access' | 'accessibility'): void {
    const urls = {
      'disk-access': PERMISSIONS.SYSTEM_PREFERENCES_PATHS.FULL_DISK_ACCESS,
      'accessibility': PERMISSIONS.SYSTEM_PREFERENCES_PATHS.ACCESSIBILITY,
    }

    shell.openExternal(urls[type])
  }

  private hasStatusChanged(newStatus: PermissionStatus): boolean {
    return (
      this.currentStatus.fullDiskAccess !== newStatus.fullDiskAccess ||
      this.currentStatus.accessibility !== newStatus.accessibility
    )
  }

  private startPeriodicCheck(): void {
    this.checkInterval = setInterval(() => {
      this.checkAllPermissions()
    }, PERMISSIONS.CHECK_INTERVAL)
  }

  public stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  public getCurrentStatus(): PermissionStatus {
    return { ...this.currentStatus }
  }
}