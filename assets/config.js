// assets/config.js — centraliza endpoints y zona horaria
// IMPORTANTE: Reemplaza <dominio-n8n> por tu dominio real de n8n.
window.APP_CONFIG = {
  agents: {
    hermes:   { name: "Hermes",   webhookUrl: "https://<dominio-n8n>/webhook/592f7716-c20e-49f0-98e2-df1d3652a2c3" },
    tot:      { name: "TOT",      webhookUrl: "https://<dominio-n8n>/webhook/ae96449a-5ad4-4c57-bc5c-cdddc248212e" },
    metatron: { name: "Metatron", webhookUrl: "https://<dominio-n8n>/webhook/2f9c6a09-0493-4d62-930e-82cde93b79da" }
  },
  cors: { allowedOrigins: ["*"] },
  timeZone: "America/Monterrey"
};
