// assets/config.js — configuración central lista para producción

window.APP_CONFIG = {
  agents: {
    hermes: {
      name: "Hermes",
      webhookUrl: "https://metatron.aircraftcare.net/webhook/592f7716-c20e-49f0-98e2-df1d3652a2c3"
    },
    tot: {
      name: "TOT",
      webhookUrl: "https://metatron.aircraftcare.net/webhook/ae96449a-5ad4-4c57-bc5c-cdddc248212e"
    },
    metatron: {
      name: "Metatron",
      webhookUrl: "https://metatron.aircraftcare.net/webhook/2f9c6a09-0493-4d62-930e-82cde93b79da"
    }
  },

  // Autenticación (desactivada por defecto, ya lista si tus flujos usan Basic o Bearer)
  auth: {
    type: "none",         // "none" | "basic" | "bearer"
    username: "",         // para Basic Auth
    password: "",         // para Basic Auth
    token: ""             // para Bearer Token
  },

  cors: { allowedOrigins: ["*"] },
  timeZone: "America/Monterrey"
};
