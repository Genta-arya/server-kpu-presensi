import express from "express";
import {
  DateTime,
  getSingleUser,
  GetUser,
  handleLogin,
  handleRegister,
  Logout,
  Session,
  verifikasiPin,
} from "../Controller/Authentikasi.controller.js";

export const RoutesAuth = express.Router();

RoutesAuth.post("/login", handleLogin);
RoutesAuth.post("/verifikasi", verifikasiPin);
RoutesAuth.post("/register", handleRegister);
RoutesAuth.post("/session", Session);
RoutesAuth.post("/logout", Logout);
RoutesAuth.get("/user", GetUser);
RoutesAuth.get("/user/:id", getSingleUser);

RoutesAuth.get("/date", DateTime);
