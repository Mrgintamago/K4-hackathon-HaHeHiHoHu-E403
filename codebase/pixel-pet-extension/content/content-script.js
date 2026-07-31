(async () => {
  const [{ MESSAGE }, { getSettings }, { PetController }, { NotificationUI }] = await Promise.all([
    import(chrome.runtime.getURL('shared/constants.js')),
    import(chrome.runtime.getURL('shared/storage.js')),
    import(chrome.runtime.getURL('content/pet-controller.js')),
    import(chrome.runtime.getURL('content/notification-ui.js')),
  ]);
  const settings = await getSettings();
  const host = location.hostname.toLowerCase();
  if (!settings.petVisible || settings.disabledSites.some((site) => host === site || host.endsWith(`.${site}`))) return;

  const mount = document.createElement('div');
  mount.id = 'pixel-pet-notifier-root';
  const shadow = mount.attachShadow({ mode: 'closed' });
  const css = await fetch(chrome.runtime.getURL('content/styles.css')).then((response) => response.text());
  const style = document.createElement('style');
  style.textContent = css;
  shadow.append(style);

  const app = document.createElement('section');
  app.className = 'pixel-pet-app';
  app.setAttribute('aria-label', 'Pixel Pet Notifier');
  app.innerHTML = `
    <aside class="bubble" role="status" aria-live="polite" hidden>
      <div class="bubble-head"><strong class="bubble-title"></strong><span class="bubble-count"></span></div>
      <p class="bubble-message"></p>
      <time class="bubble-time"></time>
      <div class="bubble-actions">
        <button class="bubble-action" type="button"></button>
        <button class="bubble-read" type="button">Đã đọc</button>
        <button class="bubble-close" type="button" aria-label="Đóng">×</button>
      </div>
    </aside>
    <nav class="pet-menu" aria-label="Pixel Pet actions" hidden>
      <button class="menu-latest" type="button">Thông báo</button>
      <button class="menu-feed" type="button">Cho ăn</button>
      <button class="menu-hide" type="button">Ẩn tại site này</button>
    </nav>
    <button class="pet" type="button" data-state="idle" aria-label="Mở Pixel Pet">
      <img src="${chrome.runtime.getURL('assets/pet.svg')}" alt="">
      <span class="connection-dot" aria-hidden="true"></span>
    </button>`;
  shadow.append(app);
  document.documentElement.append(mount);

  const pet = new PetController(shadow, settings);
  await pet.start();
  const ui = new NotificationUI(shadow, settings, pet);
  const petButton = shadow.querySelector('.pet');
  const menu = shadow.querySelector('.pet-menu');
  petButton.addEventListener('click', async () => {
    pet.touch();
    menu.hidden = !menu.hidden;
  });
  shadow.querySelector('.menu-latest').onclick = async () => {
    const state = await chrome.runtime.sendMessage({ type: MESSAGE.getState });
    const latest = state?.history?.find((item) => !item.read) || state?.history?.[0];
    if (latest) ui.enqueue(latest);
    menu.hidden = true;
  };
  shadow.querySelector('.menu-feed').onclick = () => {
    pet.setState('excited', 1400);
    menu.hidden = true;
  };
  shadow.querySelector('.menu-hide').onclick = async () => {
    settings.disabledSites = [...new Set([...settings.disabledSites, location.hostname.toLowerCase()])];
    const { saveSettings } = await import(chrome.runtime.getURL('shared/storage.js'));
    await saveSettings(settings);
    mount.remove();
  };
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MESSAGE.notification) ui.enqueue(message.notification);
    if (message.type === MESSAGE.status) {
      petButton.classList.toggle('disconnected', !message.status.connected);
      if (message.status.connected) pet.setState('excited', 900);
      else pet.setState('warning');
    }
  });
  const state = await chrome.runtime.sendMessage({ type: MESSAGE.getState }).catch(() => null);
  petButton.classList.toggle('disconnected', !state?.status?.connected);
})();
