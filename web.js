import express from "express";
import { RoutesAuth } from "./src/Routes/Auth.Routes.js";
import { RoutesAbsensi } from "./src/Routes/Absensi.routes.js";

const router = express.Router();

router.use("/api/v1/auth", RoutesAuth);
router.use("/api/v1", RoutesAbsensi);
export default router;
