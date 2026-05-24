import express from "express";
import { handleMessage } from "./handlers/router.js";
import fs from "fs";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;

async function downloadTelegramFile(fileId) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`);
    const data = await res.json();
    const filePath = data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
    const fileRes = await fetch(fileUrl);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const localPath = `/tmp/tg_voice_${Date.now()}.ogg`;
    fs.writeFileSync(localPath, buffer);
    return localPath;
  } catch (err) {
    console.error("Ошибка скачивания файла:", err);
    return null;
  }
}

async function transcribeVoice(filePath) {
  try {
    // Используем Whisper через OpenAI если есть ключ
    if (!process.env.OPENAI_API_KEY) {
      return "[голосовое сообщение — расскажите текстом, пожалуйста]";
    }
    const { default: FormData } = await import("form-data");
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), { filename: "voice.ogg", contentType: "audio/ogg" });
    form.append("model", "whisper-1");
    form.append("language", "ru");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });
    const data = await res.json();
    return data.text || "[не удалось распознать голос]";
  } catch (err) {
    console.error("Ошибка транскрипции:", err);
    return "[не удалось распознать голос]";
  }
}

app.post("/telegram", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) return res.sendStatus(200);

    const chatId = String(message.chat.id);
    let text = "";

    if (message.text) {
      // Обычное текстовое сообщение
      text = message.text;
    } else if (message.voice || message.video_note) {
      // Голосовое или кружочек
      const fileId = message.voice?.file_id || message.video_note?.file_id;
      const localPath = await downloadTelegramFile(fileId);
      if (localPath) {
        text = await transcribeVoice(localPath);
        try { fs.unlinkSync(localPath); } catch(e) {}
      } else {
        text = "[голосовое сообщение]";
      }
    } else {
      return res.sendStatus(200);
    }

    await handleMessage(chatId, text, "telegram");
    res.sendStatus(200);
  } catch (err) {
    console.error("Ошибка:", err);
    res.sendStatus(500);
  }
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_bot_token_123";
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message) {
      const from = message.from;
      const text = message.text?.body || "";
      await handleMessage(from, text, "whatsapp");
    }
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.get("/orders", async (req, res) => {
  const { getOrders } = await import("./db.js");
  res.json(getOrders());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("SPECTO бот запущен!");
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain && TOKEN) {
    const url = "https://" + domain + "/telegram";
    await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook?url=` + url);
    console.log("Webhook: " + url);
  }
});