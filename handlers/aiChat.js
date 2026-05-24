import fetch from "node-fetch";
import fs from "fs";
import os from "os";
import path from "path";

const SYSTEM_PROMPT = (calendlyLink) => `Ты Алина, менеджер по продажам компании SPECTO.
Система роста продаж под ключ. Оплата ТОЛЬКО 10% с продаж. Без фиксов.
Работаем с мебелью, строительством, недвижимостью, производством, медициной, авто, B2B.
Кейсы: STALFED +278% выручки за 6 мес, Monaco Detailing +189%.

ТВОЯ ЦЕЛЬ: Закрыть клиента на встречу или звонок.

ПРАВИЛА:
- Пиши коротко — 2-3 предложения
- Говори как живой человек
- Выясни какой бизнес и главная проблема
- Если готов созвониться — дай ссылку: ${calendlyLink}
- Если говорит дорого — объясни что 10% только с продаж, риска нет
- Если говорит подумаю — спроси что смущает
- Закрывай: Когда удобно созвониться на 20 минут? ${calendlyLink}
- Если не нужно — вежливо попрощайся`;

export async function askClaude(userMessage, history = [], calendlyLink = "") {
  try {
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
        system: SYSTEM_PROMPT(calendlyLink),
        messages: [...history, { role: "user", content: userMessage }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || "Попробуйте позже.";
  } catch (err) {
    console.error("Ошибка Claude:", err);
    return "Технические неполадки, напишите позже!";
  }
}

export async function textToVoice(text) {
  try {
    console.log("ElevenLabs вызван");
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const url = "https://api.elevenlabs.io/v1/text-to-speech/" + VOICE_ID;
    const res = await fetch(url, {
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
          similarity_boost: 0.75
        }
      })
    });
    if (!res.ok) {
      console.log("ElevenLabs error:", res.status);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const filePath = path.join(os.tmpdir(), `voice_${Date.now()}.mp3`);
    fs.writeFileSync(filePath, buffer);
    console.log("Голос создан:", filePath);
    return filePath;
  } catch (err) {
    console.error("Ошибка голоса:", err);
    return null;
  }
}