import express from "express";
import {
  DateTime,
  deleteUser,
  getSingleUser,
  GetUser,
  handleLogin,
  handleRegister,
  Logout,
  reorderUser,
  resetMFA,
  ResetPassword,
  Session,
  setupMFA,
  updateAvatar,
  updateProfilSingleUser,
  updateSingleUser,
  verifikasiPin,
  verifyMFA,
  verifySetupMFA,
} from "../Controller/Authentikasi.controller.js";

export const RoutesAuth = express.Router();

RoutesAuth.post("/login", handleLogin);
RoutesAuth.post("/reset-password", ResetPassword);
RoutesAuth.get("/mfa/setup/:userId", setupMFA);
RoutesAuth.post("/mfa/reset", resetMFA);
RoutesAuth.post("/mfa/verify-setup", verifySetupMFA);
RoutesAuth.post("/mfa/verify", verifyMFA);
RoutesAuth.post("/verifikasi", verifikasiPin);
RoutesAuth.post("/register", handleRegister);
RoutesAuth.post("/session", Session);
RoutesAuth.post("/logout", Logout);
RoutesAuth.get("/user", GetUser);
RoutesAuth.get("/user/:id", getSingleUser);
RoutesAuth.get("/date", DateTime);
RoutesAuth.post("/update-user/:id", updateSingleUser);
RoutesAuth.post("/update-profil/:id", updateProfilSingleUser);
RoutesAuth.post("/update-avatar/:id", updateAvatar);
RoutesAuth.delete("/delete-user/:id", deleteUser);
RoutesAuth.post("/update-index", reorderUser);
