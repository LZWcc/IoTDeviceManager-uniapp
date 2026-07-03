<template>
  <scroll-view class="page" scroll-y>
    <!-- 全局配置卡片 -->
    <view class="config-card">
      <view class="card-header">
        <text class="card-title">⚙️ 全局配置</text>
        <view
          class="sync-time-button"
          :class="{ 'sync-time-button-disabled': isSyncingGlobalTime }"
          @click.stop="handleSyncGlobalTime"
        >
          <text>{{
            isSyncingGlobalTime ? "同步中..." : "全局同步时间"
          }}</text>
        </view>
      </view>
      <view class="card-body">
        <view v-if="globalConfigList.length === 0" class="loading-text">
          <text>加载中...</text>
        </view>
        <view v-else>
          <ConfigNode
            v-for="(item, index) in globalConfigList"
            :key="index"
            :node="item"
            :level="0"
          />
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
        </view>

        <view class="card-body">
          <view v-if="!selectedDevice" class="empty-state">
            <text class="empty-text">请选择设备</text>
          </view>
          <view v-else-if="deviceConfigList.length === 0" class="loading-text">
            <text>加载中...</text>
          </view>
          <view v-else>
            <ConfigNode
              v-for="(item, index) in deviceConfigList"
              :key="index"
              :node="item"
              :level="0"
            />
          </view>
        </view>
      </view>
    </view>

    <!-- 全局同步时间弹窗 -->
    <view v-if="syncTimeModalVisible" class="modal-mask" @click.self="syncTimeModalVisible = false">
      <view class="modal-content">
        <view class="modal-title">
          <text>全局同步时间</text>
        </view>
        <view class="modal-body">
          <view class="switch-row">
            <text :class="useCurrentTime ? 'switch-label-active' : 'switch-label'">当前时间</text>
            <switch :checked="useCurrentTime" @change="useCurrentTime = !useCurrentTime" />
            <text :class="!useCurrentTime ? 'switch-label-active' : 'switch-label'">指定时间</text>
          </view>
          <view v-if="!useCurrentTime" class="time-picker-row">
            <picker mode="date" :value="customDate" @change="onDatePickerChange">
              <view class="time-picker-btn">
                <text>{{ customDate || '选择日期' }}</text>
              </view>
            </picker>
            <picker mode="time" :value="customTime" @change="onTimePickerChange">
              <view class="time-picker-btn">
                <text>{{ customTime || '选择时间' }}</text>
              </view>
            </picker>
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn modal-btn-cancel" @click="syncTimeModalVisible = false">
            <text>取消</text>
          </view>
          <view
            class="modal-btn modal-btn-confirm"
            :class="{ 'sync-time-button-disabled': isSyncingGlobalTime }"
            @click="confirmSyncTime"
          >
            <text>{{ isSyncingGlobalTime ? "下发中..." : "确认下发" }}</text>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>

<script setup>
import { ref, computed, watch } from "vue"
import { onShow } from "@dcloudio/uni-app"
import {
  getDirectConfig,
  saveDirectConfig,
  getConfigDeviceList,
  syncGlobalTime,
} from "@/api/config"
import ConfigNode from "@/components/ConfigNode.vue"
import { appStore } from "@/stores/index"
import {
  cloneDeep,
  initConfigTreeValues,
  collectConfigValues,
  getChangedConfigValues,
  isValidConfigValue,
  normalizeConfigValueForSubmit,
} from "@/utils/directConfigTree"

function getTodayDateText() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function normalizeTimeText(time) {
  const safe = String(time || "00:00")
  return safe.length === 5 ? `${safe}:00` : safe
}

