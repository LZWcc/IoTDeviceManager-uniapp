<template>
  <view class="page">
    <view class="card">
      <view class="card-title">显示设置</view>
      <view class="setting-row">
        <text class="row-label">显示设备编号</text>
        <switch
          :checked="showDeviceFeatures"
          color="#2979ff"
          @change="onToggleDeviceFeatures"
        />
      </view>
      <text class="row-tip"
        >关闭后, 实时 / 历史 / 错误 / 设备 / 指令各页面将隐藏设备编号相关字段与筛选。</text
      >
    </view>

    <view class="card">
      <view class="card-title">后端连接</view>
      <view class="field">
        <text class="row-label">API 地址</text>
        <input
          class="field-input"
          :value="apiBaseUrl"
          @input="apiBaseUrl = $event.detail.value"
          placeholder="如 https://uni.iot.lzwcc.xyz"
        />
      </view>
      <text class="row-tip"
        >留空则用打包时的默认地址。WebSocket 地址会按 http→ws / https→wss 自动推导。</text
      >
      <view class="current">
        <text class="current-line">当前 API: {{ effective.apiBaseUrl }}</text>
        <text class="current-line">当前 WS: {{ effective.wsBaseUrl }}</text>
      </view>
      <view class="btn-row">
        <view class="btn btn-primary" @click="onSave">保存并重启生效</view>
        <view class="btn btn-default" @click="onReset">恢复默认</view>
      </view>
      <text class="row-tip">后端地址修改后需要重启 App / 刷新页面才生效。</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue"
import { onLoad } from "@dcloudio/uni-app"
import { appStore } from "@/stores/index"
import {
  getServerConfigOverride,
  getEffectiveServerConfig,
  setServerConfigOverride,
  resetServerConfigOverride,
} from "@/config/runtime"

const apiBaseUrl = ref("")
const effective = ref({ apiBaseUrl: "", wsBaseUrl: "" })

const showDeviceFeatures = computed(() => appStore.value.settings.showDeviceFeatures)

onLoad(() => {
  apiBaseUrl.value = getServerConfigOverride().apiBaseUrl
  effective.value = getEffectiveServerConfig()
})

function onToggleDeviceFeatures(e) {
  appStore.value.updateSettings({ showDeviceFeatures: e.detail.value })
  uni.showToast({ title: "已更新", icon: "none" })
}

function onSave() {
  setServerConfigOverride({ apiBaseUrl: apiBaseUrl.value })
  effective.value = getEffectiveServerConfig()
  uni.showModal({
    title: "已保存",
    content: "后端地址已更新, 重启 App / 刷新页面后生效。",
    showCancel: false,
  })
}

function onReset() {
  resetServerConfigOverride()
  apiBaseUrl.value = ""
  effective.value = getEffectiveServerConfig()
  uni.showModal({
    title: "已恢复默认",
    content: "已清除自定义地址, 重启 App / 刷新页面后生效。",
    showCancel: false,
  })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
  box-sizing: border-box;
}
.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.row-label {
  font-size: 28rpx;
  color: #333;
}
.row-tip {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 12rpx;
  line-height: 1.5;
}
.field {
  margin-top: 8rpx;
}
.field-input {
  width: 100%;
  min-height: 76rpx;
  margin-top: 12rpx;
  border: 1rpx solid #dddddd;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  background: #fafafa;
  box-sizing: border-box;
}

.field-input :deep(.uni-input-wrapper) {
  width: 100%;
  min-height: 76rpx;
  display: flex;
  align-items: center;
}

.field-input :deep(.uni-input-input),
.field-input :deep(input) {
  width: 100%;
  min-height: 76rpx;
  height: 76rpx;
  line-height: 76rpx;
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
}

.current {
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  background: #f0f6ff;
  border-radius: 8rpx;
}
.current-line {
  display: block;
  font-size: 24rpx;
  color: #555555;
  word-break: break-all;
}
.btn-row {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}
.btn {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 8rpx;
  font-size: 28rpx;
}
.btn-primary {
  background: #2979ff;
  color: #ffffff;
}
.btn-default {
  background: #f0f0f0;
  color: #333333;
}
.btn:active {
  opacity: 0.8;
}
</style>
