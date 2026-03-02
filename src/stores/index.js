// stores/index.js - 简单的响应式状态管理
import { ref } from "vue"

// 创建响应式的应用状态
export const appStore = ref({
  settings: {
    showDeviceFeatures: true, // 启用设备编号等功能显示
    theme: "light",
    language: "zh-CN",
  },

  // 更新设置的方法
  updateSettings(newSettings) {
    Object.assign(appStore.value.settings, newSettings)
    // 可以添加持久化逻辑
    uni.setStorageSync("appSettings", appStore.value.settings)
  },

  // 初始化时从本地存储恢复设置
  init() {
    try {
      const savedSettings = uni.getStorageSync("appSettings")
      if (savedSettings) {
        Object.assign(appStore.value.settings, savedSettings)
      }
    } catch (error) {
      console.error("恢复设置失败:", error)
    }
  },
})

// 初始化 store
appStore.value.init()
