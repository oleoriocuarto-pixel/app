import { getStore } from "@netlify/blobs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const VALID_PEOPLE = new Set(["TOBIAS", "MATIAS", "NICOLAS", "SOFIA"]);

function send(statusCode, payload) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  };
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeReminder(input, existing = {}) {
  const now = new Date().toISOString();
  const text = String(input.text || "").trim();
  const createdBy = String(input.createdBy || existing.createdBy || "").trim().toUpperCase();

  if (!text) {
    throw new Error("El recuerdo necesita una descripcion.");
  }
  if (!createdBy) {
    throw new Error("Tenes que indicar quien carga el recuerdo.");
  }
  if (!VALID_PEOPLE.has(createdBy)) {
    throw new Error("La persona que carga debe ser TOBIAS, MATIAS, NICOLAS o SOFIA.");
  }

  return {
    id: existing.id || randomId(),
    text,
    createdBy,
    type: String(input.type || "General").trim() || "General",
    dueDate: input.dueDate ? String(input.dueDate) : "",
    notes: String(input.notes || "").trim(),
    completed: Boolean(input.completed ?? existing.completed ?? false),
    createdAt: existing.createdAt || now,
    updatedAt: now,
    completedAt: input.completed ? existing.completedAt || now : "",
  };
}

async function readReminders(store) {
  const data = await store.get("reminders", { type: "json" });
  return Array.isArray(data) ? data : [];
}

async function writeReminders(store, reminders) {
  await store.setJSON("reminders", reminders);
}

function getReminderId(event) {
  const marker = "/.netlify/functions/reminders/";
  if (!event.path.includes(marker)) return "";
  return decodeURIComponent(event.path.slice(event.path.indexOf(marker) + marker.length));
}

export const handler = async (event) => {
  try {
    const store = getStore("recordatorios");
    const reminders = await readReminders(store);
    const id = getReminderId(event);

    if (event.httpMethod === "GET" && !id) {
      return send(200, reminders);
    }

    if (event.httpMethod === "POST" && !id) {
      const body = JSON.parse(event.body || "{}");
      const reminder = normalizeReminder(body);
      reminders.unshift(reminder);
      await writeReminders(store, reminders);
      return send(201, reminder);
    }

    if (event.httpMethod === "PUT" && id) {
      const index = reminders.findIndex((item) => item.id === id);
      if (index === -1) {
        return send(404, { error: "No se encontro el recuerdo." });
      }
      const body = JSON.parse(event.body || "{}");
      reminders[index] = normalizeReminder(body, reminders[index]);
      await writeReminders(store, reminders);
      return send(200, reminders[index]);
    }

    if (event.httpMethod === "DELETE" && id) {
      const next = reminders.filter((item) => item.id !== id);
      if (next.length === reminders.length) {
        return send(404, { error: "No se encontro el recuerdo." });
      }
      await writeReminders(store, next);
      return send(200, { ok: true });
    }

    return send(404, { error: "Ruta no encontrada." });
  } catch (error) {
    return send(400, { error: error.message || "No se pudo procesar la solicitud." });
  }
};
