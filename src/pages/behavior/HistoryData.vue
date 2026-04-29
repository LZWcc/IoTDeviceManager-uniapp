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
      <view
        class="filter-item"
        v-if="appStore.settings.showDeviceFeatures"
      >
        <text class="filter-label">设备编号</text>
        <input
          class="filter-input"
          :value="d_no"
          placeholder="请输入设备编号"
          confirm-type="done"
          @input="onDeviceInput"
          @confirm="onFilter"
        />
      </view>

      <view class="filter-item">
        <text class="filter-label">开始时间</text>
        <DateTimePickerField
          field="start"
          placeholder="请选择开始时间"
          default-start-time="00:00:00"
          default-end-time="23:59:59"
          :start-value="startDateTimeText"
          :end-value="endDateTimeText"
          @update:startValue="onStartDateTimeChange"
          @update:endValue="onEndDateTimeChange"
        />
      </view>

      <view class="filter-item">
        <text class="filter-label">结束时间</text>
        <DateTimePickerField
          field="end"
          placeholder="请选择结束时间"
          default-start-time="00:00:00"
          default-end-time="23:59:59"
          :start-value="startDateTimeText"
          :end-value="endDateTimeText"
          @update:startValue="onStartDateTimeChange"
          @update:endValue="onEndDateTimeChange"
        />
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
      <view class="chart-toolbar">
        <view class="chart-mode-control">
          <text class="chart-mode-label">图表模式</text>
          <picker
            mode="selector"
            :range="chartModeOptions"
            range-key="label"
            :value="chartModeIndex"
            @change="onChartModeChange"
          >
            <view class="chart-select-picker chart-mode-picker">
              <text>{{ chartModeOptions[chartModeIndex].label }}</text>
              <text class="chart-type-arrow">▼</text>
            </view>
          </picker>
        </view>
        <picker
          mode="selector"
          :range="chartTypes"
          range-key="label"
          :value="chartTypeIndex"
          @change="onChartTypeChange"
        >
          <view class="chart-select-picker chart-type-picker">
            <text>{{ chartTypes[chartTypeIndex].label }}</text>
            <text class="chart-type-arrow">▼</text>
          </view>
        </picker>
      </view>
      <UChartCanvas
        :type="currentChartType"
        :categories="chartCategories"
        :series="chartSeries"
        :yAxis="chartYAxis"
        :animation="true"
        :animation-duration="420"
        height="640rpx"
      />
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue"
import DateTimePickerField from "@/components/DateTimePickerField.vue"
import UChartCanvas from "@/components/charts/UChartCanvas.vue"
import { getFormatChart, getFormatPaged } from "@/api/get_format_limit"
import { appStore } from "@/stores/index"
import {
  alignChartDataToCategories,
  createValueAxisConfig,
  downsampleChartData,
  normalizeChartSeries,
  toChartNumber,
} from "@/utils/ucharts"
import wsClient from "@/utils/websocket"
import { navigateToPage } from "@/utils/navigation"

const type = ref("behavior")
const d_no = ref("")
const DEFAULT_START_TIME = "00:00:00"
const DEFAULT_END_TIME = "23:59:59"
const startDate = ref("")
const startTime = ref(DEFAULT_START_TIME)
const endDate = ref("")
const endTime = ref(DEFAULT_END_TIME)
const tableData = ref([])
const tableHeader = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizes = [5, 10, 20, 50, 100]
const pageSizeIndex = ref(1)
const chartDataMode = ref("page")
const chartModeOptions = [
  { label: "趋势总览", value: "range" },
  { label: "当前页明细", value: "page" },
]
const chartTypeIndex = ref(0)
const chartTypes = [
  { label: "折线图", value: "line" },
  { label: "柱状图", value: "bar" },
]
const chartCategories = shallowRef([])
const chartSeries = shallowRef([])
const chartYAxis = shallowRef({ disabled: false, splitNumber: 5 })
let wsRefreshTimer = null
let wsHistoryRefreshTimer = null
let chartRequestId = 0
let lastChartFetchAt = 0
let isChartFetching = false
let hasPendingChartRefresh = false
const CHART_REFRESH_INTERVAL = 10000
const HISTORY_REFRESH_DEBOUNCE = 400
const MAX_CHART_POINTS_MOBILE = 120
const MAX_CHART_POINTS_DESKTOP = 200
const CHART_AXIS_MAX = 100
const PAGE_CHART_EXCLUDED_FIELDS = new Set([
  "设备编号",
  "是否在线数据",
  "更新时间",
])

