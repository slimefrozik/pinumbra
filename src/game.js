import * as THREE from 'three';

import { Input } from './input.js';
import { Player } from './player.js';
import { Weapon, WeaponViewModel } from './weapons.js';
import { Bear } from './bears.js';
import { World } from './world.js';
import { HUD } from './hud.js';
import { BEAR, WEAPONS, ATTACHMENTS, PLAYER, WORLD } from './config.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;
    this.time = 0;
    this.onDeath = null;

    this.renderer = null;
    this.scene = null;
    this.camera = null;

    this.world = null;
    this.input = null;
    this.player = null;
    this.hud = null;
    this.viewModel = null;

    this.weapons = {};       // id -> Weapon
    this.currentWeaponId = 'pistol';
    this.selectedAttSlot = 0;

    this.bears = [];
    this.bearRespawnTimer = 0;

    // Muzzle flash / tracers
    this.tracers = []; // {line, t}
    this.hitMarkers = []; // small blood puffs
    this.lastDamagedBear = null;

    this._promptTarget = null;
  }

  initScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 800);
    this.scene.add(this.camera);

    this.world = new World(this.scene);
    this.input = new Input(this.canvas);
    this.player = new Player(this.camera);
    this.hud = new HUD();

    this.viewModel = new WeaponViewModel(this.camera);
    this.weapons.pistol = new Weapon('pistol');
    this.weapons.rifle = new Weapon('rifle');
    this.weapons.shotgun = new Weapon('shotgun');

    this._spawnBears();

    window.addEventListener('resize', () => this._onResize());
    window.addEventListener('contextmenu', (e) => {
      if (this.input.locked) e.preventDefault();
    });

    // Hold-to-sprint friendly menu: move camera slowly for menu backdrop.
    this._menuT = 0;
  }

  start() {
    this.running = true;
    this.input.requestLock();
  }

  reset() {
    // Remove bears
    for (const b of this.bears) this.scene.remove(b.group);
    this.bears = [];
    this.lastDamagedBear = null;

    // Remove loot and respawn initial set
    for (const l of this.world.loot.slice()) {
      this.world.consumeLoot(l);
    }
    this.world._buildInitialLoot();

    // Reset weapons (but keep attachments unlocked in player inventory for QoL)
    const keepAtts = this.player?.inventory?.attachments ?? new Set();
    this.weapons.pistol = new Weapon('pistol');
    this.weapons.rifle = new Weapon('rifle');
    this.weapons.shotgun = new Weapon('shotgun');

    this.player.reset();
    this.player.inventory.attachments = keepAtts;
    this.currentWeaponId = 'pistol';
    this.time = 0;
    this.world._dayFraction = 0.29; // 7:00am
    this.world.day = 1;
    this._spawnBears();
  }

  _spawnBears() {
    for (let i = 0; i < BEAR.spawnCount; i++) {
      this._spawnBear();
    }
  }

  _spawnBear() {
    const bear = new Bear();
    // Place 25-120m from player, randomly.
    const theta = Math.random() * Math.PI * 2;
    const r = 25 + Math.random() * 95;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    bear.group.position.set(x, this.world.heightAt(x, z), z);
    this.scene.add(bear.group);
    this.bears.push(bear);
  }

  loop() {
    let last = performance.now();
    const frame = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (this.running) this._tick(dt);
      else this._menuTick(dt);

      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  _menuTick(dt) {
    // Gentle camera orbit to show the world on the main menu.
    this._menuT += dt * 0.08;
    const r = 12;
    this.camera.position.set(Math.cos(this._menuT) * r, 2.6, Math.sin(this._menuT) * r);
    this.camera.lookAt(0, 1.5, 0);
    this.world.updateDayNight(0);
  }

  _tick(dt) {
    this.time += dt;

    // --- Player ---
    this.player.move(this.input, dt, this.world);
    this.player.tickNeeds(dt, this.world.envCold());

    // --- Weapon switching & ADS ---
    if (this.input.tapped('Digit1')) this._switchWeapon('pistol');
    if (this.input.tapped('Digit2')) this._switchWeapon('rifle');
    if (this.input.tapped('Digit3')) this._switchWeapon('shotgun');
    if (Math.abs(this.input.wheelDelta) > 0) {
      const order = ['pistol', 'rifle', 'shotgun'];
      const i = order.indexOf(this.currentWeaponId);
      const dir = this.input.wheelDelta > 0 ? 1 : -1;
      this._switchWeapon(order[(i + dir + order.length) % order.length]);
    }

    const weapon = this._currentWeapon();
    this.player.ads = this.input.mouseRight && weapon.reloading <= 0;
    this.camera.fov = this.player.ads ? 72 / (weapon.stats().adsZoom) : 72;
    this.camera.updateProjectionMatrix();
    this.viewModel.show(this.currentWeaponId);
    this.viewModel.setAds(this.player.ads);
    this.viewModel.tick(dt);

    // --- Firing ---
    if (weapon.def.fullAuto ? this.input.mouseLeft : this.input.mouseLeftEdge) {
      this._tryFire(weapon);
    }

    // --- Reload ---
    if (this.input.tapped('KeyR')) weapon.startReload();
    weapon.tick(dt);

    // --- Attachment controls ---
    if (this.input.tapped('KeyT')) {
      this.selectedAttSlot = (this.selectedAttSlot + 1) % weapon.def.slots.length;
      this.hud.toastMessage(`Slot: ${weapon.def.slots[this.selectedAttSlot].toUpperCase()}`);
    }
    if (this.input.tapped('KeyF')) {
      this._cycleAttachment(weapon);
    }

    // --- Bears ---
    this.bearRespawnTimer -= dt;
    for (const b of this.bears) b.tick(dt, this.player, this.world);

    // Remove bears that have been dead for a while
    this.bears = this.bears.filter(b => {
      if (!b.alive && b.deathTimer > 45) {
        this.scene.remove(b.group);
        return false;
      }
      return true;
    });

    // Respawn
    const aliveCount = this.bears.filter(b => b.alive).length;
    if (aliveCount < BEAR.spawnCount && this.bearRespawnTimer <= 0) {
      this._spawnBear();
      this.bearRespawnTimer = BEAR.respawnDelay / BEAR.spawnCount;
    }

    // --- Loot pickup ---
    this._handleLoot();

    // --- Actions: eat / drink / relieve / sleep ---
    if (this.input.tapped('KeyG')) this._useConsumable('food');
    if (this.input.tapped('KeyH')) this._useConsumable('drink');
    if (this.input.tapped('KeyB')) {
      this.player.relieve();
      this.hud.toastMessage('You feel relieved.');
    }
    if (this.input.tapped('KeyZ')) {
      if (this.player.inventory.sleepbag > 0) {
        this.player.inventory.sleepbag -= 1;
        this.player.sleep(80);
        this.player.needs.warmth = Math.min(100, this.player.needs.warmth + 25);
        // Skip ~6 hours forward
        this.time += this._hoursToSeconds(6);
        this.hud.toastMessage('You rest in the sleeping bag (+80 rest).');
      } else {
        this.hud.toastMessage('You need a sleeping bag.', 'warn');
      }
    }

    // --- World ---
    this.world.updateDayNight(this.time);
    this._tickTracers(dt);

    // --- HUD ---
    this.hud.updateCompass(this.player.yaw);
    this.hud.updateClock(this.world.day, this.world.currentTimeString());
    this.hud.updateKills(this.player.kills);
    this.hud.updateWeapon(weapon, this.player.ads);
    this.hud.updateVitals(this.lastDamagedBear);
    this.hud.updateNeeds(this.player.needs);
    if (this.player.isHitFlashing) this.hud.flashHit();
    this.hud.tick(dt);

    // --- Death ---
    if (this.player.dead) {
      this.running = false;
      document.exitPointerLock?.();
      if (this.onDeath) this.onDeath(this.player.deathReason, this.player.kills);
    }

    this.input.frameEnd();
  }

  _currentWeapon() { return this.weapons[this.currentWeaponId]; }

  _switchWeapon(id) {
    if (!this.weapons[id]) return;
    this.currentWeaponId = id;
    this.hud.toastMessage(WEAPONS[id].displayName);
  }

  _cycleAttachment(weapon) {
    const slot = weapon.def.slots[this.selectedAttSlot];
    // Candidate attachments for this slot the player owns.
    const candidates = Object.values(ATTACHMENTS).filter(a =>
      a.slot === slot && this.player.inventory.attachments.has(a.id),
    );
    if (candidates.length === 0) {
      this.hud.toastMessage('No attachments for this slot yet.', 'warn');
      return;
    }
    const current = weapon.attachments[slot];
    const order = [null, ...candidates.map(a => a.id)];
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    if (next === null) {
      weapon.unmount(slot);
      this.hud.toastMessage(`Detached [${slot}]`);
    } else {
      weapon.mount(next);
      this.hud.toastMessage(`Attached ${ATTACHMENTS[next].name}`);
    }
  }

  _tryFire(weapon) {
    if (weapon.mag <= 0) {
      // Auto-reload on click when dry.
      weapon.startReload();
      return;
    }
    if (!weapon.fire()) return;

    const stats = weapon.stats();
    const origin = this.player.position.clone();
    const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const pellets = weapon.def.pellets || 1;

    for (let p = 0; p < pellets; p++) {
      const spread = this.player.ads ? stats.spreadAds : stats.spreadHip;
      const dir = baseDir.clone();
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
      this._fireRay(origin, dir, stats);
    }

    // Recoil — pitch up a bit.
    this.player.pitch = Math.min(Math.PI / 2 - 0.02,
      this.player.pitch + 0.008 * stats.recoil * (this.player.ads ? 0.4 : 1));
    this.viewModel.kick(1);

    // Bloodlust tiny bump per shot.
    this.player.needs.bloodlust = Math.min(100, this.player.needs.bloodlust + 0.4);
  }

  _fireRay(origin, dir, stats) {
    const maxDist = stats.range;
    let best = null;
    for (const b of this.bears) {
      if (!b.alive) continue;
      const hit = b.raycast(origin, dir, maxDist);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }

    // End point for tracer: hit point or max-distance point.
    let end;
    if (best) {
      end = origin.clone().addScaledVector(dir, best.t);
      const dealt = best.bear.applyDamage(best.organ, stats.damage);
      this.lastDamagedBear = best.bear;
      this._spawnBlood(end);
      if (!best.bear.alive) {
        this.player.recordKill();
        this.hud.toastMessage(`Bear down. (${best.organ})`);
      } else if (best.organ && best.organ !== '__body') {
        this.hud.toastMessage(`Hit: ${best.organ} (${dealt.toFixed(0)} dmg)`);
      }
    } else {
      end = origin.clone().addScaledVector(dir, maxDist);
    }
    this._spawnTracer(origin, end);
  }

  _spawnTracer(origin, end) {
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.6 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, t: 0.08 });
  }

  _spawnBlood(pos) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xa32a2a, transparent: true, opacity: 0.85 }),
    );
    puff.position.copy(pos);
    this.scene.add(puff);
    this.tracers.push({ line: puff, t: 0.4, blood: true });
  }

  _tickTracers(dt) {
    for (const tr of this.tracers) {
      tr.t -= dt;
      if (tr.blood) {
        tr.line.scale.multiplyScalar(1 + dt * 1.5);
        tr.line.material.opacity = Math.max(0, tr.t);
      } else {
        tr.line.material.opacity = Math.max(0, tr.t * 8);
      }
    }
    this.tracers = this.tracers.filter(tr => {
      if (tr.t <= 0) {
        this.scene.remove(tr.line);
        return false;
      }
      return true;
    });
  }

  _handleLoot() {
    const p = this.player.position;
    let nearest = null;
    let nearestDist = PLAYER.interactRange;
    for (const l of this.world.loot) {
      const d = Math.hypot(l.pos.x - p.x, l.pos.z - p.z);
      if (d < nearestDist && Math.abs(l.pos.y - p.y) < 2.2) {
        nearest = l;
        nearestDist = d;
      }
      if (l.mesh.userData.beacon) {
        l.mesh.userData.beacon.position.y = 0.45 + Math.sin(this.time * 3 + l.pos.x) * 0.05;
      }
    }
    if (nearest) {
      this.hud.showPrompt(`[E] ${nearest.item.label}`);
      this._promptTarget = nearest;
      if (this.input.tapped('KeyE')) {
        this._applyLoot(nearest);
        this.world.consumeLoot(nearest);
        this._promptTarget = null;
        this.hud.hidePrompt();
      }
    } else {
      this._promptTarget = null;
      this.hud.hidePrompt();
    }
  }

  _applyLoot(entry) {
    const eff = entry.item.effect || {};
    if (eff.ammo) {
      for (const [id, n] of Object.entries(eff.ammo)) {
        this.weapons[id].giveAmmo(n);
      }
      this.hud.toastMessage(`+${entry.item.label}`);
    }
    if (eff.hunger) { this.player.eat(eff.hunger); this.hud.toastMessage('You eat a ration.'); }
    if (eff.thirst) { this.player.drink(eff.thirst); this.hud.toastMessage('You drink.'); }
    if (eff.warmth) { this.player.warmUp(eff.warmth); this.hud.toastMessage('You feel warmer.'); }
    if (eff.health) {
      this.player.heal(eff.health);
      this.hud.toastMessage('You patch your wounds.');
    }
    if (eff.inventory === 'sleepbag') {
      this.player.inventory.sleepbag += 1;
      this.hud.toastMessage('Sleeping bag stowed. [Z] to sleep.');
    }
    if (eff.attachment) {
      this.player.inventory.attachments.add(eff.attachment);
      // Auto-mount if slot is empty on current weapon.
      const a = ATTACHMENTS[eff.attachment];
      const w = this._currentWeapon();
      if (w.def.slots.includes(a.slot) && !w.attachments[a.slot]) {
        w.mount(a.id);
        this.hud.toastMessage(`Mounted ${a.name}.`);
      } else {
        this.hud.toastMessage(`Picked up ${a.name} (use [T]/[F]).`);
      }
    }
  }

  _useConsumable(kind) {
    // Quick shortcut: consume nearest loot of the right type held on-field.
    // Simpler variant: auto-eat/drink if need is low.
    if (kind === 'food' && this.player.needs.hunger < 100) {
      const e = this._findLootByIds(['ration', 'thermos']);
      if (e) { this._applyLoot(e); this.world.consumeLoot(e); return; }
      this.hud.toastMessage('No food nearby.', 'warn');
    }
    if (kind === 'drink' && this.player.needs.thirst < 100) {
      const e = this._findLootByIds(['water', 'thermos']);
      if (e) { this._applyLoot(e); this.world.consumeLoot(e); return; }
      this.hud.toastMessage('No water nearby.', 'warn');
    }
  }

  _findLootByIds(ids) {
    const p = this.player.position;
    let best = null; let bestD = 6; // 6m reach for shortcuts
    for (const l of this.world.loot) {
      if (!ids.includes(l.item.id)) continue;
      const d = Math.hypot(l.pos.x - p.x, l.pos.z - p.z);
      if (d < bestD) { best = l; bestD = d; }
    }
    return best;
  }

  _hoursToSeconds(h) {
    return h * WORLD.dayLengthSeconds / 24;
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
}
