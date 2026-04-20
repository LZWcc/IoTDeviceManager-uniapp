import express from 'express'
import http from 'http'
import cors from 'cors'
import db from './db.js'
import moment from 'moment'
import deviceRouter from './device.js'
import errorRouter from './error.js'
import directConfigRouter from './routes/directConfig.js' 
import aiRouter from './routes/ai.js'
import wsService from './websocket/wsServer.js'
// import mqttRouter from './routes/mqtt.js'

const app = express()
const server = http.createServer(app)

// 添加 JSON 解析中间件
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(cors())
app.use('/api', deviceRouter)
app.use('/api', errorRouter)
app.use('/api', directConfigRouter)
app.use('/api', aiRouter)
// app.use('/api/mqtt', mqttRouter)

const tableMap = {
  sensor: { data: 't_sensor_data', mapper: 't_sensor_field_mapper' },
  behavior: { data: 't_behavior_data', mapper: 't_behavior_field_mapper' },
}

// 封装数据格式化函数
/**
 * 格式化传感器数据行
 * @param {Object} row - 数据库查询的单行数据
 * @param {Array} mappers - 字段映射表数组
 * @returns {Array} 格式化后的数据数组
 */
function formatDataRow(row, mappers) {
  const datas = []

  // 添加设备编号
  datas.push({ f_name: '设备编号', value: row.d_no })

  // 添加映射字段
  mappers.forEach((mapper) => {
    datas.push({
      f_name: mapper.f_name,
      unit: mapper.unit,
      db_name: mapper.db_name,
      value: row[mapper.db_name],
    })
  })

  // 添加在线状态
  datas.push({ f_name: '是否在线数据', value: row.online })

  // 添加更新时间
  datas.push({
    f_name: '更新时间',
    value: moment(row.c_time).format('YYYY-MM-DD HH:mm:ss'),
  })

  return datas
}

app.get('/', (req, res) => {
  res.send('服务器运行正常')
})

app.get('/api/sensor-data', async (req, res) => {
  try {
    const [rows] = await db.query(`select * from t_sensor_data`)
    // console.log(rows)
    res.json(rows)
  } catch (error) {
    console.log(error.message)
  }
})

// 返回格式化的全部数据(已测试完成)
app.get('/api/format', async (req, res) => {
  try {
    const [mappers] = await db.query('SELECT f_name, db_name, unit FROM t_sensor_field_mapper')
    console.log(mappers)
    // [{"f_name": "水温", "db_name": "field4"}, ...]
    const [dataRows] = await db.query('SELECT * from t_sensor_data ORDER BY c_time DESC LIMIT 5') // 升序排序
    // [{id: 4039, d_no: 2021, field1: 12 ...}]
    const formatted = dataRows.map((row) => formatDataRow(row, mappers))
    res.json(formatted)
  } catch (error) {
    console.log(error.message)
  }
})

