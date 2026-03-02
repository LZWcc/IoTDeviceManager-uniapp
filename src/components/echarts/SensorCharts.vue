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

    <!-- 使用条件编译，H5 平台使用 ECharts -->
    <!-- #ifdef H5 -->
    <view class="charts-container" ref="chartRef" id="chartRef"></view>
    <!-- #endif -->

    <!-- #ifndef H5 -->
    <!-- 小程序等其他平台需要使用 lime-echart 或 uChart 等库 -->
    <view class="charts-container">
      <text class="placeholder-text"
        >请安装 lime-echart 或 uChart 以支持图表</text
      >
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted, nextTick } from "vue"
import { getFormatMinuteAvg } from "@/api/get_format_limit"
import { appStore } from "@/stores/index"
import { formatDate } from "@/utils/index"
import wsClient from "@/utils/websocket"

// #ifdef H5
let echarts = null
let myChart = null
let resizeObserver = null
let resizeTimer = null
// #endif

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

const chartRef = ref(null)
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

async function fetchDeviceData(d_no) {
  try {
    const response = await getFormatMinuteAvg(d_no, props.type)
    const data = response.data || response
    deviceData.value = [...data]
    console.log("SensorCharts deviceData:", deviceData.value)
    updateChart()
  } catch (error) {
    console.error("获取设备数据失败:", error)
    uni.showToast({
      title: "获取数据失败",
      icon: "none",
    })
  }
}

// 生成格式化数据
const formattedData = computed(() => {
  return deviceData.value.map((element) => {
    return Object.fromEntries(element.map((item) => [item.f_name, item.value]))
  })
})

const legendList = computed(() => {
  if (!formattedData.value.length) return []
  const exclude = ["设备编号", "更新时间", "是否在线数据", "时间"]
  return Object.keys(formattedData.value[0]).filter((k) => !exclude.includes(k))
})

const units = computed(() => {
  const unitMap = {}
  deviceData.value.forEach((dataGroup) => {
    dataGroup.forEach((item) => {
      if (item.unit && legendList.value.includes(item.f_name)) {
        unitMap[item.f_name] = item.unit
      }
    })
  })
  return unitMap
})

// 处理 WebSocket 数据更新
const handleWsData = (data) => {
  if (data.d_no !== props.selectDevice) return
  console.log(`SensorCharts received WS data:`, data)

  if (deviceData.value.length === 0 || deviceData.value[0].length === 0) {
    console.warn("没有历史数据，无法处理实时数据")
    return
  }

  const newDataPoint = []
  newDataPoint.push({
    f_name: "时间",
    value: formatDate(data.timestamp, "YYYY-MM-DD HH:mm"),
  })

  deviceData.value[0].forEach((item) => {
    if (item.f_name === "时间") return
    // 如果有 db_name，从 WebSocket 数据中提取对应的值
    if (item.db_name && data[item.db_name] !== undefined) {
      newDataPoint.push({
        f_name: item.f_name, // 如 "水温"
        db_name: item.db_name, // 如 "field4"
        unit: item.unit, // 如 "℃"
        value: parseFloat(data[item.db_name]), // 将字符串转为数字
      })
    }
  })

  // 将新数据点追加到 deviceData
  deviceData.value.push(newDataPoint)

  // 限制数据量
  const MAX_DATA_POINTS = 20
  if (deviceData.value.length > MAX_DATA_POINTS) {
    deviceData.value.shift() // 移除最旧的数据
  }
  updateChart()
}

function onChartTypeChange(e) {
  chartTypeIndex.value = e.detail.value
  updateChart()
}

onMounted(async () => {
  // #ifdef H5
  // 动态导入 ECharts (仅 H5 平台)
  try {
    const echartsModule = await import("echarts")
    echarts = echartsModule
    await initChart()
  } catch (error) {
    console.error("ECharts 加载失败:", error)
    uni.showToast({
      title: "ECharts 加载失败",
      icon: "none",
    })
  }
  // #endif

  // WebSocket 监听
  const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"
  wsClient.on(topic, handleWsData)
  wsClient.send({
    type: "subscribe",
    topics: [topic],
  })

  // #ifdef H5
  window.addEventListener("resize", handleResize)
  // #endif
})

onUnmounted(() => {
  const topic = props.type === "sensor" ? "sensor_update" : "behavior_update"
  wsClient.off(topic, handleWsData)

  // #ifdef H5
  window.removeEventListener("resize", handleResize)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  if (myChart) {
    myChart.dispose()
    myChart = null
  }
  // #endif
})

