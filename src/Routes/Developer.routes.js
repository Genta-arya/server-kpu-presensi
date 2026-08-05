import express from "express";
import {
  GetDataUser,
  ImportMonthlyAbsensi,
  updateCuti,
} from "../Controller/Developer.controller.js";

export const RoutesDeveloper = express.Router();

RoutesDeveloper.post("/import-presensi", ImportMonthlyAbsensi);
RoutesDeveloper.get("/get-data-user", GetDataUser);
RoutesDeveloper.post("/update-cuti", updateCuti);
