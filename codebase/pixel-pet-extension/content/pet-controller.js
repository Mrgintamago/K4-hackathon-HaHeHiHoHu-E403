import { KEYS } from '../shared/constants.js';

export class PetController {
  constructor(root, settings) {
    this.root = root;
    this.settings = settings;
    this.pet = root.querySelector('.pet');
    this.state = 'idle';
    this.idleTimer = null;
    this.drag = null;
  }

  async start() {
    this.pet.style.setProperty('--pet-size', `${this.settings.petSize}px`);
    this.pet.style.setProperty('--animation-speed', `${1 / Math.max(0.25, this.settings.animationSpeed)}s`);
    if (this.settings.animationsPaused) this.pet.classList.add('paused');
    this.bindDrag();
    await this.restorePosition();
    this.touch();
  }

  setState(state, duration = 0) {
    this.state = state;
    this.pet.dataset.state = state;
    if (duration) setTimeout(() => this.setState('idle'), duration);
  }

  touch() {
    clearTimeout(this.idleTimer);
    if (this.state === 'sleeping') this.setState('idle');
    this.idleTimer = setTimeout(() => this.setState('sleeping'), 30_000);
  }

  positionKey() {
    return `${Math.round(innerWidth / 200) * 200}x${Math.round(innerHeight / 200) * 200}`;
  }

  async restorePosition() {
    const data = await chrome.storage.local.get(KEYS.positions);
    const saved = data[KEYS.positions]?.[this.positionKey()];
    if (saved) {
      this.pet.style.left = `${Math.min(saved.x, innerWidth - 48)}px`;
      this.pet.style.top = `${Math.min(saved.y, innerHeight - 48)}px`;
      this.pet.style.right = 'auto';
      this.pet.style.bottom = 'auto';
    }
  }

  async savePosition() {
    const data = await chrome.storage.local.get(KEYS.positions);
    const positions = data[KEYS.positions] || {};
    positions[this.positionKey()] = {
      x: Number.parseFloat(this.pet.style.left) || 0,
      y: Number.parseFloat(this.pet.style.top) || 0,
    };
    await chrome.storage.local.set({ [KEYS.positions]: positions });
  }

  bindDrag() {
    this.pet.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const box = this.pet.getBoundingClientRect();
      this.drag = { dx: event.clientX - box.left, dy: event.clientY - box.top, moved: false };
      this.pet.setPointerCapture(event.pointerId);
      this.setState('walking');
    });
    this.pet.addEventListener('pointermove', (event) => {
      if (!this.drag) return;
      const x = Math.max(0, Math.min(innerWidth - this.pet.offsetWidth, event.clientX - this.drag.dx));
      const y = Math.max(0, Math.min(innerHeight - this.pet.offsetHeight, event.clientY - this.drag.dy));
      this.pet.style.cssText += `;left:${x}px;top:${y}px;right:auto;bottom:auto`;
      this.drag.moved = true;
    });
    this.pet.addEventListener('pointerup', () => {
      if (this.drag?.moved) this.savePosition();
      this.drag = null;
      this.setState('idle');
      this.touch();
    });
    this.pet.addEventListener('dblclick', () => this.setState('excited', 1200));
  }
}
