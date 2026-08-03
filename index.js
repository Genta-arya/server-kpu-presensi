import express from "express";
import { createServer } from "http";
import cors from "cors";
import webRoutes from "./web.js"
import { automaticInsert } from "./src/Controller/Authentikasi.controller.js";
import { triggerAutoAbsen } from "./src/Controller/Absen.controller.js";

const app = express();
const PORT = 8080;
const httpServer = createServer(app);
app.use(express.json());

// Daftar domain yang diizinkan mengakses API Anda
const allowedOrigins = [
  "https://presensi.kpu-sekadau.my.id",
  "https://pegawai.kpu-sekadau.my.id"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Izinkan request yang tidak memiliki origin (seperti Postman atau mobile app)
      // atau jika origin ada di dalam daftar allowedOrigins
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use("/", webRoutes); 
app.get("/api/cron/generate-absen", triggerAutoAbsen);

// automaticInsert();

httpServer.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });