const EMAIL = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?<!\d)(?:\+?84|0)\s?(?:\d[ .-]?){8,10}(?!\d)/g;
const DISCORD_ID = /\b\d{17,20}\b/g;
const MENTION = /<@!?\d{17,20}>|<@&\d{17,20}>/g;

export function redactPii(value) {
  return String(value || '')
    .replace(EMAIL, '[email đã ẩn]')
    .replace(PHONE, '[số điện thoại đã ẩn]')
    .replace(MENTION, '[mention đã ẩn]')
    .replace(DISCORD_ID, '[Discord ID đã ẩn]');
}

export function safeQuestion(value, botId) {
  const withoutBot = String(value || '').replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
  return redactPii(withoutBot).slice(0, 1000);
}
