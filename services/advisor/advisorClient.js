/**
 * Thin HTTP client for the Python AI Product Advisor service.
 *
 * The Python service is INTERNAL — it is never exposed to the browser. React
 * talks to Node; Node talks to Python here. The LLM key lives only in the Python
 * process; Node only needs the service URL (and an optional shared secret).
 */

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const AI_INTERNAL_API_KEY = process.env.AI_INTERNAL_API_KEY || "";
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.AI_SERVICE_TIMEOUT_MS || "", 10) || 60_000;

class AdvisorServiceError extends Error {
  constructor(message, { status = 502, upstreamStatus = null } = {}) {
    super(message);
    this.name = "AdvisorServiceError";
    this.status = status;
    this.upstreamStatus = upstreamStatus;
  }
}

const headers = () => {
  const h = { "Content-Type": "application/json" };
  if (AI_INTERNAL_API_KEY) h["x-internal-key"] = AI_INTERNAL_API_KEY;
  return h;
};

const callJson = async (path, { method = "GET", body } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${AI_SERVICE_URL}${path}`, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new AdvisorServiceError("The AI advisor took too long to respond. Please try again.", {
        status: 504,
      });
    }
    throw new AdvisorServiceError(
      "The AI advisor service is unavailable. Please try again shortly.",
      { status: 503 }
    );
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      (payload && (payload.detail || payload.message)) ||
      "The AI advisor could not process this request.";
    throw new AdvisorServiceError(
      typeof detail === "string" ? detail : "The AI advisor could not process this request.",
      { status: 502, upstreamStatus: response.status }
    );
  }

  return payload;
};

export const advisorHealth = () => callJson("/health");

export const askAdvisor = (requestBody) =>
  callJson("/advisor/chat", { method: "POST", body: requestBody });

/**
 * Open the Python SSE stream. Returns the raw fetch Response so the caller can
 * pipe `response.body` straight to the browser. `clientSignal` lets Node abort
 * the upstream request when the browser disconnects.
 */
export const askAdvisorStream = async (requestBody, clientSignal) => {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (clientSignal) {
    if (clientSignal.aborted) controller.abort();
    else clientSignal.addEventListener("abort", onAbort, { once: true });
  }
  // Upstream watchdog: a stream can legitimately run longer than a single call.
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS + 30_000);

  let response;
  try {
    response = await fetch(`${AI_SERVICE_URL}/advisor/chat/stream`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new AdvisorServiceError("The AI advisor stream was cancelled.", { status: 499 });
    }
    throw new AdvisorServiceError(
      "The AI advisor service is unavailable. Please try again shortly.",
      { status: 503 }
    );
  }

  if (!response.ok || !response.body) {
    clearTimeout(timer);
    throw new AdvisorServiceError("The AI advisor could not start a response.", {
      status: 502,
      upstreamStatus: response.status,
    });
  }

  return { response, cleanup: () => clearTimeout(timer) };
};

export { AdvisorServiceError };
