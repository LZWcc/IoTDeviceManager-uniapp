<template>
  <scroll-view class="page" scroll-y>
    <!-- 全局配置卡片 -->
    <view class="config-card">
      <view class="card-header">
        <text class="card-title">⚙️ 全局配置</text>
        <view class="header-actions">
          <view
            class="sync-time-button"
            :class="{ 'sync-time-button-disabled': isSyncingGlobalTime }"
            @click.stop="handleSyncGlobalTime"
          >
            <text>{{
              isSyncingGlobalTime ? "同步中..." : "全局同步时间"
            }}</text>
          </view>
          <view class="mode-toggle" @click="globalIsAuto = !globalIsAuto">
            <text class="mode-label" :class="{ 'mode-active': !globalIsAuto }"
              >手动</text
            >
            <view class="toggle-track" :class="{ 'toggle-on': globalIsAuto }">
              <view
                class="toggle-thumb"
                :class="{ 'thumb-on': globalIsAuto }"
              ></view>
            </view>
            <text class="mode-label" :class="{ 'mode-active': globalIsAuto }"
              >自动</text
            >
          </view>
        </view>
      </view>

      <view class="card-body">
        <view v-if="globalConfigList.length === 0" class="loading-text">
          <text>加载中...</text>
        </view>
        <view v-else-if="globalIsAuto">
          <ConfigNode
            v-for="(item, index) in globalConfigList"
            :key="index"
            :node="item"
            :level="0"
          />
        </view>
        <view v-else class="manual-hint">
          <text>当前为手动模式</text>
        </view>
      </view>
    </view>

    <!-- 设备配置区域（按需显示） -->
    <view v-if="showDeviceFeatures" class="device-section">
      <!-- 设备选择器 -->
      <picker
        class="device-picker"
        mode="selector"
        :range="deviceList"
        :value="selectedDeviceIndex"
        @change="handleDeviceChange"
      >
        <view class="picker-view">
          <text class="picker-text">{{ selectedDevice || "请选择设备" }}</text>
          <text class="picker-arrow">▾</text>
        </view>
      </picker>

      <!-- 设备配置卡片 -->
      <view class="config-card">
        <view class="card-header">
          <text class="card-title">📱 设备配置</text>
          <view class="mode-toggle" @click="deviceIsAuto = !deviceIsAuto">
            <text class="mode-label" :class="{ 'mode-active': !deviceIsAuto }"
              >手动</text
            >
            <view class="toggle-track" :class="{ 'toggle-on': deviceIsAuto }">
              <view
                class="toggle-thumb"
                :class="{ 'thumb-on': deviceIsAuto }"
              ></view>
            </view>
            <text class="mode-label" :class="{ 'mode-active': deviceIsAuto }"
              >自动</text
            >
          </view>
        </view>

        <view class="card-body">
          <view v-if="!selectedDevice" class="empty-state">
            <text class="empty-text">请选择设备</text>
          </view>
          <view v-else-if="deviceConfigList.length === 0" class="loading-text">
            <text>加载中...</text>
          </view>
          <view v-else-if="deviceIsAuto">
            <ConfigNode
              v-for="(item, index) in deviceConfigList"
              :key="index"
              :node="item"
              :level="0"
            />
          </view>
          <view v-else class="manual-hint">
            <text>当前为手动模式</text>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script>
import {
  getDirectConfig,
  saveDirectConfig,
  getDeviceList,
  syncGlobalTime,
} from "@/api/get_direct_config"
import ConfigNode from "@/components/ConfigNode.vue"
import { appStore } from "@/stores/index"

