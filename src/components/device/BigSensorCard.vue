<template>
  <view class="sensor-card">
    <view class="card-header">
      <text class="title">基本信息</text>
    </view>

    <view class="card-body">
      <view class="data-grid" v-if="filteredTableData.length > 0">
        <view
          class="data-item"
          v-for="(item, idx) in filteredTableData"
          :key="idx"
        >
          <text class="data-label">{{ item.f_name }}</text>
          <view class="data-value-box">
            <text class="data-value">{{ item.value }}</text>
            <text class="data-unit">{{ item.unit }}</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-tip">
        <text>暂无数据</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from "vue"
import { getFormatLimit1ByDevice } from "@/api/get_format_limit"
import { appStore } from "@/stores/index"
import wsClient from "@/utils/websocket"
import { formatDate } from "@/utils/index"

const props = defineProps({
  selectDevice: {
    type: String,
    default: "",
  },
  type: {
    type: String,
    default: "sensor",
  },
})

const tableData = ref([])

const filteredTableData = computed(() => {
  if (!tableData.value || tableData.value.length === 0) return []
  // 检查是否显示设备编号
  if (appStore.value.settings.showDeviceFeatures) return tableData.value
  return tableData.value.filter((item) => item.f_name !== "设备编号")
})

watch(
  () => props.selectDevice,
  async (newDevice) => {
    if (newDevice) {
      await fetchDeviceData(newDevice)
    }
  },
  { immediate: true },
)

async function fetchDeviceData(d_no) {
  try {
    const response = await getFormatLimit1ByDevice(d_no, props.type)
    console.log("BigSensorCard fetched data:", response)
    if (response && response.data && response.data.length > 0) {
      tableData.value = response.data[0]
    } else {
      tableData.value = []
    }
  } catch (error) {
    console.error("获取设备数据失败:", error)
    tableData.value = []
    // uni-app 的错误提示
    uni.showToast({
      title: "获取数据失败",
      icon: "none",
    })
  }
}

// WebSocket 实时数据更新
const handleWsData = (data) => {
  if (data.d_no !== props.selectDevice) return
  console.log(`BigSensorCard received WS data:`, data)

  tableData.value.forEach((item) => {
    if (item.db_name && data[item.db_name] !== undefined) {
      item.value = data[item.db_name]
    } else if (item.f_name === "更新时间" && data.timestamp) {
      item.value = formatDate(data.timestamp, "YYYY-MM-DD HH:mm:ss")
    }
  })
}

onMounted(() => {
  const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"
  wsClient.on(topic, handleWsData)
  wsClient.send({
    type: "subscribe",
    topics: [topic],
  })
})

onUnmounted(() => {
  const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"
  wsClient.off(topic, handleWsData)
})
</script>

<style scoped>
.sensor-card {
  background-color: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}

.card-header {
  border-bottom: 1rpx solid #e0e0e0;
  padding-bottom: 20rpx;
  margin-bottom: 30rpx;
}

.title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.card-body {
  min-height: 200rpx;
}

.data-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.data-item {
  width: calc(50% - 10rpx);
  background-color: #f9f9f9;
  padding: 24rpx;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.data-label {
  font-size: 24rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
}

.data-value-box {
  display: flex;
  align-items: baseline;
}

.data-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-right: 4rpx;
}

.data-unit {
  font-size: 24rpx;
  color: #999;
}

.empty-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200rpx;
  color: #999;
  font-size: 28rpx;
}
</style>
