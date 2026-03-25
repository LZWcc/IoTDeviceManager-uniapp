<template>
  <view class="page">
    <view class="config-card">
      <view class="config-row">
        <text class="config-label">服务提供方</text>
        <picker
          mode="selector"
          :range="providerOptions"
          range-key="label"
          :value="providerIndex"
          @change="onProviderChange"
        >
          <view class="picker-value">
            <text>{{ providerOptions[providerIndex].label }}</text>
          </view>
        </picker>
      </view>

      <view class="config-row">
        <text class="config-label">模型名称</text>
        <input
          v-model="modelName"
          class="text-input"
          placeholder="可选，不填使用后端默认模型"
        />
      </view>

      <view class="config-row switch-row">
        <text class="config-label">流式输出</text>
        <switch :checked="useStream" color="#2563eb" @change="onStreamChange" />
      </view>
    </view>

    <scroll-view
      class="message-list"
      scroll-y
      :scroll-into-view="scrollIntoView"
      :scroll-with-animation="true"
    >
      <view
        v-for="(message, index) in messages"
        :id="`msg-${index}`"
        :key="index"
        class="message-item"
        :class="message.role"
      >
        <text class="message-role">
          {{ message.role === "user" ? "你" : "AI" }}
        </text>
        <text class="message-content">{{ message.content }}</text>
      </view>
    </scroll-view>

    <view class="input-card">
      <textarea
        v-model="inputText"
        class="message-input"
        maxlength="-1"
        placeholder="请输入消息..."
        :disabled="sending"
      />
      <view class="input-actions">
        <button class="action-btn send-btn" :disabled="sending" @click="sendMessage">
          {{ sending ? "发送中..." : "发送" }}
        </button>
        <button
          class="action-btn stop-btn"
          :disabled="!sending"
          @click="stopGenerate"
        >
          停止
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref } from "vue"
import { sendAiMessage, streamAiMessage } from "@/api/send_message"

const providerOptions = [
  { label: "本地 Ollama", value: "ollama" },
  { label: "DeepSeek API", value: "deepseek" },
]

const providerIndex = ref(0)
const provider = ref("ollama")
const modelName = ref("")
const inputText = ref("")
const sending = ref(false)
const useStream = ref(true)
const streamController = ref(null)
const scrollIntoView = ref("")

const messages = ref([
  {
    role: "assistant",
    content: "欢迎使用 AI 聊天界面。",
  },
])

const STREAM_FLUSH_INTERVAL = 60
const DEFAULT_OLLAMA_OPTIONS = {
  num_ctx: 1024,
  num_predict: 256,
  temperature: 0.3,
  keep_alive: "0m",
}

onBeforeUnmount(() => {
  stopGenerate()
})

function onProviderChange(e) {
  providerIndex.value = Number(e.detail.value)
  provider.value = providerOptions[providerIndex.value].value
}

function onStreamChange(e) {
  useStream.value = !!e.detail.value
}

function scrollToBottom() {
  nextTick(() => {
    scrollIntoView.value = `msg-${messages.value.length - 1}`
  })
}

function stopGenerate() {
  if (streamController.value) {
    streamController.value.abort()
    streamController.value = null
  }
}

async function sendMessage() {
  if (sending.value) return

  const text = inputText.value.trim()
  if (!text) {
    uni.showToast({ title: "请输入消息", icon: "none" })
    return
  }

  messages.value.push({ role: "user", content: text })
  inputText.value = ""
  scrollToBottom()

  sending.value = true
  try {
    const history = messages.value
      .slice(-6)
      .filter((item) => item.role === "user" || item.role === "assistant")

    const options = provider.value === "ollama" ? DEFAULT_OLLAMA_OPTIONS : {}

    if (useStream.value) {
      await handleStreamMessage(text, history, options)
    } else {
      await handleNormalMessage(text, history, options)
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      messages.value.push({ role: "assistant", content: "已停止生成。" })
      scrollToBottom()
      return
    }

    const errorMsg = error?.response?.data?.error || error?.message || "AI 请求失败"
    messages.value.push({ role: "assistant", content: `错误：${errorMsg}` })
    scrollToBottom()
    uni.showToast({ title: errorMsg, icon: "none" })
  } finally {
    streamController.value = null
    sending.value = false
  }
}

