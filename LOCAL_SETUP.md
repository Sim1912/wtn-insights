# WTN Insights lokal starten

1. Öffne diesen Ordner in VS Code.
2. Öffne **Terminal → New Terminal**.
3. Führe `npm install` aus.
4. Kopiere `.env.example` als `.env.local`, wenn du einen eigenen WTN-Endpunkt verwenden möchtest.
5. Starte die App mit `npm run dev`.
6. Öffne `http://localhost:3000`.

Für Produktion zuerst `npm run build` und danach `npm run start` ausführen.

`WTN_GRAPHQL_ENDPOINT` ist optional. Ohne diese Variable nutzt die Anwendung den eingebauten öffentlichen WTN-Endpunkt. Auf Vercel wird die Variable unter **Project Settings → Environment Variables** gesetzt; sie bleibt serverseitig und darf kein `NEXT_PUBLIC_`-Präfix haben.
