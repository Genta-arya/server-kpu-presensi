import express from "express";
import {
  addPengajuanCuti,
  cancelingCuti,
  createAbsen,
  getAbsen,
  getAllAbsensi,
  getPengajuanCuti,
  getRiwayatPengajuanCuti,
  getStaffPengajuanCutiForKasubag,
  updateAbsenPulang,
  updateStatusAbsensi,
  updateStatusCuti,
} from "../Controller/Absen.controller.js";

export const RoutesAbsensi = express.Router();

RoutesAbsensi.post("/absen", createAbsen);
RoutesAbsensi.post("/absen/pulang", updateAbsenPulang);
RoutesAbsensi.get("/absen/:id", getAbsen);
RoutesAbsensi.get("/absen", getAllAbsensi);
RoutesAbsensi.post("/absen/update", updateStatusAbsensi);
RoutesAbsensi.post("/absen/pengajuan-cuti", addPengajuanCuti);
RoutesAbsensi.get("/absen/pengajuan-cuti/:id", getPengajuanCuti);
RoutesAbsensi.get(
  "/absen/kasubag/pengajuan-cuti/:id",
  getStaffPengajuanCutiForKasubag,
);
RoutesAbsensi.get(
  "/absen/sekretaris/pengajuan-cuti/:id",
  getRiwayatPengajuanCuti,
);
RoutesAbsensi.post("/absen/update-pengajuan-cuti/:id", updateStatusCuti);
RoutesAbsensi.post("/absen/cancel-pengajuan-cuti/:id", cancelingCuti);
