import instance from "./request.js"

/* ---------------- 设备列表（数据页用） ---------------- */

export async function getDeviceList(type = "sensor") {
  const response = await instance.get("/api/device-list", {
    params: { type },
  })
  return response.data
}

/* ---------------- 格式化数据查询 ---------------- */

export async function getFormatLimit1ByDevice(d_no, type = "sensor") {
  const response = await instance.get(`/api/format-limit-1/${d_no}`, {
    params: { type },
  })
  return response.data
}

export async function getFormatMinuteAvg(d_no, type = "sensor") {
  const response = await instance.get(`/api/format-minute-avg/${d_no}`, {
    params: { type },
  })
  return response.data
}

export async function getFormatPaged(
  page,
  pageSize,
  d_no = "",
  startTime = "",
  endTime = "",
  type = "sensor",
  online = "",
) {
  const response = await instance.get("/api/format-paged", {
    params: { page, pageSize, d_no, startTime, endTime, type, online },
  })
  return response.data
}

export async function getFormatChart(
  d_no = "",
  startTime = "",
  endTime = "",
  type = "sensor",
  online = "",
) {
  const response = await instance.get("/api/format-chart", {
    params: { d_no, startTime, endTime, type, online },
  })
  return response.data
}
