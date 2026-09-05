// Open/closed status in America/Los_Angeles, rendered into [data-status="<officeId>"].
// The static hours table is always on the page; this only adds today's status.
(function () {
  var OFFICES = window.HH_OFFICES || [];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function nowInLA(date) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date || new Date());
    var map = {}; parts.forEach(function (p) { map[p.type] = p.value; });
    var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
    return { day: day, minutes: (parseInt(map.hour, 10) % 24) * 60 + parseInt(map.minute, 10) };
  }
  function toMin(hhmm) { var a = hhmm.split(':'); return parseInt(a[0], 10) * 60 + parseInt(a[1], 10); }
  function fmt(hhmm) { var m = toMin(hhmm), h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + (mm ? ':' + (mm < 10 ? '0' + mm : mm) : '') + ' ' + ap; }
  function status(office, date) {
    var t = nowInLA(date), ranges = office.hours[String(t.day)] || [];
    for (var i = 0; i < ranges.length; i++) {
      var s = toMin(ranges[i][0]), e = toMin(ranges[i][1]);
      if (t.minutes >= s && t.minutes < e) return { open: true, text: 'Open now, closes ' + fmt(ranges[i][1]) };
      if (t.minutes < s) return { open: false, text: 'Closed, opens today ' + fmt(ranges[i][0]) };
    }
    for (var d = 1; d <= 7; d++) {
      var day = (t.day + d) % 7, r = office.hours[String(day)];
      if (r && r.length) return { open: false, text: 'Closed, opens ' + (d === 1 ? 'tomorrow' : DAYS[day]) + ' ' + fmt(r[0][0]) };
    }
    return { open: false, text: 'Closed' };
  }
  function render(date) {
    OFFICES.forEach(function (o) {
      var st = status(o, date);
      var els = document.querySelectorAll('[data-status="' + o.id + '"]');
      for (var i = 0; i < els.length; i++) { els[i].textContent = st.text; els[i].setAttribute('data-open', st.open ? 'true' : 'false'); els[i].hidden = false; }
    });
  }
  window.hhStatus = function (id, date) { var o = OFFICES.filter(function (x) { return x.id === id; })[0]; return o ? status(o, date) : null; };
  window.hhRender = render;
  try { render(); } catch (e) {}
})();
