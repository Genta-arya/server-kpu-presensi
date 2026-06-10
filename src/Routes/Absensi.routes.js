import express from "express";
import {
  createAbsen,
  getAbsen,
  getAllAbsensi,
  updateStatusAbsensi,
} from "../Controller/Absen.controller.js";

export const RoutesAbsensi = express.Router();

RoutesAbsensi.post("/absen", createAbsen);
RoutesAbsensi.get("/absen/:id", getAbsen);
RoutesAbsensi.get("/absen", getAllAbsensi);
RoutesAbsensi.post("/absen/update", updateStatusAbsensi);
