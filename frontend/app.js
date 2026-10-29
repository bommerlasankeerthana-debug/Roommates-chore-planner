const API = "/api";
const state = { token: localStorage.getItem("roomieplan_token") || "", user: null, households: [], household: null, members: [], chores: [], filter: "all", editingId: null, authMode: "login" };
const $ = (id) => document.getElementById(id);

const authView = $("auth-view"), dashboardView = $("dashboard-view"), authForm = $("auth-form");
const choreDialog = $("chore-dialog");

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token && !path.startsWith("/auth/")) logout(false);
    throw new Error(data.error || "Request failed. Please try again.");
  }
  return data;
}

function setMessage(id, message = "", type = "") {
  const element = $(id);
  element.textContent = message;
  element.classList.toggle("success", type === "success");
}
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove("show"), 2600);
}
function setAuthMode(mode) {
  state.authMode = mode;
  const register = mode === "register";
  $("login-tab").classList.toggle("active", !register);
  $("register-tab").classList.toggle("active", register);
  $("login-tab").setAttribute("aria-selected", String(!register));
  $("register-tab").setAttribute("aria-selected", String(register));
  $("name-field").classList.toggle("hidden", !register);
  $("name-input").required = register;
  $("auth-title").textContent = register ? "Make room for good habits" : "Welcome back";
  $("auth-subtitle").textContent = register ? "Create an account to plan with your roommates." : "Log in to see what needs doing.";
  $("auth-submit").innerHTML = register ? 'Create account <span>→</span>' : 'Log in <span>→</span>';
  $("password-input").autocomplete = register ? "new-password" : "current-password";
  setMessage("auth-message");
}
$("login-tab").addEventListener("click", () => setAuthMode("login"));
$("register-tab").addEventListener("click", () => setAuthMode("register"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("auth-submit");
  button.disabled = true;
  setMessage("auth-message", "One moment…");
  try {
    const body = { email: $("email-input").value.trim(), password: $("password-input").value };
    if (state.authMode === "register") body.name = $("name-input").value.trim();
    const result = await api(`/auth/${state.authMode === "register" ? "register" : "login"}`, { method: "POST", body: JSON.stringify(body) });
    state.token = result.token;
    state.user = result.user;
    localStorage.setItem("roomieplan_token", state.token);
    await showDashboard();
  } catch (error) {
    setMessage("auth-message", error.message);
  } finally { button.disabled = false; }
});

function logout(showToast = true) {
  state.token = ""; state.user = null; state.households = []; state.household = null; state.members = []; state.chores = [];
  localStorage.removeItem("roomieplan_token");
  authView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
  $("logout-button").classList.add("hidden");
  $("user-greeting").classList.add("hidden");
  authForm.reset();
  setAuthMode("login");
  if (showToast) toast("You are logged out.");
}
$("logout-button").addEventListener("click", () => logout());

async function showDashboard() {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  $("logout-button").classList.remove("hidden");
  $("user-greeting").classList.remove("hidden");
  $("user-greeting").textContent = state.user ? `Hi, ${state.user.name.split(" ")[0]}` : "Welcome";
  $("today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
  try {
    const me = await api("/auth/me");
    state.user = me.user;
    $("user-greeting").textContent = `Hi, ${state.user.name.split(" ")[0]}`;
    await loadHouseholds();
  } catch (error) {
    setMessage("dashboard-message", error.message);
  }
}

async function loadHouseholds(selectId = null) {
  const result = await api("/households");
  state.households = result.households;
  const select = $("household-select");
  select.replaceChildren();
  state.households.forEach(household => {
    const option = document.createElement("option");
    option.value = household.id;
    option.textContent = household.name;
    select.append(option);
  });
  if (!state.households.length) {
    state.household = null;
    $("household-setup").classList.remove("hidden");
    $("planner-view").classList.add("hidden");
    return;
  }
  $("household-setup").classList.add("hidden");
  $("planner-view").classList.remove("hidden");
  const chosen = state.households.find(h => h.id === (selectId || (state.household && state.household.id))) || state.households[0];
  state.household = chosen;
  select.value = chosen.id;
  await loadHouseholdData();
}
$("household-select").addEventListener("change", async () => {
  state.household = state.households.find(h => h.id === $("household-select").value) || null;
  await loadHouseholdData();
});

$("create-household-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  setMessage("dashboard-message");
  try {
    const result = await api("/households", { method: "POST", body: JSON.stringify({ name: $("household-name").value.trim() }) });
    $("household-name").value = "";
    await loadHouseholds(result.household.id);
    toast("Household created! Share the invite code.");
  } catch (error) { setMessage("dashboard-message", error.message); }
  finally { button.disabled = false; }
});
$("join-household-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  setMessage("dashboard-message");
  try {
    const result = await api("/households/join", { method: "POST", body: JSON.stringify({ invite_code: $("invite-code").value.trim().toUpperCase() }) });
    $("invite-code").value = "";
    await loadHouseholds(result.household.id);
    toast(`Joined ${result.household.name}!`);
  } catch (error) { setMessage("dashboard-message", error.message); }
  finally { button.disabled = false; }
});

