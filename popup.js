const enabledCheckbox = document.getElementById("enabled");
const ttlInput = document.getElementById("ttlSeconds");
const saveButton = document.getElementById("save");
const statusEl = document.getElementById("status");

// Load existing config (with defaults)
chrome.storage.sync.get(
  {
    aiStealthEnabled: true,
    aiStealthTtlSeconds: 10
  },
  (items) => {
    enabledCheckbox.checked = !!items.aiStealthEnabled;
    ttlInput.value = items.aiStealthTtlSeconds || 10;
  }
);

// Save and broadcast to active Telegram tab
saveButton.addEventListener("click", () => {
  const enabled = enabledCheckbox.checked;
  let ttlSeconds = parseInt(ttlInput.value, 10);

  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    ttlSeconds = 10;
    ttlInput.value = "10";
  }

  chrome.storage.sync.set(
    {
      aiStealthEnabled: enabled,
      aiStealthTtlSeconds: ttlSeconds
    },
    () => {
      statusEl.textContent = "Saved!";
      setTimeout(() => (statusEl.textContent = ""), 1000);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id || !tab.url) {
          return;
        }

        if (!tab.url.startsWith("https://web.telegram.org/a")) {
          return;
        }

        // Fire-and-forget; no callback -> no "receiving end does not exist" noise
        chrome.tabs.sendMessage(tab.id, {
          type: "AI_STEALTH_UPDATE_TTL",
          enabled,
          ttlSeconds
        });
      });
    }
  );
});
