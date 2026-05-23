import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const SYSTEM_PROMPT = `Ты — Алина, менеджер по продажам компании SPECTO. Ты общаешься с потенциальным клиентом в мессенджере.

О SPECTO:
- Система роста продаж под ключ
- Берём весь цикл: маркетинг + контент + отдел продаж
- Оплата ТОЛЬКО 10% с фактических продаж. Без фиксов. Без окладов.
- Клиент не рискует деньгами — платит только когда зарабатывает
- Работаем с бизнесами: мебель, строительство, недвижимость, производство, медицина, авто, B2B, франшизы
- Кейсы: STALFED +278% выручки за 6 мес, Monaco Detailing +189% выручки, корпусная мебель +173%

ТВОЯ ЦЕЛЬ: Закрыть клиента на встречу или звонок с руководителем SPECTO.

ПРАВИЛА:
- Пиши коротко — максимум 3-4 предложения
- Говори как живой человек, не как робот
- Сначала выясни какой бизнес и какая главная проблема
- Если говорит дорого — объясни что 10% только с продаж, риска нет
- Если говорит подумаю — спроси что именно смущает
- Закрывай фразой: Когда вам удобно созвониться на 20 минут?
- Если клиент говорит не нужно — вежливо попрощайся`;

export async function askClaude(userMessage, history = []) {
  try {
    const messages = [...history, { role: "user", content: userMessage }];
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || "Извините, попробуйте позже.";
  } catch (err) {
    console.error("Ошибка Claude:", err);
    return "Извините, технические неполадки!";
  }
}

export async function textToVoice(text) {
  try {
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true
          }
        })
      }
    );
    if (!res.ok) return null;
    const buffer = await res.buffer();
    const filePath = path.join("/tmp", `voice_${Date.now()}.mp3`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (err) {
    console.error("Ошибка ElevenLabs:", err);
    return null;
  }
}

export function shouldUseVoice(messageCount, isVoiceMessage = false) {
  if (isVoiceMessage) return true;
  if (messageCount % 3 === 0) return true;
  return false;
}
