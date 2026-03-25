<template>
  <view class="page">
    <!-- 导航菜单 -->
    <view class="menu-list">
      <view class="menu-item" @click="navigateTo('/pages/sensor/RealtimeData')">
        <text class="menu-icon">📊</text>
        <text class="menu-text">实时数据</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item current">
        <text class="menu-icon">📈</text>
        <text class="menu-text">历史数据</text>
        <text class="menu-badge">当前页</text>
      </view>
    </view>

    <!-- 筛选条件 -->
    <view class="filter-wrapper">
      <view class="filter-item" v-if="appStore.settings.showDeviceFeatures">
        <text class="filter-label">设备编号</text>
        <input
          class="filter-input"
          type="text"
          v-model="d_no"
          placeholder="请输入设备编号"
          confirm-type="done"
        />
      </view>

      <view class="filter-item">
        <text class="filter-label">开始时间</text>
        <picker mode="date" :value="startDate" @change="onStartDateChange">
          <view class="date-picker">
            <text>{{ startDate || "选择日期" }}</text>
          </view>
        </picker>
      </view>

      <view class="filter-item">
        <text class="filter-label">结束时间</text>
        <picker mode="date" :value="endDate" @change="onEndDateChange">
          <view class="date-picker">
            <text>{{ endDate || "选择日期" }}</text>
          </view>
        </picker>
      </view>

      <view class="filter-actions">
        <button class="query-btn" @click="onFilter">查询</button>
        <button class="reset-btn" @click="onReset">重置</button>
      </view>
    </view>

    <!-- 数据表格 -->
    <view class="table-wrapper">
      <view class="table-container">
        <scroll-view scroll-x="true" class="table-scroll">
          <view class="table">
            <!-- 表头 -->
            <view class="table-header">
              <view
                class="table-cell header-cell"
                v-for="(header, index) in filteredTableHeader"
                :key="index"
              >
                <text>{{ header.label }}</text>
              </view>
            </view>

            <!-- 表体 -->
            <view class="table-body">
              <view
                class="table-row"
                v-for="(row, rowIndex) in formattedTableData"
                :key="rowIndex"
              >
                <view
                  class="table-cell"
                  v-for="(header, colIndex) in filteredTableHeader"
                  :key="colIndex"
                >
                  <text>{{ row[header.prop] || "-" }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>

        <!-- 空数据提示 -->
        <view class="empty-data" v-if="formattedTableData.length === 0">
          <text>暂无数据</text>
        </view>
      </view>
    </view>

    <!-- 分页 -->
    <view class="pagination-wrapper">
      <view class="pagination-controls">
        <text class="total-text">共 {{ total }} 条</text>
        <view class="pagination-center">
          <button
            class="page-btn"
            :disabled="currentPage === 1"
            @click="prevPage"
          >
            ‹
          </button>
          <text class="page-info">{{ currentPage }} / {{ totalPages }}</text>
          <button
            class="page-btn"
            :disabled="currentPage >= totalPages"
            @click="nextPage"
          >
            ›
          </button>
          <picker
            mode="selector"
            :range="pageSizes"
            :value="pageSizeIndex"
            @change="onPageSizeChange"
          >
            <view class="page-size-picker">
              <text>{{ pageSize }}条/页 ▼</text>
            </view>
          </picker>
        </view>
      </view>
    </view>

    <!-- 图表区域 -->
    <view class="chart-wrapper">
      <!-- #ifdef H5 -->
      <view class="chart-container" id="historyChartRef"></view>
      <!-- #endif -->

      <!-- #ifndef H5 -->
      <view class="chart-placeholder">
        <text>图表功能仅在 H5 平台支持</text>
      </view>
      <!-- #endif -->
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted, nextTick } from "vue"
import * as echarts from "echarts"
import { getFormatPaged, getFormatChart } from "@/api/get_format_limit"
import { appStore } from "@/stores/index"
import { formatDate } from "@/utils/index"
import wsClient from "@/utils/websocket"
import { navigateToPage } from "@/utils/navigation"

// #ifdef H5
let myChart = null
let resizeObserver = null
let resizeTimer = null
// #endif

const type = ref("sensor")

// 筛选条件
const d_no = ref("")
const startDate = ref("")
const endDate = ref("")

