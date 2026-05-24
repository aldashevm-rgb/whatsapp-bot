import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const SYSTEM_PROMPT = `Ты Алина, менеджер SPECTO. Система роста продаж под ключ. Оплата 10% с продаж. Работаем с мебелью, строительством, недвижимостью, производством, медициной, авто, B2B. Кейсы: STALFED +278% выручки за 6 мес. ЦЕЛЬ: закрыть на звонок. Пиши коротко 2-3 предложения. Живо, не как робот. Заканчивай: Когда удобно созвониться на 20 минут?`;

export async function askClaude(userMessage, history = []) {
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
        system: SYSTEM_PROMPT,
        messages: [...history, { role: "user", content: userMessage }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || "Попробуйте позже.";
  } catch (err) {
    return "Технические неполадки!";
  }
}

export async function textToVoice(text) {
  try {
    console.log("ElevenLabs вызван");
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
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );
    if (!res.ok) {
      console.log("ElevenLabs error:", res.status);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const filePath = path.join("/tmp", `voice_${Date.now()}.mp3`);
    fs.writeFileSync(filePath, buffer);
    console.log("Голос создан:", filePath);
    return filePath;
  } catch (err) {
    console.error("Ошибка голоса:", err);
    return null;
  }
}
