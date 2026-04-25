import { PLAYER } from './config.js';

// Low-level input state. Rebuilt each frame by the game loop.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.locked = false;

    this.mouseLeft = false;
    this.mouseRight = false;
    this.mouseLeftEdge = false; // true for one frame on click
    this.wheelDelta = 0;

    this.tapKeys = new Set(); // pressed-this-frame

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onCanvasClick = this._onCanvasClick.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.canvas.addEventListener('click', this._onCanvasClick);
  }

  requestLock() {
    if (this.canvas.requestPointerLock) this.canvas.requestPointerLock();
  }

  _onCanvasClick() {
    if (!this.locked) this.requestLock();
  }

  _onPointerLockChange() {
    this.locked = document.pointerLockElement === this.canvas;
  }

  _onKeyDown(e) {
    if (!this.keys.has(e.code)) this.tapKeys.add(e.code);
    this.keys.add(e.code);
  }
  _onKeyUp(e) {
    this.keys.delete(e.code);
  }
  _onMouseMove(e) {
    if (!this.locked) return;
    this.mouseDx += e.movementX * PLAYER.mouseSensitivity;
    this.mouseDy += e.movementY * PLAYER.mouseSensitivity;
  }
  _onMouseDown(e) {
    if (e.button === 0) {
      if (!this.mouseLeft) this.mouseLeftEdge = true;
      this.mouseLeft = true;
    } else if (e.button === 2) {
      this.mouseRight = true;
    }
  }
  _onMouseUp(e) {
    if (e.button === 0) this.mouseLeft = false;
    else if (e.button === 2) this.mouseRight = false;
  }
  _onWheel(e) {
    this.wheelDelta += e.deltaY;
  }

  // Call at the end of each frame to consume edge events.
  frameEnd() {
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.mouseLeftEdge = false;
    this.wheelDelta = 0;
    this.tapKeys.clear();
  }

  tapped(code) { return this.tapKeys.has(code); }
  down(code) { return this.keys.has(code); }
}