// 表格数据
const tableData = ref([])
const tableHeader = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizes = [5, 10, 20, 50, 100]
const pageSizeIndex = ref(1) // 默认 10

// 计算属性
const totalPages = computed(() => {
  return Math.ceil(total.value / pageSize.value) || 1
})

const formattedTableData = computed(() => {
  return tableData.value.map((row) => {
    const formattedRow = {}
    row.forEach((field) => {
      formattedRow[field.f_name] =
        field.value === null || field.value === undefined ? "" : field.value
    })
    return formattedRow
  })
})

const filteredTableHeader = computed(() => {
  if (appStore.value.settings.showDeviceFeatures) {
    return tableHeader.value
  }
  return tableHeader.value.filter((col) => col.prop !== "设备编号")
})

// WebSocket 实时数据更新处理
const handleWsData = (data) => {
  // 如果设备编号不匹配，忽略
  if (
    appStore.value.settings.showDeviceFeatures &&
    data.d_no &&
    data.d_no !== d_no.value
  ) {
    return
  }

  console.log("HistoryData received WS data:", data)

  // 更新图表数据（如果在当前日期范围内）
  if (myChart && data.timestamp) {
    const dataTime = new Date(data.timestamp)
    const start = startDate.value ? new Date(startDate.value) : null
    const end = endDate.value ? new Date(endDate.value) : null

    if ((!start || dataTime >= start) && (!end || dataTime <= end)) {
      // 重新获取图表数据
      fetchChartData()
    }
  }
}

onMounted(async () => {
  try {
    await fetchData()
    await fetchChartData()
  } catch (error) {
    console.error("初始化失败:", error)
    uni.showToast({
      title: "初始化失败",
      icon: "none",
    })
  }

  // WebSocket 监听
  const topic = "sensor_update"
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
  // 清理 WebSocket 监听
  const topic = "sensor_update"
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
      const chartDom = document.getElementById("historyChartRef")
      if (chartDom) {
        myChart.resize({
          width: chartDom.offsetWidth || window.innerWidth,
          height: chartDom.offsetHeight || 400,
        })
      }
    }
  }, 100)
  // #endif
}

async function fetchData() {
  try {
    const res = await getFormatPaged(
      currentPage.value,
      pageSize.value,
      d_no.value,
      startDate.value ? `${startDate.value} 00:00:00` : "",
      endDate.value ? `${endDate.value} 23:59:59` : "",
      type.value,
    )
    const response = res.data.data
    total.value = res.data.total

    if (response.length > 0) {
      tableHeader.value = response[0].map((field) => {
        return {
          prop: field.f_name,
          label: field.unit ? `${field.f_name}(${field.unit})` : field.f_name,
        }
      })
    }
    tableData.value = response
  } catch (error) {
    console.error("获取数据失败:", error)
    uni.showToast({
      title: "获取数据失败",
      icon: "none",
    })
  }
}

async function fetchChartData() {
  // #ifdef H5
  try {
    const res = await getFormatChart(
      d_no.value,
      startDate.value ? `${startDate.value} 00:00:00` : "",
      endDate.value ? `${endDate.value} 23:59:59` : "",
      type.value,
    )
    const { times, series } = res.data.data

    if (!times || times.length === 0) {
      uni.showToast({
        title: "没有可用的图表数据",
        icon: "none",
      })
      if (myChart) myChart.clear()
      return
    }

    console.log("chart data:", times, series)
    await nextTick()
    renderChart(times, series)
  } catch (error) {
    console.error("获取图表数据失败:", error)
    uni.showToast({
      title: "获取图表数据失败",
      icon: "none",
    })
  }
  // #endif
}

function renderChart(times, series) {
  // #ifdef H5
  if (!echarts) return

  const chartDom = document.getElementById("historyChartRef")
  if (!chartDom) return

  if (!myChart) {
    myChart = echarts.init(chartDom)

    // 使用 ResizeObserver 监听容器尺寸变化
    if (typeof ResizeObserver !== "undefined" && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        handleResize()
      })
      resizeObserver.observe(chartDom)
    }
  }

  const option = {
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        let tooltipText = params[0].axisValue + "<br/>"
        params.forEach((item) => {
          const unit = series[item.seriesIndex].unit || ""
          tooltipText += `${item.marker} ${item.seriesName}: ${item.data} ${unit}<br/>`
        })
        return tooltipText
      },
    },
    legend: {
      data: series.map((s) => s.name),
      top: "5%",
    },
    grid: {
      left: "10%",
      right: "10%",
      bottom: "10%",
      top: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: times,
      axisLabel: {
        rotate: 30,
      },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      interval: 10,
    },
    series: series.map((s) => ({
      name: s.name,
      type: "line",
      data: s.data,
      smooth: true,
    })),
  }

  myChart.setOption(option)
  // #endif
}

