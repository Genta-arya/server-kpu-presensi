import express from "express";
import { createJabatan, deleteJabatan, getAllJabatan, updateJabatan } from "../Controller/Jabatan.controller.js";

export const RoutesJabatan = express.Router();

RoutesJabatan.post("/", createJabatan);
RoutesJabatan.get("/data", getAllJabatan);
// RoutesJabatan.get("/:id", GetJabatanById);
RoutesJabatan.delete("/:id", deleteJabatan);
RoutesJabatan.post("/:id", updateJabatan);

