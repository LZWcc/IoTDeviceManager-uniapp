<template>
  <view class="config-node">
    <view class="node-card" :class="'level-' + Math.min(level, 3)">
      <!-- 层级色条 -->
      <view class="level-bar" :class="'bar-' + Math.min(level, 3)"></view>

      <view class="node-inner">
        <!-- 卡片标题 -->
        <view class="node-header">
          <text class="node-title">{{ node.t_name }}</text>
        </view>

        <!-- 卡片内容 -->
        <view class="node-body">
          <!-- f_type 1: 开关 -->
          <view v-if="node.f_type === '1'" class="control-row">
            <text class="switch-label inactive-label">{{
              node.f_value[0]?.label
            }}</text>
            <switch
              :checked="node.value === node.f_value[1]?.value"
              @change="onSwitchChange"
              color="#13ce66"
            />
            <text class="switch-label active-label">{{
              node.f_value[1]?.label
            }}</text>
          </view>

          <!-- f_type 2: 输入框 -->
          <view v-else-if="node.f_type === '2'" class="control-row">
            <input
              class="node-input"
              type="number"
              :value="node.value"
              placeholder="请输入值"
              @input="onInputChange"
              @blur="handleInputValidate"
            />
          </view>

          <!-- f_type 3: 滑动条 -->
          <view v-else-if="node.f_type === '3'" class="control-row slider-row">
            <text class="slider-min">{{ node.min }}</text>
            <slider
              class="node-slider"
              :value="node.value"
              :min="node.min"
              :max="node.max"
              show-value
              activeColor="#13ce66"
              @change="onSliderChange"
            />
            <text class="slider-max">{{ node.max }}</text>
          </view>

          <!-- f_type 4: 时间框 -->
          <view v-else-if="node.f_type === '4'" class="control-row">
            <picker mode="time" :value="node.value || ''" @change="onTimeChange">
              <view class="time-display">{{ node.value || "请选择时间" }}</view>
            </picker>
          </view>

          <!-- f_type 5: 单选框 -->
          <view v-else-if="node.f_type === '5'" class="control-row radio-row">
            <radio-group @change="onRadioChange">
              <label
                v-for="(opt, i) in node.f_value"
                :key="i"
                class="radio-item"
              >
                <radio
                  :value="opt.value"
                  :checked="node.value === opt.value"
                  color="#13ce66"
                />
                <text class="radio-label">{{ opt.label }}</text>
              </label>
            </radio-group>
          </view>
        </view>

        <!-- 递归渲染可见子节点 -->
        <view v-if="visibleChildren.length > 0" class="children-area">
          <!-- 树形连接线 -->
          <view
            class="tree-line"
            :class="'tree-line-' + Math.min(level, 3)"
          ></view>
          <view class="children-list">
            <ConfigNode
              v-for="(child, idx) in visibleChildren"
              :key="idx"
              :node="child"
              :level="level + 1"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: "ConfigNode",

  props: {
    node: { type: Object, required: true },
    level: { type: Number, default: 0 },
  },

  computed: {
    visibleChildren() {
      if (!this.node.children || this.node.children.length === 0) return []
      return this.node.children.filter((child) => {
        if (!child.ref_value) return true
        const refValues = child.ref_value.split("&")
        return refValues.includes(this.node.value)
      })
    },
  },

  methods: {
    onSwitchChange(e) {
      const isOn = e.detail.value
      this.node.value = isOn
        ? this.node.f_value[1]?.value
        : this.node.f_value[0]?.value
    },

    onInputChange(e) {
      this.node.value = e.detail.value
    },

    handleInputValidate() {
      const min = Number(this.node.min) || 0
      const max = Number(this.node.max) || 100
      const value = Number(this.node.value)
      if (this.node.value !== "" && !isNaN(value)) {
        if (value < min) {
          uni.showToast({
            title: `${this.node.t_name} 不能小于 ${min}`,
            icon: "none",
          })
          this.node.value = ""
        } else if (value > max) {
          uni.showToast({
            title: `${this.node.t_name} 不能大于 ${max}`,
            icon: "none",
          })
          this.node.value = ""
        }
      }
    },

    onSliderChange(e) {
      this.node.value = e.detail.value
    },

    onTimeChange(e) {
      const value = e.detail.value
      this.node.value = value && value.length === 5 ? `${value}:00` : value
    },

    onRadioChange(e) {
      this.node.value = e.detail.value
    },
  },
}
</script>

