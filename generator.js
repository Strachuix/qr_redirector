"use strict";

const elements = {
  routes: document.getElementById("route-list"),
  routesStatus: document.getElementById("routes-status"),
  slug: document.getElementById("slug"),
  target: document.getElementById("target"),
  ecl: document.getElementById("ecl"),
  quietZone: document.getElementById("quiet-zone"),
  size: document.getElementById("size"),
  moduleStyle: document.getElementById("module-style"),
  eyeStyle: document.getElementById("eye-style"),
  foreground: document.getElementById("foreground"),
  background: document.getElementById("background"),
  warning: document.getElementById("contrast-warning"),
  preview: document.getElementById("qr-preview"),
  redirectUrl: document.getElementById("redirect-url"),
  destinationUrl: document.getElementById("destination-url"),
  dimension: document.getElementById("dimension"),
  printSize: document.getElementById("print-size"),
  status: document.getElementById("status"),
  downloadSvg: document.getElementById("download-svg"),
  downloadPng: document.getElementById("download-png"),
  copyLink: document.getElementById("copy-link"),
  copyEntry: document.getElementById("copy-entry"),
  print: document.getElementById("print")
};

const slugPattern = /^[a-zA-Z0-9_-]{1,32}$/;
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const moduleStyles = new Set(["square", "rounded", "dots", "classy", "connected"]);
const eyeStyles = new Set(["square", "rounded", "dots"]);
const quietZones = new Set([2, 4, 6, 8]);
const printSizes = new Set([20, 25, 30]);
const routes = Object.create(null);
let currentSvg = null;
let currentRedirectUrl = "";

function validateUrl(value) {
  if (typeof value !== "string") throw new Error("Adres docelowy musi być tekstem.");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Wpisz prawidłowy adres URL.");
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("Dozwolone są wyłącznie adresy HTTP lub HTTPS bez danych logowania.");
  }
  return url.href;
}

