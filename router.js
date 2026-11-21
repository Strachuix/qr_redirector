"use strict";

const heading = document.getElementById("heading");
const message = document.getElementById("message");
const fallback = document.getElementById("fallback");

function showError(text) {
  heading.textContent = "Nie można wykonać przekierowania";
  message.textContent = text;
}

function validateTarget(value) {
  if (typeof value !== "string") {
    throw new Error("Adres docelowy w konfiguracji musi być tekstem.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Adres docelowy w konfiguracji jest nieprawidłowy.");
  }

  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("Dozwolone są wyłącznie prawidłowe adresy HTTP lub HTTPS bez danych logowania.");
  }

  return url.href;
}

async function redirect() {
  try {
    const configUrl = new URL("routes.json", document.baseURI);
    const response = await fetch(configUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Nie udało się pobrać konfiguracji tras.");
    }

    const routes = await response.json();
    if (routes === null || typeof routes !== "object" || Array.isArray(routes)) {
      throw new Error("Konfiguracja tras ma nieprawidłowy format.");
    }

    const rawKey = new URLSearchParams(window.location.search).get("r");
    const normalizedKey = rawKey === null ? "" : rawKey.trim().toLowerCase();
    const validKey = /^[a-zA-Z0-9_-]{1,32}$/.test(normalizedKey);
    const key = validKey ? normalizedKey : "";
    let target;

    if (key && Object.hasOwn(routes, key)) {
      target = validateTarget(routes[key]);
    } else {
      if (key) {
        message.textContent = "Nie znaleziono tej trasy. Używam trasy domyślnej.";
      } else if (rawKey !== null) {
        message.textContent = "Nieprawidłowy identyfikator trasy. Używam trasy domyślnej.";
      }

      if (!Object.hasOwn(routes, "default")) {
        throw new Error("Brak trasy domyślnej w konfiguracji.");
      }
      target = validateTarget(routes.default);
    }

    fallback.href = target;
    window.setTimeout(() => {
      heading.textContent = "Przekierowanie nie nastąpiło?";
      message.textContent = "Możesz otworzyć adres docelowy ręcznie.";
      fallback.hidden = false;
    }, 2500);

    window.location.replace(target);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd.");
  }
}

redirect();
