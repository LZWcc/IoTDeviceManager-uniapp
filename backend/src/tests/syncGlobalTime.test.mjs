process.env.MQTT_DISABLED = "1"

import assert from "node:assert/strict"
import express from "express"

const { default: directConfigRouter } = await import("../routes/directConfig.js")
const { default: db } = await import("../db.js")
const { default: mqttService } = await import("../mqtt/client.js")

const dbStats = {
  queryCalls: 0,
  getConnectionCalls: 0,
}

db.query = async () => {
  dbStats.queryCalls += 1
  return [[]]
}
db.getConnection = async () => {
  dbStats.getConnectionCalls += 1
  throw new Error("sync-global-time 不应申请数据库连接")
}

const mqttCalls = []
mqttService.sendGlobalCommand = async (command) => {
  mqttCalls.push(command)
}

const app = express()
app.use(express.json())
app.use("/api", directConfigRouter)

const server = app.listen(0)

try {
  const address = server.address()
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/sync-global-time`,
    {
      method: "POST",
    },
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.code, 0)
  assert.equal(body.message, "全局时间同步指令已下发")
  assert.equal(body.data.d_no, "GLOBAL")
  assert.equal(body.data.t_name, "同步时间")
  assert.equal(body.data.topic, "sync_time")
  assert.match(body.data.value, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(typeof body.data.timestamp, "number")
  assert.equal(mqttCalls.length, 1)
  assert.deepEqual(mqttCalls[0], body.data)
  assert.equal(dbStats.queryCalls, 0)
  assert.equal(dbStats.getConnectionCalls, 0)

  console.log("sync-global-time route verification passed")
  console.log(JSON.stringify(body.data))
} finally {
  server.close()
}
