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
- Если не нужно — вежливо попрощайся

ФОРМАТ ОТВЕТА (строго):
- В ответе — ТОЛЬКО готовый текст сообщения клиенту, слово в слово как он его увидит.
- НИКАКОГО анализа переписки, рассуждений, объяснений своих решений.
- НИКАКИХ служебных пометок, разделителей "---", markdown-звёздочек *...*.
- Не пиши «отправлять дожим уместно/неуместно», «единственный вариант», «если прошло время» и подобное — это внутренняя кухня, клиент её видеть не должен.
- Просто напиши сообщение, которое отправится клиенту напрямую.`;

// --- Защита от утечки «внутренней кухни» модели в чат клиента ---
// Даже если промпт «разболтается» и модель начнёт рассуждать вслух (анализ,
// разделители ---, служебные пометки), этот фильтр вырежет всё, кроме самого
// сообщения клиенту. Если чистое сообщение выделить не удалось — вернём
// нейтральную заглушку, но НИКОГДА не отправим клиенту рассуждения.

const SEP_RE = /^\s*-{3,}\s*$/;
const GREETING_RE = /(добрый день|день добрый|добрый вечер|доброе утро|здравствуй|привет)/i;

// Обороты, которые выдают рассуждение/инструкцию самой себе, а не речь клиенту.
const META_MARKERS = [
  /в данном случае/i,
  /диалог(?:\s+\S+){0,3}\s+заверш/i,
  /отправлять\s+дожим/i,
  /дожим\s+здесь/i,
  /\bнеуместно\b/i,
  /единственн\S*\s+разумн\S*\s+вариант/i,
  /\bнавязчив/i,
  /лучше\s+не\s+писать/i,
  /если\s+времени\s+прошло/i,
  /\bреферал\b/i,
  /\breferal\b/i
];

function looksLikeMeta(s) {
  if (/\*[^*\n]+\*/.test(s)) return true;            // *жирная служебная пометка*
  return META_MARKERS.some(re => re.test(s));
}

export const SAFE_FALLBACK = "Секунду, уточню детали и вернусь к вам 🙏";

// Чистая функция (тестируется без сети): сырой ответ модели → текст для клиента.
export function sanitizeReply(raw) {
  const text = (raw == null ? "" : String(raw)).trim();
  if (!text) return SAFE_FALLBACK;

  const lines = text.split(/\r?\n/);
  const hasSeparator = lines.some(l => SEP_RE.test(l));
  // Чистый обычный ответ — не трогаем.
  if (!hasSeparator && !looksLikeMeta(text)) return text;

  // Разбиваем по разделителям --- и выкидываем «мета»-сегменты.
  const segments = [];
  let cur = [];
  for (const l of lines) {
    if (SEP_RE.test(l)) { segments.push(cur.join("\n").trim()); cur = []; }
    else cur.push(l);
  }
  segments.push(cur.join("\n").trim());

  const clean = segments.filter(s => s && !looksLikeMeta(s));
  // Сообщение клиенту обычно начинается с приветствия — предпочитаем такой сегмент.
  const greeted = clean.filter(s => GREETING_RE.test(s));
  const candidates = greeted.length ? greeted : clean;

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    return candidates.sort((a, b) => b.length - a.length)[0];
  }
  // Ничего чистого не осталось — лучше нейтральная заглушка, чем «кухня».
  return SAFE_FALLBACK;
}

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
    const rawText = data.content?.[0]?.text;
    if (!rawText) return "Попробуйте позже.";
    // Страховка: клиенту уходит только сообщение, без рассуждений модели.
    return sanitizeReply(rawText);
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