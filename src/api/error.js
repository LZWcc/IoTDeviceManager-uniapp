import instance from "./request.js"

export const getErrorMsg = async (
  page,
  pageSize,
  d_no = "",
  startTime = "",
  endTime = "",
) => {
  const response = await instance.get("/api/error", {
    params: {
      page,
      pageSize,
      d_no,
      startTime,
      endTime,
    },
  })
  return response.data
}
