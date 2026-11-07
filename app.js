"use strict";
const $=id=>document.getElementById(id);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const formKeys=["room","date","start","end","people","uid","phone","releaseDate","releaseTime","early","offset","captchaLead","late","mode","remember"];
let currentRun=null, preparedConfig=null, portalTabId=null, calendarTabId=null, bookingTabId=null;
let logs=[], lastResult=null, loginWatch=0, logWrite=Promise.resolve();
const show=(id,yes=true)=>{$(id).hidden=!yes;};
function flash(text){$("flash").textContent=text;show("flash",!!text);}
function log(text){
  logs.push(`[${HKU.hkStamp()}] ${text}`);logs=logs.slice(-350);
  $("log").textContent=logs.join("\n");$("log").scrollTop=$("log").scrollHeight;
  const copy=[...logs];logWrite=logWrite.then(()=>chrome.storage.local.set({progressLog:copy})).catch(()=>{});
}
function stage(title,detail,progress){
  $("stage").textContent=title;$("stageDetail").textContent=detail;
  $("progressBar").style.width=`${progress}%`;show("progressSection");
}
function badge(text,good=false){$("loginBadge").textContent=text;$("loginBadge").classList.toggle("good",good);}
function readConfig(){
  return {roomId:$("room").value,date:$("date").value,start:$("start").value,end:$("end").value,
    people:$("people").value,uid:$("uid").value.trim(),phone:$("phone").value.trim(),mode:$("mode").value,
    releaseDate:$("releaseDate").value,releaseTime:$("releaseTime").value,
    early:+$("early").value,offset:+$("offset").value,captchaLead:+$("captchaLead").value,late:+$("late").value,
    dryRun:$("dryRun").checked,runId:crypto.randomUUID()};
}
async function savePrefs(){
  const prefs={};for(const id of formKeys)prefs[id]=$(id).type==="checkbox"?$(id).checked:$(id).value;
  if(!$("remember").checked){prefs.uid="";prefs.phone="";}
  await chrome.storage.local.set({preferences:prefs});
}
function busy(yes){
  $("settings").disabled=yes;$("confirmBtn").disabled=yes;$("portalBtn").disabled=yes;$("clearBtn").disabled=yes;
  $("cancelBtn").disabled=!yes;
}
function checkAbort(run){if(run.cancelled)throw Error("Cancelled. No further automated Create click will be sent.");}
async function openSite(url,focused=true){
  const wins=await chrome.windows.getAll({windowTypes:["normal"]});
  let tab;
  if(wins.length){const w=wins.find(w=>w.focused)||wins[0];tab=await chrome.tabs.create({windowId:w.id,url,active:true});if(focused)await chrome.windows.update(w.id,{focused:true});}
  else{const w=await chrome.windows.create({url,type:"normal",width:1150,height:850,focused});tab=w.tabs[0];}
  return tab.id;
}
async function focusTab(id=bookingTabId||portalTabId||calendarTabId){
  if(!id)throw Error("No HKU tab has been opened yet.");
  const tab=await chrome.tabs.update(id,{active:true});
  const w=await chrome.windows.get(tab.windowId);
  await chrome.windows.update(tab.windowId,{focused:true,drawAttention:true,...(w.state==="minimized"?{state:"normal"}:{})});
}
async function message(tabId,type,data={}){
  const reply=await chrome.tabs.sendMessage(tabId,{type,...data},{frameId:0});
  if(!reply)throw Error("The HKU page has not loaded the extension helper yet. Reload the HKU tab.");
  if(!reply.ok)throw Error(reply.error||"The page helper reported an error.");
  return reply;
}
async function probe(tabId){
  const tab=await chrome.tabs.get(tabId);
  if(tab.status!=="complete")return null;
  if(!tab.url?.startsWith(HKU.BASE))return {authenticated:false,login:true,external:true,url:tab.url||""};
  try{return await message(tabId,"HKU_PROBE");}catch{return null;}
}
async function notify(title,text,id){
  try {await chrome.notifications.create(`hku-${id}`,{type:"basic",iconUrl:"icons/icon128.png",title,message:text,priority:2,requireInteraction:true});}
  catch {log("System notification was unavailable. The companion banner and booking tab remain available.");}
  try{await focusTab();}catch{}
}
async function ensureLogin(run){
  stage("Checking your HKU session","Opening the actual dashboard to validate your current Edge login.",8);
  log("Validating the current Edge session against the HKUFBS dashboard.");
  portalTabId=await openSite(HKU.BASE+"dashboard.php");
  let notified=false,last=null;
  const deadline=Date.now()+180000;
  while(Date.now()<deadline){
    checkAbort(run);last=await probe(portalTabId);
    if(last?.authenticated){badge("HKU session valid",true);log("Authenticated HKUFBS page detected. Session check passed.");return;}
    if(last?.login&&!notified){
      notified=true;badge("Login required");
      stage("Please sign in","Finish HKU SSO and 2FA in the portal tab. This attempt waits for you; no password is collected.",8);
      log("Session is missing or expired. Complete SSO/2FA in the portal tab.");
      await notify("HKU login required","Complete SSO and 2FA in the HKU portal tab.",run.id+"-login");
      await focusTab(portalTabId);
    }
    await delay(600);
  }
  throw Error(last?.login?"HKU login was not completed within three minutes. No submission was made.":"The page did not expose recognized authenticated HKUFBS controls. Check the portal tab; no submission was made.");
}
async function loginOnly(){
  const token=++loginWatch;flash("");badge("Waiting for login");
  try{
    portalTabId=await openSite(HKU.BASE+"dashboard.php");
    flash("Complete HKU SSO and 2FA in the portal tab. This window will detect the dashboard automatically.");
    for(let i=0;i<300 && loginWatch===token;i++){
      const p=await probe(portalTabId);
      if(p?.authenticated){badge("HKU session valid",true);flash("Login detected. Return to Reservation to select and prepare your booking.");return;}
      await delay(1000);
    }
    if(loginWatch===token)flash("Login has not been confirmed. Finish signing in, then click Portal login again to check.");
  }catch(e){badge("Login not checked");flash(e.message);}
}
async function waitUntil(at,run){
  while(Date.now()<at){checkAbort(run);updateCountdown(at);await delay(Math.min(250,Math.max(1,at-Date.now())));}
  checkAbort(run);
}
function updateCountdown(at){
  const ms=at-Date.now();const sec=Math.max(0,Math.ceil(ms/1000));
  $("countdown").textContent=sec>=3600?`${Math.floor(sec/3600)}h ${Math.floor(sec%3600/60)}m`:`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;
}
async function waitForForm(tabId,run){
  let last=null;const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    checkAbort(run);last=await probe(tabId);
    if(last?.form)return last;
    if(last?.login)throw Error("HKU requested login again when opening the reservation form. Use Portal login and start a new attempt.");
    await delay(300);
  }
  throw Error("The reservation form did not become available within 30 seconds. It may be blocked before release, unavailable, or have different labels. Check the HKU tab. No Create click was sent.");
}
async function clickCaptchaOnce(){
  // Broadcast only inside this booking tab. The Google frame helper clicks its checkbox, not challenges.
  try{
    await chrome.tabs.sendMessage(bookingTabId,{type:"HKU_CAPTCHA_CLICK"});
    log("Requested one reCAPTCHA checkbox click. Verification is checked separately.");
  }catch{log("Automatic checkbox click was unavailable. Use the checkbox in the booking tab.");}
}
async function showCaptchaPrompt(run,text){
  $("captchaText").textContent=text;show("captchaBanner");
  log(text);
  await notify("HKU booking: CAPTCHA needs you",text,run.id+"-captcha");
}
async function waitReady(c,plan,run){
  let clickedCheckbox=false,clickRequestedAt=0,prompted=false,wasVerified=false,readyLogged=false,readyBeforeDeadline=false;
  // Prepare-now has no absolute deadline before the form has even opened.
  if(c.mode==="now"){
    plan.release=Date.now();plan.clickAt=plan.release+c.offset*1000;plan.captchaAt=Date.now();
  }
  const deadline=plan.clickAt+c.late*1000;
  while(true){
    checkAbort(run);
    const s=await message(bookingTabId,"HKU_STATUS");
    if(s.login)throw Error("Your HKU session expired during preparation. Sign in again; no click was sent.");
    if(!s.form)throw Error("The booking tab no longer contains the expected form. No click was sent.");
    const cap=s.captcha,ready=!cap.present||cap.verified;
    if(ready){
      show("captchaBanner",false);
      if(!readyLogged){log(cap.present?"A non-empty reCAPTCHA response is present. HKU will validate it on submission.":"No reCAPTCHA widget was detected on this form.");readyLogged=true;}
      wasVerified=cap.verified;
      if(Date.now()<=plan.clickAt)readyBeforeDeadline=true;
      stage(c.dryRun?"Rehearsal ready":"Ready for release",c.dryRun?"The form is prepared. Create will not be clicked.":`Create target: ${HKU.hkStamp(plan.clickAt)}. The server decides acceptance.`,70);
      if(c.dryRun)return {rehearsal:true};
      if(Date.now()>=plan.clickAt){
        if(Date.now()>deadline && !(readyBeforeDeadline&&Date.now()-plan.clickAt<=2000))throw Error("The allowed late-submission window has passed. No click was sent.");
        return {rehearsal:false};
      }
    }else{
      if(wasVerified){wasVerified=false;readyLogged=false;readyBeforeDeadline=false;prompted=false;log("The reCAPTCHA response disappeared before submission.");}
      if(!clickedCheckbox && Date.now()>=plan.captchaAt){
        clickedCheckbox=true;clickRequestedAt=Date.now();await clickCaptchaOnce();
      }
      if((cap.challenge || (clickedCheckbox&&Date.now()-clickRequestedAt>2500))&&!prompted){
        prompted=true;
        stage("Manual CAPTCHA needed","Solve the challenge in the HKU tab. The assistant checks the response field, not whether the challenge merely disappeared.",60);
        await showCaptchaPrompt(run,"Complete reCAPTCHA in the booking tab. Submission waits for verification and will occur at or after your chosen time, within the late allowance.");
      }
      if(Date.now()>deadline)throw Error("reCAPTCHA was not verified before the late allowance ended. No Create click was sent.");
    }
    updateCountdown(plan.clickAt);
    // These checks read the existing DOM. They do not refresh or poll HKU's server.
    const remain=plan.clickAt-Date.now();
    await delay(remain>0?Math.min(250,Math.max(10,remain)):200);
  }
}
async function showResult(result,title="Response received"){
  lastResult={...result,at:Date.now()};
  $("resultText").textContent=result.text||"No unambiguous booking response was captured. Inspect the HKU tab and My Reservations before trying again.";
  $("resultMeta").textContent=[title,result.source,result.status!=null?`HTTP ${result.status} (transport status only)`:"",result.truncated?"Raw response truncated to 60,000 characters":""].filter(Boolean).join(" | ");
  $("rawResponse").textContent=result.raw||"";show("rawDetails",!!result.raw);show("resultSection");
  await chrome.storage.local.set({lastResult:{...lastResult,raw:""}});
}
async function collectResult(run){
  stage("Create attempted - waiting for response","Do not resubmit while the result is unknown. The booking tab stays open.",88);
  const until=Date.now()+25000;
  let latest=null;
  while(Date.now()<until){
    // Never retry the click, including if its acknowledgement was lost on navigation.
    try{
      const s=await message(bookingTabId,"HKU_STATUS");
      if(s.login)throw Error("Login page returned after Create. The booking outcome is unconfirmed.");
      if(s.result?.text){latest=s.result;await delay(650);try{const newer=await message(bookingTabId,"HKU_STATUS");if(newer.result?.text)latest=newer.result;}catch{}break;}
    }catch(e){if(e.message.includes("Login page returned"))throw e;}
    await delay(350);
  }
  if(!latest){
    stage("Outcome not confirmed","No recognizable response was captured. Inspect the still-open HKU tab before any retry.",100);
    log("No definitive response was captured. This does NOT mean that the booking failed. Do not retry without checking My Reservations.");
    await showResult({text:"No recognizable booking response was captured within 25 seconds. The request may still have succeeded or failed. Check the HKU page and My Reservations. No retry was made.",source:"Assistant diagnostic"},"Outcome unknown");
    return;
  }
  const kind=HKU.classify(latest.text);
  const titles={success:"HKU response indicates success",rejected:"HKU response indicates rejection",pending:"Reservation needs approval",response:"HKU response received - read below"};
  stage(titles[kind],"The text below is captured from the site. The HKU tab remains open for inspection.",100);
  log(`${titles[kind]}. No automatic retry will be made.`);
  await showResult({text:latest.text,source:latest.source,status:latest.network?.status,raw:latest.network?.body||"",truncated:!!latest.network?.truncated},titles[kind]);
}
async function runBooking(c){
  if(currentRun)return;
  const run={id:c.runId,cancelled:false,attempted:false};currentRun=run;++loginWatch;
  busy(true);flash("");lastResult=null;logs=[];$("log").textContent="";show("resultSection",false);show("captchaBanner",false);
  show("progressSection");$("progressSection").scrollIntoView({block:"start",behavior:"smooth"});
  let plan=HKU.plan(c);
  try{
    await savePrefs();await chrome.storage.local.remove("lastResult");await chrome.storage.session.set({activeRun:{id:run.id,startedAt:Date.now()}});
    log(`${c.dryRun?"REHEARSAL (no Create click)":"LIVE BOOKING AUTHORIZED"}: ${HKU.ROOMS.find(r=>r.id===c.roomId).name}, ${c.date}, ${c.start}-${c.end} HKT.`);
    await ensureLogin(run);
    if(c.mode==="scheduled" && Date.now()>plan.clickAt+c.late*1000)throw Error("The configured submission window passed while logging in. No booking will be attempted.");
    stage("Waiting to open the form",`Form preparation target: ${HKU.hkStamp(plan.openAt)}. Keep this companion window open.`,25);
    log(`Form open target: ${HKU.hkStamp(plan.openAt)}.`);
    if(c.mode==="scheduled")log(`Create target: ${HKU.hkStamp(plan.clickAt)}. CAPTCHA trigger target: ${HKU.hkStamp(plan.captchaAt)}.`);
    await waitUntil(plan.openAt,run);
    stage("Opening the reservation form","Loading a fresh form using the current Edge session.",35);
    bookingTabId=await openSite(HKU.reservationURL(c));
    await chrome.storage.session.set({bookingTabId});
    await waitForForm(bookingTabId,run);checkAbort(run);
    try{await chrome.scripting.executeScript({target:{tabId:bookingTabId},world:"MAIN",files:["response-bridge.js"]});}
    catch{log("Network response observer was unavailable. Visible HKU response text will still be checked.");}
    await message(bookingTabId,"HKU_FILL",{config:c});
    log("Student UID, contact number, room-user count, and agreement were filled. No Create click yet.");
    stage("Form prepared","Waiting for the CAPTCHA trigger and submission target.",50);
    const ready=await waitReady(c,plan,run);checkAbort(run);
    if(ready.rehearsal){
      stage("Rehearsal complete - nothing booked","The form is filled. Create was never clicked. Review the HKU tab; uncheck rehearsal for a real attempt.",100);
      log("REHEARSAL COMPLETE: no Create click or reservation POST was initiated by the extension.");
      $("countdown").textContent="TEST";return;
    }
    // Exactly one call. A timeout/navigation never triggers a second call.
    run.attempted=true;$("cancelBtn").disabled=true;
    const sentAt=Date.now();
    log(`Sending the one Create attempt at ${HKU.hkStamp(sentAt)} (${((sentAt-plan.clickAt)/1000).toFixed(3)}s from the target).`);
    let reply;
    try{reply=await message(bookingTabId,"HKU_SUBMIT",{config:c});}
    catch(e){
      if(/No Create click|No click|not verified|disabled|validation|changed after|no longer matches|no longer checked|Expected one/i.test(e.message))throw e;
      log(`Create acknowledgement unavailable: ${e.message}. Treating outcome as uncertain; never clicking again.`);
    }
    if(reply?.clicked)log(`Page helper dispatched Create at ${HKU.hkStamp(reply.at)}. This is not yet confirmation.`);
    if(reply?.alreadySubmitted)log("The page reported that this run already attempted submission. No duplicate click was sent.");
    $("countdown").textContent="SENT";
    await collectResult(run);
  }catch(e){
    const title=run.cancelled?"Attempt cancelled":run.attempted?"Submission needs inspection":"Stopped before submission";
    stage(title,e.message,100);log(e.message);$("countdown").textContent="STOP";
    flash(run.attempted?`${e.message} Check My Reservations before retrying; no second click will be sent.`:e.message);
  }finally{
    currentRun=null;busy(false);show("captchaBanner",false);await chrome.storage.session.remove("activeRun");
  }
}
async function openCalendar(){
  flash("");const room=HKU.ROOMS.find(r=>r.id===$("room").value);
  if(!$("date").value)throw Error("Choose a booking date first.");
  const u=new URL("schedule.php",HKU.BASE);u.search=new URLSearchParams({sid:room.sid,sd:$("date").value}).toString();
  calendarTabId=await openSite(u.href);
  $("availabilityNote").textContent="The live HKU calendar is open. Choose the room/date there if HKU ignores the URL filter. Click a bookable slot, then return here and select Use selected HKU slot. Or try Read slot links.";
}
async function readSlots(){
  if(!calendarTabId)throw Error("Open the live HKU calendar first.");
  const p=await probe(calendarTabId);if(!p?.authenticated)throw Error("Finish HKU login and load the calendar before reading slots.");
  const data=await message(calendarTabId,"HKU_READ_SLOTS",{config:{roomId:$("room").value,date:$("date").value}});
  $("slots").replaceChildren();
  for(const s of data.slots){const b=document.createElement("button");b.type="button";b.className="slot";b.textContent=`${s.start.slice(0,5)} - ${s.end.slice(0,5)}`;b.addEventListener("click",()=>applySlot(s));$("slots").append(b);}
  $("availabilityNote").textContent=data.slots.length?`${data.slots.length} selectable slot links read from this calendar at ${HKU.hkStamp(data.checkedAt)}. Availability can change; HKU validates the final request.`:"No readable slot links were exposed for that room/date. This does NOT mean no rooms are available. Use HKU's native calendar: click a bookable slot there, then Use selected HKU slot here.";
}
function applySlot(s){
  $("room").value=s.roomId;$("date").value=s.date;$("start").value=s.start.slice(0,5);$("end").value=s.end.slice(0,5);
  $("availabilityNote").textContent="Room and time imported from an actual HKU reservation URL. This is not a hold or guarantee of availability.";
}
async function importSlot(){
  const tabs=await chrome.tabs.query({url:HKU.BASE+"reservation/*"});
  const valid=tabs.map(t=>({tab:t,slot:HKU.parseReservationURL(t.url)})).filter(x=>x.slot);
  valid.sort((a,b)=>(b.tab.id===calendarTabId?1:0)-(a.tab.id===calendarTabId?1:0)||(b.tab.lastAccessed||0)-(a.tab.lastAccessed||0));
  if(!valid.length)throw Error("Click a slot in the live HKU calendar first, so its reservation form is open. Do not submit it. Then import the selection here.");
  applySlot(valid[0].slot);flash("Imported the selected HKU reservation slot. Review its room, date, and times before confirming.");
}
function safe(fn){return (...args)=>Promise.resolve().then(()=>fn(...args)).catch(e=>flash(e.message));}
$("portalBtn").addEventListener("click",safe(loginOnly));
$("reserveBtn").addEventListener("click",()=>{show("reservationSection");$("reservationSection").scrollIntoView({behavior:"smooth"});});
$("calendarBtn").addEventListener("click",safe(openCalendar));
$("readSlotsBtn").addEventListener("click",safe(readSlots));
$("importSlotBtn").addEventListener("click",safe(importSlot));
$("showTabBtn").addEventListener("click",safe(()=>focusTab()));$("solveBtn").addEventListener("click",safe(()=>focusTab()));
$("cancelBtn").addEventListener("click",()=>{if(currentRun&&!currentRun.attempted){currentRun.cancelled=true;$("cancelBtn").disabled=true;log("Cancellation requested. No further automated submission will be sent.");}});
$("bookingForm").addEventListener("submit",e=>{
  e.preventDefault();flash("");
  try{
    const c=readConfig();HKU.validate(c);preparedConfig=c;const p=HKU.plan(c);
    const room=HKU.ROOMS.find(r=>r.id===c.roomId);
    $("reviewTitle").textContent=c.dryRun?"Review rehearsal - no booking":"Review live booking";
    $("reviewSummary").textContent=`Room: ${room.name}\nBooking: ${c.date}, ${c.start}-${c.end} HKT\nPeople: ${c.people}\nMode: ${c.dryRun?"REHEARSAL - never click Create":"LIVE - one Create attempt"}\n${c.mode==="scheduled"?`Open form: ${HKU.hkStamp(p.openAt)}\nCreate target: ${HKU.hkStamp(p.clickAt)}`:"Prepare immediately after login check; submit after CAPTCHA is ready."}\nLate CAPTCHA allowance: ${c.late} seconds\nYour UID and phone will be entered on HKU's form.`;
    $("reviewStart").textContent=c.dryRun?"Confirm rehearsal":"Confirm & arm booking";
    $("reviewDialog").showModal();
  }catch(err){flash(err.message);}
});
$("reviewBack").addEventListener("click",()=>$("reviewDialog").close());
$("reviewStart").addEventListener("click",()=>{const c=preparedConfig;$("reviewDialog").close();if(c&&!currentRun)runBooking(c).catch(e=>flash(e.message));});
$("mode").addEventListener("change",()=>{const now=$("mode").value==="now";$("releaseDate").disabled=now;$("releaseTime").disabled=now;});
for(const id of ["room","date"]){$(id).addEventListener("change",()=>{$("slots").replaceChildren();$("availabilityNote").textContent="Selection changed. Check HKU's live calendar for this room/date; no availability is assumed.";});}
$("exportBtn").addEventListener("click",()=>{
  const text=logs.join("\n")+(lastResult?"\n\nSITE RESPONSE:\n"+lastResult.text:"");
  const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=`HKU-booking-log-${HKU.hkParts().date}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("clearBtn").addEventListener("click",safe(async()=>{
  if(currentRun)throw Error("Cancel the active attempt before clearing details.");
  await logWrite;await chrome.storage.local.clear();logs=[];lastResult=null;$("uid").value="";$("phone").value="";$("log").textContent="";show("resultSection",false);flash("Extension details and saved log cleared. This does not log you out of HKU in Edge.");
}));
window.addEventListener("beforeunload",e=>{if(currentRun&&!currentRun.attempted){e.preventDefault();e.returnValue="";}});
async function init(){
  for(const room of HKU.ROOMS){const opt=document.createElement("option");opt.value=room.id;opt.textContent=room.name;$("room").append(opt);}
  $("date").value=HKU.hkParts(Date.now()+5*86400000).date;$("releaseDate").value=HKU.hkParts().date;
  const data=await chrome.storage.local.get(["preferences","progressLog","lastResult"]);
  if(data.preferences)for(const id of formKeys)if(data.preferences[id]!==undefined){if($(id).type==="checkbox")$(id).checked=data.preferences[id];else $(id).value=data.preferences[id];}
  $("mode").dispatchEvent(new Event("change"));
  // Every newly opened UI defaults to rehearsal, regardless of the previous run.
  $("dryRun").checked=true;
  if(data.progressLog?.length){logs=data.progressLog;$("log").textContent=logs.join("\n");show("progressSection");stage("Previous session log","No task is automatically resumed. Review settings before starting a new attempt.",100);}
  if(data.lastResult)await showResult(data.lastResult,"Previous response");
  const session=await chrome.storage.session.get(["bookingTabId"]);bookingTabId=session.bookingTabId||null;
  busy(false);
  const clock=()=>{$("clock").textContent=HKU.hkStamp().replace(/\.\d{3}/,"");};clock();setInterval(clock,1000);
}
init().catch(e=>flash(e.message));
