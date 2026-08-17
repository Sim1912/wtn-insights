# WTN Insights lokal starten

1. Öffne diesen Ordner in VS Code.
2. Öffne **Terminal → New Terminal**.
3. Führe `npm install` aus.
4. Kopiere `.env.example` als `.env.local`.
5. Starte die App mit `npm run dev`.
6. Öffne die im Terminal angezeigte lokale Adresse.

Die Seite startet mit Demo-Daten für `MAU8054205`. **Load player** testet die Live-Abfrage. Falls das WTN-Schema andere Argumentnamen verwendet, zeigt das Dashboard die originale Schema-Fehlermeldung. Dann muss nur die Query in `app/api/wtn/route.ts` an die bereits funktionierende Python-Query angepasst werden.

Supabase, tägliche Snapshots, Match-Scores, NZ-Perzentile und das Widget kommen nach dem erfolgreichen Live-API-Test.
