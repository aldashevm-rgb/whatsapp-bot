import fs from "fs";
const DB_FILE = "./orders.json";
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

export function saveOrder(order) {
  const orders = getOrders();
  order.id = Date.now();
  orders.push(order);
  fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2));
  console.log("Новый заказ от " + order.name);
}

export function getOrders() {
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Отправка лида в CRM (Supabase)
export async function pushLeadToCRM(lead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.log("CRM: нет SUPABASE_URL или SUPABASE_SERVICE_KEY, пропускаю");
    return;
  }

  try {
    const sourceMap = { telegram: "Telegram", whatsapp: "WhatsApp" };

    // Для WhatsApp lead.phone — настоящий номер.
    // Для Telegram lead.phone — это chat_id, не телефон.
    const isWhatsApp = lead.platform === "whatsapp";
    const phoneValue = isWhatsApp ? lead.phone : "";
    const noteValue = isWhatsApp
      ? (lead.details || "")
      : `Telegram ID: ${lead.phone}\n\nПервое сообщение: ${lead.details || ""}`;

    const body = {
      name: lead.name || "Новый лид",
      phone: phoneValue,
      source: sourceMap[lead.platform] || "Бот",
      note: noteValue,
      stage_id: "specto_new",
      project_id: "specto",
      assignee: "Алина",
      amount: 0,
      days: 0
    };

    const res = await fetch(`${url}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      console.log("CRM: лид добавлен в воронку SPECTO");
    } else {
      const errText = await res.text();
      console.error("CRM: ошибка добавления лида:", res.status, errText);
    }
  } catch (err) {
    console.error("CRM: исключение при добавлении лида:", err);
  }
}