function makeSvg(matrix, quiet, foreground, background, widthMm, moduleStyle, eyeStyle) {
  if (!colorPattern.test(foreground) || !colorPattern.test(background)) {
    throw new Error("Kolor musi być zapisany w formacie #RRGGBB.");
  }
  if (!Number.isInteger(quiet) || !quietZones.has(quiet) || !Number.isInteger(widthMm) || !printSizes.has(widthMm)) {
    throw new Error("Nieprawidłowy margines lub rozmiar wydruku.");
  }
  if (!moduleStyles.has(moduleStyle) || !eyeStyles.has(eyeStyle)) {
    throw new Error("Nieprawidłowy styl kodu QR.");
  }
  if (!Array.isArray(matrix) || !matrix.length || matrix.some(row =>
    !Array.isArray(row) || row.length !== matrix.length || row.some(cell => typeof cell !== "boolean")
  )) {
    throw new Error("Nieprawidłowa macierz kodu QR.");
  }

  const namespace = "http://www.w3.org/2000/svg";
  const total = matrix.length + quiet * 2;
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("xmlns", namespace);
  svg.setAttribute("viewBox", `0 0 ${total} ${total}`);
  svg.setAttribute("width", `${widthMm}mm`);
  svg.setAttribute("height", `${widthMm}mm`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Kod QR do przekierowania");

  const backgroundRect = document.createElementNS(namespace, "rect");
  backgroundRect.setAttribute("width", String(total));
  backgroundRect.setAttribute("height", String(total));
  backgroundRect.setAttribute("fill", background);
  svg.append(backgroundRect);

  const isFinderCell = (x, y) =>
    (x < 7 && y < 7) ||
    (x >= matrix.length - 7 && y < 7) ||
    (x < 7 && y >= matrix.length - 7);
  const appendRect = (parent, x, y, width, height, fill, radius) => {
    const rect = document.createElementNS(namespace, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("fill", fill);
    if (radius > 0) {
      rect.setAttribute("rx", String(radius));
      rect.setAttribute("ry", String(radius));
    }
    parent.append(rect);
  };
  const appendCircle = (parent, cx, cy, radius, fill) => {
    const circle = document.createElementNS(namespace, "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", fill);
    parent.append(circle);
  };
  const roundedCellPath = (column, row, radius) => {
    const x = column + quiet;
    const y = row + quiet;
    const topEmpty = !matrix[row - 1]?.[column];
    const bottomEmpty = !matrix[row + 1]?.[column];
    const leftEmpty = !matrix[row]?.[column - 1];
    const rightEmpty = !matrix[row]?.[column + 1];
    const topLeft = leftEmpty && topEmpty;
    const topRight = rightEmpty && topEmpty;
    const bottomRight = rightEmpty && bottomEmpty;
    const bottomLeft = leftEmpty && bottomEmpty;
    return [
      `M${x + (topLeft ? radius : 0)} ${y}`,
      `L${x + 1 - (topRight ? radius : 0)} ${y}`,
      topRight ? `Q${x + 1} ${y} ${x + 1} ${y + radius}` : `L${x + 1} ${y}`,
      `L${x + 1} ${y + 1 - (bottomRight ? radius : 0)}`,
      bottomRight ? `Q${x + 1} ${y + 1} ${x + 1 - radius} ${y + 1}` : `L${x + 1} ${y + 1}`,
      `L${x + (bottomLeft ? radius : 0)} ${y + 1}`,
      bottomLeft ? `Q${x} ${y + 1} ${x} ${y + 1 - radius}` : `L${x} ${y + 1}`,
      `L${x} ${y + (topLeft ? radius : 0)}`,
      topLeft ? `Q${x} ${y} ${x + radius} ${y}` : `L${x} ${y}`,
      "Z"
    ].join("");
  };
  const modulePath = document.createElementNS(namespace, "path");
  const segments = [];
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix.length; x += 1) {
      if (!matrix[y][x] || isFinderCell(x, y) || moduleStyle === "dots" || moduleStyle === "rounded") continue;
      if (moduleStyle === "square") {
        segments.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
      } else {
        const radius = moduleStyle === "classy" ? 0.28 : 0.4;
        segments.push(roundedCellPath(x, y, radius));
      }
    }
  }
  modulePath.setAttribute("d", segments.join(""));
  modulePath.setAttribute("fill", foreground);
  svg.append(modulePath);

  if (moduleStyle === "dots") {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix.length; x += 1) {
        if (matrix[y][x] && !isFinderCell(x, y)) {
          appendCircle(svg, x + quiet + 0.5, y + quiet + 0.5, 0.43, foreground);
        }
      }
    }
  } else if (moduleStyle === "rounded") {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix.length; x += 1) {
        if (matrix[y][x] && !isFinderCell(x, y)) {
          appendRect(svg, x + quiet, y + quiet, 1, 1, foreground, 0.35);
        }
      }
    }
  }

  const finderOrigins = [
    [0, 0],
    [matrix.length - 7, 0],
    [0, matrix.length - 7]
  ];
  for (const [originX, originY] of finderOrigins) {
    const x = originX + quiet;
    const y = originY + quiet;
    if (eyeStyle === "dots") {
      appendCircle(svg, x + 3.5, y + 3.5, 3.5, foreground);
      appendCircle(svg, x + 3.5, y + 3.5, 2.5, background);
      appendCircle(svg, x + 3.5, y + 3.5, 1.5, foreground);
    } else {
      const radius = eyeStyle === "rounded" ? 0.8 : 0;
      appendRect(svg, x, y, 7, 7, foreground, radius);
      appendRect(svg, x + 1, y + 1, 5, 5, background, eyeStyle === "rounded" ? 0.6 : 0);
      appendRect(svg, x + 2, y + 2, 3, 3, foreground, eyeStyle === "rounded" ? 0.35 : 0);
    }
  }

  svg.classList.add("qr-svg");
  return svg;
}

