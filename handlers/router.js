import { askClaude, textToVoice } from "./aiChat.js";
import { sendMessage, sendVoice } from "../whatsapp.js";
import { startFollowUp, cancelFollowUp } from "./followup.js";
import { saveOrder, pushLeadToCRM, findLeadByChatId, saveMessageToCRM } from "../db.js";
import fs from "fs";
const userHistory = {};
const userStatus = {};
const userMessageCount = {};
const userLeadId = {};
const STOP_WORDS = [
  "не нужно", "не надо", "передумал", "передумала",
  "спасибо не нужно", "не интересно", "откажусь", "не актуально"
];
const CALENDLY_LINK = process.env.CALENDLY_LINK || "https://calendly.com/aldashevm83/30min";

async function ensureLeadId(chatId, firstText, platform) {
  if (userLeadId[chatId]) return userLeadId[chatId];
  // Бот мог перезапуститься — попробуем найти существующий лид
  let leadId = await findLeadByChatId(chatId);
  if (!leadId) {
    const leadData = {
      phone: chatId,
      name: "Новый лид",
      details: firstText,
      date: new Date().toLocaleString("ru-RU"),
      platform
    };
    saveOrder(leadData);
    leadId = await pushLeadToCRM(leadData);
  }
  userLeadId[chatId] = leadId;
  return leadId;
}

export async function handleMessage(chatId, text, platform = "telegram", isVoice = false) {
  const lower = text.toLowerCase();
  if (!userHistory[chatId]) userHistory[chatId] = [];
  if (!userStatus[chatId]) userStatus[chatId] = "active";
  if (!userMessageCount[chatId]) userMessageCount[chatId] = 0;
  userMessageCount[chatId]++;
  cancelFollowUp(chatId);

  // Гарантируем что лид существует, и берём его id
  const leadId = await ensureLeadId(chatId, text, platform);

  // Сохраняем входящее сообщение клиента
  await saveMessageToCRM({ leadId, chatId, role: "user", content: text, platform });

  const isStop = STOP_WORDS.some(word => lower.includes(word));
  if (isStop) {
    userStatus[chatId] = "stopped";
    const byeMsg = "Понял вас! Спасибо за честность 🤝 Если в будущем понадобится система роста продаж — всегда рады помочь. Удачи в бизнесе!";
    await sendMessage(chatId, byeMsg, platform);
    await saveMessageToCRM({ leadId, chatId, role: "assistant", content: byeMsg, platform });
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

  // Сохраняем ответ Алины
  await saveMessageToCRM({ leadId, chatId, role: "assistant", content: reply, platform });

  const mentionsCalendly = reply.includes("calendly.com") ||
    reply.includes(CALENDLY_LINK) ||
    lower.includes("записаться") ||
    lower.includes("созвониться") ||
    lower.includes("звонок") ||
    lower.includes("встреч");
  if (isVoice && !!process.env.ELEVENLABS_API_KEY) {
    // Клиент написал голосом — отвечаем голосом
    try {
      const replyForVoice = reply.replace(/https?:\/\/\S+/g, "").trim();
      const voiceFile = await textToVoice(replyForVoice || reply);
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
    // Клиент написал текстом — отвечаем текстом
    await sendMessage(chatId, reply, platform);
  }
  // Ссылка Calendly всегда текстом
  if (mentionsCalendly) {
    const calMsg = `📅 Записаться на звонок: ${CALENDLY_LINK}`;
    await sendMessage(chatId, calMsg, platform);
    await saveMessageToCRM({ leadId, chatId, role: "assistant", content: calMsg, platform });
  }
  startFollowUp(chatId, (id, msg) => sendMessage(id, msg, platform));
}
