import express from "express";
import { handleMessage } from "./handlers/router.js";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_bot_token_123";

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    if (message) {
      const from = message.from;
      const text = message.text?.body || "";
      await handleMessage(from, text);
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
app.listen(PORT, () => console.log("Бот запущен на порту " + PORT));
