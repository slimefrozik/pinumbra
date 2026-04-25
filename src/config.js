// Central tuning constants. Tweak here to rebalance gameplay.

export const WORLD = {
  size: 600, // half-extent of the playable area, in meters
  terrainSegments: 128,
  fogNear: 40,
  fogFar: 280,
  // Snow biome props
  numRocks: 60,
  numDeadTrees: 45,
  numLootPiles: 55,
  numIceSpikes: 30,
  // Day/night
  dayLengthSeconds: 720, // one in-game day = 12 real minutes
  startHour: 7,
};

export const PLAYER = {
  eyeHeight: 1.72,
  crouchHeight: 1.1,
  radius: 0.35,
  walkSpeed: 4.2,
  sprintSpeed: 7.0,
  crouchSpeed: 1.8,
  jumpVelocity: 5.6,
  gravity: 22,
  mouseSensitivity: 0.0022,
  interactRange: 2.4,
  // Passive regen per second when well-fed/rested/warm:
  healthRegen: 1.5,
};

// Daily decay per real second. Needs tick from 100 (full) → 0 (critical).
export const NEEDS_DECAY = {
  hunger: 100 / 900,      // empty in ~15 minutes
  thirst: 100 / 600,      // empty in ~10 minutes
  warmth: 100 / 480,      // freeze in ~8 minutes of standing still
  sleep:  100 / 1800,     // exhausted in ~30 minutes
  bladder: 100 / 720,     // full in ~12 minutes
  bloodlust: -100 / 300,  // bloodlust RISES over time (negative decay)
};

export const NEED_DAMAGE_THRESHOLD = 15; // below this % each need starts damaging the player

export const WEAPONS = {
  pistol: {
    id: 'pistol',
    displayName: 'M19 Pistol',
    damage: 22,
    rpm: 300,
    magSize: 15,
    reserveMax: 90,
    reloadTime: 1.6,
    spreadHip: 0.06,
    spreadAds: 0.006,
    recoil: 1.2,
    range: 120,
    fullAuto: false,
    slots: ['optic', 'muzzle', 'mag', 'laser'],
    adsZoom: 1.4,
  },
  rifle: {
    id: 'rifle',
    displayName: 'ARX-4 Rifle',
    damage: 34,
    rpm: 650,
    magSize: 30,
    reserveMax: 180,
    reloadTime: 2.2,
    spreadHip: 0.08,
    spreadAds: 0.004,
    recoil: 1.6,
    range: 240,
    fullAuto: true,
    slots: ['optic', 'muzzle', 'mag', 'laser', 'barrel'],
    adsZoom: 1.9,
  },
  shotgun: {
    id: 'shotgun',
    displayName: 'KS-12 Shotgun',
    damage: 18,
    pellets: 8,
    rpm: 90,
    magSize: 6,
    reserveMax: 48,
    reloadTime: 2.8,
    spreadHip: 0.18,
    spreadAds: 0.10,
    recoil: 3.2,
    range: 35,
    fullAuto: false,
    slots: ['optic', 'muzzle', 'mag'],
    adsZoom: 1.2,
  },
};

// Attachment effects are applied as multipliers / deltas on top of base weapon stats.
export const ATTACHMENTS = {
  redDot:        { id: 'redDot',        name: 'Red Dot',          slot: 'optic',  adsSpread: 0.7 },
  scope:         { id: 'scope',         name: 'Scope 4x',         slot: 'optic',  adsSpread: 0.35, adsZoomMul: 2.2 },
  suppressor:    { id: 'suppressor',    name: 'Suppressor',       slot: 'muzzle', stealth: 0.45, damageMul: 0.9 },
  compensator:   { id: 'compensator',   name: 'Compensator',      slot: 'muzzle', recoilMul: 0.6 },
  heavyBarrel:   { id: 'heavyBarrel',   name: 'Heavy Barrel',     slot: 'barrel', damageMul: 1.3, recoilMul: 1.25, rangeMul: 1.25 },
  extendedMag:   { id: 'extendedMag',   name: 'Extended Mag',     slot: 'mag',    magMul: 1.6 },
  laserSight:    { id: 'laserSight',    name: 'Laser Sight',      slot: 'laser',  hipSpread: 0.55 },
};

