<script>
export default {
  onLaunch: function () {
    console.log("App Launch")
  },
  onShow: function () {
    console.log("App Show")
  },
  onHide: function () {
    console.log("App Hide")
  },
}
</script>

<style>
/* 每个页面公共css */

/* 全局变量 */
page {
  --primary-color: #2979ff;
  --success-color: #4caf50;
  --warning-color: #ff9800;
  --danger-color: #f44336;
  --info-color: #667eea;
  --text-primary: #333;
  --text-secondary: #666;
  --text-placeholder: #999;
  --border-color: #e0e0e0;
  --bg-color: #f5f5f5;
}

/* 重置默认样式 */
* {
  box-sizing: border-box;
}

/* 全局字体 */
page {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu",
    "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--bg-color);
  color: var(--text-primary);
  line-height: 1.6;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8rpx;
  height: 8rpx;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4rpx;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 公共按钮样式 */
.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-success {
  background-color: var(--success-color);
  color: white;
}

.btn-warning {
  background-color: var(--warning-color);
  color: white;
}

.btn-danger {
  background-color: var(--danger-color);
  color: white;
}

/* 公共卡片样式 */
.card {
  background-color: white;
  border-radius: 16rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

/* 公共间距类 */
.mt-small {
  margin-top: 16rpx;
}
.mt-medium {
  margin-top: 32rpx;
}
.mt-large {
  margin-top: 64rpx;
}

.mb-small {
  margin-bottom: 16rpx;
}
.mb-medium {
  margin-bottom: 32rpx;
}
.mb-large {
  margin-bottom: 64rpx;
}

.p-small {
  padding: 16rpx;
}
.p-medium {
  padding: 32rpx;
}
.p-large {
  padding: 64rpx;
}

/* 文本对齐 */
.text-left {
  text-align: left;
}
.text-center {
  text-align: center;
}
.text-right {
  text-align: right;
}

/* Flex布局 */
.flex {
  display: flex;
}
.flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.flex-column {
  display: flex;
  flex-direction: column;
}
</style>
