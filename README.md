# QR redirector

Lekki router przekierowań do hostowania jako statyczna strona GitHub Pages. Aplikacja odczytuje identyfikator `r` z query stringa i wybiera adres wyłącznie z allowlisty w `routes.json`.

## Wdrożenie na GitHub Pages

1. Wypchnij pliki repozytorium do GitHub.
2. W ustawieniach repozytorium wybierz **Pages** i źródło wdrożenia (np. gałąź `main` oraz katalog `/ (root)`).
3. Po wdrożeniu używaj adresu w formie `https://<użytkownik>.github.io/qr_redirector/?r=w`. Bez parametru `r` użyta zostanie trasa `default`.

`404.html` obsługuje błędne ścieżki i zakłada domyślny adres projektu Pages `/qr_redirector/`. Przy wdrożeniu pod inną ścieżką projektu zaktualizuj element `<base>` w `404.html`; dla witryny pod własną domeną w katalogu głównym ustaw go na `/`.

## Dodawanie trasy

Dodaj parę `"slug": "https://docelowy-adres"` do `routes.json`. Slug może zawierać 1–32 znaki: litery ASCII, cyfry, `_` lub `-`. Dozwolone są adresy HTTP i HTTPS bez danych logowania. Zmiany w konfiguracji są pobierane bez użycia cache przeglądarki.

Nie przekazuj adresu docelowego w parametrze URL. Parametr `r` służy wyłącznie do wyboru wcześniej skonfigurowanego sluga, np. `?r=w`.

## Generator kodów QR

Otwórz `https://<użytkownik>.github.io/qr_redirector/generator.html`, aby wybrać trasę z konfiguracji lub przygotować nowy wpis. Generator działa lokalnie w przeglądarce, a tras nie modyfikuje. Nowy kod zacznie działać po skopiowaniu wpisu do `routes.json` i wdrożeniu zmiany.

Możesz ustawić korekcję błędów, margines, kolory, rozmiar wydruku 20, 25 lub 30 mm oraz niezależnie style modułów (`square`, `rounded`, `dots`, `classy`, `connected`) i narożników (`square`, `rounded`, `dots`). SVG jest wspólnym źródłem podglądu i eksportu PNG (1200 × 1200 px). Generator ostrzega o niskim kontraście, odwróconych kolorach przy zbyt małym marginesie oraz zaleca korekcję Q lub H dla stylów kropek i zaokrągleń. Dostępne są też kopiowanie linku lub wpisu JSON oraz drukowanie. Generator używa lokalnego, samodzielnego kodera QR w `qr-encoder.js` i nie ładuje bibliotek zewnętrznych. Obsługuje kody QR Model 2 w wersjach 1–10; zbyt długi adres lub zbyt wysoki poziom korekcji może przekroczyć pojemność i zostanie zgłoszony czytelny błąd.

Uwaga: przeglądarki ignorują dyrektywę `frame-ancestors` w CSP ustawionym przez `<meta>`. GitHub Pages nie pozwala skonfigurować nagłówka CSP z poziomu tych statycznych plików, dlatego ochrona przed osadzaniem strony nie jest tu egzekwowana.
