<template>
  <view class="page">
    <view class="page-title">错误信息</view>
    <view class="page-desc">这是错误信息页面</view>
  </view>
</template>

<script>
export default {
  data() {
    return {}
  }
}
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 40rpx;
  background-color: #f5f5f5;
}

.page-title {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.page-desc {
  font-size: 28rpx;
  color: #999;
}
</style>