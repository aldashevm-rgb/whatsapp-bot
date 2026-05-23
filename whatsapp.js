import fs from "fs";
import FormData from "form-data";

const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const TG_TOKEN = process.env.TELEGRAM_TOKEN;

export async function sendMessage(to, text, platform = "telegram") {
  if (platform === "telegram") {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: to, text })
    });
  } else {
    await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body: text }
      })
    });
  }
}

export async function sendVoice(to, filePath, platform = "telegram") {
  if (platform === "telegram") {
    const form = new FormData();
    form.append("chat_id", to);
    form.append("voice", fs.createReadStream(filePath), {
      filename: "voice.mp3",
      contentType: "audio/mpeg"
    });
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendVoice`, {
      method: "POST",
      body: form
    });
  }
}

export async function broadcast(numbers, text, platform = "telegram") {
  for (const num of numbers) {
    await sendMessage(num, text, platform);
    await new Promise(r => setTimeout(r, 1500));
  }
}
