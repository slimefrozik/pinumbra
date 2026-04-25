import { Game } from './game.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const deathScreen = document.getElementById('death-screen');
const startBtn = document.getElementById('start-btn');
const respawnBtn = document.getElementById('respawn-btn');

const game = new Game(canvas);

function startRun() {
  menu.classList.add('hidden');
  deathScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  game.start();
}

function showDeath(reason, kills) {
  hud.classList.add('hidden');
  document.getElementById('death-reason').textContent = reason;
  document.getElementById('death-kills').textContent = String(kills);
  let best = 0;
  try { best = Number(localStorage.getItem('pinumbra_best') || 0); } catch (_e) { /* ignore */ }
  document.getElementById('death-best').textContent = String(Math.max(best, kills));
  deathScreen.classList.remove('hidden');
}

game.onDeath = showDeath;

startBtn.addEventListener('click', startRun);
respawnBtn.addEventListener('click', () => {
  game.reset();
  startRun();
});

// Kick off the render loop immediately so the menu shows a live 3D backdrop.
game.initScene();
game.loop();
