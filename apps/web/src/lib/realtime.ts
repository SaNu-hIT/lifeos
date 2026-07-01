// Client for the phase-29 SSE stream (GET /v1/realtime/stream). Each frame's `data` is
// a RealtimeMessage; `parseRealtimeMessage` validates it, and `subscribeRealtime` wires
// an EventSource that reconnects automatically (native EventSource behaviour).

export interface RealtimeMessage {
  type: string;
  payload: unknown;
  occurredAt: string;
}

/** Parse + validate one SSE `data:` line. Returns null on malformed frames. */
export function parseRealtimeMessage(raw: string): RealtimeMessage | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (typeof obj.type !== 'string' || typeof obj.occurredAt !== 'string') return null;
    return { type: obj.type, payload: obj.payload, occurredAt: obj.occurredAt };
  } catch {
    return null;
  }
}

export function subscribeRealtime(
  streamUrl: string,
  onMessage: (message: RealtimeMessage) => void,
): () => void {
  // The dev token is passed via query since EventSource can't set headers; the API
  // accepts either (the browser also sends it as a cookie in a real deployment).
  const source = new EventSource(streamUrl, { withCredentials: false });
  source.onmessage = (evt: MessageEvent<string>) => {
    const message = parseRealtimeMessage(evt.data);
    if (message) onMessage(message);
  };
  return () => source.close();
}
