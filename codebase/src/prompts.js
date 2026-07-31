export const systemPrompts = {
  summarize: {
    base: (count, part) => {
      return `Bạn là một chuyên gia tóm tắt học liệu. Hãy tóm tắt nội dung dưới đây thành ${count} điểm chính trong JSON format.

Transcript (${part.label}):
${part.context}

Trả về JSON có cấu trúc sau:
{
  "title": "Tiêu đề bản tóm tắt",
  "key_points": [
    {
      "text": "Điểm chính 1",
      "citations": ["mã tham chiếu từ transcript"]
    }
  ],
  "actions": ["Gợi ý ôn tập 1", "Gợi ý ôn tập 2"]
}

Lưu ý: citations phải là mã từ transcript (T01-001, T01-002, v.v).`;
    },
  },
};
