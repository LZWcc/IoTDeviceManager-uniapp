import instance from "./request.js"

export const getFormatLimit5 = async (d_no) => {
  const response = await instance.get(`/api/format-limit-5/${d_no}`)
  return response.data
}

export const getFormatLimit1ByDevice = async (d_no, type = "sensor") => {
  const response = await instance.get(`/api/format-limit-1/${d_no}`, {
    params: { type },
  })
  return response.data
}

export const getFormatMinuteAvg = async (d_no, type = "sensor") => {
  const response = await instance.get(`/api/format-minute-avg/${d_no}`, {
    params: { type },
  })
  return response.data
}

export const getFormatPaged = async (
  page,
  pageSize,
  d_no = "",
  startTime = "",
  endTime = "",
  type = "sensor",
) => {
  const response = await instance.get("/api/format-paged", {
    params: {
      page,
      pageSize,
      d_no,
      startTime,
      endTime,
      type,
    },
  })
  return response.data
}

export const getFormatChart = async (
  d_no = "",
  startTime = "",
  endTime = "",
  type = "sensor",
) => {
  const response = await instance.get("/api/format-chart", {
    params: {
      d_no,
      startTime,
      endTime,
      type,
    },
  })
  return response.data
}
