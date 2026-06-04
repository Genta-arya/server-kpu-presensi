import express from "express";
import { RoutesAuth } from "./src/Routes/Auth.Routes.js";
import { RoutesAbsensi } from "./src/Routes/Absensi.routes.js";
import { RoutesLaporan } from "./src/Routes/Laporan.Routes.js";
import { RoutesSubbagian } from "./src/Routes/Subbagian.routes.js";
import { RoutesJabatan } from "./src/Routes/Jabatan.routes.js";

const router = express.Router();

router.use("/api/v1/auth", RoutesAuth);
router.use("/api/v1", RoutesAbsensi);
router.use("/api/v1/laporan", RoutesLaporan);
router.use("/api/v1/subbagian", RoutesSubbagian);
router.use("/api/v1/jabatan", RoutesJabatan);
export default router;