function onStartDateChange(e) {
  startDate.value = e.detail.value
}

function onEndDateChange(e) {
  endDate.value = e.detail.value
}

async function onFilter() {
  if (!appStore.value.settings.showDeviceFeatures) {
    d_no.value = ""
  }

  currentPage.value = 1
  await fetchData()
  await fetchChartData()
}

function onReset() {
  d_no.value = ""
  startDate.value = ""
  endDate.value = ""
  currentPage.value = 1
  fetchData()
  fetchChartData()
}

function onPageSizeChange(e) {
  pageSizeIndex.value = e.detail.value
  pageSize.value = pageSizes[e.detail.value]
  currentPage.value = 1
  fetchData()
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    fetchData()
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    fetchData()
  }
}

function navigateTo(url) {
  navigateToPage(url)
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 40rpx;
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

/* 筛选条件 */
.filter-wrapper {
  margin: 20rpx;
  padding: 30rpx;
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.filter-item {
  margin-bottom: 24rpx;
}

.filter-label {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.filter-input {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 20rpx;
  background-color: #f9f9f9;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.date-picker {
  padding: 20rpx;
  background-color: #f9f9f9;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
}

.filter-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.query-btn,
.reset-btn {
  flex: 1;
  padding: 24rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  border: none;
}

.query-btn {
  background-color: #2979ff;
  color: #fff;
}

.reset-btn {
  background-color: #f5f5f5;
  color: #666;
}

/* 表格样式 */
.table-wrapper {
  margin: 20rpx;
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.table-container {
  width: 100%;
  position: relative;
}

.table-scroll {
  width: 100%;
  white-space: nowrap;
}

.table {
  width: 100%;
  display: table;
  border-collapse: collapse;
}

.table-header {
  display: flex;
  background-color: #f5f7fa;
  border-bottom: 2rpx solid #e0e0e0;
}

.header-cell {
  font-weight: 600;
  color: #333;
  background: transparent;
}

.table-body {
  width: 100%;
}

.table-row {
  display: flex;
  border-bottom: 1rpx solid #f0f0f0;
}

.table-row:last-child {
  border-bottom: none;
}

.table-cell {
  flex: 1;
  min-width: 120rpx;
  padding: 24rpx 16rpx;
  font-size: 26rpx;
  color: #666;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-all;
}

.empty-data {
  padding: 80rpx;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}

/* 分页 */
.pagination-wrapper {
  margin: 20rpx;
  padding: 24rpx 30rpx;
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}

.pagination-controls {
  display: flex;
  align-items: center;
}

.total-text {
  font-size: 26rpx;
  color: #666;
  white-space: nowrap;
  flex-shrink: 0;
}

.pagination-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 0 8rpx;
  overflow: visible;
}

.page-btn {
  width: 56rpx;
  height: 56rpx;
  padding: 0;
  background-color: #2979ff;
  color: #fff;
  border-radius: 8rpx;
  font-size: 36rpx;
  font-weight: bold;
  line-height: 56rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.page-btn[disabled] {
  background-color: #e0e0e0;
  color: #999;
}

.page-info {
  font-size: 26rpx;
  color: #666;
  white-space: nowrap;
  min-width: 80rpx;
  text-align: center;
}

.page-size-picker {
  padding: 10rpx 12rpx;
  background-color: #f5f7fa;
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #666;
  white-space: nowrap;
  flex-shrink: 0;
}

/* 图表区域 */
.chart-wrapper {
  margin: 20rpx;
  padding: 30rpx;
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
}

.chart-container {
  width: 100%;
  max-width: 1200px;
  height: 400px;
  margin: 0 auto;
}

.chart-placeholder {
  width: 100%;
  max-width: 1200px;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  border-radius: 12rpx;
  color: #999;
  font-size: 28rpx;
  margin: 0 auto;
}
</style>
