import express from 'express'
import OpenAI from 'openai'
import dotenv from 'dotenv'
dotenv.config()

const router = express.Router()

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:9b'
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 1024)
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 256)
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.3)
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '0m'

const openai = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      baseURL: DEEPSEEK_BASE_URL,
      apiKey: process.env.DEEPSEEK_API_KEY,
    })
  : null

const SYSTEM_PROMPT = '你是一个软件开发领域的专家，帮助用户解决编程相关的问题。'

function getValidHistory(history = []) {
  return Array.isArray(history) ? history.filter((item) => item && item.role && item.content) : []
}

function getChatMessages(message, history = []) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...getValidHistory(history),
    { role: 'user', content: message },
  ]
}

function validateRequest(req, res) {
  const { message, provider = 'deepseek', model, history = [], options = {} } = req.body || {}

  if (!message || !message.trim()) {
    res.status(400).json({
      success: false,
      error: '消息不能为空',
    })
    return null
  }

  if (!['deepseek', 'ollama'].includes(provider)) {
    res.status(400).json({
      success: false,
      error: 'provider 仅支持 deepseek 或 ollama',
    })
    return null
  }

  return { message, provider, model, history, options }
}

function getOllamaRuntimeOptions(options = {}) {
  return {
    num_ctx: Number(options.num_ctx || OLLAMA_NUM_CTX),
    num_predict: Number(options.num_predict || OLLAMA_NUM_PREDICT),
    temperature: typeof options.temperature === 'number' ? options.temperature : OLLAMA_TEMPERATURE,
  }
}

function writeSSE(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

router.post('/ai/chat', async (req, res) => {
  try {
    const validRequest = validateRequest(req, res)
    if (!validRequest) return
    const { message, provider, model, history, options } = validRequest

    console.log('📩 收到用户消息:', message)
    console.log('🤖 provider:', provider)

    let aiReply = null
    let usedModel = model

    if (provider === 'deepseek') {
      if (!openai) {
        return res.status(500).json({
          success: false,
          error: '未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek',
        })
      }

      usedModel = model || DEEPSEEK_MODEL
      const completion = await openai.chat.completions.create({
        model: usedModel,
        messages: getChatMessages(message, history),
      })

      const content = completion?.choices?.[0]?.message?.content || '模型未返回内容'
      aiReply = {
        role: 'assistant',
        content,
      }
    }

    if (provider === 'ollama') {
      usedModel = model || OLLAMA_MODEL

      const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: usedModel,
          stream: false,
          messages: getChatMessages(message, history),
          options: getOllamaRuntimeOptions(options),
          keep_alive: options.keep_alive || OLLAMA_KEEP_ALIVE,
        }),
      })

      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text()
        return res.status(500).json({
          success: false,
          error: `Ollama 调用失败: ${errorText || ollamaResponse.statusText}`,
        })
      }

      const ollamaData = await ollamaResponse.json()
      aiReply = ollamaData?.message || {
        role: 'assistant',
        content: '模型未返回内容',
      }
    }

    res.json({
      success: true,
      provider,
      model: usedModel,
      message: aiReply,
    })
  } catch (error) {
    console.error('AI请求失败:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'AI 请求失败',
    })
  }
})

router.post('/ai/chat/stream', async (req, res) => {
  const validRequest = validateRequest(req, {
    status: (...args) => res.status(...args),
    json: (...args) => res.json(...args),
  })
  if (!validRequest) return

  const { message, provider, model, history, options } = validRequest
  const usedModel = model || (provider === 'ollama' ? OLLAMA_MODEL : DEEPSEEK_MODEL)

  let clientClosed = false
  req.on('close', () => {
    clientClosed = true
  })

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  try {
    if (provider === 'deepseek') {
      if (!openai) {
        writeSSE(res, 'error', { error: '未配置 DEEPSEEK_API_KEY，无法调用 DeepSeek' })
        writeSSE(res, 'done', { success: false })
        return res.end()
      }

      const stream = await openai.chat.completions.create({
        model: usedModel,
        stream: true,
        messages: getChatMessages(message, history),
      })

      for await (const chunk of stream) {
        if (clientClosed) {
          break
        }
        const delta = chunk?.choices?.[0]?.delta?.content
        if (delta) {
          writeSSE(res, 'delta', { content: delta })
        }
      }

      if (clientClosed) {
        return res.end()
      }

      writeSSE(res, 'done', { success: true, provider, model: usedModel })
      return res.end()
    }

    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: usedModel,
        stream: true,
        messages: getChatMessages(message, history),
        options: getOllamaRuntimeOptions(options),
        keep_alive: options.keep_alive || OLLAMA_KEEP_ALIVE,
      }),
    })

    if (!ollamaResponse.ok || !ollamaResponse.body) {
      const errorText = await ollamaResponse.text()
      writeSSE(res, 'error', {
        error: `Ollama 调用失败: ${errorText || ollamaResponse.statusText}`,
      })
      writeSSE(res, 'done', { success: false })
      return res.end()
    }

    const reader = ollamaResponse.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      if (clientClosed) {
        try {
          await reader.cancel()
        } catch {
          // ignore cancel error
        }
        return res.end()
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line)
          const delta = json?.message?.content || ''
          if (delta) {
            writeSSE(res, 'delta', { content: delta })
          }
          if (json?.done) {
            writeSSE(res, 'done', { success: true, provider, model: usedModel })
            return res.end()
          }
        } catch (parseError) {
          console.error('解析 Ollama 流响应失败:', parseError)
        }
      }
    }

    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer)
        const delta = json?.message?.content || ''
        if (delta) {
          writeSSE(res, 'delta', { content: delta })
        }
      } catch (parseError) {
        console.error('解析 Ollama 尾包失败:', parseError)
      }
    }

    writeSSE(res, 'done', { success: true, provider, model: usedModel })
    return res.end()
  } catch (error) {
    console.error('AI 流式请求失败:', error)
    writeSSE(res, 'error', { error: error?.message || 'AI 流式请求失败' })
    writeSSE(res, 'done', { success: false })
    return res.end()
  }
})

export default router
