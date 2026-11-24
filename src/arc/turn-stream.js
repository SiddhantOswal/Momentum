export function frame(event) {
  const id = event.sequence > 0 ? `id: ${event.sequence}\n` : "";
  return `${id}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export const streamHeaders = { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" };

export function turnStream(work, { signal, requestTimeoutMs, keepAliveMs }) {
  const cancelled = new AbortController();
  const deadline = new AbortController();
  const activeSignal = AbortSignal.any([signal, cancelled.signal, deadline.signal].filter(Boolean));
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      const send = (line) => {
        if (!cancelled.signal.aborted) controller.enqueue(encoder.encode(line));
      };
      const sendEvent = (event) => send(frame(event));
      const finish = () => {
        clearInterval(heartbeat);
        clearTimeout(timeout);
        activeSignal.removeEventListener("abort", onAbort);
        if (!cancelled.signal.aborted) controller.close();
      };
      const onAbort = () => {
        if (!cancelled.signal.aborted) {
          sendEvent({ type: "stream.error", code: deadline.signal.aborted ? "REQUEST_TIMEOUT" : "SERVICE_UNAVAILABLE" });
        }
        finish();
      };
      const heartbeat = setInterval(() => send(": keep-alive\n\n"), keepAliveMs);
      const timeout = setTimeout(() => deadline.abort(), requestTimeoutMs);
      send(": keep-alive\n\n");
      activeSignal.addEventListener("abort", onAbort, { once: true });
      if (activeSignal.aborted) {
        onAbort();
        return;
      }
      void Promise.resolve().then(() => work(sendEvent, activeSignal)).then(() => {
        if (!activeSignal.aborted) finish();
      }, (error) => {
        if (!activeSignal.aborted) {
          sendEvent({ type: "stream.error", code: error?.code === "TRACE_INCOMPLETE" ? error.code : "SERVICE_UNAVAILABLE" });
          finish();
        }
      });
    },
    cancel() { cancelled.abort(); },
  });
  return new Response(body, { headers: streamHeaders });
}
