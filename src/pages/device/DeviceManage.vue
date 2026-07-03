<template>
  <view class="page">
    <MenuNav :items="[
      { icon: '🗂️', label: '设备管理', current: true },
      { icon: '⚠️', label: '错误信息', url: '/pages/error/ErrorMsg' },
      { icon: '⚙️', label: '设置', url: '/pages/settings/Settings' },
    ]" variant="column" />

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <input
        class="filter-input"
        v-model="filter"
        :placeholder="
          showDeviceFeatures ? '请输入查询编号 / 名称' : '请输入查询名称'
        "
        @confirm="onFilter"
      />
      <view class="filter-buttons">
        <view class="btn btn-primary" @click="onFilter">查询</view>
        <view class="btn btn-warning" @click="onReset">重置</view>
        <view class="btn btn-success" @click="onAdd">新增</view>
      </view>
    </view>

    <!-- 设备列表 -->
    <scroll-view
      class="device-list"
      scroll-y
      :refresher-enabled="true"
      @refresherrefresh="onRefresh"
      :refresher-triggered="isRefreshing"
    >
      <!-- 设备卡片 -->
      <view
        class="device-card"
        v-for="(row, rowIndex) in tableData"
        :key="rowIndex"
      >
        <view class="device-card-body">
          <view
            class="device-field"
            v-for="(col, colIndex) in filteredTableHeader"
            :key="colIndex"
          >
            <text class="field-label">{{ col.label }}</text>
            <text class="field-value">{{ row[col.prop] || "-" }}</text>
          </view>
        </view>
        <view class="device-card-footer">
          <text class="action-btn edit-btn" @click="onEdit(row)">编辑</text>
          <text class="action-btn delete-btn" @click="onDelete(row)">删除</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view class="empty-state" v-if="tableData.length === 0 && !loading">
        <text class="empty-text">暂无设备数据</text>
      </view>

      <!-- 加载状态 -->
      <view class="loading-state" v-if="loading">
        <text class="loading-text">加载中...</text>
      </view>
    </scroll-view>

    <!-- 弹出层 - 新增/编辑设备 -->
    <view class="drawer-mask" v-if="drawer" @click="onCancel"></view>
    <view class="drawer" :class="{ 'drawer-show': drawer }" @click.stop>
      <view class="drawer-header">
        <text class="drawer-title">{{ isEdit ? "编辑设备" : "新增设备" }}</text>
        <text class="drawer-close" @click="onCancel">×</text>
      </view>
      <view class="drawer-content">
        <view class="form-item">
          <text class="form-label"
            ><text class="required">*</text>设备名称</text
          >
          <input
            class="form-input"
            v-model="currentDevice.device_name"
            placeholder="请输入设备名称"
            maxlength="50"
          />
          <text class="form-error" v-if="errors.device_name">{{
            errors.device_name
          }}</text>
        </view>

        <view class="form-item" v-if="showDeviceFeatures">
          <text class="form-label"
            ><text class="required">*</text>设备编号</text
          >
          <input
            class="form-input"
            v-model="currentDevice.number"
            placeholder="请输入设备编号"
            maxlength="20"
          />
          <text class="form-error" v-if="errors.number">{{
            errors.number
          }}</text>
        </view>

        <view class="form-item">
          <text class="form-label">备注</text>
          <textarea
            class="form-textarea"
            v-model="currentDevice.remarks"
            placeholder="请输入备注信息"
            maxlength="200"
          ></textarea>
          <text class="form-error" v-if="errors.remarks">{{
            errors.remarks
          }}</text>
        </view>

        <view class="form-buttons">
          <view class="btn btn-primary btn-large" @click="onSubmit">提交</view>
          <view class="btn btn-default btn-large" @click="onCancel">取消</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue"
import { onShow } from "@dcloudio/uni-app"
import { getDevice, deleteDevice, addDevice, editDevice } from "@/api/device"
import { appStore } from "@/stores/index"
import MenuNav from "@/components/MenuNav.vue"

const filter = ref("")
const tableHeader = ref([])
const tableData = ref([])
const currentDevice = ref({})
const drawer = ref(false)
const isEdit = ref(false)
const loading = ref(false)
const isRefreshing = ref(false)
const errors = ref({})

