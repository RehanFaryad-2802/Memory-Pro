// Update context menu creation
chrome.runtime.onInstalled.addListener(() => {
  // Existing text save menu
  chrome.contextMenus.create({
    id: "saveToMemory",
    title: "Save to Memory",
    contexts: ["selection"]
  });
  
  // Add tag submenu (unchanged)
  const tags = ["Info", "Reference", "Content", "Series", "Code", "URL"];
  tags.forEach(tag => {
    chrome.contextMenus.create({
      id: `saveWithTag_${tag}`,
      title: tag,
      parentId: "saveToMemory",
      contexts: ["selection"]
    });
  });
  
  // NEW: Add screenshot context menu
  chrome.contextMenus.create({
    id: "captureVisibleTab",
    title: "📸 Capture Visible Tab",
    contexts: ["all"], // Available on any page
    documentUrlPatterns: ["http://*/*", "https://*/*"] // Only on web pages
  });
});

// Updated click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // Text save handler
  if (info.menuItemId.startsWith("saveWithTag_") && info.selectionText) {
    const tag = info.menuItemId.replace("saveWithTag_", "");
    const detected = detectType(info.selectionText);
    
    const newItem = {
      id: Date.now().toString() + Math.floor(Math.random() * 1000),
      text: info.selectionText,
      created: new Date().toISOString(),
      color: randomColor(),
      pinned: false,
      tags: [tag],
      type: detected.type,
      meta: {
        ...(detected.meta || {}),
        sourceUrl: tab.url
      },
      versions: []
    };
    
    chrome.storage.local.get({ memory: [] }, (res) => {
      const updated = [newItem, ...res.memory];
      chrome.storage.local.set({ memory: updated });
    });
    return;
  }
  
  // Screenshot handler
  if (info.menuItemId === "captureVisibleTab") {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (!dataUrl) return;
      
      const newItem = {
        id: Date.now().toString() + Math.floor(Math.random() * 1000),
        text: `Screenshot from ${tab.title || tab.url}`,
        created: new Date().toISOString(),
        color: randomColor(),
        pinned: false,
        tags: ["Content"],
        type: "image",
        meta: {
          imageData: dataUrl,
          sourceUrl: tab.url,
          favicon: `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}`
        },
        versions: []
      };
      
      chrome.storage.local.get({ memory: [] }, (res) => {
        chrome.storage.local.set({ memory: [newItem, ...res.memory] });
      });
    });
  }
});

// Existing helper functions remain unchanged
function randomColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 60 + Math.floor(Math.random() * 20);
  const l = 45 + Math.floor(Math.random() * 10);
  return `hsl(${h} ${s}% ${l}%)`;
}

function detectType(text) {
  const trimmed = text.trim();
  const urlRegex = /^https?:\/\/[^\s]+$/i;
  if (urlRegex.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return {
        type: "url",
        meta: { title: trimmed, favicon: `https://www.google.com/s2/favicons?domain=${url.hostname}` }
      };
    } catch(e) { /* ignore */ }
  }
  const codeKeywords = ["function","const","let","var","=>","console.log","{","}",";","class"];
  if (codeKeywords.some(k => trimmed.includes(k))) return { type: "code", meta: {} };
  return { type: "text", meta: {} };
}
