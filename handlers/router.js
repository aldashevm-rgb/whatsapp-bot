import { askClaude } from "./aiChat.js";
import { sendMessage } from "../whatsapp.js";
import { saveOrder } from "../db.js";

const userState = {};

export async function handleMessage(from, text) {
  const lower = text.toLowerCase().trim();

  if (!userState[from]) {
    userState[from] = { step: "start" };
  }

  const state = userState[from];

  if (state.step === "start") {
    userState[from].step = "menu";
    await sendMessage(from,
      "Сәлем! Привет! 👋\n\n" +
      "1️⃣ Заказать / Тапсырыс беру\n" +
      "2️⃣ Задать вопрос / Сұрақ қою\n" +
      "3️⃣ Менеджер"
    );
    return;
  }

  if (state.step === "menu") {
    if (lower === "1" || lower.includes("заказ") || lower.includes("тапсырыс")) {
      userState[from].step = "order_name";
      await sendMessage(from, "Напишите ваше имя / Атыңызды жазыңыз:");
    } else if (lower === "2" || lower.includes("вопрос")) {
      userState[from].step = "ai_chat";
      await sendMessage(from, "Задайте вопрос / Сұрағыңызды жазыңыз:");
    } else if (lower === "3" || lower.includes("менеджер")) {
      userState[from].step = "start";
      await sendMessage(from, "Менеджер скоро свяжется! ✅");
    } else {
      await sendMessage(from, "Выберите:\n1️⃣ Заказать\n2️⃣ Вопрос\n3️⃣ Менеджер");
    }
    return;
  }

  if (state.step === "order_name") {
    userState[from].name = text;
    userState[from].step = "order_details";
    await sendMessage(from, text + ", что хотите заказать? / Не тапсырыс беруді қалайсыз?");
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
    await sendMessage(from, "✅ Заказ принят! Менеджер свяжется скоро!\nТапсырыс қабылданды!");
    return;
  }

  if (state.step === "ai_chat") {
    await sendMessage(from, "⏳ Думаю...");
    const reply = await askClaude(text);
    await sendMessage(from, reply);
    return;
  }

  if (lower === "меню" || lower === "мәзір") {
    userState[from].step = "start";
    await handleMessage(from, "start");
  }
}
