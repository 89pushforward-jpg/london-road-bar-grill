/* BookingWidget — reusable slot-booking front-end (demo mode: localStorage)
 * Production: swap Store for a REST backend (see SKILL.md).
 * API: BookingWidget.init(config)
 */
(function (global) {
  'use strict';

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  /* ---- storage layer (demo: localStorage; replace with fetch() in production) ---- */
  function Store(key) {
    this.key = key;
    this.load = () => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } };
    this.save = (data) => localStorage.setItem(key, JSON.stringify(data));
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtTime(dec) { return pad(Math.floor(dec)) + ':' + pad(Math.round((dec % 1) * 60)); }

  const Widget = {
    cfg: null,
    store: null,
    selDate: null,
    selSlot: null,

    init(cfg) {
      this.cfg = Object.assign({
        el: '#booking',
        business: 'Demo Business',
        storageKey: 'bookings-demo',
        slotMinutes: 30,
        capacityPerSlot: 3,
        partyMax: 10,
        daysAhead: 21,
        hours: { 0: null, 1: [17, 22], 2: [17, 22], 3: [17, 22], 4: [17, 22], 5: [17, 22], 6: [17, 22] },
        labels: { book: 'Book a table', party: 'Guests', note: 'Any requests? (optional)' },
        seed: true
      }, cfg);
      this.store = new Store(this.cfg.storageKey);
      if (this.cfg.seed) this.seedDemo();
      this.root = document.querySelector(this.cfg.el);
      if (!this.root) return;
      this.render();
      // live-refresh when kitchen confirms in another tab
      window.addEventListener('storage', (e) => { if (e.key === this.cfg.storageKey) this.render(); });
    },

    /* pre-populate some realistic bookings so the calendar looks alive */
    seedDemo() {
      const data = this.store.load();
      if (data.__seeded) return;
      const names = ['Walker party', 'Ahmed x4', 'Birthday — Claire', 'Patel x2', 'Anniversary table', 'Jones x6'];
      const out = { __seeded: true };
      for (let i = 0; i < this.cfg.daysAhead; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        const hrs = this.cfg.hours[d.getDay()];
        if (!hrs) continue;
        const slots = [];
        for (let t = hrs[0]; t < hrs[1]; t += this.cfg.slotMinutes / 60) slots.push(t);
        // book a few random slots to capacity, some partially
        slots.forEach((t, idx) => {
          const rnd = (i * 7 + idx * 13) % 10; // deterministic pseudo-random
          if (rnd < 2) {
            const k = dateKey(d) + 'T' + fmtTime(t);
            const n = rnd === 0 ? this.cfg.capacityPerSlot : 1 + (idx % 2);
            out[k] = { bookings: [] };
            for (let b = 0; b < n; b++) {
              out[k].bookings.push({ id: 'seed-' + i + '-' + idx + '-' + b, name: names[(i + idx + b) % names.length], party: 2 + ((idx + b) % 4), status: 'confirmed', phone: '', email: '', seeded: true });
            }
          }
        });
      }
      this.store.save(out);
    },

    slotState(k) {
      const data = this.store.load();
      const entry = data[k];
      if (!entry) return { free: this.cfg.capacityPerSlot, pending: 0, confirmed: 0 };
      const confirmed = entry.bookings.filter(b => b.status === 'confirmed').length;
      const pending = entry.bookings.filter(b => b.status === 'pending').length;
      return { free: Math.max(0, this.cfg.capacityPerSlot - confirmed - pending), pending, confirmed };
    },

    render() {
      const c = this.cfg;
      this.root.classList.add('bw');
      this.root.innerHTML =
        '<div class="bw-head"><h3>' + c.labels.book + '</h3>' +
        '<p>Pick a day, choose a free time, and we’ll confirm your booking by email.</p></div>' +
        '<div class="bw-legend"><span><i class="bw-dot bw-free"></i>Available</span><span><i class="bw-dot bw-some"></i>Filling up</span><span><i class="bw-dot bw-full"></i>Fully booked</span></div>' +
        '<div class="bw-days" id="bw-days"></div>' +
        '<div class="bw-slots" id="bw-slots"></div>' +
        '<form class="bw-form" id="bw-form" style="display:none"></form>' +
        '<div class="bw-done" id="bw-done" style="display:none"></div>';
      this.renderDays();
    },

    renderDays() {
      const wrap = this.root.querySelector('#bw-days');
      wrap.innerHTML = '';
      for (let i = 0; i < this.cfg.daysAhead; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        const hrs = this.cfg.hours[d.getDay()];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bw-day' + (hrs ? '' : ' bw-closed');
        btn.innerHTML = '<b>' + DAY_NAMES[d.getDay()] + '</b><span>' + d.getDate() + '</span><small>' + MONTHS[d.getMonth()].slice(0, 3) + '</small>';
        if (!hrs) { btn.disabled = true; btn.title = 'Closed'; }
        else btn.addEventListener('click', () => { this.selDate = new Date(d); this.markSel(wrap, btn); this.renderSlots(); });
        wrap.appendChild(btn);
      }
    },

    markSel(wrap, btn) {
      wrap.querySelectorAll('.bw-sel').forEach(x => x.classList.remove('bw-sel'));
      btn.classList.add('bw-sel');
    },

    renderSlots() {
      const wrap = this.root.querySelector('#bw-slots');
      const form = this.root.querySelector('#bw-form');
      const done = this.root.querySelector('#bw-done');
      form.style.display = 'none'; done.style.display = 'none';
      const d = this.selDate;
      const hrs = this.cfg.hours[d.getDay()];
      wrap.innerHTML = '<h4>' + DAY_NAMES[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' — choose a time</h4><div class="bw-grid"></div>';
      const grid = wrap.querySelector('.bw-grid');
      const now = new Date();
      for (let t = hrs[0]; t < hrs[1]; t += this.cfg.slotMinutes / 60) {
        const k = dateKey(d) + 'T' + fmtTime(t);
        const st = this.slotState(k);
        const isPast = dateKey(d) === dateKey(now) && t <= now.getHours() + now.getMinutes() / 60;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bw-slot ' + (st.free === 0 ? 'bw-full' : (st.free < this.cfg.capacityPerSlot ? 'bw-some' : 'bw-free'));
        b.innerHTML = fmtTime(t) + (st.free === 0 ? '<small>Full</small>' : '<small>' + st.free + ' table' + (st.free > 1 ? 's' : '') + ' left</small>');
        if (st.free === 0 || isPast) b.disabled = true;
        else b.addEventListener('click', () => { this.selSlot = { key: k, label: fmtTime(t) }; grid.querySelectorAll('.bw-sel').forEach(x => x.classList.remove('bw-sel')); b.classList.add('bw-sel'); this.renderForm(); });
        grid.appendChild(b);
      }
    },

    renderForm() {
      const form = this.root.querySelector('#bw-form');
      const c = this.cfg;
      form.style.display = 'block';
      let opts = '';
      for (let i = 1; i <= c.partyMax; i++) opts += '<option' + (i === 2 ? ' selected' : '') + '>' + i + '</option>';
      form.innerHTML =
        '<h4>Your details — ' + this.selSlot.label + '</h4>' +
        '<div class="bw-row"><label>Name<input required name="name" placeholder="John Smith"></label>' +
        '<label>' + c.labels.party + '<select name="party">' + opts + '</select></label></div>' +
        '<div class="bw-row"><label>Phone<input required type="tel" name="phone" placeholder="07__ ______"></label>' +
        '<label>Email<input required type="email" name="email" placeholder="you@email.com"></label></div>' +
        '<label>' + c.labels.note + '<input name="note" placeholder="e.g. window table, birthday"></label>' +
        '<button type="submit" class="bw-submit">Request Booking</button>' +
        '<p class="bw-hint">You’ll get an email as soon as we confirm — usually within minutes during opening hours.</p>';
      form.onsubmit = (e) => { e.preventDefault(); this.submit(new FormData(form)); };
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    submit(fd) {
      const data = this.store.load();
      const k = this.selSlot.key;
      if (!data[k]) data[k] = { bookings: [] };
      const booking = {
        id: 'b-' + Date.now(),
        name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'),
        party: +fd.get('party'), note: fd.get('note') || '',
        status: 'pending', created: new Date().toISOString(), slot: k
      };
      data[k].bookings.push(booking);
      this.store.save(data);
      const done = this.root.querySelector('#bw-done');
      this.root.querySelector('#bw-form').style.display = 'none';
      done.style.display = 'block';
      done.innerHTML =
        '<div class="bw-card"><span class="bw-check">⏳</span><h4>Request received!</h4>' +
        '<p>Your booking for <b>' + booking.party + '</b> at <b>' + this.selSlot.label + '</b> is waiting for confirmation.</p>' +
        '<div class="bw-mail">📧 <b>Email sent to ' + booking.email + ':</b><br>"Thanks ' + booking.name.split(' ')[0] + '! We’ve received your booking request for ' + this.selSlot.label + '. You’ll get a confirmation email as soon as the team accepts it."</div>' +
        '<div class="bw-mail">📧 <b>Email sent to the kitchen:</b><br>"New booking request: ' + booking.name + ', party of ' + booking.party + ', ' + k.replace('T', ' at ') + '. Confirm or decline in the dashboard."</div>' +
        '</div>';
      this.renderSlots0keep();
    },

    renderSlots0keep() { /* refresh slot colors without clearing confirmation */
      const d = this.selDate;
      if (!d) return;
      const grid = this.root.querySelector('.bw-grid');
      if (!grid) return;
      const hrs = this.cfg.hours[d.getDay()];
      let i = 0;
      for (let t = hrs[0]; t < hrs[1]; t += this.cfg.slotMinutes / 60) {
        const k = dateKey(d) + 'T' + fmtTime(t);
        const st = this.slotState(k);
        const b = grid.children[i++];
        if (!b) continue;
        b.className = 'bw-slot ' + (st.free === 0 ? 'bw-full' : (st.free < this.cfg.capacityPerSlot ? 'bw-some' : 'bw-free'));
        b.innerHTML = fmtTime(t) + (st.free === 0 ? '<small>Full</small>' : '<small>' + st.free + ' table' + (st.free > 1 ? 's' : '') + ' left</small>');
        if (st.free === 0) b.disabled = true;
      }
    }
  };

  global.BookingWidget = Widget;
})(window);
