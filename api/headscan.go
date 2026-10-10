// Fonction serverless Vercel : GET /api/headscan?url=example.com
//
// Lance une analyse headscan en mode sécurisé (anti-SSRF) et renvoie le résultat en JSON.
// Code du moteur : https://github.com/yaniscalo36-commits/headscan
package handler

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/yaniscalo36-commits/headscan/scan"
)

const (
	scanTimeout  = 10 * time.Second // page principale ; la vérification HTTP secondaire est plafonnée à 5 s
	maxURLLength = 2048
	rateLimit    = 10 // analyses par IP…
	rateWindow   = time.Minute
)

// Limiteur en mémoire : il ne vit que le temps de l'instance serverless, mais freine un abus
// en rafale. Le cache CDN (s-maxage) évite en plus de relancer un scan identique.
var (
	mu      sync.Mutex
	history = map[string][]time.Time{}
)

func allow(ip string) (bool, int) {
	mu.Lock()
	defer mu.Unlock()
	now := time.Now()
	recent := history[ip][:0]
	for _, t := range history[ip] {
		if now.Sub(t) < rateWindow {
			recent = append(recent, t)
		}
	}
	if len(recent) >= rateLimit {
		history[ip] = recent
		return false, int(rateWindow.Seconds() - now.Sub(recent[0]).Seconds() + 1)
	}
	history[ip] = append(recent, now)
	if len(history) > 10000 { // garde-fou mémoire
		history = map[string][]time.Time{}
	}
	return true, 0
}

// clientIP lit l'IP fournie par Vercel (en-têtes réécrits par sa périphérie, non falsifiables).
func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-Ip"); ip != "" {
		return ip
	}
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	return host
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, status, map[string]string{"error": msg})
}

// Handler est le point d'entrée appelé par Vercel.
func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		fail(w, http.StatusMethodNotAllowed, "méthode non autorisée")
		return
	}

	target := strings.TrimSpace(r.URL.Query().Get("url"))
	switch {
	case target == "":
		fail(w, http.StatusBadRequest, "paramètre « url » manquant")
		return
	case len(target) > maxURLLength:
		fail(w, http.StatusBadRequest, "URL trop longue")
		return
	}
	if _, err := scan.NormalizeTarget(target); err != nil {
		fail(w, http.StatusBadRequest, "URL invalide : "+err.Error())
		return
	}

	if ok, retry := allow(clientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retry))
		fail(w, http.StatusTooManyRequests, "trop d'analyses : réessayez dans "+strconv.Itoa(retry)+" s")
		return
	}

	res, err := scan.NewSafeScanner(scanTimeout).Scan(target)
	switch {
	case errors.Is(err, scan.ErrBlockedTarget):
		fail(w, http.StatusBadRequest, "cette adresse ne peut pas être analysée : seuls les sites publics, sur les ports 80 et 443, sont autorisés")
		return
	case err != nil:
		var dnsErr *net.DNSError
		if errors.As(err, &dnsErr) {
			fail(w, http.StatusBadGateway, "nom de domaine introuvable")
			return
		}
		fail(w, http.StatusBadGateway, "impossible de joindre le site (hors ligne, trop lent ou certificat invalide)")
		return
	}

	// Mise en cache 5 minutes par le CDN de Vercel : un même site n'est pas rescanné en boucle.
	w.Header().Set("Cache-Control", "public, max-age=0, s-maxage=300")
	writeJSON(w, http.StatusOK, res)
}
