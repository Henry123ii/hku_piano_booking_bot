(() => {
  "use strict";
  if (window.__hkuPianoContentLoaded) return;
  window.__hkuPianoContentLoaded=true;
  const responseSelector="#reservationResponse,#reservationResult,#reservationCreated,#reservationFailed,#reservationErrors,#reservation-errors,#result,.alert,[role='alert'],[role='dialog'],.modal.show,.modal.in,.ui-dialog-content,.toast-message";
  let submitted=false, runId=null, responseBaseline=new Map(), network=[];
  let submittedAt=0;
  try {
    const old=JSON.parse(sessionStorage.getItem("hkuPianoPending")||"null");
    if(old && Date.now()-old.at<120000){submitted=true;runId=old.runId;submittedAt=old.at;}
  } catch {}
  const visible=el=>!!el && el.getClientRects().length>0 && getComputedStyle(el).visibility!=="hidden" && getComputedStyle(el).display!=="none";
  const norm=t=>String(t||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  function field(labelText) {
    const matches=[];
    for (const label of document.querySelectorAll("label")) {
      if(norm(label.textContent)!==norm(labelText))continue;
      const el=label.control || (label.htmlFor?document.getElementById(label.htmlFor):label.querySelector("input,select,textarea"));
      if(el && visible(el)) matches.push(el);
    }
    if(matches.length===0) for(const el of document.querySelectorAll("input,textarea,select")) {
      if(visible(el) && norm(el.getAttribute("aria-label"))===norm(labelText))matches.push(el);
    }
    const unique=[...new Set(matches)];
    if(unique.length!==1)throw Error(`Expected one visible field labelled '${labelText}', found ${unique.length}. No submission was made.`);
    return unique[0];
  }
  function hasFields(){try{field("Student UID No.");field("Contact No.");field("Total Number of People Using the Room");return true;}catch{return false;}}
  function createButton() {
    const candidates=[...document.querySelectorAll("button,input[type=submit],input[type=button],[role=button]")]
      .filter(el=>visible(el) && /^create$/i.test((el.getAttribute("aria-label")||el.value||el.innerText||el.textContent||"").trim()));
    if(candidates.length!==1)throw Error(`Expected one visible Create button, found ${candidates.length}. Check the booking tab.`);
    return candidates[0];
  }
  function probe(){
    const login=!!document.querySelector("input[type=password]") || /(?:\bLog In\b|\bSign In\b)/i.test(document.title) || [...document.querySelectorAll("a,button")].some(el=>visible(el)&&/log in with hku sso/i.test(el.textContent));
    const logout=!!document.querySelector("a[href*='logout'],a[href*='signout'],form[action*='logout']");
    const form=hasFields();
    const schedule=!!document.querySelector("a[href*='schedule.php']") && /dashboard\.php|schedule\.php/.test(location.pathname);
    return {url:location.href,title:document.title,login,authenticated:!login&&(logout||form||schedule),form,
      labels:[...document.querySelectorAll("label")].slice(0,25).map(x=>x.textContent.trim())};
  }
  function setField(el,value){
    if(el.disabled||el.readOnly)throw Error("A required field is disabled or read-only. Check the live form.");
    const proto=el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:el.tagName==="SELECT"?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;
    if(setter)setter.call(el,String(value));else el.value=String(value);
    el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));
    if(el.value!==String(value))throw Error("The page did not retain a filled field. Please inspect it.");
  }
  function assertTarget(c){
    const actual=HKU.parseReservationURL(location.href);
    if(!actual || actual.roomId!==c.roomId || actual.date!==c.date || actual.start!==HKU.timeValue(c.start) || actual.end!==HKU.timeValue(c.end))throw Error("The open reservation URL no longer matches the confirmed room/date/time. Stopped.");
  }
  function fill(c){
    assertTarget(c);
    const items=[["Student UID No.",c.uid],["Contact No.",c.phone],["Total Number of People Using the Room",c.people]];
    // Find every target before changing any fields.
    const targets=items.map(([label,value])=>[field(label),value]);
    const rules=document.querySelector("#attribute-65");
    if(!rules || rules.type!=="checkbox")throw Error("Agreement checkbox #attribute-65 was not found. No submission was made.");
    const button=createButton();
    for(const [el,value]of targets)setField(el,value);
    rules.scrollIntoView({block:"center"});
    if(!rules.checked)rules.click();
    if(!rules.checked)throw Error("The agreement checkbox could not be checked.");
    button.scrollIntoView({block:"center"});
    submitted=false;runId=c.runId;submittedAt=0;network=[];responseBaseline=new Map();
    sessionStorage.removeItem("hkuPianoPending");
    return {filled:true,createEnabled:!button.disabled};
  }
  function captcha(){
    const responses=[...document.querySelectorAll("textarea[name='g-recaptcha-response'],input[name='g-recaptcha-response'],textarea[id^='g-recaptcha-response']")];
    const frame=document.querySelector("iframe[src*='/recaptcha/'][src*='/anchor'],iframe[title='reCAPTCHA']");
    const challenge=[...document.querySelectorAll("iframe[src*='/recaptcha/'][src*='/bframe'],iframe[title*='recaptcha challenge']")].some(visible);
    const present=!!frame || !!document.querySelector(".g-recaptcha,[data-sitekey]") || responses.length>0;
    return {present,verified:responses.some(x=>String(x.value||"").trim().length>0),challenge};
  }
  function rawToText(raw){
    if(!raw)return "";
    try {
      const data=JSON.parse(raw);
      if(typeof data==="string")return data;
      const messages=[];
      for(const k of ["message","Message","error","errors","Errors","statusMessage","confirmation"]) {
        const v=data[k];if(v)messages.push(typeof v==="string"?v:JSON.stringify(v,null,2));
      }
      if(messages.length)return messages.join("\n");
      return JSON.stringify(data,null,2);
    } catch {}
    if(/<[a-z][\s\S]*>/i.test(raw)){
      const d=new DOMParser().parseFromString(raw,"text/html");
      for(const el of d.querySelectorAll("script,style,noscript"))el.remove();
      return d.body.textContent.trim();
    }
    return raw;
  }
  function result(){
    if(!submitted)return {submitted:false};
    const list=[];
    for(const el of document.querySelectorAll(responseSelector)) {
      if(!visible(el))continue;
      const text=el.innerText?.trim();
      if(text && responseBaseline.get(el)!==text && !el.closest("#hku-piano-note"))list.push(text);
    }
    const unique=[...new Set(list)];
    const latest=network.at(-1)||null;
    const text=unique.join("\n\n") || (latest?rawToText(latest.body):"");
    return {submitted:true,submittedAt,text,source:unique.length?"Visible HKUFBS response":latest?.source||"",network:latest,url:location.href};
  }
  document.addEventListener("hku-piano-response",e=>{
    if(!submitted)return;
    try {const d=JSON.parse(e.detail);if(d && typeof d.body==="string"){network.push(d);network=network.slice(-6);}}catch{}
  });
  function submit(c){
    if(submitted && runId===c.runId)return {alreadySubmitted:true,at:submittedAt};
    assertTarget(c);
    for(const [label,value]of [["Student UID No.",c.uid],["Contact No.",c.phone],["Total Number of People Using the Room",c.people]]) {
      if(field(label).value!==String(value))throw Error(`The ${label} field changed after preparation. Review the form; no automated submission was made.`);
    }
    const cap=captcha();
    if(cap.present&&!cap.verified)throw Error("reCAPTCHA is not verified. No Create click was sent.");
    const rules=document.querySelector("#attribute-65");
    if(!rules?.checked)throw Error("The agreement is no longer checked.");
    const button=createButton();
    if(button.disabled || button.getAttribute("aria-disabled")==="true")throw Error("Create is disabled on the live page. No click was sent.");
    if(button.form&&!button.form.checkValidity()){
      const invalid=[...button.form.elements].filter(e=>e.willValidate&&!e.checkValidity()).map(e=>e.validationMessage);
      button.form.reportValidity();throw Error(`Browser form validation: ${[...new Set(invalid)].join(" ")}`);
    }
    responseBaseline=new Map([...document.querySelectorAll(responseSelector)].map(el=>[el,el.innerText?.trim()]));
    submitted=true;runId=c.runId;submittedAt=Date.now();network=[];
    sessionStorage.setItem("hkuPianoPending",JSON.stringify({runId,at:submittedAt}));
    document.dispatchEvent(new Event("hku-piano-arm-response"));
    button.click();
    return {clicked:true,at:submittedAt};
  }
  function slots(c){
    const found=[];
    for(const a of document.querySelectorAll("a[href],[data-href],[data-url]")){
      if(!visible(a)||a.closest(".unreservable,.reserved,.pasttime,.disabled,[aria-disabled=true]"))continue;
      const url=a.getAttribute("href")||a.getAttribute("data-href")||a.getAttribute("data-url");
      const slot=HKU.parseReservationURL(url);
      if(slot && slot.roomId===c.roomId && slot.date===c.date)found.push({...slot,url:new URL(url,location.href).href});
    }
    const map=new Map(found.map(s=>[s.start+"|"+s.end,s]));
    return {slots:[...map.values()].sort((a,b)=>a.start.localeCompare(b.start)),checkedAt:Date.now(),pageURL:location.href};
  }
  function status(){
    let enabled=false,buttonError="";
    try{const b=createButton();enabled=!b.disabled&&b.getAttribute("aria-disabled")!=="true";}catch(e){buttonError=e.message;}
    return {...probe(),captcha:captcha(),createEnabled:enabled,buttonError,result:result()};
  }
  chrome.runtime.onMessage.addListener((m,s,reply)=>{
    if(!m || !String(m.type).startsWith("HKU_"))return;
    try {
      let data;
      switch(m.type){
        case "HKU_PROBE":data=probe();break;
        case "HKU_FILL":data=fill(m.config);break;
        case "HKU_STATUS":data=status();break;
        case "HKU_SUBMIT":data=submit(m.config);break;
        case "HKU_READ_SLOTS":data=slots(m.config);break;
        case "HKU_IMPORT_SLOT":data={slot:HKU.parseReservationURL(location.href)};break;
        default:return;
      }
      reply({ok:true,...data});
    }catch(e){reply({ok:false,error:e.message});}
  });
})();
