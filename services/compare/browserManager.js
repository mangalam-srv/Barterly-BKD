import { chromium } from "playwright";

/**
 * Centralised Playwright browser lifecycle manager.
 *
 * - Launches a single shared Chromium instance lazily (first request only).
 * - Hands out short-lived browser contexts so individual scrapers stay isolated.
 * - Auto-closes the browser after a period of inactivity so we do not keep a
 *   headless Chromium running forever on the API server.
 *
 * Nothing here is scraper-specific; adding a new platform never touches this file.
 */

const IDLE_SHUTDOWN_MS = 60_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let browserPromise = null;
let activeContexts = 0;
let idleTimer = null;

const clearIdleTimer = () => {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
};

const scheduleIdleShutdown = () => {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    if (activeContexts === 0) {
      void closeBrowser();
    }
  }, IDLE_SHUTDOWN_MS);
  // Do not keep the Node process alive just for this timer.
  if (typeof idleTimer.unref === "function") idleTimer.unref();
};

const launchBrowser = async () => {
  return chromium.launch({
    headless: process.env.COMPARE_HEADLESS !== "false",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      // Several target sites terminate HTTP/2 connections from headless Chromium
      // with ERR_HTTP2_PROTOCOL_ERROR; forcing HTTP/1.1 makes navigation reliable.
      "--disable-http2",
    ],
  });
};

/**
 * Returns the shared browser, launching it if required.
 * Throws if Chromium cannot be launched (e.g. binaries not installed) — callers
 * are expected to treat that as a scraper-source failure, never as fake data.
 */
const getBrowser = async () => {
  clearIdleTimer();
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
};

/**
 * Creates an isolated browsing context configured to look like a normal desktop
 * browser. Always pair with `releaseContext` (a try/finally is ideal).
 */
export const acquireContext = async () => {
  const browser = await getBrowser();
  activeContexts += 1;
  clearIdleTimer();

  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1366, height: 768 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    extraHTTPHeaders: {
      "Accept-Language": "en-IN,en;q=0.9",
    },
  });
  context.setDefaultNavigationTimeout(25_000);
  context.setDefaultTimeout(15_000);
  return context;
};

export const releaseContext = async (context) => {
  try {
    if (context) await context.close();
  } catch {
    /* context already gone — nothing to do */
  } finally {
    activeContexts = Math.max(0, activeContexts - 1);
    if (activeContexts === 0) scheduleIdleShutdown();
  }
};

export const closeBrowser = async () => {
  clearIdleTimer();
  const pending = browserPromise;
  browserPromise = null;
  if (!pending) return;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    /* best-effort shutdown */
  }
};

// Make sure Chromium is not left running when the API server stops.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void closeBrowser();
  });
}
