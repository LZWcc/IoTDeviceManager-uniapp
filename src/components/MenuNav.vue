<template>
  <view class="menu-list" :class="variant">
    <view
      v-for="item in items"
      :key="item.label"
      class="menu-item"
      :class="{ current: item.current }"
      @click="!item.current && onNav(item.url)"
    >
      <text class="menu-icon">{{ item.icon }}</text>
      <text class="menu-text">{{ item.label }}</text>
      <text v-if="item.current" class="menu-badge">当前页</text>
      <text v-else class="menu-arrow">›</text>
    </view>
  </view>
</template>

<script setup>
import { navigateToPage } from "@/utils/navigation"

defineProps({
  items: { type: Array, required: true },
  variant: { type: String, default: "row" },
})

function onNav(url) {
  if (url) navigateToPage(url)
}
</script>

<style scoped>
.menu-list {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin: 20rpx;
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

.menu-list.column .menu-item {
  flex-direction: column;
  justify-content: center;
  padding: 16rpx 8rpx;
  margin: 0 8rpx;
}

.menu-list.column .menu-icon {
  margin-right: 0;
  margin-bottom: 8rpx;
  font-size: 36rpx;
}

.menu-list.column .menu-text {
  flex: none;
  font-size: 26rpx;
  white-space: nowrap;
}

.menu-list.column .menu-arrow {
  display: none;
}

.menu-list.column .menu-badge {
  margin-top: 6rpx;
  font-size: 20rpx;
}
</style>