async function loadHouseholdData() {
  if (!state.household) return;
  $("current-household-name").textContent = state.household.name;
  $("current-invite-code").textContent = state.household.invite_code;
  try {
    const [membersResult, choresResult] = await Promise.all([
      api(`/households/${encodeURIComponent(state.household.id)}/members`),
      api(`/chores?household_id=${encodeURIComponent(state.household.id)}`)
    ]);
    state.members = membersResult.members;
    state.chores = choresResult.chores;
    renderMembers();
    renderStats();
    renderChores();
  } catch (error) { setMessage("dashboard-message", error.message); }
}
$("copy-code-button").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(state.household.invite_code);
    toast("Invite code copied!");
  } catch {
    toast(`Invite code: ${state.household.invite_code}`);
  }
});

function renderMembers() {
  $("stat-members").textContent = state.members.length;
  $("member-count-badge").textContent = state.members.length;
  const list = $("member-list");
  list.replaceChildren();
  state.members.forEach((member, index) => {
    const row = document.createElement("div"); row.className = "member-row";
    const avatar = document.createElement("span"); avatar.className = `avatar alt-${index % 4}`;
    avatar.textContent = member.name.trim().charAt(0).toUpperCase();
    const info = document.createElement("span"); info.className = "member-info";
    const name = document.createElement("strong"); name.textContent = member.name + (state.user && member.id === state.user.id ? " (you)" : "");
    const email = document.createElement("small"); email.textContent = member.email;
    info.append(name, email);
    const role = document.createElement("span"); role.className = "role-tag"; role.textContent = member.role;
    row.append(avatar, info, role); list.append(row);
  });
  const assignee = $("chore-assignee");
  const current = assignee.value;
  assignee.replaceChildren();
  const nobody = document.createElement("option"); nobody.value = ""; nobody.textContent = "Anyone / unassigned"; assignee.append(nobody);
  state.members.forEach(member => {
    const option = document.createElement("option"); option.value = member.id; option.textContent = member.name; assignee.append(option);
  });
  assignee.value = current;
}

function renderStats() {
  const completed = state.chores.filter(chore => chore.status === "completed").length;
  $("stat-total").textContent = state.chores.length;
  $("stat-pending").textContent = state.chores.length - completed;
  $("stat-completed").textContent = completed;
}

