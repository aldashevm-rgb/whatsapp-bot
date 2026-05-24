import { askClaude, textToVoice } from "./aiChat.js";
import { sendMessage, sendVoice } from "../whatsapp.js";
import { startFollowUp, cancelFollowUp } from "./followup.js";
import { saveOrder } from "../db.js";
import fs from "fs";

const userHistory = {};
const userStatus = {};
const userMessageCount = {};

const STOP_WORDS = [
  "не нужно", "не надо", "передумал", "передумала",
  "спасибо не нужно", "не интересно", "откажусь", "не актуально"
];

const CALENDLY_LINK = "https://calendly.com/specto/20min";

export async function handleMessage(chatId, text, platform = "telegram", isVoiceMessage = false) {
  const lower = text.toLowerCase();

  if (!userHistory[chatId]) userHistory[chatId] = [];
  if (!userStatus[chatId]) userStatus[chatId] = "active";
  if (!userMessageCount[chatId]) userMessageCount[chatId] = 0;

  userMessageCount[chatId]++;
  cancelFollowUp(chatId);

  const isStop = STOP_WORDS.some(word => lower.includes(word));
  if (isStop) {
    userStatus[chatId] = "stopped";
    await sendMessage(chatId, "Понял вас! Спасибо за честность 🤝 Если в будущем понадобится система роста продаж — всегда рады помочь. Удачи в бизнесе!", platform);
    return;
  }

  if (userStatus[chatId] === "stopped") {
    userStatus[chatId] = "active";
  }

  userHistory[chatId].push({ role: "user", content: text });

  const reply = await askClaude(text, userHistory[chatId].slice(0, -1), CALENDLY_LINK);

  userHistory[chatId].push({ role: "assistant", content: reply });

  if (userHistory[chatId].length > 20) {
    userHistory[chatId] = userHistory[chatId].slice(-20);
  }

  // Всегда отвечаем голосом если есть ключ
  const useVoice = !!process.env.ELEVENLABS_API_KEY;

  if (useVoice) {
    try {
      const voiceFile = await textToVoice(reply);
      if (voiceFile) {
        await sendVoice(chatId, voiceFile, platform);
        try { fs.unlinkSync(voiceFile); } catch(e) {}
      } else {
        await sendMessage(chatId, reply, platform);
      }
    } catch(e) {
      await sendMessage(chatId, reply, platform);
    }
  } else {
    await sendMessage(chatId, reply, platform);
  }

  if (userMessageCount[chatId] === 1) {
    saveOrder({
      phone: chatId,
      name: "Новый лид",
      details: text,
      date: new Date().toLocaleString("ru-RU"),
      platform
    });
  }

  startFollowUp(chatId, (id, msg) => sendMessage(id, msg, platform));
}