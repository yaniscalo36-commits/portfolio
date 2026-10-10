const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== NAVBAR ===== */
const navbar = document.getElementById("navbar");
const toggle = document.getElementById("nav-toggle");
const menu = document.getElementById("nav-menu");

window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 20);
}, { passive: true });

toggle.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});

menu.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  });
});

/* Lien actif selon la section visible */
const navLinks = menu.querySelectorAll('a[href^="#"]');
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(a => a.classList.toggle("current", a.getAttribute("href") === "#" + entry.target.id));
    }
  });
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("main section[id]").forEach(s => sectionObserver.observe(s));

/* ===== TEXTE TAPÉ ===== */
const roles = [
  "étudiant en cybersécurité",
  "Bachelor 2 — Ynov Toulouse",
  "réseaux · systèmes · développement",
  "à la recherche d'un stage"
];
const typed = document.getElementById("typed");

if (reduceMotion) {
  typed.textContent = roles[0];
} else {
  let r = 0, i = 0, deleting = false;
  (function type() {
    const word = roles[r];
    typed.textContent = word.slice(0, i);
    if (!deleting && i < word.length) { i++; setTimeout(type, 65); }
    else if (!deleting) { deleting = true; setTimeout(type, 1800); }
    else if (i > 0) { i--; setTimeout(type, 30); }
    else { deleting = false; r = (r + 1) % roles.length; setTimeout(type, 300); }
  })();
}

/* ===== FILTRES PROJETS ===== */
const filters = document.querySelectorAll(".filter");
const cards = document.querySelectorAll(".project-card");

filters.forEach(btn => {
  btn.addEventListener("click", () => {
    filters.forEach(b => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-selected", b === btn);
    });
    const f = btn.dataset.filter;
    cards.forEach(card => {
      card.classList.toggle("is-hidden", f !== "all" && card.dataset.cat !== f);
    });
  });
});

/* ===== APPARITION AU SCROLL ===== */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("show");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".section-head, .section-sub, .about-grid, .skill-group, .project-card, .contact-grid, .contact-cta")
  .forEach(el => {
    el.classList.add("reveal");
    revealObserver.observe(el);
  });

/* ===== FOND : GRILLE DE POINTS ===== */
const canvas = document.getElementById("grid-bg");
const ctx = canvas.getContext("2d");
let w, h, dots = [];
const mouse = { x: -9999, y: -9999 };

function resize() {
  const dpr = window.devicePixelRatio || 1;
  w = canvas.width = window.innerWidth * dpr;
  h = canvas.height = window.innerHeight * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  dots = [];
  const gap = 34;
  for (let x = gap / 2; x < window.innerWidth; x += gap) {
    for (let y = gap / 2; y < window.innerHeight; y += gap) {
      dots.push({ x, y });
    }
  }
  draw();
}

function draw() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const d of dots) {
    const dist = Math.hypot(d.x - mouse.x, d.y - mouse.y);
    const near = Math.max(0, 1 - dist / 180);
    ctx.fillStyle = near > 0
      ? `rgba(34, 211, 166, ${0.12 + near * 0.6})`
      : "rgba(148, 163, 184, 0.09)";
    ctx.fillRect(d.x, d.y, 1.4 + near * 1.2, 1.4 + near * 1.2);
  }
}

window.addEventListener("resize", resize);
if (!reduceMotion) {
  let ticking = false;
  window.addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => { draw(); ticking = false; });
    }
  });
}
resize();

/* ===== FOOTER ===== */
document.getElementById("year").textContent = new Date().getFullYear();

/* ===== E-MAIL : COPIE DE L'ADRESSE ===== */
// Un lien mailto: ne fait rien si aucune messagerie n'est installée (cas fréquent avec Gmail
// ou Outlook dans le navigateur). On copie donc aussi l'adresse et on le signale.
const toast = document.getElementById("toast");
let toastTimer;

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("visible"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 4000);
}

document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
  link.addEventListener("click", () => {
    const email = link.getAttribute("href").replace("mailto:", "");
    const fallback = () => showToast("Mon adresse : " + email);
    if (!navigator.clipboard) return fallback();
    navigator.clipboard.writeText(email)
      .then(() => showToast("Adresse copiée : " + email))
      .catch(fallback); // copie refusée par le navigateur : on affiche au moins l'adresse
  });
});