// 简易 debounce
function debounce(fn, delay) {
  let timer = null
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 深拷贝
function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export default {
  components: { ConfigNode },

  data() {
    return {
      globalConfigList: [],
      globalIsAuto: true,
      deviceConfigList: [],
      deviceIsAuto: true,
      globalInitLock: true,
      deviceInitLock: true,
      globalConfigSnapshot: null,
      deviceConfigSnapshot: null,
      deviceList: [],
      selectedDevice: "",
      selectedDeviceIndex: 0,
      isGlobalSaving: false,
      isDeviceSaving: false,
      isSyncingGlobalTime: false,
    }
  },

  computed: {
    showDeviceFeatures() {
      return appStore.value.settings.showDeviceFeatures
    },
  },

  watch: {
    globalConfigList: {
      deep: true,
      handler() {
        if (!this.globalInitLock) this.debouncedSaveGlobal()
      },
    },
    deviceConfigList: {
      deep: true,
      handler() {
        if (!this.deviceInitLock) this.debouncedSaveDevice()
      },
    },
  },

  onShow() {
    this.loadConfig("GLOBAL", "global")
    this.fetchDeviceList()
  },

  created() {
    this.debouncedSaveGlobal = debounce(() => this.autoSave("GLOBAL"), 1000)
    this.debouncedSaveDevice = debounce(() => {
      if (this.selectedDevice) this.autoSave(this.selectedDevice)
    }, 1000)
  },

  methods: {
    // 初始化节点默认值
    initNodeValue(node) {
      if (node.f_type === "3") {
        node.min = Number(node.min) || 0
        node.max = Number(node.max) || 100
      }
      if (
        node.value !== null &&
        node.value !== undefined &&
        node.value !== ""
      ) {
        if (node.f_type === "3") node.value = Number(node.value)
      } else {
        let defaultValue = ""
        switch (node.f_type) {
          case "1":
            defaultValue =
              Array.isArray(node.f_value) && node.f_value.length > 0
                ? node.f_value[0].value
                : "off"
            break
          case "2":
            defaultValue = ""
            break
          case "3":
            defaultValue = Number(node.min) || 0
            break
          case "4":
            defaultValue = null
            break
          case "5":
            defaultValue = ""
            break
        }
        node.value = defaultValue
      }
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => this.initNodeValue(child))
      }
    },

    // 加载配置
    async loadConfig(d_no, type) {
      if (type === "global") this.globalInitLock = true
      else this.deviceInitLock = true
      try {
        const data = await getDirectConfig(d_no)
        data.forEach((item) => this.initNodeValue(item))
        if (type === "global") {
          this.globalConfigList = data
          this.globalConfigSnapshot = cloneDeep(this.collectAllValues(data))
        } else {
          this.deviceConfigList = data
          this.deviceConfigSnapshot = cloneDeep(this.collectAllValues(data))
        }
      } catch (error) {
        console.error(`加载配置失败（d_no=${d_no}）:`, error)
        uni.showToast({ title: "加载配置失败", icon: "none" })
      } finally {
        setTimeout(() => {
          if (type === "global") this.globalInitLock = false
          else this.deviceInitLock = false
        }, 500)
      }
    },

    // 扁平化收集所有节点的值
    collectAllValues(nodes) {
      const result = []
      const traverse = (node) => {
        result.push({
          id: node.id,
          t_name: node.t_name,
          f_type: node.f_type,
          value: node.value,
        })
        if (node.children && node.children.length > 0) {
          node.children.forEach((child) => traverse(child))
        }
      }
      nodes.forEach((n) => traverse(n))
      return result
    },

    // 获取变更的值
    getChangedValues(currentValues, snapshot) {
      if (!snapshot || snapshot.length === 0) return []
      return currentValues.filter((item) => {
        const original = snapshot.find((s) => s.id === item.id)
        return !original || String(original.value) !== String(item.value)
      })
    },

    // 自动保存
    async autoSave(d_no) {
      const isGlobal = d_no === "GLOBAL"
      if (isGlobal) this.isGlobalSaving = true
      else this.isDeviceSaving = true
      try {
        const configList = isGlobal
          ? this.globalConfigList
          : this.deviceConfigList
        const allValues = this.collectAllValues(configList)
        const snapshot = isGlobal
          ? this.globalConfigSnapshot
          : this.deviceConfigSnapshot
        const changedValues = this.getChangedValues(allValues, snapshot)
        if (changedValues.length === 0) return

        const validValues = changedValues.filter((item) => {
          if (["1", "3", "5"].includes(item.f_type)) {
            return (
              item.value !== null &&
              item.value !== undefined &&
              item.value !== ""
            )
          }
          if (["2", "4"].includes(item.f_type)) {
            return (
              item.value !== null &&
              item.value !== undefined &&
              item.value !== ""
            )
          }
          return true
        })

        if (validValues.length > 0) {
          await saveDirectConfig(validValues, d_no)
          if (isGlobal) {
            this.globalConfigSnapshot = cloneDeep(
              this.collectAllValues(configList),
            )
          } else {
            this.deviceConfigSnapshot = cloneDeep(
              this.collectAllValues(configList),
            )
          }
          const msg = isGlobal
            ? `全局配置已保存 (${validValues.length} 项)`
            : `设备 ${d_no} 配置已保存 (${validValues.length} 项)`
          uni.showToast({ title: msg, icon: "success", duration: 2000 })
        }
      } catch (error) {
        console.error("保存配置时出错:", error)
        uni.showToast({ title: "保存配置失败", icon: "none" })
      } finally {
        if (isGlobal) this.isGlobalSaving = false
        else this.isDeviceSaving = false
      }
    },

    // 获取设备列表
    async fetchDeviceList() {
      try {
        this.deviceList = await getDeviceList()
      } catch (error) {
        console.error("获取设备列表失败:", error)
      }
    },

    async handleSyncGlobalTime() {
      if (this.isSyncingGlobalTime) return
      this.isSyncingGlobalTime = true
      try {
        const response = await syncGlobalTime()
        uni.showToast({
          title: response?.message || "全局时间同步指令已下发",
          icon: "success",
          duration: 2000,
        })
      } catch (error) {
        console.error("全局同步时间失败:", error)
        const message =
          error?.response?.data?.message || error?.message || "全局同步时间失败"
        uni.showToast({
          title: message,
          icon: "none",
          duration: 2500,
        })
      } finally {
        this.isSyncingGlobalTime = false
      }
    },

    // 切换设备
    async handleDeviceChange(e) {
      const index = e.detail.value
      this.selectedDeviceIndex = index
      const deviceNo = this.deviceList[index]
      if (!deviceNo) {
        this.deviceConfigList = []
        this.deviceConfigSnapshot = null
        return
      }
      this.selectedDevice = deviceNo
      this.deviceConfigList = []
      await this.loadConfig(deviceNo, "device")
    },
  },
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f6f8fa;
  padding: 24rpx;
  box-sizing: border-box;
}

