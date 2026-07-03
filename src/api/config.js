import instance from "./request.js"

/* ---------------- 指令配置 ---------------- */

export async function getDirectConfig(d_no = "GLOBAL") {
  const response = await instance.get("/api/get-direct-config", {
    params: { d_no },
  })
  return response.data
}

export async function saveDirectConfig(configs, d_no = "GLOBAL") {
  const response = await instance.post("/api/save-config", {
    configs,
    d_no,
  })
  return response.data
}

/* ---------------- 设备列表（配置页用） ---------------- */

export async function getConfigDeviceList() {
  const response = await instance.get("/api/get-devices")
  return response.data
}

/* ---------------- 全局时间同步 ---------------- */

export async function syncGlobalTime(time) {
  const body = time ? { time } : {}
  const response = await instance.post("/api/sync-global-time", body)
  return response.data
}
