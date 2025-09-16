<template>
  <footer class="footer">
    <div class="footer-content">
      <div class="footer-left">
        <span class="copyright">© 2024 MessAuto. All rights reserved.</span>
      </div>
      
      <div class="footer-right">
        <button class="btn btn-secondary btn-sm" @click="checkPermissions">
          刷新权限状态
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/app'

const appStore = useAppStore()

const checkPermissions = () => {
  appStore.checkPermissions()
}
</script>

<style scoped>
.footer {
  background: white;
  border-top: 1px solid #E5E5EA;
  padding: 12px 20px;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.copyright {
  font-size: 12px;
  color: #666;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
  min-height: 28px;
}
</style>