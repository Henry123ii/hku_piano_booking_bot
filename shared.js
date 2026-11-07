/* Shared, dependency-free helpers. All displayed booking times are Hong Kong time. */
(function (root) {
  "use strict";
  const BASE = "https://hkufbs.hku.hk/fbs/centralbook/book/Web/";
  const ROOMS = [
    {id: "2871", sid: "421", name: "FSCAC Music Room 108"},
    {id: "2873", sid: "421", name: "FSCAC Music Room 109"},
    {id: "2889", sid: "432", name: "CYMAC Music Room"}
  ];
  function hkParts(ms = Date.now()) {
    const d = new Date(ms + 8 * 3600000);
    return {date: d.toISOString().slice(0,10), time: d.toISOString().slice(11,19)};
  }
  function hkStamp(ms = Date.now()) {
    const p = hkParts(ms);
    return `${p.date} ${p.time}.${String(new Date(ms).getUTCMilliseconds()).padStart(3,"0")} HKT`;
  }
  function timeValue(s) {
    const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s));
    if (!m || +m[1]>23 || +m[2]>59 || +(m[3]||0)>59) throw Error("Use a valid 24-hour time.");
    return `${m[1]}:${m[2]}:${m[3]||"00"}`;
  }
  function hkEpoch(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error("Choose a valid date.");
    const stamp = Date.parse(`${date}T${timeValue(time)}+08:00`);
    if (!Number.isFinite(stamp) || hkParts(stamp).date !== date) throw Error("Choose a real calendar date.");
    return stamp;
  }
  function reservationURL(c) {
    const room = ROOMS.find(r => r.id === c.roomId);
    if (!room) throw Error("Choose one of the configured rooms.");
    const u = new URL("reservation/", BASE);
    u.search = new URLSearchParams({rid:room.id, sid:room.sid, rd:c.date,
      sd:`${c.date} ${timeValue(c.start)}`, ed:`${c.date} ${timeValue(c.end)}`}).toString();
    return u.href;
  }
  function parseReservationURL(value) {
    try {
      const u = new URL(value, BASE), p = u.searchParams;
      if (u.origin !== new URL(BASE).origin || !/\/reservation\/?$/.test(u.pathname)) return null;
      const room = ROOMS.find(r => r.id===p.get("rid") && r.sid===p.get("sid"));
      const sd = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(p.get("sd")||"");
      const ed = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(p.get("ed")||"");
      if (!room || !sd || !ed || sd[1]!==ed[1]) return null;
      if (hkEpoch(sd[1],ed[2])<=hkEpoch(sd[1],sd[2])) return null;
      return {roomId:room.id, date:sd[1], start:timeValue(sd[2]), end:timeValue(ed[2])};
    } catch { return null; }
  }
  function validate(c, now=Date.now()) {
    if (!ROOMS.some(r=>r.id===c.roomId)) throw Error("Select a room.");
    if (!String(c.uid||"").trim() || !String(c.phone||"").trim()) throw Error("Enter your student UID and contact number.");
    if (!Number.isInteger(+c.people) || +c.people<1) throw Error("Room users must be a positive whole number.");
    const start=hkEpoch(c.date,c.start), end=hkEpoch(c.date,c.end);
    if (end<=start) throw Error("End time must be later than start time on the same day.");
    if (end<=now) throw Error("The requested booking is in the past.");
    for (const [k,min,max] of [["early",5,300],["offset",0,300],["captchaLead",0,120],["late",0,300]]) {
      if (!Number.isFinite(+c[k]) || +c[k]<min || +c[k]>max) throw Error(`Invalid ${k} setting (${min} to ${max} seconds).`);
    }
    if (c.mode!=="scheduled" && c.mode!=="now") throw Error("Choose a run mode.");
    if (c.mode==="scheduled") {
      const release = hkEpoch(c.releaseDate,c.releaseTime);
      if (release + +c.offset*1000 < now) throw Error("The submission time has passed. Choose a later release date/time, or Prepare now.");
      if (release + +c.offset*1000 >= start) throw Error("Submission must be before the room booking starts.");
    }
    return true;
  }
  function plan(c, now=Date.now()) {
    const release = c.mode==="now" ? now : hkEpoch(c.releaseDate,c.releaseTime);
    return {release, openAt:c.mode==="now"?now:release-(+c.early*1000),
      clickAt:release+(+c.offset*1000), captchaAt:c.mode==="now"?now:release-(+c.captchaLead*1000)};
  }
  function classify(text) {
    // Only classify the response text, never the entire booking page.
    const t=String(text||"");
    if (/\b(?:failed|failure|error|conflict|unavailable|already booked|could not be made|not permitted|not allowed|invalid|expired)\b/i.test(t)) return "rejected";
    if (/\b(?:pending approval|requires approval|awaiting approval)\b/i.test(t)) return "pending";
    if (/\breservation\s+(?:was\s+|has been\s+)?(?:successfully\s+)?(?:created|confirmed|saved)\b|\bbooking\s+(?:was\s+|has been\s+)?(?:successfully\s+)?confirmed\b|\b(?:reservation|booking)\s+(?:created|saved)\s+successfully\b/i.test(t)) return "success";
    return "response";
  }
  root.HKU = {BASE,ROOMS,hkParts,hkStamp,timeValue,hkEpoch,reservationURL,parseReservationURL,validate,plan,classify};
  if (typeof module !== "undefined") module.exports = root.HKU;
})(typeof globalThis !== "undefined" ? globalThis : this);