/* 配置卡片 */
.config-card {
  background-color: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.08);
  margin-bottom: 24rpx;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  background-color: #f8f9fa;
  border-bottom: 1rpx solid #ebeef5;
}

.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #303133;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.card-body {
  padding: 24rpx;
}

/* 自定义 toggle 开关 */
.mode-toggle {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.sync-time-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 172rpx;
  height: 56rpx;
  padding: 0 24rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #2979ff, #4d9bff);
  box-shadow: 0 6rpx 16rpx rgba(41, 121, 255, 0.18);
}

.sync-time-button text {
  font-size: 24rpx;
  color: #fff;
  font-weight: 600;
}

.sync-time-button-disabled {
  opacity: 0.72;
  pointer-events: none;
}

.mode-label {
  font-size: 26rpx;
  color: #c0c4cc;
  transition: color 0.2s;
}

.mode-active {
  color: #303133;
  font-weight: bold;
}

.toggle-track {
  width: 80rpx;
  height: 44rpx;
  border-radius: 22rpx;
  background-color: #dcdfe6;
  position: relative;
  transition: background-color 0.3s;
}

.toggle-on {
  background-color: #13ce66;
}

.toggle-thumb {
  position: absolute;
  top: 4rpx;
  left: 4rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background-color: #fff;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.2);
  transition: left 0.3s;
}

.thumb-on {
  left: 40rpx;
}

/* 手动模式提示 */
.manual-hint {
  padding: 40rpx 0;
  text-align: center;
}

.manual-hint text {
  font-size: 28rpx;
  color: #909399;
}

/* 加载 */
.loading-text {
  padding: 40rpx 0;
  text-align: center;
}

.loading-text text {
  font-size: 28rpx;
  color: #909399;
}

/* 设备区域 */
.device-section {
  margin-top: 8rpx;
}

/* 设备选择器 */
.device-picker {
  margin-bottom: 20rpx;
}

.picker-view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  border-radius: 12rpx;
  padding: 24rpx 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.picker-text {
  font-size: 30rpx;
  color: #303133;
}

.picker-arrow {
  font-size: 28rpx;
  color: #909399;
}

/* 空状态 */
.empty-state {
  padding: 60rpx 0;
  text-align: center;
}

.empty-text {
  font-size: 28rpx;
  color: #c0c4cc;
}
</style>
