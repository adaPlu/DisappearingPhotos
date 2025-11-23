// AI Stealth: content script
// - Injects injected.js into the page as an external script (CSP-safe)
// - Bridges config between popup <-> storage <-> injected.js

console.log("[AI Stealth] Content script loaded on", location.href);

function injectPageScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

// Only inject on Telegram Web A (`/a`)
if (location.hostname === "web.telegram.org" && location.pathname.startsWith("/a")) {
  injectPageScript();
}

// Listen for messages FROM the page script (injected.js)
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || !data.__aiStealthFromPage) return;

  if (data.type === "AI_STEALTH_REQUEST_CONFIG") {
    chrome.storage.sync.get(
      {
        aiStealthEnabled: true,
        aiStealthTtlSeconds: 10
      },
      (items) => {
        window.postMessage(
          {
            __aiStealthFromContent: true,
            type: "AI_STEALTH_SET_CONFIG",
            enabled: items.aiStealthEnabled,
            ttlSeconds: items.aiStealthTtlSeconds
          },
          "*"
        );
      }
    );
  }
});

// Receive config updates from popup.js and forward to page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AI_STEALTH_UPDATE_TTL") {
    window.postMessage(
      {
        __aiStealthFromContent: true,
        type: "AI_STEALTH_SET_CONFIG",
        enabled: message.enabled,
        ttlSeconds: message.ttlSeconds
      },
      "*"
    );
  }
  // Sync response; no need to keep channel open
  return false;
});
