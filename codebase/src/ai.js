import { config } from './config.js';
import { redactPii } from './privacy.js';
import { prompts } from './prompts.js';

function extractJson(text) {
  if (!text || typeof text !== 'string') throw new Error('Response không hợp lệ');
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI không trả JSON hợp lệ');
  const jsonStr = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`JSON parse lỗi: ${e.message}`);
  }
}

async function post(url, options) {
  if (!config.ai.apiKey) throw new Error('API key không được cấu hình');
  const signal = AbortSignal.timeout(config.ai.timeoutMs);
  const response = await fetch(url, { ...options, signal });
  if (!response.ok) throw new Error(`AI provider HTTP ${response.status}`);
  return response.json();
}

async function callOpenAI(prompt) {
  const data = await post('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0,
    }),
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Không nhận response từ AI');
  return content;
}

async function callText(prompt, maxOutputTokens = 700) {
  const data = await post('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxOutputTokens,
      temperature: 0,
    }),
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Không nhận response từ AI');
  return content.trim();
}

export async function summarize(part, detail) {
  const count = detail === 'day-du' ? '5 đến 7' : '3 đến 4';
  const prompt = prompts.summarize(count, part);
  const text = await callOpenAI(prompt);
  return extractJson(text);
}

export async function answerFromTranscripts(question, sources) {
  const prompt = prompts.answerFromTranscripts(question, sources);
  return redactPii(await callText(prompt, 900)).slice(0, 1900);
}

export async function answerFromLearningSources(question, sources) {
  if (!sources.trim()) return 'Mình chưa tìm thấy lịch, PDF hoặc transcript Workshop phù hợp với câu hỏi.';
  const prompt = prompts.answerFromLearningSources(question, sources);
  return redactPii(await callText(prompt, 900)).slice(0, 1900);
}

export async function summarizeWorkshop(source, label) {
  if (!source.trim()) return '';
  const prompt = prompts.summarizeWorkshop(label, source);
  return redactPii(await callText(prompt, 650)).slice(0, 1200);
}

export async function summarizeWorkshopDaily(source, label) {
  if (!source.trim()) return '';
  const prompt = prompts.summarizeWorkshopDaily(label, source);
  return redactPii(await callText(prompt, 300))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 420);
}

export async function summarizeLessonPage(text) {
  if (!text) return '';
  const prompt = prompts.summarizeLessonPage(text);
  return redactPii(await callText(prompt, 250)).replace(/\s+/g, ' ').slice(0, 240);
}