function handleResize() {
  // #ifdef H5
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
  resizeTimer = setTimeout(() => {
    if (myChart) {
      const chartDom = document.getElementById("chartRef")
      if (chartDom) {
        myChart.resize({
          width: chartDom.offsetWidth || window.innerWidth,
          height:
            chartDom.offsetHeight ||
            Math.max(Math.round(window.innerWidth * 0.5), 300),
        })
      }
    }
  }, 100)
  // #endif
}

watch(
  () => props.selectDevice,
  async (newDevice) => {
    if (newDevice) {
      await fetchDeviceData(newDevice)
    }
  },
  { immediate: true },
)

watch(chartTypeIndex, () => {
  updateChart()
})

watch(
  () => appStore.value.settings.showDeviceFeatures,
  () => {
    updateChart()
  },
)

async function initChart() {
  // #ifdef H5
  await nextTick()
  try {
    const chartDom = document.getElementById("chartRef")
    if (!chartDom || !echarts) {
      console.error("Chart container or echarts not found")
      return
    }
    // 若容器尺寸尚未生效（offsetHeight=0），使用计算值兜底
    const w = chartDom.offsetWidth || window.innerWidth
    const h =
      chartDom.offsetHeight ||
      Math.max(Math.round(window.innerWidth * 0.5), 300)
    myChart = echarts.init(chartDom, null, { width: w, height: h })
    // 初始化完成后，若数据已就绪则立即渲染
    updateChart()
    // 延迟 resize，确保父容器 CSS 已完全生效
    setTimeout(() => {
      if (myChart) myChart.resize()
    }, 150)

    // 使用 ResizeObserver 监听容器尺寸变化
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        handleResize()
      })
      resizeObserver.observe(chartDom)
    }
  } catch (error) {
    console.error("初始化图表失败:", error)
  }
  // #endif
}

function updateChart() {
  // #ifdef H5
  if (!myChart || !formattedData.value.length) return

  try {
    const times = formattedData.value.map((item) => {
      return formatDate(item["时间"], "YYYY-MM-DD HH:mm")
    })

    const currentChartType = chartTypes[chartTypeIndex.value].value

    const series = legendList.value.map((name) => {
      return {
        name: name,
        type: currentChartType,
        data: formattedData.value.map((item) => item[name]),
        smooth: true,
      }
    })

    myChart.setOption({
      title: {
        text:
          `${tableMap[props.type]} Data Overview` +
          `${appStore.value.settings.showDeviceFeatures ? " - " + props.selectDevice : ""}`,
        top: 8,
        left: "center",
        textStyle: {
          fontSize: 14,
        },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(50,50,50,0.9)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        axisPointer: {
          type: "cross",
          crossStyle: { color: "#999" },
          lineStyle: { type: "dashed" },
        },
        formatter: (params) => {
          if (!params || params.length === 0) return ""
          let text = params[0].axisValue + "\n"
          params.forEach((item) => {
            const unit = units.value[item.seriesName] || ""
            const value =
              item.data !== null && item.data !== undefined ? item.data : "-"
            text += `${item.seriesName}: ${value}${unit ? " " + unit : ""}\n`
          })
          return text.trimEnd()
        },
      },
      legend: {
        data: legendList.value,
        top: 36,
        type: "scroll",
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { fontSize: 11 },
      },
      grid: {
        top: 90,
        left: 8,
        right: 16,
        bottom: 48,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: times,
        name: "时间",
        nameGap: 28,
        axisLabel: {
          rotate: 30,
          fontSize: 10,
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        interval: 10,
        axisLabel: { fontSize: 10 },
      },
      series,
    })
  } catch (error) {
    console.error("更新图表失败:", error)
  }
  // #endif
}
</script>

<style lang="scss" scoped>
#sensor-charts {
  width: 100%;

  .charts-container {
    width: 100%;
    height: 50vw;
    min-height: 300px;

    /* #ifndef H5 */
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f5f5;
    border-radius: 8px;

    .placeholder-text {
      color: #999;
      font-size: 14px;
    }
    /* #endif */
  }

  .tool-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;

    .picker-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 14px;
      background-color: #fff;
      border: 1px solid #dcdfe6;
      border-radius: 4px;
      min-width: 100px;

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
    .picker-box {
      padding: 16rpx 28rpx;
    }
  }

  .charts-container {
    height: 800rpx;
  }
}
/* #endif */
</style>
