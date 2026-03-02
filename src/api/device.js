import instance from "./request.js"

export async function getDevice(keyword = "") {
  const response = await instance.get("/api/device", {
    params: {
      keyword,
    },
  })
  return response.data
}

export async function deleteDevice(id) {
  return instance.delete(`/api/device/${id}`)
}

export async function addDevice(params) {
  return instance.post(`/api/device`, params)
}

export async function editDevice(id, params) {
  return instance.put(`/api/device/${id}`, params)
}
