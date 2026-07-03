<template>
  <view class="page">
    <MenuNav :items="[
      { icon: '🗂️', label: '设备管理', url: '/pages/device/DeviceManage' },
      { icon: '⚠️', label: '错误信息', current: true },
    ]" />

    <view class="filter-wrapper">
      <view class="filter-item" v-if="showDeviceFeatures">
        <text class="filter-label">设备编号</text>
        <input
          v-model="dNo"
          class="filter-input"
          placeholder="请输入设备编号"
          confirm-type="search"
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
          :start-value="startDateTime"
          :end-value="endDateTime"
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
          :start-value="startDateTime"
          :end-value="endDateTime"
          @update:startValue="onStartDateTimeChange"
          @update:endValue="onEndDateTimeChange"
        />
      </view>

      <view class="filter-actions">
        <button class="action-btn primary-btn" @click="onFilter">查询</button>
        <button class="action-btn reset-btn" @click="onReset">重置</button>
      </view>
    </view>

    <view class="list-wrapper">
      <view v-if="loading" class="placeholder">
        <text>加载中...</text>
      </view>
      <view v-else-if="tableData.length === 0" class="placeholder">
        <text>暂无错误信息</text>
      </view>
      <view v-else class="error-list">
        <view v-for="(row, index) in tableData" :key="index" class="error-card">
          <view class="error-header">
            <text class="error-time">{{ row.c_time || "-" }}</text>
            <text class="error-tag" :class="tagClass(row.type)">
              {{ row.type_name || "-" }}
            </text>
          </view>
          <view v-if="showDeviceFeatures" class="error-device">
            <text>设备编号：{{ row.d_no || "-" }}</text>
          </view>
          <view class="error-device">
            <text>错误编号：{{ row.e_no || "-" }}</text>
          </view>
          <view class="error-content">
            <text>{{ row.e_msg || "-" }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="pagination-wrapper">
      <text class="total-text">共 {{ total }} 条</text>
      <view class="pagination-controls">
        <button
          class="page-btn"
          :disabled="currentPage === 1"
          @click="handlePrevPage"
        >
          上一页
        </button>
        <text class="page-text">{{ currentPage }} / {{ totalPages }}</text>
        <button
          class="page-btn"
          :disabled="currentPage >= totalPages"
          @click="handleNextPage"
        >
          下一页
        </button>
      </view>
      <picker
        mode="selector"
        :range="pageSizes"
        :value="pageSizeIndex"
        @change="handlePageSizeChange"
      >
        <view class="page-size-picker">
          <text>{{ pageSize }}条/页 ▼</text>
        </view>
      </picker>
    </view>

    <!-- 错误分布图（纯前端根据当前筛选条件汇总 /api/error 全量结果） -->
    <view class="chart-wrapper">
      <view class="chart-header">
        <view>
          <text class="chart-title">错误分布饼图</text>
          <text class="chart-subtitle">按 {{ chartGroupLabel }} 汇总</text>
        </view>
        <view class="chart-meta">
          <picker
            mode="selector"
            :range="chartGroupOptions"
            range-key="label"
            :value="chartGroupIndex"
            @change="handleChartGroupChange"
          >
            <view class="chart-picker">
              <text>{{ chartGroupLabel }} ▼</text>
            </view>
          </picker>
          <text v-if="chartLoading" class="chart-status">加载中...</text>
          <text v-else-if="chartTotal > 0" class="chart-status"
            >共 {{ chartTotal }} 条</text
          >
        </view>
      </view>
      <UChartCanvas
        type="ring"
        height="520rpx"
        :series="chartSeries"
      />
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue"
import { getErrorMsg } from "@/api/error"
import { appStore } from "@/stores/index"
import { formatDate } from "@/utils/index"
import wsClient from "@/utils/websocket"
import MenuNav from "@/components/MenuNav.vue"
import UChartCanvas from "@/components/charts/UChartCanvas.vue"
import DateTimePickerField from "@/components/DateTimePickerField.vue"
import { isWithinDateTimeRange } from "@/utils/dateTimeRange"
import { countRowsByKey, mergeCounts, toErrorRingSeries } from "@/utils/errorChart"

const tableData = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(5)
const pageSizes = [5, 10, 20, 50, 100]
const pageSizeIndex = ref(0)
const dNo = ref("")
const chartGroupOptions = [
  { label: "错误信息 e_msg", value: "e_msg" },
  { label: "错误编号 e_no", value: "e_no" },
]
const chartGroupIndex = ref(0)
// 时间筛选统一用完整 datetime 字符串（"YYYY-MM-DD HH:mm:ss"），空字符串表示不限制。
// DateTimePickerField 的 update:*Value 直接吐出这个格式，getErrorMsg 也接受这个格式，
// 因此页面内不再存在 date-only 和 datetime 的分裂状态。
const startDateTime = ref("")
const endDateTime = ref("")
const loading = ref(false)

// 图表相关状态。chartSeries 的结构是 uCharts ring 图要求的 [{name, data, color}]，
// 由 aggregateChartData() 基于当前筛选条件下的全量 /api/error 结果统计得出。
const chartSeries = ref([])
const chartTotal = ref(0)
const chartLoading = ref(false)
let chartFetchSeq = 0
let chartRefreshTimer = null
const CHART_REFRESH_DEBOUNCE = 800
// 汇总时防止后端数据异常造成翻页死循环
const CHART_MAX_PAGES = 50
const CHART_PAGE_SIZE = 100

const showDeviceFeatures = computed(
  () => appStore.value.settings.showDeviceFeatures,
)
const totalPages = computed(() => Math.max(Math.ceil(total.value / pageSize.value), 1))
const chartGroupKey = computed(
  () => chartGroupOptions[chartGroupIndex.value]?.value || "e_msg",
)
const chartGroupLabel = computed(
  () => chartGroupOptions[chartGroupIndex.value]?.label || "错误信息 e_msg",
)

onMounted(async () => {
  await fetchData()
  refreshChart()
  wsClient.on("error_update", handleErrorData)
  wsClient.send({
    type: "subscribe",
    topics: ["error_update"],
  })
})

onUnmounted(() => {
  wsClient.off("error_update", handleErrorData)
  clearChartRefreshTimer()
  // 作废正在进行的汇总请求，防止异步回调写入已卸载页面的 ref
  chartFetchSeq += 1
})

function normalizeRow(data) {
  const typeName =
    data.type === "1" ? "告警" : data.type === "2" ? "错误" : "正常"
  return {
    d_no: data.d_no,
    e_msg: data.e_msg,
    e_no: data.e_no ?? "",
    type: data.type,
    type_name: data.type_name || typeName,
    c_time: formatDate(data.c_time, "YYYY-MM-DD HH:mm:ss"),
  }
}

// 筛选参数的唯一构造入口。列表查询、图表汇总、WebSocket 过滤都从这里拿，
// 避免出现列表和图表用不同时间范围的分裂。
function buildQueryParams() {
  return {
    d_no: showDeviceFeatures.value ? dNo.value.trim() : "",
    startTime: startDateTime.value || "",
    endTime: endDateTime.value || "",
  }
}

function getChartQueryParams() {
  return buildQueryParams()
}

async function fetchData() {
  loading.value = true
  try {
    const { d_no, startTime, endTime } = buildQueryParams()
    const res = await getErrorMsg(
      currentPage.value,
      pageSize.value,
      d_no,
      startTime,
      endTime,
    )
    const rows = res.data || []
    total.value = res.total || 0
    tableData.value = rows.map(normalizeRow)
  } catch (error) {
    console.error("获取错误信息失败:", error)
    uni.showToast({
      title: error.response?.data?.msg || "获取错误信息失败",
      icon: "none",
    })
  } finally {
    loading.value = false
  }
}

function isErrorInCurrentFilter(data) {
  const { d_no: filterDNo, startTime, endTime } = buildQueryParams()
  if (filterDNo && data.d_no !== filterDNo) return false
  return isWithinDateTimeRange(data.c_time, startTime, endTime)
}

function prependErrorRow(row) {
  if (currentPage.value !== 1) return
  tableData.value.unshift(row)
  if (tableData.value.length > pageSize.value) {
    tableData.value.pop()
  }
}

function handleErrorData(data) {
  if (!isErrorInCurrentFilter(data)) return

  prependErrorRow(normalizeRow(data))
  total.value += 1
  // WebSocket 推送只做当前筛选范围内的增量展示；图表聚合较重，必须 debounce 合并刷新。
  scheduleChartRefresh()
}

async function onFilter() {
  currentPage.value = 1
  await fetchData()
  refreshChart()
}

async function onReset() {
  dNo.value = ""
  startDateTime.value = ""
  endDateTime.value = ""
  currentPage.value = 1
  await fetchData()
  refreshChart()
}

function onStartDateTimeChange(value) {
  startDateTime.value = String(value || "").trim()
}

function onEndDateTimeChange(value) {
  endDateTime.value = String(value || "").trim()
}

// 根据当前筛选条件汇总 /api/error 的全量结果，按当前选择的 e_msg / e_no 维度计数，
// 生成 uCharts ring 图的 series。接口是分页的，这里循环拉取并用多种终止条件
// （页末、total、最大页数）防止死循环。
async function fetchChartPage(page, params, seq) {
  try {
    return await getErrorMsg(
      page,
      CHART_PAGE_SIZE,
      params.d_no,
      params.startTime,
      params.endTime,
    )
  } catch (error) {
    if (seq !== chartFetchSeq) return null
    console.error("汇总错误类型分布失败:", error)
    throw error
  }
}

function shouldStopChartAggregation(rows, aggregatedTotal, declaredTotal) {
  // 接口是分页的，图表需要统计当前筛选下的全量结果；这些终止条件用于避免异常数据导致死循环。
  if (rows.length === 0) return true
  if (declaredTotal !== null && aggregatedTotal >= declaredTotal) return true
  return rows.length < CHART_PAGE_SIZE
}

// 图表统计的是当前筛选条件下的全量错误分布，不是只统计当前列表页。
async function aggregateChartData(seq) {
  const params = getChartQueryParams()
  const counts = new Map()
  let page = 1
  let aggregatedTotal = 0
  let declaredTotal = null

  while (page <= CHART_MAX_PAGES) {
    const res = await fetchChartPage(page, params, seq)
    if (seq !== chartFetchSeq || !res) return null

    const rows = res?.data || []
    if (declaredTotal === null) {
      const totalFromResponse = Number(res?.total)
      declaredTotal = Number.isFinite(totalFromResponse) ? totalFromResponse : null
    }

    mergeCounts(counts, countRowsByKey(rows, chartGroupKey.value))
    aggregatedTotal += rows.length

    if (shouldStopChartAggregation(rows, aggregatedTotal, declaredTotal)) break
    page += 1
  }

  return { counts, aggregatedTotal }
}

function applyChartResult(result, seq) {
  if (seq !== chartFetchSeq) return
  if (!result?.counts) {
    chartSeries.value = []
    chartTotal.value = 0
    return
  }

  chartSeries.value = toErrorRingSeries(result.counts)
  chartTotal.value = result.aggregatedTotal || 0
}

async function refreshChart() {
  clearChartRefreshTimer()
  const seq = ++chartFetchSeq
  // seq 是图表请求的版本号：筛选或分组变化后，旧请求回来也不能覆盖新结果。
  chartLoading.value = true
  try {
    applyChartResult(await aggregateChartData(seq), seq)
  } catch (error) {
    if (seq !== chartFetchSeq) return
    chartSeries.value = []
    chartTotal.value = 0
  } finally {
    if (seq === chartFetchSeq) {
      chartLoading.value = false
    }
  }
}

function clearChartRefreshTimer() {
  if (!chartRefreshTimer) return
  clearTimeout(chartRefreshTimer)
  chartRefreshTimer = null
}

function scheduleChartRefresh() {
  clearChartRefreshTimer()
  chartRefreshTimer = setTimeout(() => {
    chartRefreshTimer = null
    refreshChart()
  }, CHART_REFRESH_DEBOUNCE)
}

async function handlePrevPage() {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
  await fetchData()
  // 翻页时过滤条件并未变化，但按需求仍要保持同步；走 debounce 避免快速翻页时
  // 每一步都发全量汇总请求。
  scheduleChartRefresh()
}

async function handleNextPage() {
  if (currentPage.value >= totalPages.value) return
  currentPage.value += 1
  await fetchData()
  scheduleChartRefresh()
}

async function handlePageSizeChange(e) {
  pageSizeIndex.value = Number(e.detail.value)
  pageSize.value = pageSizes[pageSizeIndex.value]
  currentPage.value = 1
  await fetchData()
  scheduleChartRefresh()
}

function handleChartGroupChange(e) {
  const index = Number(e.detail.value)
  chartGroupIndex.value = Number.isNaN(index) ? 0 : index
  refreshChart()
}

function tagClass(type) {
  if (type === "1") return "tag-warning"
  if (type === "2") return "tag-danger"
  return "tag-info"
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6f8;
  padding: 24rpx;
  box-sizing: border-box;
}

.chart-wrapper {
  margin-top: 24rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.chart-title {
  display: block;
  font-size: 30rpx;
  color: #0f172a;
  font-weight: 600;
}

.chart-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748b;
}

.chart-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
}