const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)
const chartModeIndex = computed(() => {
  const index = chartModeOptions.findIndex(
    (item) => item.value === chartDataMode.value,
  )
  return index >= 0 ? index : 0
})
const currentChartType = computed(() => chartTypes[chartTypeIndex.value].value)
const startDateTimeText = computed(() =>
  buildDateTimeText(startDate.value, startTime.value, false),
)
const endDateTimeText = computed(() =>
  buildDateTimeText(endDate.value, endTime.value, true),
)

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
  // 历史页收到实时推送后不直接改表格，只在推送数据命中当前筛选范围时调度刷新。
  if (shouldRefreshChartFromWs(data)) {
    scheduleHistoryRefresh()
  }
}

// 页面初始化入口：先加载当前页表格；默认 page 模式下会顺带用表格数据生成图表，最后再订阅实时更新。
onMounted(async () => {
  try {
    await fetchData()
    if (chartDataMode.value === "range") {
      await fetchChartData()
    }
  } catch (error) {
    console.error("初始化失败:", error)
    uni.showToast({
      title: "初始化失败",
      icon: "none",
    })
  }

  // 初始化数据完成后再监听 WebSocket，避免页面还未准备好就处理实时推送。
  wsClient.on("behavior_update", handleWsData)
  wsClient.send({
    type: "subscribe",
    topics: ["behavior_update"],
  })
})

onUnmounted(() => {
  wsClient.off("behavior_update", handleWsData)
  clearScheduledChartRefresh()
  clearScheduledHistoryRefresh()
})

// 汇总当前筛选、分页和业务类型，生成表格分页接口需要的参数。
function buildTableQueryParams() {
  return {
    page: currentPage.value,
    pageSize: pageSize.value,
    dNo: d_no.value,
    startTime: buildDateTimeParam(startDate.value, startTime.value, false),
    endTime: buildDateTimeParam(endDate.value, endTime.value, true),
    type: type.value,
  }
}

// 统一整理分页接口返回值：表格行、动态表头和总数都在这里标准化。
function normalizeTableResponse(res) {
  const rows = Array.isArray(res.data.data) ? res.data.data : []
  const headers = rows.length
    ? rows[0].map((field) => ({
        prop: field.f_name,
        label: field.unit ? `${field.f_name}(${field.unit})` : field.f_name,
      }))
    : []

  return {
    rows,
    headers,
    total: res.data.total,
  }
}

// 应用表格请求结果；当前页明细模式下，图表直接跟随表格当前页同步重建。
function applyTableResponse(result) {
  tableData.value = result.rows
  tableHeader.value = result.headers
  total.value = result.total

  if (chartDataMode.value === "page") {
    updateChartFromCurrentPage()
  }
}

// 表格数据主入口：只请求当前页数据，并把响应交给标准化和应用函数处理。
// 表格接口只负责当前页数据；图表接口单独请求，避免把两种返回结构混在一起处理。
async function fetchData() {
  try {
    const params = buildTableQueryParams()
    const res = await getFormatPaged(
      params.page,
      params.pageSize,
      params.dNo,
      params.startTime,
      params.endTime,
      params.type,
    )
    applyTableResponse(normalizeTableResponse(res))
  } catch (error) {
    console.error("获取数据失败:", error)
    uni.showToast({
      title: "获取数据失败",
      icon: "none",
    })
  }
}

function buildChartQueryParams() {
  return {
    dNo: d_no.value,
    startTime: buildDateTimeParam(startDate.value, startTime.value, false),
    endTime: buildDateTimeParam(endDate.value, endTime.value, true),
    type: type.value,
  }
}

function getChartMaxPoints() {
  const screenWidth = uni.getSystemInfoSync().windowWidth || 375
  return screenWidth >= 1024 ? MAX_CHART_POINTS_DESKTOP : MAX_CHART_POINTS_MOBILE
}

function normalizeChartResponse(res) {
  const { times, series } = res.data.data
  if (!times?.length) {
    return {
      categories: [],
      series: [],
      yAxis: { disabled: false, splitNumber: 5 },
    }
  }

  const aligned = alignChartDataToCategories(times, series)
  const sampled = downsampleChartData(
    aligned.times,
    aligned.series,
    getChartMaxPoints(),
  )
  const normalizedSeries = normalizeChartSeries(
    sampled.series.map((item) => ({
      ...item,
      unit: item.unit || "",
    })),
    currentChartType.value,
  )

  return {
    categories: sampled.times,
    series: normalizedSeries,
    yAxis: createValueAxisConfig(normalizedSeries, {
      forceZeroMin: true,
      fixedMax: CHART_AXIS_MAX,
    }),
  }
}