function debounce(fn, delay) {
  let timer = null
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

const globalConfigList = ref([])
const deviceConfigList = ref([])
const globalInitLock = ref(true)
const deviceInitLock = ref(true)
const globalConfigSnapshot = ref(null)
const deviceConfigSnapshot = ref(null)
const deviceList = ref([])
const selectedDevice = ref("")
const selectedDeviceIndex = ref(0)
const isSyncingGlobalTime = ref(false)
const syncTimeModalVisible = ref(false)
const useCurrentTime = ref(true)
const customDate = ref(getTodayDateText())
const customTime = ref("00:00:00")

const showDeviceFeatures = computed(() => appStore.value.settings.showDeviceFeatures)

async function loadConfig(d_no, type) {
  const isGlobal = type === "global"
  if (isGlobal) globalInitLock.value = true
  else deviceInitLock.value = true

  try {
    const data = initConfigTreeValues(await getDirectConfig(d_no))
    const snapshot = cloneDeep(collectConfigValues(data))
    if (isGlobal) {
      globalConfigList.value = data
      globalConfigSnapshot.value = snapshot
    } else {
      deviceConfigList.value = data
      deviceConfigSnapshot.value = snapshot
    }
  } catch (error) {
    console.error(`加载配置失败（d_no=${d_no}）:`, error)
    uni.showToast({ title: "加载配置失败", icon: "none" })
  } finally {
    setTimeout(() => {
      if (isGlobal) globalInitLock.value = false
      else deviceInitLock.value = false
    }, 500)
  }
}

async function autoSave(d_no) {
  const isGlobal = d_no === "GLOBAL"
  const configList = isGlobal ? globalConfigList.value : deviceConfigList.value
  const snapshot = isGlobal ? globalConfigSnapshot.value : deviceConfigSnapshot.value

  try {
    const allValues = collectConfigValues(configList)
    const validValues = getChangedConfigValues(allValues, snapshot).filter(isValidConfigValue)
    if (validValues.length === 0) return

    await saveDirectConfig(validValues.map(normalizeConfigValueForSubmit), d_no)

    const newSnapshot = cloneDeep(collectConfigValues(configList))
    if (isGlobal) globalConfigSnapshot.value = newSnapshot
    else deviceConfigSnapshot.value = newSnapshot

    const label = isGlobal ? "全局配置" : `设备 ${d_no} 配置`
    uni.showToast({ title: `${label}已保存 (${validValues.length} 项)`, icon: "success", duration: 2000 })
  } catch (error) {
    console.error("保存配置时出错:", error)
    uni.showToast({ title: "保存配置失败", icon: "none" })
  }
}

const debouncedSaveGlobal = debounce(() => autoSave("GLOBAL"), 1000)
const debouncedSaveDevice = debounce(() => {
  if (selectedDevice.value) autoSave(selectedDevice.value)
}, 1000)

watch(globalConfigList, () => {
  if (!globalInitLock.value) debouncedSaveGlobal()
}, { deep: true })

watch(deviceConfigList, () => {
  if (!deviceInitLock.value) debouncedSaveDevice()
}, { deep: true })

onShow(() => {
  loadConfig("GLOBAL", "global")
  fetchDeviceList()
})

async function fetchDeviceList() {
  try {
    deviceList.value = await getConfigDeviceList()
  } catch (error) {
    console.error("获取设备列表失败:", error)
  }
}

function handleSyncGlobalTime() {
  if (isSyncingGlobalTime.value) return
  if (!customDate.value) customDate.value = getTodayDateText()
  syncTimeModalVisible.value = true
}

function onDatePickerChange(e) {
  customDate.value = e.detail.value
}

function onTimePickerChange(e) {
  customTime.value = e.detail.value
}

async function confirmSyncTime() {
  isSyncingGlobalTime.value = true
  try {
    const time = useCurrentTime.value
      ? undefined
      : `${customDate.value || getTodayDateText()} ${normalizeTimeText(customTime.value)}`
    const response = await syncGlobalTime(time)
    uni.showToast({
      title: response?.message || "全局时间同步指令已下发",
      icon: "success",
      duration: 2000,
    })
    syncTimeModalVisible.value = false
  } catch (error) {
    console.error("全局同步时间失败:", error)
    uni.showToast({
      title: error?.response?.data?.message || error?.message || "全局同步时间失败",
      icon: "none",
      duration: 2500,
    })
  } finally {
    isSyncingGlobalTime.value = false
  }
}

async function handleDeviceChange(e) {
  const index = e.detail.value
  selectedDeviceIndex.value = index
  const deviceNo = deviceList.value[index]
  if (!deviceNo) {
    deviceConfigList.value = []
    deviceConfigSnapshot.value = null
    return
  }
  selectedDevice.value = deviceNo
  deviceConfigList.value = []
  await loadConfig(deviceNo, "device")
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

/* 同步时间弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  width: 600rpx;
  background-color: #fff;
  border-radius: 24rpx;
  overflow: hidden;
}

.modal-title {
  padding: 32rpx;
  text-align: center;
  border-bottom: 1rpx solid #eee;
}

.modal-title text {
  font-size: 32rpx;
  font-weight: bold;
  color: #303133;
}

.modal-body {
  padding: 32rpx;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.switch-label {
  font-size: 28rpx;
  color: #c0c4cc;
}

.switch-label-active {
  font-size: 28rpx;
  color: #303133;
  font-weight: bold;
}

.time-picker-row {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16rpx;
}

.time-picker-btn {
  background-color: #f5f7fa;
  border: 1rpx solid #dcdfe6;
  border-radius: 12rpx;
  padding: 20rpx 48rpx;
  text-align: center;
}

.time-picker-btn text {
  font-size: 32rpx;
  color: #303133;
}

.modal-footer {
  display: flex;
  border-top: 1rpx solid #eee;
}

.modal-btn {
  flex: 1;
  padding: 28rpx 0;
  text-align: center;
}

.modal-btn-cancel {
  border-right: 1rpx solid #eee;
}

.modal-btn-cancel text {
  font-size: 30rpx;
  color: #909399;
}

.modal-btn-confirm {
  background-color: #2979ff;
}

.modal-btn-confirm text {
  font-size: 30rpx;
  color: #fff;
  font-weight: bold;
}
</style>
