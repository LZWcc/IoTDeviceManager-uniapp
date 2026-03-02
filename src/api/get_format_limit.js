import instance from "./request.js"

export const getFormatLimit5 = (d_no) => {
  return instance.get(`/api/format-limit-5/${d_no}`)
}

export const getFormatLimit1ByDevice = (d_no, type = "sensor") => {
  return instance.get(`/api/format-limit-1/${d_no}`, {
    params: { type },
  })
}

export const getFormatMinuteAvg = (d_no, type = "sensor") => {
  return instance.get(`/api/format-minute-avg/${d_no}`, {
    params: { type },
  })
}

export const getFormatPaged = (
  page,
  pageSize,
  d_no = "",
  startTime = "",
  endTime = "",
  type = "sensor",
) => {
  return instance.get("/api/format-paged", {
    params: {
      page,
      pageSize,
      d_no,
      startTime,
      endTime,
      type,
    },
  })
}

export const getFormatChart = (
  d_no = "",
  startTime = "",
  endTime = "",
  type = "sensor",
) => {
  return instance.get("/api/format-chart", {
    params: {
      d_no,
      startTime,
      endTime,
      type,
    },
  })
}
