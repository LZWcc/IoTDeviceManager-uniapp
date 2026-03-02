import instance from "./request.js"

export async function sendAiMessage(message) {
  return instance.post("/api/ai/chat", { message })
}
