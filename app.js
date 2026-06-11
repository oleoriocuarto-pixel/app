const state = {
  reminders: [],
  didOpenInitialDialog: false,
  isSyncing: false,
};

const els = {
  saveStatus: document.querySelector("#saveStatus"),
  openCreate: document.querySelector("#openCreate"),
  floatingCreate: document.querySelector("#floatingCreate"),
  createDialog: document.querySelector("#createDialog"),
  cancelCreate: document.querySelector("#cancelCreate"),
  form: document.querySelector("#reminderForm"),
  createdBy: document.querySelector("#createdBy"),
  text: document.querySelector("#text"),
  type: document.querySelector("#type"),
  dueDate: document.querySelector("#dueDate"),
  notes: document.querySelector("#notes"),
  search: document.querySelector("#search"),
  typeFilter: document.querySelector("#typeFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  fromDate: document.querySelector("#fromDate"),
  toDate: document.querySelector("#toDate"),
  summary: document.querySelector("#summary"),
  list: document.querySelector("#reminderList"),
  overdueList: document.querySelector("#overdueList"),
  overdueCount: document.querySelector("#overdueCount"),
  template: document.querySelector("#reminderTemplate"),
  columnTemplate: document.querySelector("#columnTemplate"),
  editDialog: document.querySelector("#editDialog"),
  editForm: document.querySelector("#editForm"),
  editId: document.querySelector("#editId"),
  editCreatedBy: document.querySelector("#editCreatedBy"),
  editText: document.querySelector("#editText"),
  editType: document.querySelector("#editType"),
  editDueDate: document.querySelector("#editDueDate"),
  editNotes: document.querySelector("#editNotes"),
  cancelEdit: document.querySelector("#cancelEdit"),
};

function todayValue() {
  return new Date().toLocaleDateString("en-CA");
}

function setStatus(text, mode = "idle") {
  els.saveStatus.textContent = text;
  els.saveStatus.dataset.mode = mode;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "No se pudo guardar.");
  }
  return response.json();
}

async function loadReminders() {
  setStatus("Cargando...");
  state.reminders = await api("/api/reminders");
  setStatus("Guardado");
  resetCreateForm();
  render();
  if (!state.didOpenInitialDialog) {
    state.didOpenInitialDialog = true;
    openCreateDialog();
  }
}

async function syncReminders() {
  if (state.isSyncing) return;
  state.isSyncing = true;
  try {
    const reminders = await api("/api/reminders");
    const previous = JSON.stringify(state.reminders);
    const next = JSON.stringify(reminders);
    if (previous !== next) {
      state.reminders = reminders;
      render();
      setStatus("Actualizado");
    }
  } catch (error) {
    setStatus("Sin conexion", "error");
  } finally {
    state.isSyncing = false;
  }
}

function resetCreateForm() {
  const previousPerson = els.createdBy.value.trim();
  els.form.reset();
  els.createdBy.value = isKnownPerson(previousPerson) ? previousPerson : "";
  els.dueDate.value = todayValue();
}

function isKnownPerson(value) {
  return ["TOBIAS", "MATIAS", "NICOLAS", "SOFIA"].includes(value);
}

function openCreateDialog() {
  resetCreateForm();
  if (!els.createDialog.open) {
    els.createDialog.showModal();
  }
  els.createdBy.focus();
}

