import fs from "fs";
import FormData from "form-data";

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;

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
  console.log("sendVoice вызван:", to, filePath, platform);

  if (platform === "telegram") {
    const form = new FormData();
    form.append("chat_id", String(to));
    form.append("voice", fs.createReadStream(filePath), {
      filename: "voice.mp3",
      contentType: "audio/mpeg"
    });

    const res = await fetch(
      `https://api.telegram.org/bot${TG_TOKEN}/sendVoice`,
      { method: "POST", body: form }
    );
    const data = await res.json();
    console.log("Telegram sendVoice ответ:", JSON.stringify(data).slice(0, 100));
    return;
  }

  if (platform === "whatsapp") {
    const mediaForm = new FormData();
    mediaForm.append("file", fs.createReadStream(filePath), {
      filename: "voice.mp3",
      contentType: "audio/mpeg"
    });
    mediaForm.append("messaging_product", "whatsapp");

    const mediaRes = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${WA_TOKEN}` },
        body: mediaForm
      }
    );
    const mediaData = await mediaRes.json();
    console.log("WhatsApp media upload ответ:", JSON.stringify(mediaData).slice(0, 200));

    if (!mediaData.id) {
      throw new Error("WhatsApp media upload failed");
    }

    const res = await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WA_TOKEN}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "audio",
        audio: { id: mediaData.id }
      })
    });
    const data = await res.json();
    console.log("WhatsApp sendVoice ответ:", JSON.stringify(data).slice(0, 200));
    return;
  }

  throw new Error(`Unsupported voice platform: ${platform}`);
}

export async function broadcast(numbers, text, platform = "telegram") {
  for (const num of numbers) {
    await sendMessage(num, text, platform);
    await new Promise(r => setTimeout(r, 1500));
  }
}