function applyChartResponse(result, requestId) {
  // 图表请求可能被筛选、模式切换打断，旧请求回来不能覆盖新状态。
  if (requestId !== chartRequestId || chartDataMode.value !== "range") return

  chartCategories.value = result.categories
  chartSeries.value = result.series
  chartYAxis.value = result.yAxis
  appendLatestTablePointToRangeChart()
}

// 趋势总览使用独立图表接口；当前页明细模式由表格数据生成，不走这里。
async function fetchChartData() {
  if (chartDataMode.value !== "range") return
  if (isChartFetching) {
    hasPendingChartRefresh = true
    return
  }

  isChartFetching = true
  const requestId = ++chartRequestId
  lastChartFetchAt = Date.now()
  try {
    const params = buildChartQueryParams()
    const res = await getFormatChart(
      params.dNo,
      params.startTime,
      params.endTime,
      params.type,
    )
    applyChartResponse(normalizeChartResponse(res), requestId)
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

function clearScheduledChartRefresh() {
  if (wsRefreshTimer) {
    clearTimeout(wsRefreshTimer)
    wsRefreshTimer = null
  }
  hasPendingChartRefresh = false
}

function clearScheduledHistoryRefresh() {
  if (wsHistoryRefreshTimer) {
    clearTimeout(wsHistoryRefreshTimer)
    wsHistoryRefreshTimer = null
  }
}

function shouldRefreshChartFromWs(data) {
  // 设备功能开启且用户已筛选设备时，只响应同设备推送；未筛选设备时保留“全设备”刷新行为。
  if (
    appStore.value.settings.showDeviceFeatures &&
    d_no.value &&
    data.d_no &&
    data.d_no !== d_no.value
  ) {
    return false
  }
  // 没有时间戳就无法判断是否命中当前时间筛选，直接忽略，避免无效刷新。
  if (!data.timestamp) return false

  // 只在推送时间落入当前筛选区间时刷新；起止时间为空表示该方向不限制。
  const dataTime = new Date(data.timestamp)
  const start = parseDateTime(startDate.value, startTime.value, false)
  const end = parseDateTime(endDate.value, endTime.value, true)
  return (!start || dataTime >= start) && (!end || dataTime <= end)
}

function scheduleChartRefresh() {
  if (chartDataMode.value !== "range") return

  const elapsed = Date.now() - lastChartFetchAt
  const delay = Math.max(500, CHART_REFRESH_INTERVAL - elapsed)
  clearScheduledChartRefresh()

  // 图表接口可能较重，实时推送过来时至少间隔 CHART_REFRESH_INTERVAL 再重新拉取。
  wsRefreshTimer = setTimeout(() => {
    if (isChartFetching) {
      hasPendingChartRefresh = true
      return
    }
    fetchChartData()
  }, delay)
}

function scheduleHistoryRefresh() {
  clearScheduledHistoryRefresh()

  wsHistoryRefreshTimer = setTimeout(async () => {
    wsHistoryRefreshTimer = null
    await fetchData()
    if (chartDataMode.value === "range") {
      // WebSocket 是被动高频来源，趋势图刷新必须复用节流，不能绕过后直接拉全量图表。
      scheduleChartRefresh()
    }
  }, HISTORY_REFRESH_DEBOUNCE)
}

function readEventValue(e) {
  if (e?.detail?.value !== undefined) return e.detail.value
  if (e?.target?.value !== undefined) return e.target.value
  return ""
}

function onDeviceInput(e) {
  d_no.value = readEventValue(e)
}

function onStartDateTimeChange(value) {
  applyDateTimeValue("start", value)
}

function onEndDateTimeChange(value) {
  applyDateTimeValue("end", value)
}

// 日期和时间在页面状态里分开存，只有展示和请求前才组装成后端需要的 datetime 字符串。
function buildDateTimeText(date, time, isEnd) {
  if (!date) return ""
  const fallbackTime = isEnd ? DEFAULT_END_TIME : DEFAULT_START_TIME
  return `${date} ${normalizeTimeText(time, fallbackTime)}`
}

function buildDateTimeParam(date, time, isEnd) {
  return buildDateTimeText(date, time, isEnd)
}

function normalizeTimeText(time, fallbackTime) {
  const [fallbackHour = "00", fallbackMinute = "00", fallbackSecond = "00"] =
    String(fallbackTime || DEFAULT_START_TIME).split(":")
  const [hourText = fallbackHour, minuteText = fallbackMinute, secondText = fallbackSecond] =
    String(time || "").split(":")

  const parts = [hourText, minuteText, secondText].map((item, index) => {
    const fallback = [fallbackHour, fallbackMinute, fallbackSecond][index]
    const numeric = Number(item)
    if (Number.isNaN(numeric)) {
      return String(fallback).padStart(2, "0")
    }
    const [min, max] = index === 0 ? [0, 23] : [0, 59]
    const safeValue = Math.min(Math.max(numeric, min), max)
    return String(safeValue).padStart(2, "0")
  })

  return parts.join(":")
}

function applyDateTimeValue(kind, rawValue) {
  const normalizedValue = String(rawValue || "").trim()
  const isEnd = kind === "end"

  if (!normalizedValue) {
    if (kind === "start") {
      startDate.value = ""
      startTime.value = DEFAULT_START_TIME
    } else {
      endDate.value = ""
      endTime.value = DEFAULT_END_TIME
    }
    return
  }

  const [dateText, timeText = isEnd ? DEFAULT_END_TIME : DEFAULT_START_TIME] =
    normalizedValue.replace(" ", "T").split("T")
  const safeTime = normalizeTimeText(
    timeText,
    isEnd ? DEFAULT_END_TIME : DEFAULT_START_TIME,
  )

  if (kind === "start") {
    startDate.value = dateText
    startTime.value = safeTime || DEFAULT_START_TIME
  } else {
    endDate.value = dateText
    endTime.value = safeTime || DEFAULT_END_TIME
  }
}

function parseDateTime(date, time, isEnd) {
  if (!date) return null
  const [year, month, day] = date.split("-").map((item) => Number(item))
  const [hour, minute, second] = normalizeTimeText(
    time,
    isEnd ? DEFAULT_END_TIME : DEFAULT_START_TIME,
  )
    .split(":")
    .map((item) => Number(item))

  if (
    [year, month, day, hour, minute, second].some((item) => Number.isNaN(item))
  ) {
    return null
  }

  return new Date(year, month - 1, day, hour, minute, second)
}

async function onFilter() {
  if (!appStore.value.settings.showDeviceFeatures) {
    d_no.value = ""
  }
  currentPage.value = 1
  await fetchData()
  if (chartDataMode.value === "range") {
    clearScheduledChartRefresh()
    await fetchChartData()
  }
}

async function onReset() {
  d_no.value = ""
  startDate.value = ""
  startTime.value = DEFAULT_START_TIME
  endDate.value = ""
  endTime.value = DEFAULT_END_TIME
  currentPage.value = 1
  await fetchData()
  if (chartDataMode.value === "range") {
    clearScheduledChartRefresh()
    await fetchChartData()
  }
}

function onPageSizeChange(e) {
  pageSizeIndex.value = e.detail.value
  pageSize.value = pageSizes[e.detail.value]
  currentPage.value = 1
  fetchData()
}

function onChartTypeChange(e) {
  const index = Number(readEventValue(e))
  chartTypeIndex.value = Number.isNaN(index) ? 0 : index
  chartSeries.value = normalizeChartSeries(
    (chartSeries.value || []).map((item) => ({
      ...item,
    })),
    currentChartType.value,
  )
}

function onChartModeChange(e) {
  const index = Number(readEventValue(e))
  const nextMode = chartModeOptions[index]?.value || "range"
  chartDataMode.value = nextMode

  if (nextMode === "page") {
    updateChartFromCurrentPage()
    return
  }

  clearScheduledChartRefresh()
  lastChartFetchAt = 0
  fetchChartData()
}

// 当前页明细图表入口：不请求图表接口，直接把当前页表格数据转换成图表数据。
function updateChartFromCurrentPage() {
  clearScheduledChartRefresh()
  chartRequestId += 1

  const { categories, series } = buildChartDataFromTableData(tableData.value)
  const normalizedSeries = normalizeChartSeries(series, currentChartType.value)

  chartCategories.value = categories
  chartSeries.value = normalizedSeries
  chartYAxis.value = createValueAxisConfig(normalizedSeries, {
    forceZeroMin: true,
    fixedMax: CHART_AXIS_MAX,
  })
}

// 将当前页表格行转换为图表 categories/series；表格通常倒序展示，图表按时间正序展示。
function buildChartDataFromTableData(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { categories: [], series: [] }
  }

  const orderedRows = [...rows].reverse()
  const categories = orderedRows.map((row, index) => {
    const timeField = findFieldByName(row, "更新时间")
    const value = timeField?.value
    return value === null || value === undefined || value === ""
      ? String(index + 1)
      : String(value)
  })
  const metricNames = []
  const metricUnits = new Map()

  orderedRows.forEach((row) => {
    if (!Array.isArray(row)) return
    row.forEach((field) => {
      if (!field?.f_name || PAGE_CHART_EXCLUDED_FIELDS.has(field.f_name)) return
      if (metricNames.includes(field.f_name)) return
      if (toChartNumber(field.value) === null) return

      metricNames.push(field.f_name)
      metricUnits.set(field.f_name, field.unit || "")
    })
  })

  const series = metricNames.map((name) => ({
    name,
    unit: metricUnits.get(name) || "",
    data: orderedRows.map((row) => {
      const field = findFieldByName(row, name)
      return toChartNumber(field?.value)
    }),
  }))

  return { categories, series }
}

function findFieldByName(row, name) {
  if (!Array.isArray(row)) return null
  return row.find((field) => field?.f_name === name) || null
}

function appendLatestTablePointToRangeChart() {
  const latestRow = tableData.value[0]
  if (!Array.isArray(latestRow) || chartDataMode.value !== "range") return
  if (!chartCategories.value?.length || !chartSeries.value?.length) return

  const timeText = getChartMinuteText(findFieldByName(latestRow, "更新时间")?.value)
  if (!timeText || chartCategories.value.includes(timeText)) return

  const nextSeries = chartSeries.value.map((item) => {
    if (!item?.name || !Array.isArray(item.data)) return item

    const field = findFieldByName(latestRow, item.name)
    return {
      ...item,
      data: [...item.data, toChartNumber(field?.value)],
    }
  })

  chartCategories.value = [...chartCategories.value, timeText]
  chartSeries.value = nextSeries
  chartYAxis.value = createValueAxisConfig(nextSeries, {
    forceZeroMin: true,
    fixedMax: CHART_AXIS_MAX,
  })
}

function getChartMinuteText(value) {
  if (!value) return ""
  const text = String(value).replace("T", " ")
  const match = text.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/)
  return match ? match[1] : text
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
  position: relative;
  z-index: 20;
  isolation: isolate;
}

