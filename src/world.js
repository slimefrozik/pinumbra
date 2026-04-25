import * as THREE from 'three';
import { WORLD, COLORS, LOOT_TABLE } from './config.js';

// Seeded pseudo-random (mulberry32) so the world is stable between frames.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fractal noise for the snow terrain. Simple value noise built from a seeded grid.
function makeTerrainHeightFn(seed) {
  const rand = mulberry32(seed);
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand() * 2 - 1;

  function sample(x, y) {
    x = ((x % size) + size) % size;
    y = ((y % size) + size) % size;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x2 = (xi + 1) % size, y2 = (yi + 1) % size;
    const a = grid[yi * size + xi];
    const b = grid[yi * size + x2];
    const c = grid[y2 * size + xi];
    const d = grid[y2 * size + x2];
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  return function height(x, z) {
    // Smooth, low-amplitude dunes.
    const freq = 0.012;
    let h = 0;
    let amp = 2.4;
    let f = freq;
    for (let i = 0; i < 4; i++) {
      h += sample(x * f, z * f) * amp;
      amp *= 0.5;
      f *= 2.1;
    }
    // Big central bowl so the player spawns in a gentle valley.
    const r = Math.sqrt(x * x + z * z);
    h += Math.min(0, (80 - r) * 0.015);
    return h;
  };
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.seed = 1337;
    this.heightFn = makeTerrainHeightFn(this.seed);
    this.loot = []; // {mesh, item, pos}
    this._dayFraction = WORLD.startHour / 24;
    this.day = 1;

    this._buildSky();
    this._buildSun();
    this._buildTerrain();
    this._buildDecor();
    this._buildInitialLoot();
  }

  heightAt(x, z) { return this.heightFn(x, z); }

  _buildSky() {
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.fog, WORLD.fogNear, WORLD.fogFar);
  }

  _buildSun() {
    this.ambient = new THREE.HemisphereLight(0xd6e4f2, 0x6a7c90, 0.55);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.1);
    this.sun.position.set(100, 200, 80);
    this.scene.add(this.sun);

    this.moon = new THREE.DirectionalLight(0x8ba7c2, 0.15);
    this.moon.position.set(-100, 200, -80);
    this.scene.add(this.moon);
  }

  _buildTerrain() {
    const size = WORLD.size * 2;
    const seg = WORLD.terrainSegments;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this.heightAt(x, z));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({
      color: COLORS.snow,
      flatShading: false,
    });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  _buildDecor() {
    const rand = mulberry32(this.seed + 1);
    const s = WORLD.size - 30;

    // Ice rocks
    const rockMat = new THREE.MeshLambertMaterial({ color: COLORS.snowDark });
    for (let i = 0; i < WORLD.numRocks; i++) {
      const x = (rand() * 2 - 1) * s;
      const z = (rand() * 2 - 1) * s;
      if (Math.hypot(x, z) < 15) continue;
      const rocks = new THREE.Group();
      const count = 2 + Math.floor(rand() * 3);
      for (let j = 0; j < count; j++) {
        const r = 0.5 + rand() * 1.8;
        const geo = new THREE.DodecahedronGeometry(r, 0);
        const m = new THREE.Mesh(geo, rockMat);
        m.position.set((rand() - 0.5) * 2, r * 0.4, (rand() - 0.5) * 2);
        m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        rocks.add(m);
      }
      rocks.position.set(x, this.heightAt(x, z), z);
      this.scene.add(rocks);
    }

    // Dead trees
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2c });
    for (let i = 0; i < WORLD.numDeadTrees; i++) {
      const x = (rand() * 2 - 1) * s;
      const z = (rand() * 2 - 1) * s;
      if (Math.hypot(x, z) < 10) continue;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 3.5 + rand() * 2, 6), trunkMat);
      trunk.position.set(x, this.heightAt(x, z) + 1.8, z);
      trunk.rotation.z = (rand() - 0.5) * 0.3;
      this.scene.add(trunk);
      // A couple of broken branches
      for (let b = 0; b < 2 + Math.floor(rand() * 2); b++) {
        const br = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.08, 0.8 + rand() * 0.8, 5),
          trunkMat,
        );
        br.position.set(x, this.heightAt(x, z) + 2 + rand() * 1.5, z);
        br.rotation.z = (rand() - 0.5) * 2;
        br.rotation.x = (rand() - 0.5) * 2;
        this.scene.add(br);
      }
    }

    // Ice spikes
    const iceMat = new THREE.MeshPhongMaterial({ color: 0xc6e3f2, shininess: 60 });
    for (let i = 0; i < WORLD.numIceSpikes; i++) {
      const x = (rand() * 2 - 1) * s;
      const z = (rand() * 2 - 1) * s;
      const h = 2 + rand() * 3;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.6 + rand() * 0.5, h, 6), iceMat);
      spike.position.set(x, this.heightAt(x, z) + h * 0.5, z);
      spike.rotation.y = rand() * 3;
      this.scene.add(spike);
    }
  }

  _buildInitialLoot() {
    const rand = mulberry32(this.seed + 2);
    const s = WORLD.size - 30;
    for (let i = 0; i < WORLD.numLootPiles; i++) {
      const x = (rand() * 2 - 1) * s;
      const z = (rand() * 2 - 1) * s;
      if (Math.hypot(x, z) < 12) continue;
      this.spawnLootAt(x, z, rand);
    }
  }

  spawnLootAt(x, z, rand = Math.random) {
    const item = pickLootItem(typeof rand === 'function' ? rand : Math.random);
    const mesh = buildLootMesh(item);
    mesh.position.set(x, this.heightAt(x, z) + 0.3, z);
    this.scene.add(mesh);
    this.loot.push({ mesh, item, pos: mesh.position });
  }

  consumeLoot(entry) {
    const i = this.loot.indexOf(entry);
    if (i >= 0) {
      this.loot.splice(i, 1);
      this.scene.remove(entry.mesh);
    }
  }

  // Update day/night. `t` is cumulative game time in seconds.
  updateDayNight(t) {
    const prev = this._dayFraction;
    this._dayFraction = ((WORLD.startHour * 3600 + t) / (WORLD.dayLengthSeconds * 3600 / 24)) % 1;
    // A day is WORLD.dayLengthSeconds real seconds.
    const cycle = ((WORLD.startHour / 24) + (t / WORLD.dayLengthSeconds)) % 1;
    if (cycle < prev) this.day++;
    this._dayFraction = cycle;

    const angle = cycle * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    this.sun.position.set(sunX * 300, sunY * 300 + 40, 80);
    this.moon.position.set(-sunX * 300, -sunY * 300 + 40, -80);

    const dayFactor = Math.max(0, Math.min(1, sunY + 0.2));
    this.sun.intensity = 0.15 + dayFactor * 1.1;
    this.moon.intensity = 0.05 + (1 - dayFactor) * 0.25;
    this.ambient.intensity = 0.25 + dayFactor * 0.45;

    const skyColor = new THREE.Color(COLORS.sky).lerp(new THREE.Color(COLORS.night), 1 - dayFactor);
    const fogColor = new THREE.Color(COLORS.fog).lerp(new THREE.Color(COLORS.night), 1 - dayFactor);
    this.scene.background.copy(skyColor);
    this.scene.fog.color.copy(fogColor);
  }

  currentTimeString() {
    const minutes = Math.floor(this._dayFraction * 24 * 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Colder at night.
  envCold() {
    const angle = this._dayFraction * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(angle);
    return sunY < 0 ? Math.min(0.08, -sunY * 0.08) : 0;
  }
}

function pickLootItem(rand) {
  const total = LOOT_TABLE.reduce((a, b) => a + b.weight, 0);
  let r = rand() * total;
  for (const item of LOOT_TABLE) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return LOOT_TABLE[0];
}

function buildLootMesh(item) {
  // Simple color-coded crates.
  const g = new THREE.Group();
  let color = 0xbd9a64;
  if (item.id.startsWith('ammo')) color = 0x5b6b7a;
  else if (item.id === 'ration') color = 0xc49b5b;
  else if (item.id === 'water') color = 0x6fb7d0;
  else if (item.id === 'thermos') color = 0xd07a6f;
  else if (item.id === 'medkit') color = 0xd05555;
  else if (item.id === 'sleepbag') color = 0x6e60a4;
  else if (item.id.startsWith('att_')) color = 0xf2c94c;

  const mat = new THREE.MeshLambertMaterial({ color });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), mat);
  g.add(box);
  const topMat = new THREE.MeshLambertMaterial({ color: 0x1e2530 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.52), topMat);
  top.position.y = 0.2;
  g.add(top);
  // Tiny light beacon so loot is visible from a distance.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe58f }),
  );
  beacon.position.y = 0.45;
  g.add(beacon);
  g.userData.beacon = beacon;
  return g;
}
