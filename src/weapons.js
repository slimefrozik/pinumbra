import * as THREE from 'three';
import { WEAPONS, ATTACHMENTS } from './config.js';

// A weapon *instance* owned by the player. Tracks ammo, attachments, fire state.
export class Weapon {
  constructor(defId) {
    this.def = WEAPONS[defId];
    this.id = defId;
    this.attachments = { optic: null, muzzle: null, mag: null, laser: null, barrel: null };
    this.mag = this.magCapacity();
    this.reserve = Math.floor(this.def.reserveMax * 0.5);
    this.fireCooldown = 0;
    this.reloading = 0; // seconds remaining
  }

  magCapacity() {
    const att = this.attachments.mag ? ATTACHMENTS[this.attachments.mag] : null;
    const mul = att?.magMul ?? 1;
    return Math.round(this.def.magSize * mul);
  }

  // Returns effective ballistic stats factoring in attachments.
  stats() {
    let damage = this.def.damage;
    let recoil = this.def.recoil;
    let spreadHip = this.def.spreadHip;
    let spreadAds = this.def.spreadAds;
    let range = this.def.range;
    let adsZoom = this.def.adsZoom;
    let stealth = 1.0;

    for (const slot of Object.keys(this.attachments)) {
      const aid = this.attachments[slot];
      if (!aid) continue;
      const a = ATTACHMENTS[aid];
      if (a.damageMul) damage *= a.damageMul;
      if (a.recoilMul) recoil *= a.recoilMul;
      if (a.rangeMul) range *= a.rangeMul;
      if (a.adsSpread) spreadAds *= a.adsSpread;
      if (a.hipSpread) spreadHip *= a.hipSpread;
      if (a.adsZoomMul) adsZoom *= a.adsZoomMul;
      if (a.stealth) stealth *= a.stealth;
    }

    return { damage, recoil, spreadHip, spreadAds, range, adsZoom, stealth };
  }

  canFire() {
    return this.mag > 0 && this.fireCooldown <= 0 && this.reloading <= 0;
  }

  fire() {
    if (!this.canFire()) return false;
    this.mag -= 1;
    this.fireCooldown = 60 / this.def.rpm;
    return true;
  }

  startReload() {
    if (this.reloading > 0) return;
    if (this.reserve <= 0) return;
    if (this.mag === this.magCapacity()) return;
    this.reloading = this.def.reloadTime;
  }

  tick(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        const cap = this.magCapacity();
        const need = cap - this.mag;
        const use = Math.min(need, this.reserve);
        this.mag += use;
        this.reserve -= use;
      }
    }
  }

  giveAmmo(n) {
    this.reserve = Math.min(this.def.reserveMax, this.reserve + n);
  }

  mount(attachmentId) {
    const a = ATTACHMENTS[attachmentId];
    if (!a) return false;
    if (!this.def.slots.includes(a.slot)) return false;
    this.attachments[a.slot] = a.id;
    // Ensure mag still valid
    if (this.mag > this.magCapacity()) this.mag = this.magCapacity();
    return true;
  }

  unmount(slot) {
    this.attachments[slot] = null;
    if (this.mag > this.magCapacity()) this.mag = this.magCapacity();
  }
}

// Small viewmodel: a flat "gun mesh" attached to the camera, visible bottom-right.
export class WeaponViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.position.set(0.35, -0.28, -0.6);
    this._bodies = new Map();
    this._buildAll();
    camera.add(this.group);
    this.current = null;
  }

  _buildAll() {
    // Stylized low-poly silhouettes.
    const mats = {
      body: new THREE.MeshLambertMaterial({ color: 0x1e2530 }),
      accent: new THREE.MeshLambertMaterial({ color: 0x3a4654 }),
      dark: new THREE.MeshLambertMaterial({ color: 0x0f1419 }),
    };

    // Pistol
    {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.26), mats.body);
      body.position.set(0, 0, 0);
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.3), mats.accent);
      slide.position.set(0, 0.07, 0.02);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), mats.dark);
      grip.position.set(0, -0.11, -0.08);
      g.add(body, slide, grip);
      this._bodies.set('pistol', g);
    }
    // Rifle
    {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.7), mats.body);
      body.position.set(0, 0, 0.05);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.22), mats.accent);
      stock.position.set(0, 0, -0.3);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 10), mats.dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, 0.55);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.08), mats.dark);
      mag.position.set(0, -0.12, 0.05);
      g.add(body, stock, barrel, mag);
      this._bodies.set('rifle', g);
    }
    // Shotgun
    {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.8), mats.body);
      body.position.set(0, 0, 0.1);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 10), mats.dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03, 0.6);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 10), mats.accent);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, -0.02, 0.5);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.25), mats.accent);
      stock.position.set(0, -0.02, -0.3);
      g.add(body, barrel, tube, stock);
      this._bodies.set('shotgun', g);
    }

    for (const m of this._bodies.values()) {
      m.visible = false;
      this.group.add(m);
    }
  }

  show(weaponId) {
    for (const [id, mesh] of this._bodies) {
      mesh.visible = (id === weaponId);
    }
    this.current = weaponId;
  }

  setAds(on) {
    // Shift gun toward center when aiming down sights.
    const target = on ? new THREE.Vector3(0, -0.18, -0.45) : new THREE.Vector3(0.35, -0.28, -0.6);
    this.group.position.lerp(target, 0.35);
  }

  kick(amount) {
    this.group.position.z += amount * 0.05;
    this.group.rotation.x -= amount * 0.06;
  }

  tick(dt) {
    // Spring back from recoil.
    this.group.rotation.x = THREE.MathUtils.damp(this.group.rotation.x, 0, 12, dt);
  }
}
