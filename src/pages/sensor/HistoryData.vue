<template>
  <view class="page">
    <view class="menu-list">
      <view class="menu-item" @click="navigateToPage('/pages/sensor/RealtimeData')">
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
          :start-value="startDateTime"
          :end-value="endDateTime"
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
import DateTimePickerField from "@/components/DateTimePickerField.vue"
import UChartCanvas from "@/components/charts/UChartCanvas.vue"
import { useHistoryChartView } from "@/composables/useHistoryChartView"

const {
  appStore,
  chartCategories,
  chartModeIndex,
  chartModeOptions,
  chartSeries,
  chartTypeIndex,
  chartTypes,
  chartYAxis,
  currentChartType,
  currentPage,
  d_no,
  endDateTime,
  filteredTableHeader,
  formattedTableData,
  navigateToPage,
  nextPage,
  onChartModeChange,
  onChartTypeChange,
  onDeviceInput,
  onEndDateTimeChange,
  onFilter,
  onPageSizeChange,
  onReset,
  onStartDateTimeChange,
  pageSize,
  pageSizeIndex,
  pageSizes,
  prevPage,
  startDateTime,
  total,
  totalPages,
} = useHistoryChartView({
  type: "sensor",
})
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
