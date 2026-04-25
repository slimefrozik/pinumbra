import * as THREE from 'three';
import { BEAR, ORGANS } from './config.js';

// A single polar bear entity with per-organ hit points.
export class Bear {
  constructor() {
    this.group = new THREE.Group();
    this.velocity = new THREE.Vector3();
    this.hp = BEAR.totalHp;
    this.alive = true;
    this.state = 'wander'; // wander | alert | charge | attack | dead
    this.stateTime = Math.random() * 4;
    this.attackCd = 0;
    this.deathTimer = 0;
    this.bleed = 0; // DoT from wounded organs
    this.speedMul = 1;
    this.wanderDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();

    // Organs
    this.organs = {};
    for (const [k, def] of Object.entries(ORGANS)) {
      this.organs[k] = { hp: def.max, max: def.max, def };
    }

    this._buildMesh();
    this._buildOrganColliders();
  }

  _buildMesh() {
    const furColor = 0xf2f6fa;
    const fur = new THREE.MeshLambertMaterial({ color: furColor });
    const darkFur = new THREE.MeshLambertMaterial({ color: 0xdbe4ed });

    // Body (ellipsoid approximated by scaled sphere)
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), fur);
    body.scale.set(1.0, 0.75, 1.6);
    body.position.set(0, 0.8, 0);
    this.group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), fur);
    head.position.set(0, 1.15, 1.05);
    this.group.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), darkFur);
    snout.position.set(0, 1.08, 1.32);
    this.group.add(snout);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.07, 8, 6);
    const ear1 = new THREE.Mesh(earGeo, fur);
    ear1.position.set(0.18, 1.38, 1.0);
    const ear2 = new THREE.Mesh(earGeo, fur);
    ear2.position.set(-0.18, 1.38, 1.0);
    this.group.add(ear1, ear2);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.75, 8);
    const legOffsets = [
      [0.35, 0.38, 0.6],
      [-0.35, 0.38, 0.6],
      [0.35, 0.38, -0.7],
      [-0.35, 0.38, -0.7],
    ];
    this.legs = [];
    for (const [x, y, z] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, fur);
      leg.position.set(x, y, z);
      this.group.add(leg);
      this.legs.push(leg);
    }

    // Tail nub
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), fur);
    tail.position.set(0, 0.85, -1.1);
    this.group.add(tail);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.03, 8, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
    eye1.position.set(0.13, 1.22, 1.28);
    const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
    eye2.position.set(-0.13, 1.22, 1.28);
    this.group.add(eye1, eye2);
  }

  _buildOrganColliders() {
    // Invisible spheres used for hit detection. Attached to the bear group
    // so they inherit world transform.
    this._organColliders = [];
    for (const [name, def] of Object.entries(ORGANS)) {
      const sphere = {
        name,
        localPos: new THREE.Vector3(...def.offset),
        worldPos: new THREE.Vector3(),
        radius: def.radius,
      };
      this._organColliders.push(sphere);
    }
  }

  // Test a ray (origin, dir) against all organ colliders. Returns the closest hit.
  raycast(origin, dir, maxDist) {
    // Update world positions once per ray test.
    this.group.updateMatrixWorld();
    let bestT = Infinity;
    let bestOrgan = null;
    for (const c of this._organColliders) {
      c.worldPos.copy(c.localPos).applyMatrix4(this.group.matrixWorld);
      const t = raySphere(origin, dir, c.worldPos, c.radius);
      if (t > 0 && t < bestT && t < maxDist) {
        bestT = t;
        bestOrgan = c.name;
      }
    }
    // Also test a generic body sphere so body shots still count when no organ is hit.
    const bodyPos = new THREE.Vector3(0, 0.85, 0).applyMatrix4(this.group.matrixWorld);
    const bodyT = raySphere(origin, dir, bodyPos, 0.9);
    if (bodyT > 0 && bodyT < bestT && bodyT < maxDist) {
      bestT = bodyT;
      bestOrgan = '__body';
    }
    if (bestOrgan === null) return null;
    return { t: bestT, organ: bestOrgan, bear: this };
  }

  applyDamage(organName, rawDamage) {
    if (!this.alive) return 0;
    let dealt = rawDamage;

    if (organName === '__body') {
      this.hp -= rawDamage;
    } else {
      const organ = this.organs[organName];
      const def = organ.def;
      dealt = rawDamage * (def.damageMul ?? 1);
      organ.hp -= dealt;
      this.hp -= dealt * 0.5; // organ damage bleeds into total HP too

      if (def.bleed) this.bleed += def.bleed;

      if (def.slow) this.speedMul *= (1 - def.slow * 0.5);
      if (organ.hp <= 0) {
        organ.hp = 0;
        if (def.crit) { this.hp = 0; }
        if (def.immobilize) this.speedMul = 0.25;
      }
    }

    if (this.hp <= 0) this.die();
    else if (this.state !== 'attack') this.state = 'charge';
    return dealt;
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.state = 'dead';
    this.deathTimer = 0;
    // Collapse: flatten to the ground and roll to one side.
    this.group.rotation.x = -Math.PI * 0.15;
    this.group.rotation.z = (Math.random() - 0.5) * 0.6;
  }

  tick(dt, player, terrain) {
    if (!this.alive) {
      this.deathTimer += dt;
      return;
    }
    // Bleed damage
    if (this.bleed > 0) {
      this.hp -= this.bleed * dt;
      if (this.hp <= 0) { this.die(); return; }
    }

    const toPlayer = new THREE.Vector3().subVectors(player.position, this.group.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();
    if (distance > 0.0001) toPlayer.multiplyScalar(1 / distance);

    this.stateTime += dt;

    // Transitions
    if (this.state === 'wander' && distance < BEAR.detectRange) {
      this.state = 'alert';
      this.stateTime = 0;
    } else if (this.state === 'alert' && this.stateTime > 0.8) {
      this.state = 'charge';
    } else if (this.state === 'charge' && distance < BEAR.attackRange) {
      this.state = 'attack';
      this.stateTime = 0;
    } else if (this.state === 'attack' && this.stateTime > 0.35 && this.attackCd <= 0) {
      player.damage(BEAR.attackDamage);
      this.attackCd = BEAR.attackCooldown;
    } else if (this.state === 'attack' && distance > BEAR.attackRange * 1.4) {
      this.state = 'charge';
    }

    if (this.state === 'wander') {
      if (this.stateTime > 3 + Math.random() * 3) {
        this.wanderDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        this.stateTime = 0;
      }
      this.velocity.copy(this.wanderDir).multiplyScalar(BEAR.walkSpeed * this.speedMul * 0.5);
    } else if (this.state === 'alert') {
      this.velocity.set(0, 0, 0);
      // Face player
      this._faceDirection(toPlayer);
    } else if (this.state === 'charge') {
      this.velocity.copy(toPlayer).multiplyScalar(BEAR.chargeSpeed * this.speedMul);
      this._faceDirection(toPlayer);
    } else if (this.state === 'attack') {
      this.velocity.set(0, 0, 0);
      this._faceDirection(toPlayer);
    }
    this.attackCd = Math.max(0, this.attackCd - dt);

    // Integrate
    this.group.position.addScaledVector(this.velocity, dt);
    const y = terrain.heightAt(this.group.position.x, this.group.position.z);
    this.group.position.y = y;

    // Clamp inside world
    const s = 595;
    this.group.position.x = clamp(this.group.position.x, -s, s);
    this.group.position.z = clamp(this.group.position.z, -s, s);

    // Simple bob for running
    if (this.velocity.lengthSq() > 0.01) {
      const bob = Math.sin(performance.now() * 0.012 * (this.state === 'charge' ? 1.4 : 1)) * 0.04;
      this.group.position.y += bob;
    }
  }

  _faceDirection(dir) {
    // Bear faces +Z locally, so we need yaw such that group's forward aligns with dir.
    const yaw = Math.atan2(dir.x, dir.z);
    this.group.rotation.y = yaw;
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Ray-sphere: returns t (distance along ray) of nearest hit >= 0, or -1 if miss.
function raySphere(origin, dir, center, radius) {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  const t1 = -b - sq;
  if (t1 > 0) return t1;
  const t2 = -b + sq;
  if (t2 > 0) return t2;
  return -1;
}
