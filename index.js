import express from "express";
import { createServer } from "http";
import cors from "cors";
import webRoutes from "./web.js";
import { automaticInsert } from "./src/Controller/Authentikasi.controller.js";
import { triggerAutoAbsen } from "./src/Controller/Absen.controller.js";

const app = express();
const PORT = 8080;
const httpServer = createServer(app);

app.use(express.json());

// Daftar domain produksi/spesifik
const allowedOrigins = [
  "https://presensi.kpu-sekadau.my.id",
  "https://pegawai.kpu-sekadau.my.id"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // 1. Izinkan request tanpa origin (seperti Postman, curl, atau server-to-server)
      if (!origin) return callback(null, true);

      // 2. Izinkan SEMUA port dari localhost / 127.0.0.1 menggunakan Regex
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      // 3. Cek apakah origin ada di whitelist domain atau merupakan localhost
      if (isLocalhost || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.options("*", cors()); // Preflight request

app.use("/", webRoutes); 
app.get("/api/cron/generate-absen", triggerAutoAbsen);

httpServer.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});