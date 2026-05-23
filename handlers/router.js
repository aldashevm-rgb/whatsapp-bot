import { askClaude } from "./aiChat.js";
import { sendMessage } from "../whatsapp.js";
import { saveOrder } from "../db.js";

const userState = {};

export async function handleMessage(from, text, platform = "telegram") {
  const lower = text.toLowerCase().trim();

  if (!userState[from]) {
    userState[from] = { step: "start" };
  }

  const state = userState[from];

  if (state.step === "start" || lower === "/start") {
    userState[from].step = "menu";
    await sendMessage(from,
      "Сәлем! Привет! 👋\n\n" +
      "1️⃣ Заказать / Тапсырыс беру\n" +
      "2️⃣ Задать вопрос / Сұрақ қою\n" +
      "3️⃣ Менеджер",
      platform
    );
    return;
  }

  if (state.step === "menu") {
    if (lower === "1" || lower.includes("заказ") || lower.includes("тапсырыс")) {
      userState[from].step = "order_name";
      await sendMessage(from, "Напишите ваше имя / Атыңызды жазыңыз:", platform);
    } else if (lower === "2" || lower.includes("вопрос")) {
      userState[from].step = "ai_chat";
      await sendMessage(from, "Задайте вопрос / Сұрағыңызды жазыңыз:", platform);
    } else if (lower === "3" || lower.includes("менеджер")) {
      userState[from].step = "start";
      await sendMessage(from, "Менеджер скоро свяжется! ✅", platform);
    } else {
      await sendMessage(from, "Выберите:\n1️⃣ Заказать\n2️⃣ Вопрос\n3️⃣ Менеджер", platform);
    }
    return;
  }

  if (state.step === "order_name") {
    userState[from].name = text;
    userState[from].step = "order_details";
    await sendMessage(from, text + ", что хотите заказать?\nНе тапсырыс беруді қалайсыз?", platform);
    return;
  }

  if (state.step === "order_details") {
    const order = {
      phone: from,
      name: userState[from].name,
      details: text,
      date: new Date().toLocaleString("ru-RU")
    };
    saveOrder(order);
    userState[from].step = "start";
    await sendMessage(from, "✅ Заказ принят!\nТапсырыс қабылданды!\n\nМенеджер свяжется скоро!", platform);
    return;
  }

  if (state.step === "ai_chat") {
    await sendMessage(from, "⏳ Думаю...", platform);
    const reply = await askClaude(text);
    await sendMessage(from, reply, platform);
    return;
  }

  if (lower === "меню" || lower === "мәзір" || lower === "/menu") {
    userState[from].step = "start";
    await handleMessage(from, "/start", platform);
  }
}
