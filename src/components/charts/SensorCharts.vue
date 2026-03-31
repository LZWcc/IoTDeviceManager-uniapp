<template>
  <view id="sensor-charts">
    <view class="tool-bar">
      <picker
        mode="selector"
        :range="chartTypes"
        range-key="label"
        :value="chartTypeIndex"
        @change="onChartTypeChange"
      >
        <view class="picker-box">
          <text>{{ chartTypes[chartTypeIndex].label }}</text>
          <text class="arrow">▼</text>
        </view>
      </picker>
    </view>

    <UChartCanvas
      class="charts-container"
      :title="chartTitle"
      :type="currentChartType"
      :categories="chartCategories"
      :series="chartSeries"
      :yAxis="chartYAxis"
      height="620rpx"
    />
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import UChartCanvas from "@/components/charts/UChartCanvas.vue"
import { getFormatMinuteAvg } from "@/api/get_format_limit"
import { appStore } from "@/stores/index"
import { formatDate } from "@/utils/index"
import { createValueAxisConfig, normalizeChartSeries } from "@/utils/ucharts"
import wsClient from "@/utils/websocket"

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

const deviceData = ref([])
const chartTypeIndex = ref(0)
const chartTypes = [
  { label: "折线图", value: "line" },
  { label: "柱状图", value: "bar" },
]

const tableMap = {
  sensor: "Sensor",
  behavior: "Behavior",
}

const formattedData = computed(() => {
  return deviceData.value.map((group) =>
    Object.fromEntries(group.map((item) => [item.f_name, item.value])),
  )
})

const legendList = computed(() => {
  if (!formattedData.value.length) return []
  const exclude = ["设备编号", "更新时间", "是否在线数据", "时间"]
  return Object.keys(formattedData.value[0]).filter((key) => !exclude.includes(key))
})

const units = computed(() => {
  const unitMap = {}
  deviceData.value.forEach((group) => {
    group.forEach((item) => {
      if (item.unit && legendList.value.includes(item.f_name)) {
        unitMap[item.f_name] = item.unit
      }
    })
  })
  return unitMap
})

const chartTitle = computed(() => {
  const suffix =
    appStore.value.settings.showDeviceFeatures && props.selectDevice
      ? ` - ${props.selectDevice}`
      : ""
  return `${tableMap[props.type]} Data Overview${suffix}`
})

const chartCategories = computed(() => {
  return formattedData.value.map((item) =>
    formatDate(item["时间"], "YYYY-MM-DD HH:mm"),
  )
})

const currentChartType = computed(() => chartTypes[chartTypeIndex.value].value)

const chartSeries = computed(() => {
  const series = legendList.value.map((name) => ({
    name,
    unit: units.value[name] || "",
    data: formattedData.value.map((item) => item[name]),
  }))

  return normalizeChartSeries(series, currentChartType.value)
})

const chartYAxis = computed(() => {
  return createValueAxisConfig(chartSeries.value, { forceZeroMin: true })
})

async function fetchDeviceData(d_no) {
  try {
    const response = await getFormatMinuteAvg(d_no, props.type)
    const data = response.data || response
    deviceData.value = [...data]
  } catch (error) {
    console.error("获取设备数据失败:", error)
    uni.showToast({
      title: "获取数据失败",
      icon: "none",
    })
  }
}

const handleWsData = (data) => {
  if (data.d_no !== props.selectDevice) return
  if (!deviceData.value.length || !deviceData.value[0]?.length) return

  const newDataPoint = [
    {
      f_name: "时间",
      value: formatDate(data.timestamp, "YYYY-MM-DD HH:mm"),
    },
  ]

  deviceData.value[0].forEach((item) => {
    if (item.f_name === "时间") return
    if (item.db_name && data[item.db_name] !== undefined) {
      newDataPoint.push({
        f_name: item.f_name,
        db_name: item.db_name,
        unit: item.unit,
        value: parseFloat(data[item.db_name]),
      })
    }
  })

  deviceData.value.push(newDataPoint)

  if (deviceData.value.length > 20) {
    deviceData.value.shift()
  }
}

function onChartTypeChange(e) {
  chartTypeIndex.value = Number(e.detail.value)
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

watch(
  () => props.selectDevice,
  async (newDevice) => {
    if (newDevice) {
      await fetchDeviceData(newDevice)
    } else {
      deviceData.value = []
    }
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
#sensor-charts {
  width: 100%;
  max-width: 100%;
  overflow: hidden;

  .charts-container {
    width: 100%;
    min-height: 620rpx;
  }

  .tool-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
    width: 100%;
    max-width: 100%;
    padding-right: 4px;
    box-sizing: border-box;

    .picker-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background-color: #fff;
      border: 1px solid #dcdfe6;
      border-radius: 4px;
      min-width: 96px;
      max-width: calc(100vw - 72px);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;

      .arrow {
        color: #999;
        font-size: 12px;
        margin-left: 8px;
      }
    }
  }
}

/* uni-app 适配样式 */
/* #ifdef MP-WEIXIN || MP-ALIPAY */
#sensor-charts {
  .tool-bar {
    margin-bottom: 20rpx;
    padding-right: 0;

    .picker-box {
      padding: 16rpx 28rpx;
      max-width: calc(100vw - 88rpx);
    }
  }

  .charts-container {
    min-height: 680rpx;
  }
}
/* #endif */
</style>
