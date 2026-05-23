import express from "express";
import { handleMessage } from "./handlers/router.js";

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;

// Telegram Webhook
app.post("/telegram", async (req, res) => {
  try {
    const message = req.body.message;
    if (message && message.text) {
      const chatId = String(message.chat.id);
      const text = message.text;
      await handleMessage(chatId, text, "telegram");
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Ошибка:", err);
    res.sendStatus(500);
  }
});

app.get("/orders", async (req, res) => {
  const { getOrders } = await import("./db.js");
  const orders = getOrders();
  res.json(orders);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("Бот запущен на порту " + PORT);
  // Регистрируем Webhook в Telegram
  const url = process.env.RAILWAY_PUBLIC_DOMAIN
    ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN + "/telegram"
    : null;
  if (url) {
    await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook?url=${url}`);
    console.log("Webhook установлен: " + url);
  }
});