function contrastRatio(first, second) {
  const luminance = color => {
    const channels = color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function setStatus(text, isError) {
  elements.status.textContent = text;
  elements.status.classList.toggle("error", Boolean(isError));
}

function render() {
  currentSvg = null;
  currentRedirectUrl = "";
  elements.redirectUrl.textContent = "—";
  elements.destinationUrl.textContent = "—";
  elements.warning.hidden = true;
  const placeholder = document.createElement("p");
  placeholder.className = "placeholder";
  placeholder.textContent = "Wybierz lub wpisz poprawną trasę.";
  elements.preview.replaceChildren(placeholder);

  const key = elements.slug.value.trim();
  if (!slugPattern.test(key)) {
    setStatus(key ? "Klucz musi mieć 1–32 znaki: litery ASCII, cyfry, _ lub -." : "", Boolean(key));
    return;
  }

  let destination;
  try {
    destination = validateUrl(elements.target.value.trim());
  } catch (error) {
    setStatus(elements.target.value.trim() ? error.message : "Wpisz lub wybierz docelowy adres URL.", Boolean(elements.target.value.trim()));
    return;
  }

  const foreground = elements.foreground.value;
  const background = elements.background.value;
  if (!colorPattern.test(foreground) || !colorPattern.test(background)) {
    setStatus("Nieprawidłowy kolor kodu lub tła.", true);
    return;
  }

  const redirectBase = new URL("./", window.location.href);
  const redirectUrl = new URL(redirectBase.href);
  redirectUrl.searchParams.set("r", key);
  const safeRedirectUrl = validateUrl(redirectUrl.href);
  const size = Number(elements.size.value);
  const quiet = Number(elements.quietZone.value);
  const moduleStyle = elements.moduleStyle.value;
  const eyeStyle = elements.eyeStyle.value;

  try {
    const matrix = window.QRCodeEncoder.encode(safeRedirectUrl, elements.ecl.value);
    const svg = makeSvg(matrix, quiet, foreground, background, size, moduleStyle, eyeStyle);
    elements.preview.replaceChildren(svg);
    elements.preview.style.setProperty("--print-size", `${size}mm`);
    elements.redirectUrl.textContent = safeRedirectUrl;
    elements.destinationUrl.textContent = destination;
    elements.dimension.textContent = `${size} × ${size} mm`;
    elements.printSize.textContent = `${size} mm`;
    currentSvg = svg;
    currentRedirectUrl = safeRedirectUrl;

    const contrast = contrastRatio(foreground, background);
    const warnings = [];
    if (contrast < 4.5) {
      warnings.push(`Niski kontrast (${contrast.toFixed(1)}:1). Dla niezawodnego skanowania zalecany jest kontrast co najmniej 4,5:1.`);
    }
    const foregroundIsLight = contrastRatio(foreground, "#ffffff") < contrastRatio(background, "#ffffff");
    if (foregroundIsLight && quiet < 4) {
      warnings.push("Jasne moduły na ciemnym tle wymagają marginesu co najmniej 4 modułów.");
    }
    if ((moduleStyle === "dots" || moduleStyle === "rounded" || eyeStyle === "dots") && !["Q", "H"].includes(elements.ecl.value)) {
      warnings.push("Przy kropkach lub zaokrąglonych modułach zalecana jest korekcja błędów Q lub H.");
    }
    elements.warning.hidden = warnings.length === 0;
    elements.warning.textContent = warnings.join(" ");
    setStatus(
      Object.hasOwn(routes, key)
        ? "Kod gotowy. Używa trasy zapisanej w routes.json."
        : "Kod gotowy. Ten klucz zacznie przekierowywać po dodaniu wpisu do routes.json i wdrożeniu.",
      false
    );
  } catch (error) {
    elements.warning.hidden = true;
    setStatus(error instanceof Error ? error.message : "Nie udało się wygenerować kodu QR.", true);
  }
}

function download(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function downloadPng() {
  if (!currentSvg) return;
  const svgBlob = new Blob([new XMLSerializer().serializeToString(currentSvg)], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(objectUrl);
      setStatus("Przeglądarka nie udostępnia kontekstu Canvas.", true);
      return;
    }
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);
    canvas.toBlob(blob => {
      if (!blob) {
        setStatus("Nie udało się utworzyć pliku PNG.", true);
        return;
      }
      download(blob, `qr-${elements.slug.value.trim()}.png`);
      setStatus("Pobrano kod PNG (1200 × 1200 px).", false);
    }, "image/png");
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    setStatus("Nie udało się wyrenderować kodu PNG.", true);
  };
  image.src = objectUrl;
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage, false);
  } catch {
    setStatus("Schowek jest niedostępny. Sprawdź uprawnienia przeglądarki lub skopiuj tekst ręcznie.", true);
  }
}

