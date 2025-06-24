import express from "express";
import { createAbsen } from "../Controller/Absen.controller.js";

export const RoutesAbsensi = express.Router();

RoutesAbsensi.post("/absen", createAbsen);
