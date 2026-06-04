import express from "express";
import {
  addUsersToSubbagian,
  assignPosisi,
  CreateSubbagian,
  deleteSubbagian,
  getSubbagian,
  GetSubbagianById,
  unAssingn,
  updateSubbagian,
} from "../Controller/Subbagian.controller.js";

export const RoutesSubbagian = express.Router();

RoutesSubbagian.post("/", CreateSubbagian);
RoutesSubbagian.get("/data", getSubbagian);
RoutesSubbagian.get("/:id", GetSubbagianById);
RoutesSubbagian.delete("/:id", deleteSubbagian);
RoutesSubbagian.post("/:id", updateSubbagian);
RoutesSubbagian.post("/:id/add-users", addUsersToSubbagian);
RoutesSubbagian.post("/:id/remove-users", unAssingn);
RoutesSubbagian.post("/:id/assign-posisi", assignPosisi);
