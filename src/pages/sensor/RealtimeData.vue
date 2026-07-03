<template>
  <view class="page">
    <MenuNav :items="[
      { icon: '📊', label: '实时数据', current: true },
      { icon: '📈', label: '历史数据', url: '/pages/sensor/HistoryData' },
    ]" />

    <!-- 设备选择器 -->
    <view class="header" v-if="appStore.settings.showDeviceFeatures">
      <picker
        mode="selector"
        :range="deviceList"
        :value="selectedDeviceIndex"
        @change="onDeviceChange"
        class="device-selector"
      >
        <view class="picker-content">
          <text class="picker-text">{{ selectedDevice || "请选择设备" }}</text>
          <text class="picker-arrow">▼</text>
        </view>
      </picker>
    </view>

    <!-- 卡片区域 -->
    <view class="card-wrapper">
      <BigSensorCard
        :selectDevice="selectedDevice"
        :type="type"
      ></BigSensorCard>
    </view>

    <!-- 图表区域 -->
    <view class="charts-wrapper">
      <SensorCharts :selectDevice="selectedDevice" :type="type"></SensorCharts>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue"
import BigSensorCard from "../../components/device/BigSensorCard.vue"
import SensorCharts from "../../components/charts/SensorCharts.vue"
import { getDeviceList } from "@/api/data"
import { appStore } from "@/stores/index"
import MenuNav from "@/components/MenuNav.vue"

const selectedDevice = ref("")
const selectedDeviceIndex = ref(0)
const type = ref("sensor")
const deviceList = ref([])

onMounted(() => {
  loadDevices()
})

async function loadDevices() {
  try {
    const devices = await getDeviceList("sensor")
    deviceList.value = devices || []
    selectDefaultDevice()
  } catch (error) {
    console.error("加载设备列表失败:", error)
    uni.showToast({
      title: "加载设备列表失败",
      icon: "none",
    })
  }
}

function selectDefaultDevice() {
  // 实时页只负责确定当前设备号；卡片和图表的数据请求仍由子组件自己处理。
  if (deviceList.value.length === 0) return
  selectedDevice.value = deviceList.value[0]
  selectedDeviceIndex.value = 0
}

function onDeviceChange(e) {
  const index = e.detail.value
  selectedDeviceIndex.value = index
  selectedDevice.value = deviceList.value[index]
}

</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

/* 设备选择器样式 */
.header {
  padding: 20rpx;
  background-color: #fff;
  margin: 20rpx;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.device-selector {
  width: 100%;
}

.picker-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx;
  background-color: #f9f9f9;
  border-radius: 12rpx;
  border: 2rpx solid #e0e0e0;
}

.picker-text {
  font-size: 32rpx;
  color: #333;
}

.picker-arrow {
  font-size: 24rpx;
  color: #999;
}

/* 组件包装器 */
.card-wrapper {
  margin: 20rpx;
  padding: 20rpx;
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.charts-wrapper {
  margin: 20rpx;
  padding: 20rpx;
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}
</style>
