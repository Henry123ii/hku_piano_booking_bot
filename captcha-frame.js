/* Only the checkbox is clicked. Image/audio challenges are always left to the user. */
"use strict";
chrome.runtime.onMessage.addListener((m,s,reply)=>{
  if (m?.type!=="HKU_CAPTCHA_CLICK") return;
  const anchor=document.querySelector("#recaptcha-anchor");
  if (!anchor) return;
  if (anchor.getAttribute("aria-checked")==="true") reply({ok:true,alreadyChecked:true});
  else { anchor.click(); reply({ok:true,clicked:true}); }
});
