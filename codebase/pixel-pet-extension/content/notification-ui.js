import { dismissDelay, safeUrl } from '../shared/validation.js';
import { BoundedQueue } from '../shared/queue.js';

export class NotificationUI {
  constructor(root, settings, pet) {
    this.root = root;
    this.settings = settings;
    this.pet = pet;
    this.queue = new BoundedQueue(50);
    this.current = null;
    this.timer = null;
    this.bubble = root.querySelector('.bubble');
    this.bubble.addEventListener('mouseenter', () => clearTimeout(this.timer));
    this.bubble.addEventListener('mouseleave', () => this.scheduleDismiss());
  }

  enqueue(notification) {
    this.queue.push(notification);
    if (!this.current) this.showNext();
    else this.updateCount();
  }

  showNext() {
    clearTimeout(this.timer);
    this.current = this.queue.shift() || null;
    if (!this.current || !this.settings.speechBubbles) {
      this.bubble.hidden = true;
      return;
    }
    const item = this.current;
    this.bubble.hidden = false;
    this.bubble.dataset.priority = item.priority;
    this.bubble.querySelector('.bubble-title').textContent = item.title;
    this.bubble.querySelector('.bubble-message').textContent = item.message;
    this.bubble.querySelector('.bubble-time').textContent = new Date(item.timestamp).toLocaleString();
    const action = this.bubble.querySelector('.bubble-action');
    action.hidden = !item.actionUrl;
    action.textContent = item.actionLabel || 'Mở';
    action.onclick = () => this.openAction(item.actionUrl);
    this.bubble.querySelector('.bubble-close').onclick = () => this.dismiss();
    this.bubble.querySelector('.bubble-read').onclick = () => this.dismiss();
    this.updateCount();
    this.pet.setState(['warning', 'error'].includes(item.type) ? item.type : 'excited', 1800);
    this.scheduleDismiss();
  }

  updateCount() {
    this.bubble.querySelector('.bubble-count').textContent = this.queue.length ? `+${this.queue.length}` : '';
  }

  scheduleDismiss() {
    clearTimeout(this.timer);
    if (!this.current) return;
    const delay = dismissDelay(this.current, this.settings);
    if (delay) this.timer = setTimeout(() => this.dismiss(), delay);
  }

  dismiss() {
    clearTimeout(this.timer);
    this.current = null;
    this.bubble.hidden = true;
    this.showNext();
  }

  openAction(value) {
    const url = safeUrl(value);
    if (!url || !/^https?:/.test(url)) return;
    const unusual = !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
    if (unusual && this.settings.confirmExternalUrls && !confirm(`Mở liên kết ngoài?\n${url}`)) return;
    chrome.runtime.sendMessage({ type: 'PIXEL_PET_OPEN_ACTION', url });
  }
}