.chart-picker {
  min-width: 220rpx;
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 24rpx;
  text-align: center;
}

.chart-status {
  font-size: 24rpx;
  color: #94a3b8;
}

.filter-wrapper,
.pagination-wrapper {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.filter-item {
  margin-bottom: 20rpx;
}

.filter-label {
  display: block;
  margin-bottom: 12rpx;
  color: #64748b;
  font-size: 26rpx;
}

.filter-input {
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 12rpx;
  min-height: 76rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #0f172a;
}

.filter-actions,
.pagination-controls {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.filter-actions {
  margin-top: 8rpx;
}

.action-btn,
.page-btn {
  flex: 1;
  margin: 0;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.primary-btn {
  background: #2563eb;
  color: #fff;
}

.reset-btn {
  background: #e2e8f0;
  color: #334155;
}

.list-wrapper {
  margin: 24rpx 0;
}

.placeholder {
  min-height: 280rpx;
  border-radius: 20rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.error-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
}

.error-time {
  color: #475569;
  font-size: 26rpx;
}

.error-tag {
  border-radius: 999rpx;
  padding: 8rpx 18rpx;
  font-size: 24rpx;
}

.tag-warning {
  background: #fef3c7;
  color: #b45309;
}

.tag-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.tag-info {
  background: #dbeafe;
  color: #1d4ed8;
}

.error-device {
  margin-top: 16rpx;
  color: #64748b;
  font-size: 26rpx;
}

.error-content {
  margin-top: 18rpx;
  color: #0f172a;
  font-size: 30rpx;
  line-height: 1.6;
}

.pagination-wrapper {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.total-text,
.page-text {
  color: #475569;
  font-size: 26rpx;
}

.page-size-picker {
  min-height: 72rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #334155;
  font-size: 26rpx;
}
</style>