async function handleNormalMessage(text, history, options) {
  const response = await sendAiMessage({
    message: text,
    provider: provider.value,
    model: modelName.value.trim(),
    history,
    options,
  })

  if (response.data?.success) {
    messages.value.push({
      role: "assistant",
      content: response.data.message?.content || "模型未返回内容",
    })
    scrollToBottom()
    return
  }

  const errorMsg = response?.data?.error || "AI 回复失败"
  throw new Error(errorMsg)
}

async function handleStreamMessage(text, history, options) {
  const assistantMessage = { role: "assistant", content: "" }
  messages.value.push(assistantMessage)
  scrollToBottom()

  streamController.value = new AbortController()
  let pendingChunk = ""
  let flushTimer = null

  const flushChunk = () => {
    if (!pendingChunk) return
    assistantMessage.content += pendingChunk
    pendingChunk = ""
    scrollToBottom()
  }

  const scheduleFlush = () => {
    if (flushTimer) return
    flushTimer = setTimeout(() => {
      flushChunk()
      flushTimer = null
    }, STREAM_FLUSH_INTERVAL)
  }

  await streamAiMessage(
    {
      message: text,
      provider: provider.value,
      model: modelName.value.trim(),
      history,
      options,
    },
    {
      signal: streamController.value.signal,
      onDelta: (payload) => {
        pendingChunk += payload?.content || ""
        scheduleFlush()
      },
      onError: (payload) => {
        flushChunk()
        const errorMsg = payload?.error || "AI 流式请求失败"
        if (!assistantMessage.content) {
          assistantMessage.content = `错误：${errorMsg}`
        }
        uni.showToast({ title: errorMsg, icon: "none" })
      },
      onDone: () => {
        flushChunk()
        if (flushTimer) {
          clearTimeout(flushTimer)
          flushTimer = null
        }
        if (!assistantMessage.content) {
          assistantMessage.content = "模型未返回内容"
          scrollToBottom()
        }
      },
    },
  )
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: linear-gradient(180deg, #eff6ff 0%, #f8fafc 48%, #ffffff 100%);
}

.config-card,
.input-card {
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(148, 163, 184, 0.18);
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(37, 99, 235, 0.08);
}

.config-row + .config-row {
  margin-top: 20rpx;
}

.config-label {
  display: block;
  font-size: 26rpx;
  color: #475569;
  margin-bottom: 12rpx;
}

.picker-value,
.text-input {
  min-height: 76rpx;
  border-radius: 14rpx;
  border: 1rpx solid #dbe3f0;
  background: #f8fafc;
  display: flex;
  align-items: center;
  padding: 0 20rpx;
  color: #0f172a;
  font-size: 28rpx;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.switch-row .config-label {
  margin-bottom: 0;
}

.message-list {
  height: 860rpx;
  margin: 24rpx 0;
  padding: 12rpx 0;
}

.message-item {
  max-width: 86%;
  border-radius: 24rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.message-item.user {
  margin-left: auto;
  background: #dbeafe;
  color: #0f172a;
}

.message-item.assistant {
  background: #ffffff;
  color: #111827;
}

.message-role {
  display: block;
  font-size: 24rpx;
  color: #64748b;
  margin-bottom: 8rpx;
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 30rpx;
  line-height: 1.7;
}

.message-input {
  width: 100%;
  min-height: 180rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  border: 1rpx solid #dbe3f0;
  padding: 20rpx;
  box-sizing: border-box;
  font-size: 30rpx;
}

.input-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.action-btn {
  flex: 1;
  margin: 0;
  border-radius: 14rpx;
  font-size: 30rpx;
}

.send-btn {
  background: #2563eb;
  color: #fff;
}

.stop-btn {
  background: #e2e8f0;
  color: #334155;
}
</style>