// Organs on a polar bear. 'offset' is a local-space point relative to the bear's
// center (bear stands at origin of its group, ~2.4m long, ~1.2m shoulder height).
// 'radius' is the hit sphere; 'max' is organ HP; damage multipliers apply when a
// bullet actually intersects the organ sphere. 'crit' triggers instant-kill logic
// if the organ HP reaches 0.
export const ORGANS = {
  brain:   { offset: [0, 1.2,  1.15], radius: 0.18, max: 40,  damageMul: 4.5, crit: true },
  heart:   { offset: [0.1, 0.85, 0.25], radius: 0.22, max: 60,  damageMul: 2.8, crit: true },
  lungs:   { offset: [0, 0.9,  0.35], radius: 0.38, max: 120, damageMul: 1.8, bleed: 1.5 },
  liver:   { offset: [-0.2, 0.75, -0.1], radius: 0.22, max: 80, damageMul: 1.6, bleed: 1.2 },
  stomach: { offset: [0, 0.7, -0.35], radius: 0.32, max: 90,  damageMul: 1.1, bleed: 0.6 },
  spine:   { offset: [0, 1.05, -0.2], radius: 0.18, max: 70, damageMul: 2.0, immobilize: true },
  legFrontL: { offset: [0.35, 0.55, 0.6], radius: 0.22, max: 55, damageMul: 0.8, slow: 0.4 },
  legFrontR: { offset: [-0.35, 0.55, 0.6], radius: 0.22, max: 55, damageMul: 0.8, slow: 0.4 },
  legHindL:  { offset: [0.35, 0.55, -0.7], radius: 0.22, max: 55, damageMul: 0.8, slow: 0.4 },
  legHindR:  { offset: [-0.35, 0.55, -0.7], radius: 0.22, max: 55, damageMul: 0.8, slow: 0.4 },
};

// HUD aggregates organs into these logical groups for the vitals panel.
export const ORGAN_GROUPS = {
  brain:   ['brain'],
  heart:   ['heart'],
  lungs:   ['lungs'],
  liver:   ['liver'],
  stomach: ['stomach', 'spine'],
  legs:    ['legFrontL', 'legFrontR', 'legHindL', 'legHindR'],
};

export const BEAR = {
  walkSpeed: 1.6,
  chargeSpeed: 7.2,
  detectRange: 38,
  attackRange: 2.3,
  attackDamage: 24,
  attackCooldown: 1.4,
  totalHp: 220, // bleed-out HP; organs also contribute to kills
  spawnCount: 14, // simultaneous live bears
  respawnDelay: 18,
};

export const LOOT_TABLE = [
  { id: 'ammo_9mm',    weight: 18, label: '9×19 ammo',       effect: { ammo: { pistol: 30 } } },
  { id: 'ammo_556',    weight: 15, label: '5.56 ammo',       effect: { ammo: { rifle: 30 } } },
  { id: 'ammo_12g',    weight: 12, label: '12ga shells',     effect: { ammo: { shotgun: 12 } } },
  { id: 'ration',      weight: 14, label: 'MRE ration',      effect: { hunger: 45 } },
  { id: 'water',       weight: 12, label: 'Water bottle',    effect: { thirst: 50 } },
  { id: 'thermos',     weight: 8,  label: 'Hot thermos',     effect: { warmth: 40, thirst: 20 } },
  { id: 'medkit',      weight: 6,  label: 'Medkit',          effect: { health: 60, heal_organs: true } },
  { id: 'sleepbag',    weight: 3,  label: 'Sleeping bag',    effect: { inventory: 'sleepbag' } },
  { id: 'att_redDot',  weight: 3,  label: 'Red Dot sight',   effect: { attachment: 'redDot' } },
  { id: 'att_scope',   weight: 2,  label: 'Scope 4x',        effect: { attachment: 'scope' } },
  { id: 'att_supp',    weight: 3,  label: 'Suppressor',      effect: { attachment: 'suppressor' } },
  { id: 'att_comp',    weight: 3,  label: 'Compensator',     effect: { attachment: 'compensator' } },
  { id: 'att_heavy',   weight: 2,  label: 'Heavy Barrel',    effect: { attachment: 'heavyBarrel' } },
  { id: 'att_extmag',  weight: 4,  label: 'Extended Mag',    effect: { attachment: 'extendedMag' } },
  { id: 'att_laser',   weight: 3,  label: 'Laser Sight',     effect: { attachment: 'laserSight' } },
];

export const COLORS = {
  snow:  0xe7f2fb,
  snowDark: 0xbacedf,
  sky:   0x9dc6e8,
  fog:   0xbfd5e8,
  night: 0x0b1428,
};
