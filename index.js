import express from "express";
import { handleMessage } from "./handlers/router.js";
import fs from "fs";
import os from "os";
import path from "path";
import fetch from "node-fetch";
import FormData from "form-data";

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
    const localPath = path.join(os.tmpdir(), `tg_voice_${Date.now()}.ogg`);
    fs.writeFileSync(localPath, buffer);
    console.log("Файл скачан:", localPath);
    return localPath;
  } catch (err) {
    console.error("Ошибка скачивания файла:", err);
    return null;
  }
}

async function transcribeVoice(filePath) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log("OPENAI_API_KEY не задан");
      return null;
    }
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: "voice.ogg",
      contentType: "audio/ogg"
    });
    form.append("model", "whisper-1");
    form.append("language", "ru");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });
    const data = await res.json();
    console.log("Whisper ответ:", JSON.stringify(data));
    return data.text || null;
  } catch (err) {
    console.error("Ошибка транскрипции:", err);
    return null;
  }
}

app.post("/telegram", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) return res.sendStatus(200);

    const chatId = String(message.chat.id);
    let text = "";

    if (message.text) {
      text = message.text;
      console.log("Текст от", chatId, ":", text);
    } else if (message.voice || message.video_note) {
      console.log("Голосовое/кружочек от", chatId);
      const fileId = message.voice?.file_id || message.video_note?.file_id;
      const localPath = await downloadTelegramFile(fileId);
      if (localPath) {
        const transcribed = await transcribeVoice(localPath);
        try { fs.unlinkSync(localPath); } catch(e) {}
        if (transcribed) {
          text = transcribed;
          console.log("Распознано:", text);
        } else {
          text = "Привет, расскажи о своём бизнесе";
        }
      } else {
        text = "Привет, расскажи о своём бизнесе";
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
    const url = `https://${domain}/telegram`;
    await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook?url=` + url);
    console.log("Webhook: " + url);
  }
});