async function loadRoutes() {
  try {
    const configUrl = new URL("routes.json", document.baseURI);
    const response = await fetch(configUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Nie udało się pobrać routes.json.");
    const config = await response.json();
    if (config === null || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("routes.json musi zawierać obiekt JSON.");
    }

    let ignored = 0;
    for (const key of Object.keys(config)) {
      if (!slugPattern.test(key)) {
        ignored += 1;
        continue;
      }
      try {
        routes[key] = validateUrl(config[key]);
      } catch {
        ignored += 1;
      }
    }

    elements.routes.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Wybierz skonfigurowaną trasę…";
    elements.routes.append(placeholder);

    for (const key of Object.keys(routes).sort()) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `${key} — ${routes[key]}`;
      elements.routes.append(option);
    }

    elements.routesStatus.textContent = Object.keys(routes).length
      ? `${Object.keys(routes).length} tras gotowych do użycia.${ignored ? ` Pominięto ${ignored} nieprawidłowych wpisów.` : ""}`
      : `Brak prawidłowych tras w routes.json.${ignored ? ` Pominięto ${ignored} nieprawidłowych wpisów.` : ""}`;
    if (!elements.slug.value && Object.hasOwn(routes, "default")) {
      elements.routes.value = "default";
      elements.slug.value = "default";
      elements.target.value = routes.default;
      render();
    }
  } catch (error) {
    elements.routesStatus.textContent = error instanceof Error ? error.message : "Nie udało się wczytać tras.";
    elements.routes.replaceChildren();
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nie udało się wczytać tras";
    elements.routes.append(option);
  }
}

elements.routes.addEventListener("change", () => {
  const key = elements.routes.value;
  if (!key || !Object.hasOwn(routes, key)) return;
  elements.slug.value = key;
  elements.target.value = routes[key];
  render();
});
elements.slug.addEventListener("input", () => {
  const key = elements.slug.value.trim();
  if (Object.hasOwn(routes, key)) elements.target.value = routes[key];
  render();
});
for (const control of [elements.target, elements.ecl, elements.quietZone, elements.size, elements.moduleStyle, elements.eyeStyle, elements.foreground, elements.background]) {
  control.addEventListener("input", render);
  control.addEventListener("change", render);
}

elements.downloadSvg.addEventListener("click", () => {
  if (!currentSvg) return;
  const content = new XMLSerializer().serializeToString(currentSvg);
  download(new Blob([content], { type: "image/svg+xml;charset=utf-8" }), `qr-${elements.slug.value.trim()}.svg`);
  setStatus("Pobrano wektorowy plik SVG.", false);
});
elements.downloadPng.addEventListener("click", downloadPng);
elements.copyLink.addEventListener("click", () => {
  if (currentRedirectUrl) copyText(currentRedirectUrl, "Skopiowano link przekierowujący.");
});
elements.copyEntry.addEventListener("click", () => {
  const key = elements.slug.value.trim();
  if (!currentSvg || !slugPattern.test(key)) return;
  const entry = `${JSON.stringify(key)}: ${JSON.stringify(elements.destinationUrl.textContent)}`;
  copyText(entry, "Skopiowano wpis. Wklej go do routes.json i dodaj przecinek, jeśli to nie jest ostatnia trasa.");
});
elements.print.addEventListener("click", () => window.print());
window.addEventListener("beforeprint", () => {
  elements.preview.style.setProperty("--print-size", `${Number(elements.size.value)}mm`);
});

loadRoutes();
