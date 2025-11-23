// Runs in the *page* context of web.telegram.org/a, not in the extension sandbox.
// Hooks the MTProto worker's postMessage and sets ttlSeconds / ttl_seconds on
// outgoing media (photos, albums, etc.) when enabled.
// Exposes window.takeHome(photo), which sends the currently open photo preview
// using the TTL from the popup-config.

(function () {
  if (window.__aiStealthInjected) {
    console.log("[AI Stealth] injected.js already loaded, skipping duplicate injection");
    return;
  }
  window.__aiStealthInjected = true;

  console.log("[AI Stealth] injected.js loaded in page context");

  const config = {
    enabled: true,
    ttlSeconds: 10
  };

  // ===== Config bridge from content script =====
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || !data.__aiStealthFromContent) return;

    if (data.type === "AI_STEALTH_SET_CONFIG") {
      config.enabled = !!data.enabled;
      if (typeof data.ttlSeconds === "number" && data.ttlSeconds > 0) {
        config.ttlSeconds = data.ttlSeconds;
      }
      console.log("[AI Stealth] Config updated in page:", config);
    }
  });

  // ===== Generic helpers =====

  function deepWalk(node, fn, seen) {
    if (!node || typeof node !== "object") return;
    if (!seen) seen = new WeakSet();
    if (seen.has(node)) return;
    seen.add(node);

    fn(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        deepWalk(item, fn, seen);
      }
    } else {
      for (const key of Object.keys(node)) {
        deepWalk(node[key], fn, seen);
      }
    }
  }

  function setTtlFields(obj, contextLabel) {
    if (!config.enabled) return;
    if (!obj || typeof obj !== "object") return;

    const oldCamel = obj.ttlSeconds;
    const oldSnake = obj.ttl_seconds;

    // Set both camelCase and snake_case so the MTProto layer sees ttl_seconds.
    obj.ttlSeconds = config.ttlSeconds;
    obj.ttl_seconds = config.ttlSeconds;

    console.debug("[AI Stealth] [worker] Set TTL on", contextLabel, {
      oldCamel,
      oldSnake,
      new: config.ttlSeconds
    });
  }

  // ===== MTProto worker hook (core logic) =====

  function patchWorkerMessage(message, scriptURL) {
    if (!config.enabled) return;
    if (!message || typeof message !== "object") return;

    const isInvoke = message.type === "invoke";
    if (isInvoke) {
      console.debug(
        "[AI Stealth] [worker] Saw invoke message for worker",
        scriptURL,
        "payload keys:",
        message.payload ? Object.keys(message.payload) : null
      );
    }

    if (isInvoke && message.payload && typeof message.payload === "object") {
      deepWalk(message.payload, (node) => {
        if (!node || typeof node !== "object") return;

        // Direct media object (e.g. messages.SendMedia)
        if (node.media && typeof node.media === "object") {
          setTtlFields(node.media, "node.media");
        }

        // Albums / multi-media (e.g. messages.SendMultiMedia)
        if (Array.isArray(node.multiMedia)) {
          node.multiMedia.forEach((item, idx) => {
            if (item && typeof item === "object" && item.media && typeof item.media === "object") {
              setTtlFields(item.media, "multiMedia[" + idx + "].media");
            }
          });
        }

        // Any object that already has ttlSeconds / ttl_seconds
        if ("ttlSeconds" in node || "ttl_seconds" in node) {
          setTtlFields(node, "node (direct ttl)");
        }
      });
    } else {
      // Fallback for non-invoke or unexpected shapes
      deepWalk(message, (node) => {
        if (!node || typeof node !== "object") return;
        if (node.media && typeof node.media === "object") {
          setTtlFields(node.media, "fallback node.media");
        }
        if ("ttlSeconds" in node || "ttl_seconds" in node) {
          setTtlFields(node, "fallback node (direct ttl)");
        }
      });
    }
  }

  function installWorkerHook() {
    const OriginalWorker = window.Worker;
    if (!OriginalWorker || OriginalWorker.__aiStealthWrapped) {
      return;
    }

    function WrappedWorker(scriptURL, options) {
      const worker = new OriginalWorker(scriptURL, options);

      console.debug("[AI Stealth] [worker] New Worker created:", scriptURL);

      const originalPostMessage = worker.postMessage;
      worker.postMessage = function (message, transfer) {
        try {
          console.debug("[AI Stealth] [worker] postMessage", {
            scriptURL,
            type: message && message.type,
            hasPayload: !!(message && message.payload)
          });
          patchWorkerMessage(message, scriptURL);
        } catch (e) {
          console.error("[AI Stealth] Error patching worker message:", e);
        }
        return originalPostMessage.call(worker, message, transfer);
      };

      return worker;
    }

    WrappedWorker.__aiStealthWrapped = true;
    WrappedWorker.prototype = OriginalWorker.prototype;
    window.Worker = WrappedWorker;

    console.log("[AI Stealth] Worker hook installed");
  }

  // ===== takeHome helper (console entrypoint like in the video) =====

  // Best-effort DOM helper: click the "Send" button in the currently open media preview.
  // TTL is always taken from config.ttlSeconds (popup UI), not from arguments.
  function sendCurrentPhotoUsingConfigTtl() {
    // Helper to test visibility
    function isVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      if (
        style.visibility === "hidden" ||
        style.display === "none" ||
        style.pointerEvents === "none"
      ) {
        return false;
      }
      return true;
    }

    // 0) Prefer to search within a dialog / media preview container if present
    const previewRoots = Array.from(
      document.querySelectorAll(
        "div[role='dialog'], div[aria-modal='true'], div[class*='popup'], div[class*='modal'], div[class*='media']"
      )
    ).filter(isVisible);

    const scopes = previewRoots.length ? previewRoots : [document];

    let sendBtn = null;

    // 1) Try obvious "Send" selectors inside those scopes
    const primarySelectors = [
      'button[title="Send"]',
      'button[title*="Send"]',
      'button[aria-label="Send"]',
      'button[aria-label*="Send"]',
      'div[role="button"][aria-label*="Send"]',
      'button[data-testid*="send"]',
      'div[role="button"][data-testid*="send"]',
      'button[class*="send"]',
      'div[role="button"][class*="send"]'
    ];

    for (const scope of scopes) {
      for (const sel of primarySelectors) {
        const el = scope.querySelector(sel);
        if (el && isVisible(el)) {
          sendBtn = el;
          console.log("[AI Stealth] takeHome: primary selector matched:", {
            selector: sel,
            tag: el.tagName,
            className: el.className,
            text: (el.textContent || "").trim().slice(0, 40)
          });
          break;
        }
      }
      if (sendBtn) break;
    }

    // 2) Fallback: bottom-rightmost visible button-like element within scopes
    if (!sendBtn) {
      let candidates = [];
      for (const scope of scopes) {
        const local = Array.from(
          scope.querySelectorAll("button, div[role='button']")
        ).filter(isVisible);
        candidates = candidates.concat(local);
      }

      if (candidates.length > 0) {
        let best = candidates[0];
        let bestScore = -Infinity;

        for (const el of candidates) {
          const rect = el.getBoundingClientRect();
          // Heuristic: favor elements lower and further right on screen
          const score = rect.bottom * 2 + rect.right;
          if (score > bestScore) {
            bestScore = score;
            best = el;
          }
        }

        sendBtn = best;

        console.log("[AI Stealth] takeHome: fallback send candidate:", {
          tag: sendBtn.tagName,
          className: sendBtn.className,
          text: (sendBtn.textContent || "").trim().slice(0, 40)
        });
      }
    }

    if (!sendBtn) {
      console.warn(
        "[AI Stealth] takeHome: could not find a Send button. " +
          "Make sure a photo preview is open before calling takeHome(photo)."
      );
      return;
    }

    sendBtn.click();
    console.log(
      "[AI Stealth] takeHome: clicked Send button with TTL from config:",
      config.ttlSeconds
    );
  }

  // Public helper, available in DevTools console as window.takeHome(photo)
  // The `photo` argument is accepted to match the video; TTL comes only from config.
  window.takeHome = function (photo) {
    console.log(
      "[AI Stealth] takeHome() called. Using current config TTL via worker hook:",
      config.ttlSeconds
    );
    sendCurrentPhotoUsingConfigTtl();
  };

  console.log("[AI Stealth] takeHome(photo) helper attached to window.");

  // ===== Install worker hook and request config =====

  installWorkerHook();

  window.postMessage(
    { __aiStealthFromPage: true, type: "AI_STEALTH_REQUEST_CONFIG" },
    "*"
  );
})();
