import { ORGAN_GROUPS } from './config.js';

// Pure DOM updater. `state` is passed in each frame.
export class HUD {
  constructor() {
    this.killEl = document.getElementById('kill-count');
    this.dayEl = document.getElementById('day-count');
    this.timeEl = document.getElementById('time-of-day');
    this.weaponName = document.getElementById('weapon-name');
    this.ammoMag = document.getElementById('ammo-mag');
    this.ammoReserve = document.getElementById('ammo-reserve');
    this.attachmentsEl = document.getElementById('attachments');
    this.prompt = document.getElementById('prompt');
    this.toast = document.getElementById('toast');
    this.compassStrip = document.getElementById('compass-strip');
    this.crosshair = document.getElementById('crosshair');
    this.hudRoot = document.getElementById('hud');

    this._toastTimer = 0;
    this._lastHit = 0;
    this._setupCompass();
  }

  _setupCompass() {
    // Label cardinal directions every 90 degrees along a 720px-wide strip.
    const strip = this.compassStrip;
    strip.innerHTML = '';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const w = 720; // maps to 360 degrees of rotation (2px per degree)
    for (let rep = -1; rep <= 1; rep++) {
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('span');
        el.textContent = dirs[i];
        el.style.left = `${rep * w + i * (w / 8)}px`;
        strip.appendChild(el);
      }
    }
    strip.style.width = `${w * 3}px`;
  }

  updateCompass(yaw) {
    const deg = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const px = deg * 2;
    const offset = -px + 130;
    this.compassStrip.style.transform = `translateX(${offset}px)`;
  }

  updateClock(day, timeStr) {
    this.dayEl.textContent = String(day);
    this.timeEl.textContent = timeStr;
  }

  updateKills(n) {
    this.killEl.textContent = String(n);
  }

  updateWeapon(weapon, ads) {
    if (!weapon) {
      this.weaponName.textContent = '—';
      this.ammoMag.textContent = '0';
      this.ammoReserve.textContent = '0';
      this.attachmentsEl.innerHTML = '';
      return;
    }
    this.weaponName.textContent = weapon.def.displayName;
    this.ammoMag.textContent = weapon.reloading > 0 ? '…' : String(weapon.mag);
    this.ammoReserve.textContent = String(weapon.reserve);

    // Attachment chips
    const slots = weapon.def.slots;
    this.attachmentsEl.innerHTML = slots.map(slot => {
      const id = weapon.attachments[slot];
      const label = id ? `[${slot.toUpperCase()}] ${shortName(id)}` : `[${slot.toUpperCase()}] —`;
      return `<span class="att ${id ? 'on' : ''}">${label}</span>`;
    }).join('');

    this.crosshair.classList.toggle('hidden-ads', ads);
  }

  updateVitals(bearHits) {
    // Aggregate organ HP fractions by group.
    // 'bearHits' is player's own "body" — we use it to show player's health as brain placeholder?
    // Simpler: vitals panel shows the *player's* organs. We don't simulate player organs,
    // so we just show health across all bars — BUT the user specifically wanted an organ
    // system that responds to *where bullets hit*. So the vitals panel represents the
    // most-recently-damaged bear so the player gets visual feedback.
    const groups = Object.keys(ORGAN_GROUPS);
    for (const g of groups) {
      const el = document.querySelector(`.organ[data-organ="${g}"] .fill`);
      if (!el) continue;
      let frac = 1;
      if (bearHits) {
        const keys = ORGAN_GROUPS[g];
        let hp = 0, max = 0;
        for (const k of keys) {
          hp += bearHits.organs[k].hp;
          max += bearHits.organs[k].max;
        }
        frac = max > 0 ? hp / max : 1;
      }
      el.style.width = `${Math.max(0, frac * 100)}%`;
    }
  }

  updateNeeds(needs) {
    for (const name of Object.keys(needs)) {
      const el = document.querySelector(`.need[data-need="${name}"] .fill`);
      if (!el) continue;
      const v = Math.max(0, Math.min(100, needs[name]));
      el.style.width = `${v}%`;
      if (name === 'bloodlust') {
        // Bloodlust fill color ramps red
        el.style.background = v > 75 ? '#ff5a66' : '#b5454d';
      }
    }
  }

  showPrompt(text) {
    this.prompt.textContent = text;
    this.prompt.classList.remove('hidden');
  }
  hidePrompt() {
    this.prompt.classList.add('hidden');
  }

  toastMessage(text, kind = '') {
    this.toast.textContent = text;
    this.toast.className = '';
    if (kind) this.toast.classList.add(kind);
    this.toast.classList.add('show');
    this._toastTimer = 2.2;
  }

  tick(dt) {
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.toast.classList.remove('show');
    }
    if (this._lastHit > 0) {
      this._lastHit -= dt;
      if (this._lastHit <= 0) this.hudRoot.classList.remove('hit');
    }
  }

  flashHit() {
    this.hudRoot.classList.add('hit');
    this._lastHit = 0.35;
  }
}

function shortName(id) {
  const map = {
    redDot: 'RedDot',
    scope: 'Scope',
    suppressor: 'Supp',
    compensator: 'Comp',
    heavyBarrel: 'Heavy',
    extendedMag: 'ExtMag',
    laserSight: 'Laser',
  };
  return map[id] || id;
}
