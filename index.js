import express from "express";
import { createServer } from "http";
import cors from "cors";
import webRoutes from "./web.js";
import { automaticInsert } from "./src/Controller/Authentikasi.controller.js";
import { triggerAutoAbsen } from "./src/Controller/Absen.controller.js";

const app = express();
const PORT = 8080;
const httpServer = createServer(app);

// Daftar domain produksi/spesifik
const allowedOrigins = [
  "https://presensi.kpu-sekadau.my.id",
  "https://pegawai.kpu-sekadau.my.id"
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (isLocalhost || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
};

// 1. PASANG CORS DI URUTAN PALING PERTAMA
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Handle preflight untuk semua route

// 2. SETELAH CORS, BARU JSON PARSER
app.use(express.json());

app.use("/", webRoutes); 
app.get("/api/cron/generate-absen", triggerAutoAbsen);

httpServer.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});