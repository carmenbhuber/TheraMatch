const JSON_PATH = "./EntscheidungsbaumTheraMatch.json"; // nur diese Datei austauschen

let tree = null;
let nodeById = new Map();
let currentNodeId = null;

// history entries: { nodeId, answerLabel, nextNodeId }
let history = [];

const el = (id) => document.getElementById(id);
const contentEl = el("content");
const breadcrumbEl = el("breadcrumb");
const statusEl = el("statusText");
const btnBack = el("btnBack");
const btnRestart = el("btnRestart");
const btnReloadJson = el("btnReloadJson");
const btnCopySummary = el("btnCopySummary");
const pillVersion = el("pillVersion");
const pillUpdated = el("pillUpdated");

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

async function loadTree() {
  setStatus("Lade Entscheidungsbaum …");
  // cache: 'no-store' hilft bei Updates; bei GitHub Pages ggf. trotzdem Hard-Refresh nötig
  const res = await fetch(JSON_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`JSON konnte nicht geladen werden (${res.status})`);
  const data = await res.json();

  // minimal validation
  if (!data.startNodeId || !Array.isArray(data.nodes)) {
    throw new Error("JSON-Format ungültig: erwartet { startNodeId, nodes[] }");
  }

  tree = data;
  nodeById = new Map(data.nodes.map(n => [n.id, n]));

  // metadata pills
  pillVersion.textContent = `Version: ${data?.metadata?.version ?? "–"}`;
  pillUpdated.textContent = `Updated: ${data?.metadata?.lastUpdated ?? "–"}`;

  currentNodeId = data.startNodeId;
  history = [];
  render();
  setStatus("");
}

function getNode(id) {
  const n = nodeById.get(id);
  if (!n) throw new Error(`Node nicht gefunden: ${id}`);
  return n;
}

function renderBreadcrumb() {
  breadcrumbEl.innerHTML = "";

  // Start crumb
  const startCrumb = document.createElement("div");
  startCrumb.className = "crumb";
  startCrumb.textContent = "Start";
  startCrumb.title = "Zurück zum Start";
  startCrumb.addEventListener("click", () => {
    currentNodeId = tree.startNodeId;
    history = [];
    render();
  });
  breadcrumbEl.appendChild(startCrumb);

  history.forEach((h, idx) => {
    const c = document.createElement("div");
    c.className = "crumb";
    c.title = "Klicken, um zu diesem Schritt zurückzuspringen";
    c.innerHTML = `<span class="sep">›</span> ${escapeHtml(h.answerLabel)}`;
    c.addEventListener("click", () => {
      // go to node that was reached after this answer
      currentNodeId = h.nextNodeId;
      history = history.slice(0, idx + 1);
      render();
    });
    breadcrumbEl.appendChild(c);
  });
}

function render() {
  if (!tree) return;
  btnBack.disabled = history.length === 0;

  renderBreadcrumb();

  const node = getNode(currentNodeId);
  contentEl.innerHTML = "";

  if (node.type === "question") renderQuestion(node);
  else if (node.type === "result") renderResult(node);
  else renderError(`Unbekannter node.type: ${node.type}`);
}

function renderQuestion(node) {
  const h2 = document.createElement("h2");
  h2.textContent = node.question || "Frage";
  contentEl.appendChild(h2);

  if (node.help) {
    const p = document.createElement("p");
    p.textContent = node.help;
    contentEl.appendChild(p);
  }

  const answersWrap = document.createElement("div");
  answersWrap.className = "answers";

  (node.answers || []).forEach((a) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.type = "button";
    b.textContent = a.label;
    b.addEventListener("click", () => {
      const nextId = a.next;
      history.push({ nodeId: node.id, answerLabel: a.label, nextNodeId: nextId });
      currentNodeId = nextId;
      render();
    });
    answersWrap.appendChild(b);
  });

  contentEl.appendChild(answersWrap);
}

function renderResult(node) {
  const h2 = document.createElement("h2");
  h2.textContent = node.title || "Ergebnis";
  contentEl.appendChild(h2);

  if (node.description) {
    const p = document.createElement("p");
    p.textContent = node.description;
    contentEl.appendChild(p);
  }

  const box = document.createElement("div");
  box.className = "result";

  if (Array.isArray(node.bullets) && node.bullets.length > 0) {
    const ul = document.createElement("ul");
    node.bullets.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    box.appendChild(ul);
  } else {
    const p = document.createElement("p");
    p.textContent = "Keine To-dos hinterlegt.";
    box.appendChild(p);
  }

  if (Array.isArray(node.links) && node.links.length > 0) {
    const links = document.createElement("div");
    links.className = "links";
    node.links.forEach((l) => {
      const a = document.createElement("a");
      a.className = "link";
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = l.label || "Link";
      links.appendChild(a);
    });
    box.appendChild(links);
  }

  contentEl.appendChild(box);

  // optional: show "What you selected"
  const summary = document.createElement("p");
  summary.innerHTML = `<b>Pfad:</b> ${escapeHtml(buildPathText())}`;
  contentEl.appendChild(summary);
}

function renderError(msg) {
  const h2 = document.createElement("h2");
  h2.textContent = "Fehler";
  const p = document.createElement("p");
  p.textContent = msg;
  contentEl.appendChild(h2);
  contentEl.appendChild(p);
}

function buildPathText() {
  if (history.length === 0) return "Start";
  return ["Start", ...history.map(h => h.answerLabel)].join(" > ");
}

function copySummary() {
  const lines = [];
  lines.push("TheraMatch – Zusammenfassung");
  lines.push(buildPathText());
  const node = getNode(currentNodeId);
  if (node.type === "result") {
    lines.push("");
    lines.push(node.title || "Ergebnis");
    (node.bullets || []).forEach(b => lines.push(`- ${b}`));
    (node.links || []).forEach(l => lines.push(`${l.label}: ${l.url}`));
  }
  navigator.clipboard.writeText(lines.join("\n"))
    .then(() => setStatus("Zusammenfassung kopiert."))
    .catch(() => setStatus("Kopieren nicht möglich (Browser-Berechtigung)."));
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Buttons
btnBack.addEventListener("click", () => {
  if (history.length === 0) return;
  history.pop();
  currentNodeId = history.length === 0 ? tree.startNodeId : history[history.length - 1].nextNodeId;
  render();
});

btnRestart.addEventListener("click", () => {
  currentNodeId = tree.startNodeId;
  history = [];
  render();
});

btnReloadJson.addEventListener("click", async () => {
  try {
    await loadTree();
    setStatus("JSON neu geladen.");
  } catch (e) {
    renderError(e.message);
  }
});

btnCopySummary.addEventListener("click", (e) => {
  e.preventDefault();
  try { copySummary(); } catch {}
});

// Init
loadTree().catch(err => renderError(err.message));
