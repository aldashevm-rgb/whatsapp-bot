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

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function crmReady() {
  if (!SB_URL || !SB_KEY) {
    console.log("CRM: нет SUPABASE_URL или SUPABASE_SERVICE_KEY, пропускаю");
    return false;
  }
  return true;
}

const sbHeaders = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json"
};

// Создаёт лид в CRM и возвращает его id (uuid) или null
export async function pushLeadToCRM(lead) {
  if (!crmReady()) return null;

  try {
    const sourceMap = { telegram: "Telegram", whatsapp: "WhatsApp" };
    const isWhatsApp = lead.platform === "whatsapp";
    const phoneValue = isWhatsApp ? lead.phone : "";
    const noteValue = isWhatsApp
      ? (lead.details || "")
      : `Telegram ID: ${lead.phone}`;

    const body = {
      name: lead.name || "Новый лид",
      phone: phoneValue,
      source: sourceMap[lead.platform] || "Бот",
      note: noteValue,
      stage_id: "specto_new",
      project_id: "specto",
      assignee: "Алина",
      amount: 0,
      days: 0,
      chat_id: String(lead.phone)
    };

    const res = await fetch(`${SB_URL}/rest/v1/leads`, {
      method: "POST",
      headers: { ...sbHeaders, "Prefer": "return=representation" },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      const leadId = data?.[0]?.id || null;
      console.log("CRM: лид добавлен, id =", leadId);
      return leadId;
    } else {
      const errText = await res.text();
      console.error("CRM: ошибка добавления лида:", res.status, errText);
      return null;
    }
  } catch (err) {
    console.error("CRM: исключение при добавлении лида:", err);
    return null;
  }
}

// Находит lead_id по chat_id (если бот перезапускался и забыл связь)
export async function findLeadByChatId(chatId) {
  if (!crmReady()) return null;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/leads?chat_id=eq.${encodeURIComponent(String(chatId))}&select=id&order=created_at.desc&limit=1`,
      { headers: sbHeaders }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.[0]?.id || null;
    }
    return null;
  } catch (err) {
    console.error("CRM: ошибка поиска лида:", err);
    return null;
  }
}

// Сохраняет одно сообщение переписки
export async function saveMessageToCRM({ leadId, chatId, role, content, platform }) {
  if (!crmReady()) return;
  try {
    const body = {
      lead_id: leadId || null,
      chat_id: String(chatId),
      role,
      content: content || "",
      platform: platform || ""
    };
    const res = await fetch(`${SB_URL}/rest/v1/lead_messages`, {
      method: "POST",
      headers: { ...sbHeaders, "Prefer": "return=minimal" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("CRM: ошибка сохранения сообщения:", res.status, errText);
    }
  } catch (err) {
    console.error("CRM: исключение при сохранении сообщения:", err);
  }
}
