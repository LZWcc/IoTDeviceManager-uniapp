<template>
  <view class="page">
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
        <text class="filter-label">开始日期</text>
        <!-- #ifdef H5 -->
        <input
          class="picker-value date-input"
          type="date"
          :value="startDate"
          @change="onStartDateNativeChange"
        />
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker mode="date" :value="startDate" @change="onStartDateChange">
          <view class="picker-value">
            <text>{{ startDate || "请选择开始日期" }}</text>
          </view>
        </picker>
        <!-- #endif -->
      </view>

      <view class="filter-item">
        <text class="filter-label">结束日期</text>
        <!-- #ifdef H5 -->
        <input
          class="picker-value date-input"
          type="date"
          :value="endDate"
          @change="onEndDateNativeChange"
        />
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <picker mode="date" :value="endDate" @change="onEndDateChange">
          <view class="picker-value">
            <text>{{ endDate || "请选择结束日期" }}</text>
          </view>
        </picker>
        <!-- #endif -->
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
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue"
import { getErrorMsg } from "@/api/error"
import { appStore } from "@/stores/index"
import { formatDate } from "@/utils/index"
import wsClient from "@/utils/websocket"

const tableData = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(5)
const pageSizes = [5, 10, 20, 50, 100]
const pageSizeIndex = ref(0)
const dNo = ref("")
const startDate = ref("")
const endDate = ref("")
const loading = ref(false)

const showDeviceFeatures = computed(
  () => appStore.value.settings.showDeviceFeatures,
)
const totalPages = computed(() => Math.max(Math.ceil(total.value / pageSize.value), 1))

onMounted(async () => {
  await fetchData()
  wsClient.on("error_update", handleErrorData)
  wsClient.send({
    type: "subscribe",
    topics: ["error_update"],
  })
})

onUnmounted(() => {
  wsClient.off("error_update", handleErrorData)
})

function normalizeRow(data) {
  const typeName =
    data.type === "1" ? "告警" : data.type === "2" ? "错误" : "正常"
  return {
    d_no: data.d_no,
    e_msg: data.e_msg,
    type: data.type,
    type_name: data.type_name || typeName,
    c_time: formatDate(data.c_time, "YYYY-MM-DD HH:mm:ss"),
  }
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getErrorMsg(
      currentPage.value,
      pageSize.value,
      showDeviceFeatures.value ? dNo.value.trim() : "",
      startDate.value ? `${startDate.value} 00:00:00` : "",
      endDate.value ? `${endDate.value} 23:59:59` : "",
    )
    const rows = res.data?.data || []
    total.value = res.data?.total || 0
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

function handleErrorData(data) {
  if (showDeviceFeatures.value && dNo.value.trim() && data.d_no !== dNo.value.trim()) {
    return
  }

  const current = normalizeRow(data)
  if (currentPage.value === 1) {
    tableData.value.unshift(current)
    if (tableData.value.length > pageSize.value) {
      tableData.value.pop()
    }
  }
  total.value += 1
}

async function onFilter() {
  currentPage.value = 1
  await fetchData()
}

async function onReset() {
  dNo.value = ""
  startDate.value = ""
  endDate.value = ""
  currentPage.value = 1
  await fetchData()
}

function onStartDateChange(e) {
  startDate.value = e.detail.value
}

function onEndDateChange(e) {
  endDate.value = e.detail.value
}

function onStartDateNativeChange(e) {
  startDate.value = e.target?.value || e.detail?.value || ""
}

function onEndDateNativeChange(e) {
  endDate.value = e.target?.value || e.detail?.value || ""
}

async function handlePrevPage() {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
  await fetchData()
}

async function handleNextPage() {
  if (currentPage.value >= totalPages.value) return
  currentPage.value += 1
  await fetchData()
}

async function handlePageSizeChange(e) {
  pageSizeIndex.value = Number(e.detail.value)
  pageSize.value = pageSizes[pageSizeIndex.value]
  currentPage.value = 1
  await fetchData()
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

.filter-input,
.picker-value {
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

.date-input {
  width: 100%;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
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