// 分页接口 + 筛选
app.get('/api/format-paged', async (req, res) => {
  try {
    // 1. 从前端获取参数
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 10
    const offset = (page - 1) * pageSize

    // 1.1 动态表名
    const type = req.query.type || 'sensor'
    const tables = tableMap[type]

    const { d_no, startTime, endTime } = req.query
    // 2.1 构建筛选条件
    let filter = `
      WHERE 1=1
      ${d_no ? ' AND d_no = ?' : ''}
      ${startTime && endTime ? ' AND c_time BETWEEN ? AND ?' : ''}
      `
    const params = [...(d_no ? [d_no] : []), ...(startTime && endTime ? [startTime, endTime] : [])]
    // 2.2 查询字段映射表
    const [mappers] = await db.query(`SELECT f_name, db_name, unit FROM ${tables.mapper}`)
    // 3. 查询总条数
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM ${tables.data} ${filter}`,
      params,
    )
    // 4. 查询当前页数据
    const [dataRows] = await db.query(
      `
      SELECT * 
      FROM ${tables.data}
      ${filter}
      ORDER BY c_time DESC 
      LIMIT ? OFFSET ?
    `,
      [...params, pageSize, offset],
    )
    // 5. 格式化输出
    const formatted = dataRows.map((row) => formatDataRow(row, mappers))
    // 6. 返回分页结果
    res.json({
      total,
      data: formatted,
      page,
      pageSize,
    })
  } catch (error) {
    console.log(error.message)
  }
})

// HistoryData折线图接口
app.get('/api/format-chart', async (req, res) => {
  try {
    const { d_no, startTime, endTime } = req.query

    const type = req.query.type || 'sensor'
    const tables = tableMap[type]

    let filter = `
      WHERE 1=1
      ${d_no ? ' AND d_no = ?' : ''}
      ${startTime && endTime ? ' AND c_time BETWEEN ? AND ?' : ''}
    `
    const params = [...(d_no ? [d_no] : []), ...(startTime && endTime ? [startTime, endTime] : [])]

    const [mappers] = await db.query(`SELECT f_name, db_name, unit FROM ${tables.mapper}`)

    const avgSelect = mappers
      .map((item) => `AVG(${item.db_name}) AS ${item.db_name}_avg`)
      .join(', ')

    const [rows] = await db.query(
      `
      SELECT 
        DATE_FORMAT(c_time, '%Y-%m-%d %H:%i') AS minute_time,
        ${avgSelect}
      FROM ${tables.data}
      ${filter}
      GROUP BY minute_time
      ORDER BY minute_time ASC
      `,
      params,
    )
    /*
    rows = [
      { minute_time: '2024-06-29 20:15', field4_avg: 55.0, field5_avg: 36.2 },
      { minute_time: '2024-06-29 20:16', field4_avg: 62.5, field5_avg: 48.5 },
      // ...
    ]*/
    const times = rows.map((r) => r.minute_time)
    // times = ['2024-06-29 20:15', '2024-06-29 20:16', ...]

    const series = mappers.map((m) => {
      const key = `${m.db_name}_avg`
      return {
        name: m.f_name,
        unit: m.unit,
        data: rows.map((r) => (r[key] !== null ? Number(r[key].toFixed(2)) : null)),
      }
    })
    /* 希望返回的结构
    series = [
      { name: '水温', unit: '℃', data: [55.0, 62.5] },
      { name: '水质', unit: 'ppm', data: [36.2, 48.5] },
    ]*/

    let displayTimes = times
    if (times.length > 15) {
      const step = Math.ceil(times.length / 15)
      displayTimes = times.filter((_, i) => i % step === 0)
    }

    res.json({
      code: 200,
      msg: '获取折线图数据成功',
      data: {
        times: displayTimes,
        series,
      },
    })
  } catch (error) {
    console.error('获取折线图数据出错:', error)
    res.status(500).json({ code: 500, msg: '服务器内部错误' })
  }
})

// 返回最新的一条数据(按设备编号, 在RealtimeData上方el-card中使用)
app.get('/api/format-limit-1/:d_no', async (req, res) => {
  try {
    const d_no = req.params.d_no
    const type = req.query.type || 'sensor'
    const tables = tableMap[type]
    const [mappers] = await db.query(`SELECT f_name, db_name, unit FROM ${tables.mapper}`)
    const [dataRows] = await db.query(
      `
      SELECT * FROM ${tables.data}
      WHERE d_no = ?
      ORDER BY c_time DESC, id DESC
      LIMIT 1
      `,
      [d_no],
    )
    const formatted = dataRows.map((row) => formatDataRow(row, mappers))

    res.json(formatted)
  } catch (error) {
    console.log(error.message)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 获取所有设备编号(辅助方法)
app.get('/api/device-list', async (req, res) => {
  try {
    const type = req.query.type || 'sensor'
    const dataTable = tableMap[type]
    const [rows] = await db.query(`
      SELECT DISTINCT d_no FROM ${dataTable.data} ORDER BY d_no
    `)
    const deviceNos = rows.map((row) => row.d_no)
    res.json(deviceNos)
  } catch (error) {
    console.error(error.message)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 取一个设备的最新五条数据(已完成 / 未使用?)
app.get('/api/format-limit-5/:d_no', async (req, res) => {
  try {
    const d_no = req.params.d_no
    const [mappers] = await db.query('SELECT f_name, db_name, unit FROM t_sensor_field_mapper')
    const [dataRows] = await db.query(
      `
      SELECT * FROM t_sensor_data 
      WHERE d_no = ?
      ORDER BY c_time DESC, id DESC
      LIMIT 5
    `,
      [d_no],
    )
    const formatted = dataRows.map((row) => formatDataRow(row, mappers))

    res.json(formatted)
  } catch (error) {
    console.log(error.message)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 获取指定设备的分钟级平均值数据(RealtimeData-ECharts图接口)
app.get('/api/format-minute-avg/:d_no', async (req, res) => {
  try {
    const d_no = req.params.d_no
    const type = req.query.type || 'sensor'
    const tables = tableMap[type]
    const [mappers] = await db.query(`SELECT f_name, db_name, unit FROM ${tables.mapper}`)
    const avgFields = mappers.map((m) => `AVG(${m.db_name}) AS ${m.db_name}_avg`).join(', ')
    const [rowDesc] = await db.query(
      `SELECT DATE_FORMAT(c_time, '%Y-%m-%d %H:%i') AS minute_time, ${avgFields} FROM ${tables.data}
       WHERE d_no = ? GROUP BY minute_time ORDER BY minute_time DESC LIMIT 5`,
      [d_no],
    )
    const rows = rowDesc.reverse()
    const formatted = rows.map((row) => {
      const datas = []
      datas.push({ f_name: '时间', value: row.minute_time })

      mappers.forEach((m) => {
        const value = row[`${m.db_name}_avg`]
        datas.push({
          f_name: m.f_name,
          unit: m.unit,
          db_name: m.db_name,
          value: value === null ? null : parseFloat(value.toFixed(2)),
        })
      })
      return datas
    })
    res.json(formatted)
  } catch (error) {
    console.log(error.message)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

const PORT = 8081
wsService.init(server)
server.listen(PORT, () => {
  console.log(`✅ 服务器已启动：http://localhost:${PORT}`)
  console.log(`   - http://localhost:${PORT}/api/sensor-data`)
  console.log(`   - http://localhost:${PORT}/api/format`)
  console.log(`   - http://localhost:${PORT}/api/format-limit-1`)
  console.log(`   - http://localhost:${PORT}/api/device-list`)
  console.log(`   - http://localhost:${PORT}/api/format-minute-avg/2021`)
  console.log(`   - http://localhost:${PORT}/api/device`)
  console.log(`   - http://localhost:${PORT}/api/get-direct-config`)
})
