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
  const response = await instance.delete(`/api/device/${id}`)
  return response.data
}

export async function addDevice(params) {
  const response = await instance.post(`/api/device`, params)
  return response.data
}

export async function editDevice(id, params) {
  const response = await instance.put(`/api/device/${id}`, params)
  return response.data
}
