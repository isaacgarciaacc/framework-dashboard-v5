# Centro de Agentes — GitHub Pages

Sitio estático (HTML/CSS/JS puros) para conversar con 3 agentes en n8n vía webhooks: **Hermes**, **TOT** y **Metatron**.

## Estructura
```
/index.html
/hermes.html
/tot.html
/metatron.html
/assets/js/main.js
/assets/css/main.css
/assets/config.js
/assets/img/logo.svg
```

## Configuración
1. Edita `assets/config.js` y reemplaza `https://<dominio-n8n>` por tu dominio real de n8n.
2. Asegura que cada flujo en n8n:
   - Reciba JSON `{ "chatInput": "...", "sessionId": "..." }`.
   - Responda `200` con JSON **simple** `{ "assistant": "..." }` o **extendido**:
     ```json
     { "messages": [{ "role": "assistant", "content": "..." }], "meta": { "agent": "Hermes", "tookMs": 1234 } }
     ```
   - En los headers de respuesta incluya:
     - `Content-Type: application/json`
     - `Access-Control-Allow-Origin: *`
     - `Cache-Control: no-store`

## Mock Mode
- Activar desde el toggle en la UI o agregando `?mock=1` a la URL. No se llama al webhook y se simula la respuesta.

## Publicar en GitHub Pages
- Opción A) Branch `gh-pages`: compila (no hay build) y sube la carpeta raíz a `gh-pages`.
- Opción B) Pages desde `main`: en settings → Pages, selecciona root.
- Revisa que los paths relativos estén correctos (`/assets/...`).

## Solución de problemas
- **CORS**: si ves bloqueos, verifica headers en el nodo `Respond to Webhook`.
- **404 en Pages**: comprueba rutas y nombres de archivo en minúsculas.
- **JSON inválido**: asegúrate que n8n devuelve un cuerpo JSON bien formado (sin logs mezclados).
- **Timeout**: ajusta tiempos del flujo o usa Mock Mode para pruebas.
