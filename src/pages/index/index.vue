<template>
  <view class="container">
    <!-- 顶部导航栏 -->
    <view class="header">
      <text class="menu-toggle" @click="toggleMenu">{{
        showMenu ? "✕" : "☰"
      }}</text>
      <text class="app-title">IoT设备管理系统</text>
    </view>

    <!-- 侧边菜单 -->
    <view :class="['sidebar', { show: showMenu }]">
      <view class="menu-list">
        <view
          class="menu-item"
          @click="navigateTo('/pages/sensor/RealtimeData')"
        >
          <text class="menu-icon">📊</text>
          <text>传感器数据</text>
        </view>
        <view
          class="menu-item"
          @click="navigateTo('/pages/behavior/RealtimeData')"
        >
          <text class="menu-icon">📈</text>
          <text>行为数据</text>
        </view>
        <view
          class="menu-item"
          @click="navigateTo('/pages/device/DeviceManage')"
        >
          <text class="menu-icon">⚙️</text>
          <text>设备管理</text>
        </view>
      </view>
    </view>

    <!-- 主内容区域 -->
    <view :class="['main-content', { 'menu-open': showMenu }]">
      <view class="welcome-text">
        <text class="title">欢迎使用 IoT 设备管理系统</text>
        <text class="subtitle">点击左上角菜单开始使用</text>
      </view>
    </view>

    <!-- 遮罩层 -->
    <view v-if="showMenu" class="overlay" @click="toggleMenu"></view>
  </view>
</template>

<script>
import { navigateToPage } from "@/utils/navigation"

export default {
  data() {
    return {
      showMenu: false,
    }
  },
  methods: {
    toggleMenu() {
      this.showMenu = !this.showMenu
    },
    navigateTo(url) {
      this.showMenu = false
      navigateToPage(url)
    },
  },
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

/* 顶部导航栏 */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 88rpx;
  background-color: #2979ff;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  z-index: 1000;
}

.menu-toggle {
  font-size: 40rpx;
  color: #fff;
  margin-right: 20rpx;
}

.app-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

/* 侧边菜单 */
.sidebar {
  position: fixed;
  top: 88rpx;
  left: -500rpx;
  width: 500rpx;
  height: calc(100vh - 88rpx);
  background-color: #fff;
  transition: left 0.3s ease;
  z-index: 999;
  box-shadow: 2rpx 0 8rpx rgba(0, 0, 0, 0.1);
}

.sidebar.show {
  left: 0;
}

.menu-list {
  padding: 20rpx 0;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx 40rpx;
  font-size: 30rpx;
  color: #333;
  border-bottom: 1rpx solid #f0f0f0;
}

.menu-item:active {
  background-color: #f5f5f5;
}

.menu-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
}

/* 遮罩层 */
.overlay {
  position: fixed;
  top: 88rpx;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 998;
}

/* 主内容区域 */
.main-content {
  padding-top: 88rpx;
  min-height: 100vh;
}

.welcome-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 40rpx;
  text-align: center;
}

.title {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.subtitle {
  font-size: 28rpx;
  color: #999;
}
</style>
