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
  const data = await post('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      input: prompt,
      max_output_tokens: 2000,
      store: false,
      reasoning: { effort: 'low' },
      text: {
        format: {
          type: 'json_schema',
          name: 'day2_summary',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              key_points: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    text: { type: 'string' },
                    citations: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['text', 'citations'],
                },
              },
              actions: { type: 'array', items: { type: 'string' } },
              warning: { type: ['string', 'null'] },
            },
            required: ['title', 'key_points', 'actions', 'warning'],
          },
        },
      },
    }),
  });
  const content = data.output?.flatMap((item) => item.content || [])
    .find((item) => item.type === 'output_text')?.text;
  if (!content) throw new Error('Không nhận response từ AI');
  return content;
}

async function callText(prompt, maxOutputTokens = 700) {
  const data = await post('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      input: prompt,
      max_output_tokens: maxOutputTokens,
      store: false,
      reasoning: { effort: 'low' },
    }),
  });
  const content = data.output?.flatMap((item) => item.content || [])
    .find((item) => item.type === 'output_text')?.text;
  if (!content) throw new Error('Không nhận response từ AI');
  return content.trim();
}

export function validateWorkshopOutput(answer, source) {
  const validCodes = new Set(String(source || '').match(/WS[12]-\d{3}/g) || []);
  if (!validCodes.size) return true;
  const citedCodes = String(answer || '').match(/WS[12]-\d{3}/g) || [];
  return citedCodes.length > 0 && citedCodes.every((code) => validCodes.has(code));
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
  if (!sources.trim()) return 'Mình chưa tìm thấy bài học, lịch hoặc Workshop phù hợp với câu hỏi.';
  const prompt = prompts.answerFromLearningSources(question, sources);
  const answer = redactPii(await callText(prompt, 900)).slice(0, 1900);
  return validateWorkshopOutput(answer, sources)
    ? answer
    : 'Mình chưa thể tạo câu trả lời có trích dẫn Workshop hợp lệ lúc này.';
}

export async function summarizeWorkshop(source, label) {
  if (!source.trim()) return '';
  const prompt = prompts.summarizeWorkshop(label, source);
  const answer = redactPii(await callText(prompt, 650)).slice(0, 1200);
  return validateWorkshopOutput(answer, source)
    ? answer
    : 'Mình chưa thể tạo tóm tắt có trích dẫn Workshop hợp lệ lúc này.';
}

export async function summarizeWorkshopDaily(source, label) {
  if (!source.trim()) return '';
  const prompt = prompts.summarizeWorkshopDaily(label, source);
  const answer = redactPii(await callText(prompt, 300))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 420);
  return validateWorkshopOutput(answer, source)
    ? answer
    : 'Chưa thể tạo tóm tắt có trích dẫn Workshop hợp lệ.';
}

export async function summarizeLessonPage(text) {
  if (!text) return '';
  const prompt = prompts.summarizeLessonPage(text);
  return redactPii(await callText(prompt, 320)).replace(/\s+/g, ' ').slice(0, 360);
}