function closeDialogOnBackdrop(event) {
  if (event.target === event.currentTarget) {
    event.currentTarget.close();
  }
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function expirationDate(item) {
  const base = item.createdAt ? new Date(item.createdAt) : new Date();
  return addDays(base, 7);
}

function formatDateTime(date) {
  return formatDate(date.toLocaleDateString("en-CA"));
}

function isOverdue(item) {
  return !item.completed && expirationDate(item) < new Date();
}

function uniqueTypes() {
  return [...new Set(state.reminders.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function renderTypeFilter() {
  const current = els.typeFilter.value;
  els.typeFilter.innerHTML = '<option value="">Todos</option>';
  uniqueTypes().forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    els.typeFilter.append(option);
  });
  els.typeFilter.value = [...els.typeFilter.options].some((option) => option.value === current) ? current : "";
}

function filteredReminders() {
  const query = els.search.value.trim().toLowerCase();
  const type = els.typeFilter.value;
  const status = els.statusFilter.value;
  const from = els.fromDate.value;
  const to = els.toDate.value;

  return state.reminders.filter((item) => {
    const haystack = `${item.text} ${item.createdBy || ""} ${item.type} ${item.notes}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesType = !type || item.type === type;
    const matchesStatus =
      status === "all" || (status === "completed" ? item.completed : !item.completed);
    const matchesFrom = !from || (item.dueDate && item.dueDate >= from);
    const matchesTo = !to || (item.dueDate && item.dueDate <= to);
    return matchesQuery && matchesType && matchesStatus && matchesFrom && matchesTo;
  });
}

function renderSummary(items) {
  const pending = state.reminders.filter((item) => !item.completed).length;
  const completed = state.reminders.length - pending;
  const overdue = state.reminders.filter(isOverdue).length;
  els.summary.innerHTML = "";
  [
    `${items.length} en vista`,
    `${pending} pendientes`,
    `${completed} cumplidos`,
    `${overdue} vencidos`,
  ].forEach((text) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = text;
    els.summary.append(pill);
  });
}

function renderList(items) {
  els.list.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No hay recuerdos con esos filtros.";
    els.list.append(empty);
    return;
  }

  groupedByType(items).forEach(([type, group]) => {
    const column = els.columnTemplate.content.firstElementChild.cloneNode(true);
    column.dataset.type = type;
    column.querySelector("h2").textContent = type;
    column.querySelector("span").textContent = group.length;
    const columnList = column.querySelector(".column-list");
    group.forEach((item) => columnList.append(createReminderNode(item)));
    els.list.append(column);
  });
}

function groupedByType(items) {
  const groups = new Map();
  items.forEach((item) => {
    const type = item.type || "General";
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(item);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function createReminderNode(item) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.classList.toggle("completed", item.completed);
  node.classList.toggle("overdue", isOverdue(item));
  node.dataset.type = item.type || "General";
  node.querySelector(".reminder-text").textContent = item.text;
  node.querySelector(".meta").textContent = `${item.type} - ${formatDate(item.dueDate)} - Cargo: ${item.createdBy || "Sin responsable"} - Vence: ${formatDateTime(expirationDate(item))}`;
  const notes = node.querySelector(".reminder-notes");
  notes.textContent = item.notes || "";
  notes.hidden = !item.notes;
  node.querySelector(".check").addEventListener("click", () => toggleCompleted(item));
  node.querySelector(".edit").addEventListener("click", () => openEdit(item));
  node.querySelector(".delete").addEventListener("click", () => deleteReminder(item));
  return node;
}

function renderOverdue() {
  const items = state.reminders.filter(isOverdue).sort((a, b) => expirationDate(a) - expirationDate(b));
  els.overdueList.innerHTML = "";
  els.overdueCount.textContent = items.length;
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty small";
    empty.textContent = "Sin vencidas.";
    els.overdueList.append(empty);
    return;
  }
  items.forEach((item) => els.overdueList.append(createReminderNode(item)));
}

function render() {
  renderTypeFilter();
  const items = filteredReminders();
  renderSummary(items);
  renderList(items);
  renderOverdue();
}

async function createReminder(event) {
  event.preventDefault();
  setStatus("Guardando...");
  const payload = {
    createdBy: els.createdBy.value,
    text: els.text.value,
    type: els.type.value,
    dueDate: els.dueDate.value,
    notes: els.notes.value,
  };
  const saved = await api("/api/reminders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  state.reminders.unshift(saved);
  resetCreateForm();
  els.createDialog.close();
  setStatus("Guardado");
  render();
}

async function updateReminder(item, patch) {
  setStatus("Guardando...");
  const updated = await api(`/api/reminders?id=${encodeURIComponent(item.id)}`, {
    method: "PUT",
    body: JSON.stringify({ ...item, ...patch }),
  });
  state.reminders = state.reminders.map((current) => (current.id === updated.id ? updated : current));
  setStatus("Guardado");
  render();
}

function toggleCompleted(item) {
  updateReminder(item, { completed: !item.completed }).catch((error) => setStatus(error.message, "error"));
}

async function deleteReminder(item) {
  const ok = confirm(`Borrar este recuerdo?\n\n${item.text}`);
  if (!ok) return;
  setStatus("Guardando...");
  await api(`/api/reminders?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
  state.reminders = state.reminders.filter((current) => current.id !== item.id);
  setStatus("Guardado");
  render();
}

function openEdit(item) {
  els.editId.value = item.id;
  els.editCreatedBy.value = isKnownPerson(item.createdBy) ? item.createdBy : "";
  els.editText.value = item.text;
  els.editType.value = item.type;
  els.editDueDate.value = item.dueDate || "";
  els.editNotes.value = item.notes || "";
  els.editDialog.showModal();
}

async function saveEdit(event) {
  event.preventDefault();
  const item = state.reminders.find((current) => current.id === els.editId.value);
  if (!item) return;
  await updateReminder(item, {
    createdBy: els.editCreatedBy.value,
    text: els.editText.value,
    type: els.editType.value,
    dueDate: els.editDueDate.value,
    notes: els.editNotes.value,
  });
  els.editDialog.close();
}

els.openCreate.addEventListener("click", openCreateDialog);
els.floatingCreate.addEventListener("click", openCreateDialog);
els.cancelCreate.addEventListener("click", () => els.createDialog.close());
els.createDialog.addEventListener("click", closeDialogOnBackdrop);
els.editDialog.addEventListener("click", closeDialogOnBackdrop);
els.form.addEventListener("submit", (event) => createReminder(event).catch((error) => setStatus(error.message, "error")));
els.editForm.addEventListener("submit", (event) => saveEdit(event).catch((error) => setStatus(error.message, "error")));
els.cancelEdit.addEventListener("click", () => els.editDialog.close());
[els.search, els.typeFilter, els.statusFilter, els.fromDate, els.toDate].forEach((input) => {
  input.addEventListener("input", render);
});

loadReminders().catch((error) => setStatus(error.message, "error"));
setInterval(syncReminders, 5000);
