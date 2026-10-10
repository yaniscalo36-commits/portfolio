// Affiche le chemin demandé dans le faux terminal. textContent : jamais interprété comme du HTML.
let path = location.pathname;
try {
  path = decodeURIComponent(path);
} catch {
  // URL mal encodée (ex. « %E0 ») : on garde la version brute.
}
document.getElementById("path").textContent = path.slice(0, 120) || "/";
