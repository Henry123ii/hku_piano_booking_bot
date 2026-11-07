"use strict";
let opening = null;
async function openPanel() {
  if (opening) return opening;
  opening = (async () => {
    const {panelWindowId} = await chrome.storage.session.get("panelWindowId");
    if (panelWindowId) {
      try { await chrome.windows.update(panelWindowId,{focused:true}); return; } catch {}
    }
    const w=await chrome.windows.create({url:chrome.runtime.getURL("app.html"),type:"popup",width:1040,height:850,focused:true});
    await chrome.storage.session.set({panelWindowId:w.id});
  })();
  try { await opening; } finally { opening=null; }
}
chrome.action.onClicked.addListener(()=>openPanel().catch(console.error));
chrome.notifications.onClicked.addListener(async id=>{
  const {bookingTabId}=await chrome.storage.session.get("bookingTabId");
  try {
    if (bookingTabId) { const t=await chrome.tabs.update(bookingTabId,{active:true}); await chrome.windows.update(t.windowId,{focused:true}); }
    else await openPanel();
  } catch { await openPanel(); }
  await chrome.notifications.clear(id);
});
chrome.windows.onRemoved.addListener(async id=>{
  const {panelWindowId}=await chrome.storage.session.get("panelWindowId");
  if (id===panelWindowId) {
    await chrome.storage.session.remove(["panelWindowId","activeRun"]);
    // No background submission timer exists. Closing the panel stops future clicks.
  }
});
