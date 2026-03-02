import instance from "./request.js"

export async function getDirectConfig(d_no = "GLOBAL") {
  try {
    const response = await instance.get("/api/get-direct-config", {
      params: { d_no },
    })
    return response.data
  } catch (error) {
    console.error("获取数据失败:", error)
    throw error
  }
}

export async function saveDirectConfig(configs, d_no = "GLOBAL") {
  try {
    const response = await instance.post("/api/save-config", {
      configs,
      d_no,
    })
    return response.data
  } catch (error) {
    console.error("保存数据失败:", error)
    throw error
  }
}

// 获取设备列表
export async function getDeviceList() {
  try {
    const response = await instance.get("/api/get-devices")
    return response.data
  } catch (error) {
    console.error("获取设备列表失败:", error)
    throw error
  }
}
