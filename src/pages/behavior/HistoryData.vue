<template>
  <view class="page">
    <view class="menu-list">
      <view
        class="menu-item"
        @click="navigateTo('/pages/behavior/RealtimeData')"
      >
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

    <view class="filter-wrapper">
      <view class="filter-item" v-if="appStore.settings.showDeviceFeatures">
        <text class="filter-label">设备编号</text>
        <input
          class="filter-input"
          type="text"
          :value="d_no"
          @input="onDeviceInput"
          placeholder="请输入设备编号"
          confirm-type="done"
        />
      </view>

      <view class="filter-item">
        <text class="filter-label">开始时间</text>
        <!-- #ifdef H5 -->
        <input
          class="filter-input date-input"
          type="date"
          :value="startDate"
          @change="onStartDateChange"
        />
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker mode="date" :value="startDate" @change="onStartDateChange">
          <view class="date-picker">
            <text>{{ startDate || "选择日期" }}</text>
          </view>
        </picker>
        <!-- #endif -->
      </view>

      <view class="filter-item">
        <text class="filter-label">结束时间</text>
        <!-- #ifdef H5 -->
        <input
          class="filter-input date-input"
          type="date"
          :value="endDate"
          @change="onEndDateChange"
        />
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker mode="date" :value="endDate" @change="onEndDateChange">
          <view class="date-picker">
            <text>{{ endDate || "选择日期" }}</text>
          </view>
        </picker>
        <!-- #endif -->
      </view>

      <view class="filter-actions">
        <button class="query-btn" @click="onFilter">查询</button>
        <button class="reset-btn" @click="onReset">重置</button>
      </view>
    </view>

    <view class="table-wrapper">
      <view class="table-container">
        <!-- #ifdef H5 -->
        <view class="table-scroll table-scroll-native">
          <view class="table-scroll-content">
            <view class="table">
              <view class="table-header">
                <view
                  class="table-cell header-cell"
                  v-for="(header, index) in filteredTableHeader"
                  :key="index"
                >
                  <text>{{ header.label }}</text>
                </view>
              </view>

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
          </view>
        </view>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <scroll-view scroll-x="true" class="table-scroll">
          <view class="table-scroll-content">
            <view class="table">
              <view class="table-header">
                <view
                  class="table-cell header-cell"
                  v-for="(header, index) in filteredTableHeader"
                  :key="index"
                >
                  <text>{{ header.label }}</text>
                </view>
              </view>

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
          </view>
        </scroll-view>
        <!-- #endif -->

        <view class="empty-data" v-if="formattedTableData.length === 0">
          <text>暂无数据</text>
        </view>
      </view>
    </view>

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

    <view class="chart-wrapper">
      <UChartCanvas
        :categories="chartCategories"
        :series="chartSeries"
        :yAxis="chartYAxis"
        height="640rpx"
      />
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue"
import UChartCanvas from "@/components/charts/UChartCanvas.vue"
import { getFormatChart, getFormatPaged } from "@/api/get_format_limit"
import { appStore } from "@/stores/index"
import {
  createValueAxisConfig,
  downsampleChartData,
  normalizeChartSeries,
} from "@/utils/ucharts"
import wsClient from "@/utils/websocket"
import { navigateToPage } from "@/utils/navigation"

const type = ref("behavior")
const d_no = ref("")
const startDate = ref("")
const endDate = ref("")
const tableData = ref([])
const tableHeader = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizes = [5, 10, 20, 50, 100]
const pageSizeIndex = ref(1)
const chartCategories = shallowRef([])
const chartSeries = shallowRef([])
const chartYAxis = shallowRef({ disabled: false, splitNumber: 5 })
let wsRefreshTimer = null
let chartRequestId = 0
let lastChartFetchAt = 0
let isChartFetching = false
let hasPendingChartRefresh = false
const CHART_REFRESH_INTERVAL = 10000
const MAX_CHART_POINTS_MOBILE = 120
const MAX_CHART_POINTS_DESKTOP = 200

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)

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

const handleWsData = (data) => {
  if (
    appStore.value.settings.showDeviceFeatures &&
    data.d_no &&
    data.d_no !== d_no.value
  ) {
    return
  }

  if (!data.timestamp) return

  const dataTime = new Date(data.timestamp)
  const start = startDate.value ? new Date(startDate.value) : null
  const end = endDate.value ? new Date(endDate.value) : null

  if ((!start || dataTime >= start) && (!end || dataTime <= end)) {
    scheduleChartRefresh()
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

  wsClient.on("behavior_update", handleWsData)
  wsClient.send({
    type: "subscribe",
    topics: ["behavior_update"],
  })
})