.filter-item {
  margin-bottom: 24rpx;
  position: relative;
}

.filter-label {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 12rpx;
}

.filter-input,
.datetime-picker {
  width: 100%;
  min-height: 76rpx;
  padding: 0 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  font-size: 30rpx;
  color: #333;
  background-color: #f9f9f9;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 22;
  pointer-events: auto;
}

.filter-input :deep(.uni-input-wrapper),
.datetime-picker :deep(.uni-input-wrapper) {
  width: 100%;
  min-height: 76rpx;
  display: flex;
  align-items: center;
}

.filter-input :deep(.uni-input-input),
.filter-input :deep(input),
.datetime-picker :deep(.uni-input-input),
.datetime-picker :deep(input) {
  width: 100%;
  min-height: 76rpx;
  height: 76rpx;
  line-height: 76rpx;
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
  background: transparent;
  color: inherit;
}

.datetime-native-input {
  appearance: none;
  -webkit-appearance: none;
}

.datetime-native-input :deep(.uni-input-input),
.datetime-native-input :deep(input) {
  cursor: pointer;
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
  justify-content: flex-start;
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
  width: 100%;
  min-width: max-content;
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

.chart-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16rpx;
  flex-wrap: wrap;
  margin-bottom: 16rpx;
}

.chart-mode-control {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.chart-mode-label {
  font-size: 26rpx;
  color: #666;
  white-space: nowrap;
}

.chart-select-picker {
  min-width: 180rpx;
  max-width: 280rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  background-color: #f9f9f9;
  color: #333;
  font-size: 28rpx;
  box-sizing: border-box;
}

.chart-type-arrow {
  margin-left: 12rpx;
  color: #999;
  font-size: 20rpx;
}
</style>
