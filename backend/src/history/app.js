import express from 'express'
import cors from 'cors'
import db from './db.js'

const app = express()
app.use(cors())

app.get('/api/sensor-data-formatted', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM t_sensor_field_mapper WHERE visible = "1"')
  const fieldMapping = {}
  rows.forEach((mapper) => {
    fieldMapping[mapper.db_name] = mapper.f_name
  })

  const [dataRows] = await db.query('SELECT * FROM t_sensor_data LIMIT 10')

  const formattedData = dataRows.map((row) => {
    const formatted = {
      "设备编码": row.d_no,
      "更新时间": row.c_time,
      "是否在线数据": row.online,
    }

    // 遍历映射表，将 field1-field10 转换为中文名称
    Object.keys(fieldMapping).forEach((dbName) => {
      const chineseName = fieldMapping[dbName]
      formatted[chineseName] = row[dbName]
    })

    return formatted
  })
  res.json(formattedData)
})

// 启动服务器
const PORT = 8081
app.listen(PORT, () => {
  console.log(`API 地址：`)
  console.log(`  - http://localhost:${PORT}/api/sensor-data-formatted`)
})