onUnmounted(() => {
  wsClient.off("behavior_update", handleWsData)
  if (wsRefreshTimer) {
    clearTimeout(wsRefreshTimer)
    wsRefreshTimer = null
  }
})

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
      tableHeader.value = response[0].map((field) => ({
        prop: field.f_name,
        label: field.unit ? `${field.f_name}(${field.unit})` : field.f_name,
      }))
    } else {
      tableHeader.value = []
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
  if (isChartFetching) {
    hasPendingChartRefresh = true
    return
  }

  isChartFetching = true
  const requestId = ++chartRequestId
  lastChartFetchAt = Date.now()
  try {
    const res = await getFormatChart(
      d_no.value,
      startDate.value ? `${startDate.value} 00:00:00` : "",
      endDate.value ? `${endDate.value} 23:59:59` : "",
      type.value,
    )
    const { times, series } = res.data.data

    if (requestId !== chartRequestId) {
      return
    }

    if (!times?.length) {
      chartCategories.value = []
      chartSeries.value = []
      chartYAxis.value = { disabled: false, splitNumber: 5 }
      return
    }

    const screenWidth = uni.getSystemInfoSync().windowWidth || 375
    const maxPoints =
      screenWidth >= 1024 ? MAX_CHART_POINTS_DESKTOP : MAX_CHART_POINTS_MOBILE
    const sampled = downsampleChartData(times, series, maxPoints)
    const normalizedSeries = normalizeChartSeries(
      sampled.series.map((item) => ({
        ...item,
        unit: item.unit || "",
      })),
      "line",
    )

    chartCategories.value = sampled.times
    chartSeries.value = normalizedSeries
    chartYAxis.value = createValueAxisConfig(normalizedSeries, {
      forceZeroMin: true,
    })
  } catch (error) {
    console.error("获取图表数据失败:", error)
    uni.showToast({
      title: "获取图表数据失败",
      icon: "none",
    })
  } finally {
    isChartFetching = false
    if (hasPendingChartRefresh) {
      hasPendingChartRefresh = false
      scheduleChartRefresh()
    }
  }
}

function scheduleChartRefresh() {
  const elapsed = Date.now() - lastChartFetchAt
  const delay = Math.max(500, CHART_REFRESH_INTERVAL - elapsed)

  if (wsRefreshTimer) {
    clearTimeout(wsRefreshTimer)
  }

  wsRefreshTimer = setTimeout(() => {
    if (isChartFetching) {
      hasPendingChartRefresh = true
      return
    }
    fetchChartData()
  }, delay)
}

function readEventValue(e) {
  if (e?.detail?.value !== undefined) return e.detail.value
  if (e?.target?.value !== undefined) return e.target.value
  return ""
}

function onDeviceInput(e) {
  d_no.value = readEventValue(e)
}

function onStartDateChange(e) {
  startDate.value = readEventValue(e)
}

function onEndDateChange(e) {
  endDate.value = readEventValue(e)
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
  position: relative;
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

.filter-input,
.date-picker {
  width: 100%;
  padding: 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  font-size: 30rpx;
  color: #333;
  background-color: #f9f9f9;
  box-sizing: border-box;
}

.date-input {
  min-height: 80rpx;
  line-height: 40rpx;
}

.filter-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
}

.query-btn,
.reset-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 12rpx;
  font-size: 30rpx;
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

.table-wrapper {
  margin: 20rpx;
  position: relative;
  z-index: 1;
}

.table-container {
  background-color: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
}

.table-scroll {
  width: 100%;
  white-space: nowrap;
}

.table-scroll-native {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.table-scroll-content {
  min-width: 100%;
  display: flex;
  justify-content: center;
}

.table {
  width: 100%;
  min-width: max-content;
}

.table-header {
  display: flex;
  background-color: #f7f9fc;
  border-bottom: 2rpx solid #ebeef5;
  width: 100%;
  min-width: max-content;
}

.table-body {
  max-height: 800rpx;
}

.table-row {
  display: flex;
  border-bottom: 1rpx solid #f0f0f0;
  width: 100%;
  min-width: max-content;
}

.table-cell {
  flex: 1 0 180rpx;
  min-width: 180rpx;
  padding: 24rpx 16rpx;
  box-sizing: border-box;
  font-size: 24rpx;
  color: #666;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-all;
}

.header-cell {
  font-size: 26rpx;
  font-weight: 600;
  color: #333;
}

.empty-data {
  padding: 80rpx;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}

.pagination-wrapper {
  margin: 20rpx;
  padding: 24rpx 30rpx;
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
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

.chart-wrapper {
  margin: 20rpx;
  padding: 30rpx;
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 1;
}
</style>
