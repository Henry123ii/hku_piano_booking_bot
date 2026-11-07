/* Page-world observer. Never modifies requests, credentials, or responses. */
(() => {
  if (window.__hkuPianoResponseObserver) return;
  window.__hkuPianoResponseObserver=true;
  let until=0;
  document.addEventListener("hku-piano-arm-response",()=>{until=Date.now()+45000;});
  const eligible=(method,url)=>{
    try { const u=new URL(url,location.href); return Date.now()<until && String(method).toUpperCase()==="POST" && u.origin===location.origin && u.pathname.startsWith("/fbs/centralbook/book/Web/"); }
    catch {return false;}
  };
  function emit(data) {
    const text=String(data.body||"");
    const detail={...data,body:text.slice(0,60000),truncated:text.length>60000,at:Date.now()};
    document.dispatchEvent(new CustomEvent("hku-piano-response",{detail:JSON.stringify(detail)}));
  }
  const open=XMLHttpRequest.prototype.open, send=XMLHttpRequest.prototype.send;
  const meta=new WeakMap();
  XMLHttpRequest.prototype.open=function(method,url,...rest){meta.set(this,{method,url:String(url)});return open.call(this,method,url,...rest);};
  XMLHttpRequest.prototype.send=function(...args){
    const m=meta.get(this);
    if (m && eligible(m.method,m.url)) this.addEventListener("loadend",()=>{
      let body="";
      try { body=(!this.responseType || this.responseType==="text")?this.responseText:JSON.stringify(this.response); } catch {}
      emit({source:"XHR POST",status:this.status,url:this.responseURL||m.url,body});
    },{once:true});
    return send.apply(this,args);
  };
  const originalFetch=window.fetch;
  window.fetch=function(input,init){
    const url=typeof input==="string"?input:input?.url||String(input);
    const capture=eligible(init?.method || input?.method || "GET",url);
    const promise=originalFetch.apply(this,arguments);
    if (capture) promise.then(r=>r.clone().text().then(body=>emit({source:"fetch POST",status:r.status,url:r.url||url,body})).catch(()=>{})).catch(()=>{});
    return promise;
  };
  const originalAlert=window.alert;
  window.alert=function(message){if(Date.now()<until)emit({source:"Browser alert",status:null,url:location.href,body:String(message)});return originalAlert.call(this,message);};
})();
