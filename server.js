const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "reminders.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const VALID_PEOPLE = new Set(["TOBIAS", "MATIAS", "NICOLAS", "SOFIA"]);

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function readReminders() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReminders(reminders) {
  ensureDataFile();
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(reminders, null, 2), "utf8");
  fs.renameSync(tempFile, DATA_FILE);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("El contenido es demasiado grande."));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
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
    id: existing.id || cryptoRandomId(),
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

function cryptoRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const safePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const decodedPath = decodeURIComponent(safePath).replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, decodedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(data);
  });
}

async function handleApi(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const reminders = readReminders();
  const queryId = requestUrl.searchParams.get("id") || "";

  if (request.method === "GET" && requestUrl.pathname === "/api/reminders") {
    sendJson(response, 200, reminders);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/reminders") {
    const body = JSON.parse(await readBody(request) || "{}");
    const reminder = normalizeReminder(body);
    reminders.unshift(reminder);
    writeReminders(reminders);
    sendJson(response, 201, reminder);
    return;
  }

  const match = requestUrl.pathname.match(/^\/api\/reminders\/([^/]+)$/);
  const idFromRequest = queryId || (match ? decodeURIComponent(match[1]) : "");
  if (idFromRequest && request.method === "PUT") {
    const id = idFromRequest;
    const index = reminders.findIndex((item) => item.id === id);
    if (index === -1) {
      sendJson(response, 404, { error: "No se encontro el recuerdo." });
      return;
    }
    const body = JSON.parse(await readBody(request) || "{}");
    reminders[index] = normalizeReminder(body, reminders[index]);
    writeReminders(reminders);
    sendJson(response, 200, reminders[index]);
    return;
  }

  if (idFromRequest && request.method === "DELETE") {
    const id = idFromRequest;
    const next = reminders.filter((item) => item.id !== id);
    if (next.length === reminders.length) {
      sendJson(response, 404, { error: "No se encontro el recuerdo." });
      return;
    }
    writeReminders(next);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "Ruta no encontrada." });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/")) {
      await handleApi(request, response);
      return;
    }
    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 400, { error: error.message || "No se pudo procesar la solicitud." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Recordatorios listo en http://localhost:${PORT}`);
  console.log(`Para otros dispositivos de la red, abrir http://IP-DE-ESTA-PC:${PORT}`);
});
