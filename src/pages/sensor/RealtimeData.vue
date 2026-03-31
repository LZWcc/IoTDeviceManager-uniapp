<template>
  <view class="page">
    <!-- 导航菜单 -->
    <view class="menu-list">
      <view class="menu-item current">
        <text class="menu-icon">📊</text>
        <text class="menu-text">实时数据</text>
        <text class="menu-badge">当前页</text>
      </view>
      <view class="menu-item" @click="navigateTo('/pages/sensor/HistoryData')">
        <text class="menu-icon">📈</text>
        <text class="menu-text">历史数据</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

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
import { getDeviceList } from "@/api/get_deviceList"
import { appStore } from "@/stores/index"
import { navigateToPage } from "@/utils/navigation"

const selectedDevice = ref("")
const selectedDeviceIndex = ref(0)
const type = ref("sensor")
const deviceList = ref([])

onMounted(async () => {
  try {
    const devices = await getDeviceList("sensor")
    console.log("加载设备列表:", devices)
    deviceList.value = devices || []

    if (devices && devices.length > 0) {
      selectedDevice.value = devices[0]
      selectedDeviceIndex.value = 0
    }
  } catch (error) {
    console.error("加载设备列表失败:", error)
    uni.showToast({
      title: "加载设备列表失败",
      icon: "none",
    })
  }
})

function onDeviceChange(e) {
  const index = e.detail.value
  selectedDeviceIndex.value = index
  selectedDevice.value = deviceList.value[index]
  console.log("选择设备:", selectedDevice.value)
}

function navigateTo(url) {
  navigateToPage(url)
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

.menu-list {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 20rpx;
  background-color: #fff;
}

.menu-item {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 30rpx 20rpx;
  margin: 0 10rpx;
  border-radius: 20rpx;
  background-color: #fff;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.menu-item:not(.current):active {
  background-color: #f5f5f5;
}

.menu-item.current {
  background-color: #f0f7ff;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

.menu-text {
  flex: 1;
  font-size: 32rpx;
  color: #333;
}

.menu-arrow {
  font-size: 40rpx;
  color: #999;
}

.menu-badge {
  font-size: 24rpx;
  color: #2979ff;
  padding: 4rpx 12rpx;
  background-color: #e3f2fd;
  border-radius: 20rpx;
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
