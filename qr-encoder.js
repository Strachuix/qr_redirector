"use strict";

(function () {
  const levels = new Set(["L", "M", "Q", "H"]);

  function encode(text, level) {
    if (typeof text !== "string" || !text.length) {
      throw new Error("Tekst kodu QR nie może być pusty.");
    }
    if (!levels.has(level)) {
      throw new Error("Nieobsługiwany poziom korekcji błędów.");
    }

    const qr = window.qrcode(0, level);
    qr.addData(text, "Byte");
    qr.make();
    const size = qr.getModuleCount();
    return Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, column) => qr.isDark(row, column))
    );
  }

  window.QRCodeEncoder = Object.freeze({ encode });
})();
