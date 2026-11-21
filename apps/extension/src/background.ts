// Stores the parsed order and opens the Processing tab.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type === "open-process" && msg.order) {
    const key = `order:${msg.order.orderNumber}`;
    chrome.storage.local.set({ [key]: msg.order }).then(async () => {
      await chrome.tabs.create({ url: chrome.runtime.getURL(`process.html?order=${msg.order.orderNumber}`), index: (sender.tab?.index ?? 0) + 1 });
      reply({ ok: true });
    });
    return true;
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && tab.url && /^https:\/\/www\.walmart\.com\/orders\/\d+/.test(tab.url)) {
    chrome.tabs.sendMessage(tab.id, { type: "process-current" });
  } else {
    chrome.tabs.create({ url: "https://www.walmart.com/orders" });
  }
});
