// Interface de headscan en direct : appelle /api/headscan et affiche le résultat.
// Les en-têtes analysés viennent de sites inconnus : tout est inséré avec textContent,
// jamais avec innerHTML, pour qu'un site malveillant ne puisse pas injecter de code ici.

const $ = id => document.getElementById(id);
const els = {
  form: $("form"), url: $("url"), go: $("go"), status: $("status"), result: $("result"),
  finalUrl: $("final-url"), meta: $("meta"), pills: $("pills"), grade: $("grade"),
  letter: $("grade-letter"), score: $("grade-score"), findings: $("findings"), dl: $("dl-json"),
};

const ICONS = { "ok": "✔", "attention": "!", "échec": "✘", "info": "i" };
const CLASSES = { "ok": "pass", "attention": "warn", "échec": "fail", "info": "info" };
let jsonUrl = null;

els.form.addEventListener("submit", e => {
  e.preventDefault();
  scan(els.url.value);
});

document.querySelectorAll(".examples button").forEach(b => b.addEventListener("click", () => {
  els.url.value = b.dataset.url;
  scan(b.dataset.url);
}));

// Permet de partager un lien direct : /lab/headscan/?url=example.com
const initial = new URLSearchParams(location.search).get("url");
if (initial) {
  els.url.value = initial;
  scan(initial);
}

async function scan(raw) {
  const target = raw.trim();
  if (!target) {
    setStatus("Entrez l'adresse d'un site.", true);
    els.url.focus();
    return;
  }
  els.go.disabled = true;
  els.result.hidden = true;
  setStatus("Analyse de " + target + " en cours…");
  history.replaceState(null, "", "?url=" + encodeURIComponent(target));

  try {
    const res = await fetch("/api/headscan?url=" + encodeURIComponent(target), { headers: { Accept: "application/json" } });
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("réponse inattendue du serveur (" + res.status + ")");
    }
    if (!res.ok) throw new Error(data.error || "erreur " + res.status);
    show(data);
    setStatus("");
  } catch (err) {
    setStatus("Erreur : " + err.message, true);
  } finally {
    els.go.disabled = false;
  }
}

function show(r) {
  els.finalUrl.textContent = r.finalUrl;
  const meta = ["HTTP " + r.statusCode];
  if (r.tls) meta.push(r.tls.version, "certificat " + r.tls.issuer + " (" + r.tls.daysLeft + " j)");
  meta.push(r.durationMs + " ms");
  els.meta.textContent = meta.join(" · ");

  els.letter.textContent = r.grade;
  els.score.textContent = r.score + "/100";
  els.grade.className = "grade " + (/^A/.test(r.grade) ? "good" : /^[BC]$/.test(r.grade) ? "mid" : "bad");

  const count = s => r.findings.filter(f => f.status === s).length;
  els.pills.replaceChildren(
    el("span", "pill pass", "✔ " + count("ok") + " conformes"),
    el("span", "pill warn", "! " + count("attention") + " à améliorer"),
    el("span", "pill fail", "✘ " + count("échec") + " échecs"),
  );

  const sections = [];
  let current = null;
  for (const f of r.findings) {
    if (!current || current.dataset.category !== f.category) {
      current = el("section", "panel");
      current.dataset.category = f.category;
      current.append(el("h2", "", f.category));
      sections.push(current);
    }
    const row = el("div", "row");
    row.append(
      el("span", "icon " + (CLASSES[f.status] || "info"), ICONS[f.status] || "i"),
      el("span", "name", f.name),
      el("span", "detail", f.detail),
    );
    if (f.advice) row.append(el("span", "advice", "→ " + f.advice));
    current.append(row);
  }
  els.findings.replaceChildren(...sections);

  if (jsonUrl) URL.revokeObjectURL(jsonUrl);
  jsonUrl = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }));
  els.dl.href = jsonUrl;

  els.result.hidden = false;
  els.result.scrollIntoView({ behavior: "smooth", block: "start" });
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function setStatus(msg, error = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", error);
}
