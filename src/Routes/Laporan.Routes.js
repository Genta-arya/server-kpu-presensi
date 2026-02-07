import express from "express";
import {
  DeleteLaporan,
  EditLaporan,
  GetLaporan,
  PostLaporan,
} from "../Controller/Laporan.controller.js";

export const RoutesLaporan = express.Router();

RoutesLaporan.post("/", PostLaporan);
RoutesLaporan.get("/data", GetLaporan);

RoutesLaporan.delete("/:id", DeleteLaporan);
RoutesLaporan.put("/:id", EditLaporan);