function dateLabel(date) {
  if (!date) return "No due date";
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isOverdue(chore) {
  return chore.status === "pending" && chore.due_date && chore.due_date < new Date().toISOString().slice(0, 10);
}
function makeButton(label, className, title, action) {
  const button = document.createElement("button");
  button.type = "button"; button.className = className; button.textContent = label; button.title = title; button.setAttribute("aria-label", title);
  button.addEventListener("click", action);
  return button;
}
function renderChores() {
  const list = $("chore-list"); list.replaceChildren();
  const filtered = state.chores.filter(chore => state.filter === "all" || chore.status === state.filter);
  $("empty-state").classList.toggle("hidden", filtered.length !== 0);
  list.classList.toggle("hidden", filtered.length === 0);
  filtered.forEach(chore => {
    const item = document.createElement("article"); item.className = `chore-item ${chore.status === "completed" ? "completed" : ""}`;
    const check = makeButton(chore.status === "completed" ? "✓" : "", `check-button ${chore.status === "completed" ? "checked" : ""}`, chore.status === "completed" ? "Mark as pending" : "Mark as completed", () => toggleChore(chore));
    const main = document.createElement("div"); main.className = "chore-main";
    const title = document.createElement("div"); title.className = "chore-title"; title.textContent = chore.title;
    main.append(title);
    if (chore.description) { const desc = document.createElement("div"); desc.className = "chore-description"; desc.textContent = chore.description; main.append(desc); }
    const meta = document.createElement("div"); meta.className = "chore-meta";
    const assignee = state.members.find(member => member.id === chore.assigned_to);
    const assignedPill = document.createElement("span"); assignedPill.className = "meta-pill"; assignedPill.textContent = `♙ ${assignee ? assignee.name : "Unassigned"}`; meta.append(assignedPill);
    const duePill = document.createElement("span"); duePill.className = `meta-pill ${isOverdue(chore) ? "overdue" : ""} ${chore.status === "completed" ? "done" : ""}`;
    duePill.textContent = `${chore.status === "completed" ? "✓" : "◷"} ${chore.status === "completed" ? "Completed" : isOverdue(chore) ? "Overdue · " : ""}${dateLabel(chore.due_date)}`;
    meta.append(duePill); main.append(meta);
    const actions = document.createElement("div"); actions.className = "chore-actions";
    actions.append(makeButton("✎", "icon-button", "Edit chore", () => openChoreDialog(chore)));
    actions.append(makeButton("×", "icon-button delete", "Delete chore", () => deleteChore(chore)));
    item.append(check, main, actions); list.append(item);
  });
}
$("status-filter").addEventListener("change", () => { state.filter = $("status-filter").value; renderChores(); });
$("add-chore-button").addEventListener("click", () => openChoreDialog());
$("empty-add-button").addEventListener("click", () => openChoreDialog());
$("close-dialog").addEventListener("click", () => choreDialog.close());
$("cancel-dialog").addEventListener("click", () => choreDialog.close());

function openChoreDialog(chore = null) {
  state.editingId = chore ? chore.id : null;
  $("dialog-title").textContent = chore ? "Edit chore" : "Add a chore";
  $("chore-title").value = chore ? chore.title : "";
  $("chore-description").value = chore ? (chore.description || "") : "";
  $("chore-assignee").value = chore ? (chore.assigned_to || "") : "";
  $("chore-due-date").value = chore ? (chore.due_date || "") : "";
  $("save-chore").textContent = chore ? "Save changes" : "Save chore";
  setMessage("chore-message");
  choreDialog.showModal();
  $("chore-title").focus();
}
$("chore-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {
    title: $("chore-title").value.trim(),
    description: $("chore-description").value.trim(),
    assigned_to: $("chore-assignee").value,
    due_date: $("chore-due-date").value
  };
  const button = $("save-chore"); button.disabled = true;
  setMessage("chore-message", "Saving…");
  try {
    if (state.editingId) {
      await api(`/chores/${encodeURIComponent(state.editingId)}`, { method: "PATCH", body: JSON.stringify(body) });
    } else {
      body.household_id = state.household.id;
      await api("/chores", { method: "POST", body: JSON.stringify(body) });
    }
    choreDialog.close();
    await loadHouseholdData();
    toast(state.editingId ? "Chore updated." : "Chore added.");
  } catch (error) { setMessage("chore-message", error.message); }
  finally { button.disabled = false; }
});

async function toggleChore(chore) {
  try {
    await api(`/chores/${encodeURIComponent(chore.id)}`, { method: "PATCH", body: JSON.stringify({ status: chore.status === "completed" ? "pending" : "completed" }) });
    await loadHouseholdData();
    toast(chore.status === "completed" ? "Chore moved back to to-do." : "Nice work! Chore completed.");
  } catch (error) { toast(error.message); }
}
async function deleteChore(chore) {
  if (!window.confirm(`Delete "${chore.title}"? This cannot be undone.`)) return;
  try {
    await api(`/chores/${encodeURIComponent(chore.id)}`, { method: "DELETE" });
    await loadHouseholdData();
    toast("Chore deleted.");
  } catch (error) { toast(error.message); }
}

async function initialize() {
  $("today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
  if (!state.token) return;
  try {
    const result = await api("/auth/me");
    state.user = result.user;
    await showDashboard();
  } catch {
    logout(false);
  }
}
initialize();