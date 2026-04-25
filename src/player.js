import * as THREE from 'three';
import { PLAYER, NEEDS_DECAY, NEED_DAMAGE_THRESHOLD } from './config.js';

export class Player {
  constructor(camera) {
    this.camera = camera;

    this.yaw = 0;
    this.pitch = 0;

    this.position = new THREE.Vector3(0, PLAYER.eyeHeight, 0);
    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.crouching = false;
    this.sprinting = false;

    this.health = 100;
    this.needs = {
      hunger: 100,
      thirst: 100,
      warmth: 100,
      sleep: 100,
      bladder: 100,
      bloodlust: 0,
    };

    this.inventory = {
      sleepbag: 0,
      medkit: 0,
      attachments: new Set(), // collected attachments (unlocked globally)
    };

    this.kills = 0;
    this.dead = false;
    this.deathReason = '';

    this.sleeping = false;
    this.ads = false;

    this._hitFlashTimer = 0;
  }

  reset() {
    this.yaw = 0;
    this.pitch = 0;
    this.position.set(0, PLAYER.eyeHeight, 0);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.needs = { hunger: 100, thirst: 100, warmth: 100, sleep: 100, bladder: 100, bloodlust: 0 };
    this.inventory = { sleepbag: 0, medkit: 0, attachments: new Set() };
    this.kills = 0;
    this.dead = false;
    this.deathReason = '';
    this.sleeping = false;
    this.ads = false;
  }

  get eyeHeight() {
    return this.crouching ? PLAYER.crouchHeight : PLAYER.eyeHeight;
  }

  applyMouseLook(dx, dy) {
    this.yaw -= dx;
    this.pitch -= dy;
    const limit = Math.PI / 2 - 0.01;
    if (this.pitch > limit) this.pitch = limit;
    if (this.pitch < -limit) this.pitch = -limit;
  }

  getForward(out = new THREE.Vector3()) {
    out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return out;
  }

  getRight(out = new THREE.Vector3()) {
    out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return out;
  }

  updateCamera() {
    this.camera.position.copy(this.position);
    // Camera rotation: yaw around Y, then pitch around X.
    const q = new THREE.Quaternion();
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    q.multiplyQuaternions(qy, qx);
    this.camera.quaternion.copy(q);
  }

  move(input, dt, terrain) {
    if (this.dead) return;

    // Rotation
    this.applyMouseLook(input.mouseDx, input.mouseDy);

    // Movement
    const forward = this.getForward();
    const right = this.getRight();

    let wish = new THREE.Vector3();
    if (input.down('KeyW')) wish.add(forward);
    if (input.down('KeyS')) wish.sub(forward);
    if (input.down('KeyD')) wish.add(right);
    if (input.down('KeyA')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    if (input.tapped('KeyC')) this.crouching = !this.crouching;

    this.sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    if (this.crouching) this.sprinting = false;
    if (this.needs.sleep < 10 || this.needs.hunger < 10) this.sprinting = false;

    let speed = this.crouching ? PLAYER.crouchSpeed
              : this.sprinting ? PLAYER.sprintSpeed
              : PLAYER.walkSpeed;

    // Slow when cold/injured
    if (this.needs.warmth < 25) speed *= 0.75;
    if (this.health < 35) speed *= 0.8;

    this.velocity.x = wish.x * speed;
    this.velocity.z = wish.z * speed;

    // Gravity / jump
    this.velocity.y -= PLAYER.gravity * dt;
    if (input.tapped('Space') && this.onGround && !this.crouching) {
      this.velocity.y = PLAYER.jumpVelocity;
      this.onGround = false;
    }

    this.position.addScaledVector(this.velocity, dt);

    // Clamp to world
    const s = 580;
    if (this.position.x > s) this.position.x = s;
    if (this.position.x < -s) this.position.x = -s;
    if (this.position.z > s) this.position.z = s;
    if (this.position.z < -s) this.position.z = -s;

    // Terrain collision
    const ground = terrain.heightAt(this.position.x, this.position.z);
    const floor = ground + this.eyeHeight;
    if (this.position.y <= floor) {
      this.position.y = floor;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Sprint costs stamina (sleep/hunger); also drains bladder faster
    if (this.sprinting && wish.lengthSq() > 0) {
      this.needs.sleep = Math.max(0, this.needs.sleep - dt * 0.6);
      this.needs.hunger = Math.max(0, this.needs.hunger - dt * 0.35);
    }

    this.updateCamera();
  }

  tickNeeds(dt, envCold = 0) {
    if (this.dead) return;
    // Basic passive decay.
    this.needs.hunger = clamp(this.needs.hunger - NEEDS_DECAY.hunger * dt);
    this.needs.thirst = clamp(this.needs.thirst - NEEDS_DECAY.thirst * dt);
    this.needs.warmth = clamp(this.needs.warmth - (NEEDS_DECAY.warmth + envCold) * dt);
    this.needs.sleep  = clamp(this.needs.sleep  - NEEDS_DECAY.sleep  * dt);
    this.needs.bladder = clamp(this.needs.bladder - NEEDS_DECAY.bladder * dt);
    // Bloodlust RISES over time (its decay is negative) but is reduced by kills elsewhere.
    this.needs.bloodlust = clamp(this.needs.bloodlust - NEEDS_DECAY.bloodlust * dt);

    // Need damage
    const dmg = (n, per) => {
      if (n < NEED_DAMAGE_THRESHOLD) this.damage(per * dt, 'need');
    };
    dmg(this.needs.hunger, 2.0);
    dmg(this.needs.thirst, 2.5);
    dmg(this.needs.warmth, 3.0);
    dmg(this.needs.sleep, 1.5);
    // A full bladder damages you too (above 95).
    if (this.needs.bladder > 95) this.damage(1.0 * dt, 'need');
    // Maxed bloodlust causes you to hurt yourself.
    if (this.needs.bloodlust > 95) this.damage(1.5 * dt, 'bloodlust');

    // Passive regen when all basic needs are high and health not full
    if (this.health < 100 &&
        this.needs.hunger > 60 && this.needs.thirst > 60 &&
        this.needs.warmth > 60 && this.needs.sleep > 40) {
      this.health = Math.min(100, this.health + PLAYER.healthRegen * dt);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      if (!this.deathReason) this.deathReason = 'Your vitals failed in the cold.';
    }

    this._hitFlashTimer = Math.max(0, this._hitFlashTimer - dt);
  }

  damage(amount, source = 'bear') {
    if (this.dead) return;
    this.health -= amount;
    if (amount > 1.5) this._hitFlashTimer = 0.4;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.deathReason = {
        bear: 'A polar bear tore you apart.',
        need: 'You succumbed to the elements.',
        bloodlust: 'Untempered bloodlust consumed you.',
      }[source] || 'You died.';
    }
  }

  recordKill() {
    this.kills += 1;
    // Killing reduces bloodlust.
    this.needs.bloodlust = clamp(this.needs.bloodlust - 22);
  }

  eat(amount) { this.needs.hunger = clamp(this.needs.hunger + amount); }
  drink(amount) { this.needs.thirst = clamp(this.needs.thirst + amount); }
  warmUp(amount) { this.needs.warmth = clamp(this.needs.warmth + amount); }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
  relieve() { this.needs.bladder = 100; }
  sleep(amount) { this.needs.sleep = clamp(this.needs.sleep + amount); }

  get isHitFlashing() { return this._hitFlashTimer > 0; }
}

function clamp(v, lo = 0, hi = 100) {
  return v < lo ? lo : v > hi ? hi : v;
}
