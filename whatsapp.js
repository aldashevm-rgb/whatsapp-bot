const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;

export async function sendMessage(to, text) {
  try {
    await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body: text }
      })
    });
  } catch (err) {
    console.error("Ошибка отправки:", err);
  }
}

export async function broadcast(numbers, text) {
  for (const num of numbers) {
    await sendMessage(num, text);
    await new Promise(r => setTimeout(r, 1500));
  }
}
