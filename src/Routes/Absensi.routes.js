import express from "express";
import { createAbsen, getAbsen } from "../Controller/Absen.controller.js";

export const RoutesAbsensi = express.Router();

RoutesAbsensi.post("/absen", createAbsen);
RoutesAbsensi.get("/absen/:id", getAbsen);
