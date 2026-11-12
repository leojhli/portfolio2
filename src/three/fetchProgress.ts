/** Reads a response body, reporting bytes as they arrive when a size is known. */
export async function readBytes(
  response: Response,
  fallbackSize: number,
  onProgress?: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const reader = onProgress ? response.body?.getReader?.() : undefined
  if (!reader || !onProgress) return response.arrayBuffer()
  // A compressed transfer reports its encoded length, so trust the header only
  // when the body is sent as-is.
  const header = response.headers.get("content-encoding")
    ? 0
    : Number(response.headers.get("content-length"))
  const total = header > 0 ? header : fallbackSize
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress(Math.min(.99, loaded / Math.max(total, loaded)))
  }
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  onProgress(1)
  return bytes.buffer
}
