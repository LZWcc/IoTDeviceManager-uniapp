import instance, { BASE_URL } from "./request.js"

export async function sendAiMessage({
  message,
  provider = "deepseek",
  model = "",
  history = [],
  options = {},
}) {
  return instance.post("/api/ai/chat", {
    message,
    provider,
    model,
    history,
    options,
  })
}

const AI_STREAM_URL = `${BASE_URL}/api/ai/chat/stream`

export async function streamAiMessage(
  { message, provider = "deepseek", model = "", history = [], options = {} },
  { onDelta, onError, onDone, signal } = {},
) {
  if (typeof fetch !== "function") {
    throw new Error("当前平台不支持流式请求")
  }

  const response = await fetch(AI_STREAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      provider,
      model,
      history,
      options,
    }),
    signal,
  })

  if (!response.ok || !response.body) {
    const text = await response.text()
    throw new Error(text || "流式请求失败")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let currentEvent = "message"

  const handleEvent = (eventName, payloadText) => {
    if (!payloadText) return

    let payload = null
    try {
      payload = JSON.parse(payloadText)
    } catch {
      payload = { raw: payloadText }
    }

    if (eventName === "delta" && onDelta) {
      onDelta(payload)
      return
    }

    if (eventName === "error" && onError) {
      onError(payload)
      return
    }

    if (eventName === "done" && onDone) {
      onDone(payload)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split("\n\n")
    buffer = blocks.pop() || ""

    for (const block of blocks) {
      const lines = block.split("\n")
      let eventName = currentEvent
      let dataText = ""

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim()
          currentEvent = eventName
        }
        if (line.startsWith("data:")) {
          dataText += line.slice(5).trim()
        }
      }

      handleEvent(eventName, dataText)
    }
  }
}
