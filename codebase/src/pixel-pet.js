import { config } from './config.js';

const TYPES = new Set(['info', 'reminder', 'success', 'warning', 'error', 'message']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

export async function publishPixelPetNotification({
  title, message, type = 'info', priority = 'normal', actionUrl = '', actionLabel = '',
}) {
  if (!config.pixelPet.enabled) return false;
  const body = {
    title: String(title || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    message: String(message || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    type: TYPES.has(type) ? type : 'info',
    priority: PRIORITIES.has(priority) ? priority : 'normal',
  };
  if (!body.title || !body.message) return false;
  if (actionUrl) {
    try {
      const url = new URL(actionUrl);
      if (['http:', 'https:'].includes(url.protocol)) body.actionUrl = url.toString();
    } catch { /* Bỏ URL không hợp lệ. */ }
  }
  if (body.actionUrl && actionLabel) body.actionLabel = String(actionLabel).slice(0, 40);
  try {
    const response = await fetch(config.pixelPet.notificationUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.pixelPet.token ? { 'x-pixel-pet-token': config.pixelPet.token } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.error('pixel_pet_publish_failed', error?.name || 'UNKNOWN');
    return false;
  }
}
