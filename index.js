
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
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use("/", webRoutes); 
app.get("/api/cron/generate-absen", triggerAutoAbsen);

// automaticInsert();

httpServer.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
  