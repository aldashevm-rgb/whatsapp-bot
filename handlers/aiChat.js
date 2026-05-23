export async function askClaude(userMessage) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: "Ты помощник магазина. Отвечай кратко. Если клиент пишет на казахском — отвечай на казахском. Если на русском — на русском.",
        messages: [{ role: "user", content: userMessage }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text || "Извините, менеджер скоро ответит!";
  } catch (err) {
    return "Извините, сейчас не могу ответить. Менеджер свяжется!";
  }
}
