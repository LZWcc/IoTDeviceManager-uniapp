import instance from "./request.js"

export const getErrorMsg = (
  page,
  pageSize,
  d_no = "",
  startTime = "",
  endTime = "",
) => {
  return instance.get("/api/error", {
    params: {
      page,
      pageSize,
      d_no,
      startTime,
      endTime,
    },
  })
}