<style scoped>
/* ── 外层容器 ── */
.config-node {
  margin-bottom: 14rpx;
}

/* ── 卡片主体：flex 横向，左侧色条 + 右侧内容 ── */
.node-card {
  display: flex;
  flex-direction: row;
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.07);
  overflow: hidden;
}

/* ── 左侧层级色条 ── */
.level-bar {
  width: 8rpx;
  flex-shrink: 0;
}
.bar-0 {
  background-color: #409eff;
}
.bar-1 {
  background-color: #13ce66;
}
.bar-2 {
  background-color: #f59e0b;
}
.bar-3 {
  background-color: #8b5cf6;
}

/* ── 卡片背景：随层级略微变浅 ── */
.level-0 {
  background-color: #ffffff;
}
.level-1 {
  background-color: #fafbff;
}
.level-2 {
  background-color: #f9fff9;
}
.level-3 {
  background-color: #fffdf5;
}

/* ── 色条右侧内容区 ── */
.node-inner {
  flex: 1;
  min-width: 0;
}

/* ── 标题行 ── */
.node-header {
  padding: 18rpx 24rpx;
  background-color: transparent;
  border-bottom: 1rpx solid #f0f2f5;
}

.node-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #303133;
}

/* ── 控件区 ── */
.node-body {
  padding: 20rpx 24rpx;
}

.control-row {
  display: flex;
  align-items: center;
}

.switch-label {
  font-size: 26rpx;
  color: #606266;
  margin: 0 12rpx;
}

.inactive-label {
  color: #909399;
}
.active-label {
  color: #13ce66;
}

.node-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  border: 1rpx solid #dcdfe6;
  border-radius: 8rpx;
  font-size: 28rpx;
  background-color: #fff;
}

.slider-row {
  gap: 16rpx;
}
.node-slider {
  flex: 1;
}

.slider-min,
.slider-max {
  font-size: 24rpx;
  color: #909399;
  white-space: nowrap;
}

/* ── 子节点区域：树形连接线 + 子列表 ── */
.children-area {
  display: flex;
  flex-direction: row;
  padding: 0 16rpx 16rpx 12rpx;
  background-color: #f4f6fa;
}

/* 竖向连接线，颜色对应父节点色条 */
.tree-line {
  width: 4rpx;
  border-radius: 2rpx;
  flex-shrink: 0;
  margin-right: 16rpx;
  margin-top: 8rpx;
  margin-bottom: 4rpx;
}
.tree-line-0 {
  background-color: rgba(64, 158, 255, 0.35);
}
.tree-line-1 {
  background-color: rgba(19, 206, 102, 0.35);
}
.tree-line-2 {
  background-color: rgba(245, 158, 11, 0.35);
}
.tree-line-3 {
  background-color: rgba(139, 92, 246, 0.35);
}

/* 子节点列表占满剩余宽度 */
.children-list {
  flex: 1;
  min-width: 0;
  padding-top: 8rpx;
}

/* ── f_type 4 时间框 / 5 单选 ── */
.time-display {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 20rpx;
  border: 1rpx solid #dcdfe6;
  border-radius: 8rpx;
  font-size: 28rpx;
  color: #303133;
  background-color: #fff;
}
.radio-row {
  flex-wrap: wrap;
}
.radio-item {
  display: flex;
  align-items: center;
  margin-right: 32rpx;
  margin-bottom: 8rpx;
}
.radio-label {
  font-size: 26rpx;
  color: #606266;
  margin-left: 8rpx;
}
</style>