const keyMap = {
  device_name: "设备名称",
  remarks: "备注",
  ctime: "创建时间",
  number: "设备编号",
}

const showDeviceFeatures = computed(() => appStore.value.settings.showDeviceFeatures)

const filteredTableHeader = computed(() => {
  if (showDeviceFeatures.value) return tableHeader.value
  return tableHeader.value.filter((col) => col.prop !== "number")
})

onShow(() => {
  fetchDeviceData()
})

function buildDeviceHeaders(rows) {
  if (!rows.length) return []
  return Object.keys(rows[0])
    .filter((key) => key !== "id")
    .map((key) => ({ prop: key, label: keyMap[key] || key }))
}

async function fetchDeviceData() {
  loading.value = true
  try {
    const response = await getDevice(filter.value)
    tableData.value = response
    tableHeader.value = buildDeviceHeaders(response)
  } catch (error) {
    console.error("获取设备数据失败:", error)
    uni.showToast({ title: "获取数据失败", icon: "none" })
  } finally {
    loading.value = false
    isRefreshing.value = false
  }
}

async function onRefresh() {
  isRefreshing.value = true
  await fetchDeviceData()
}

async function onFilter() {
  await fetchDeviceData()
}

async function onReset() {
  filter.value = ""
  await fetchDeviceData()
}

function openDrawer(mode, row = {}) {
  currentDevice.value = mode === "edit" ? { ...row } : {}
  isEdit.value = mode === "edit"
  errors.value = {}
  drawer.value = true
}

function closeDrawer() {
  drawer.value = false
  errors.value = {}
}

function onAdd() {
  openDrawer("add")
}

function onEdit(row) {
  openDrawer("edit", row)
}

function onDelete(row) {
  uni.showModal({
    title: "删除确认",
    content: `确定要删除设备 "${row.device_name}" 吗？`,
    confirmColor: "#e6a23c",
    success: async (res) => {
      if (!res.confirm) return
      try {
        await deleteDevice(row.id)
        uni.showToast({ title: "删除成功", icon: "success" })
        await fetchDeviceData()
      } catch (error) {
        console.error("删除失败:", error)
        uni.showToast({ title: "删除失败", icon: "none" })
      }
    },
  })
}

function validateForm() {
  const newErrors = {}
  const deviceName = currentDevice.value.device_name?.trim()
  if (!deviceName) newErrors.device_name = "请输入设备名称"
  else if (deviceName.length < 2 || deviceName.length > 50) {
    newErrors.device_name = "长度在 2 到 50 个字符"
  }

  if (showDeviceFeatures.value) {
    const number = currentDevice.value.number?.trim()
    if (!number) newErrors.number = "请输入设备编号"
    else if (!/^[A-Za-z0-9_-]+$/.test(number)) {
      newErrors.number = "设备编号只能包含字母、数字、下划线和连字符"
    } else if (number.length < 3 || number.length > 20) {
      newErrors.number = "长度在 3 到 20 个字符"
    }
  }

  const remarks = currentDevice.value.remarks?.trim()
  if (remarks && remarks.length > 200) newErrors.remarks = "备注不能超过 200 个字符"

  errors.value = newErrors
  return Object.keys(newErrors).length === 0
}

async function onSubmit() {
  if (!validateForm()) return

  const submitData = {
    device_name: currentDevice.value.device_name.trim(),
    remarks: currentDevice.value.remarks?.trim() || "",
    number: currentDevice.value.number?.trim() || "",
  }

  try {
    if (isEdit.value) {
      await editDevice(currentDevice.value.id, submitData)
      uni.showToast({ title: "编辑成功", icon: "success" })
    } else {
      await addDevice(submitData)
      uni.showToast({ title: "新增成功", icon: "success" })
    }
    closeDrawer()
    await fetchDeviceData()
  } catch (error) {
    console.error("提交失败:", error)
    uni.showToast({ title: error.response?.data?.msg || "提交失败", icon: "none" })
  }
}

function onCancel() {
  closeDrawer()
}
</script>

