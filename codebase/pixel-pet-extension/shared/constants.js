export const TYPES = Object.freeze(['info', 'reminder', 'success', 'warning', 'error', 'message']);
export const PRIORITIES = Object.freeze(['low', 'normal', 'high', 'urgent']);
export const DEFAULTS = Object.freeze({
  websocketUrl: 'ws://localhost:8765/ws',
  pollingUrl: 'http://localhost:8765/api/notifications',
  healthUrl: 'http://localhost:8765/health',
  pollingIntervalMinutes: 1,
  petSize: 72,
  animationSpeed: 1,
  soundVolume: 0.5,
  nativeNotifications: true,
  speechBubbles: true,
  sounds: false,
  petVisible: true,
  animationsPaused: false,
  autoDismissSeconds: 8,
  urgentSticky: true,
  confirmExternalUrls: true,
  disabledSites: [],
  allowLanHost: false,
  authToken: '',
  debug: false,
});
export const KEYS = Object.freeze({
  settings: 'pixelPetSettings',
  history: 'pixelPetHistory',
  seenIds: 'pixelPetSeenIds',
  status: 'pixelPetStatus',
  positions: 'pixelPetPositions',
});
export const MESSAGE = Object.freeze({
  notification: 'PIXEL_PET_NOTIFICATION',
  status: 'PIXEL_PET_STATUS',
  getState: 'PIXEL_PET_GET_STATE',
  reconnect: 'PIXEL_PET_RECONNECT',
  markAllRead: 'PIXEL_PET_MARK_ALL_READ',
  openAction: 'PIXEL_PET_OPEN_ACTION',
  settingsChanged: 'PIXEL_PET_SETTINGS_CHANGED',
});