<style scoped>
.page {
  height: 100vh;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 筛选栏 */
.filter-bar {
  flex-shrink: 0;
  margin: 0 20rpx 20rpx;
  padding: 24rpx;
  background-color: #fff;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.filter-input {
  width: 100%;
  min-height: 76rpx;
  padding: 0 20rpx;
  background-color: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 12rpx;
  font-size: 28rpx;
  margin-bottom: 16rpx;
  box-sizing: border-box;
  color: #0f172a;
}

.filter-buttons {
  display: flex;
  gap: 16rpx;
}

/* 按钮样式 */
.btn {
  padding: 16rpx 0;
  border-radius: 8rpx;
  font-size: 28rpx;
  text-align: center;
  flex: 1;
}

.btn:active {
  opacity: 0.8;
}

.btn-primary {
  background-color: #409eff;
  color: #fff;
}

.btn-warning {
  background-color: #e6a23c;
  color: #fff;
}

.btn-success {
  background-color: #67c23a;
  color: #fff;
}

.btn-default {
  background-color: #f5f5f5;
  color: #333;
  border: 1rpx solid #dcdfe6;
}

.btn-large {
  padding: 24rpx 0;
  font-size: 32rpx;
}

/* 设备列表 */
.device-list {
  flex: 1;
  height: 0; /* 让 flex:1 在移动端生效的关键 */
}

/* 设备卡片 */
.device-card {
  background-color: #fff;
  margin: 16rpx 24rpx 0;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.device-card:last-child {
  margin-bottom: 16rpx;
}

.device-card-body {
  padding: 24rpx 28rpx 16rpx;
}

.device-field {
  display: flex;
  align-items: flex-start;
  padding: 10rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.device-field:last-child {
  border-bottom: none;
}

.field-label {
  width: 160rpx;
  flex-shrink: 0;
  font-size: 26rpx;
  color: #909399;
}

.field-value {
  flex: 1;
  font-size: 28rpx;
  color: #303133;
  word-break: break-all;
}

.device-card-footer {
  display: flex;
  gap: 0;
  border-top: 1rpx solid #ebeef5;
}

.action-btn {
  flex: 1;
  font-size: 28rpx;
  padding: 20rpx 0;
  text-align: center;
  white-space: nowrap;
  border-radius: 0;
  border: none;
  background: none;
}

.action-btn:active {
  background-color: #f5f5f5;
}

.edit-btn {
  color: #409eff;
  border-right: 1rpx solid #ebeef5;
}

.delete-btn {
  color: #f56c6c;
}

/* 空状态 */
.empty-state,
.loading-state {
  padding: 120rpx 0;
  text-align: center;
}

.empty-text,
.loading-text {
  font-size: 28rpx;
  color: #c0c4cc;
}

/* 抽屉遮罩 */
.drawer-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

/* 抽屉 - 底部弹出，移动端更自然 */
.drawer {
  position: fixed;
  bottom: -100%;
  left: 0;
  right: 0;
  max-height: 85vh;
  background-color: #fff;
  z-index: 1001;
  transition: bottom 0.3s ease;
  box-shadow: 0 -4rpx 24rpx rgba(0, 0, 0, 0.12);
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}

.drawer-show {
  bottom: 0;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx 40rpx;
  border-bottom: 1rpx solid #ebeef5;
  flex-shrink: 0;
}

.drawer-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #303133;
}

.drawer-close {
  font-size: 48rpx;
  color: #909399;
  line-height: 1;
  padding: 0 8rpx;
}

.drawer-content {
  flex: 1;
  padding: 32rpx 40rpx;
  overflow-y: auto;
}

/* 表单 */
.form-item {
  margin-bottom: 32rpx;
}

.form-label {
  display: block;
  font-size: 28rpx;
  color: #606266;
  margin-bottom: 12rpx;
}

.required {
  color: #f56c6c;
  margin-right: 8rpx;
}

.form-input {
  width: 100%;
  height: 80rpx;
  padding: 0 24rpx;
  border: 1rpx solid #dcdfe6;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  background-color: #fff;
}

.form-textarea {
  width: 100%;
  height: 160rpx;
  padding: 20rpx 24rpx;
  border: 1rpx solid #dcdfe6;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.form-error {
  display: block;
  font-size: 24rpx;
  color: #f56c6c;
  margin-top: 8rpx;
}

.form-buttons {
  display: flex;
  gap: 24rpx;
  margin-top: 40rpx;
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
