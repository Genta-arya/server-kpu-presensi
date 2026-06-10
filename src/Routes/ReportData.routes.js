import express from "express";
import { createReport, deleteReport, getAllReport, updateStatusReport } from "../Controller/ReportData.controller.js";
import { notificationStream } from "../Controller/Notifications.controller.js";

export const RoutesReportData = express.Router();

RoutesReportData.post("/", createReport);
RoutesReportData.delete("/:id", deleteReport);
RoutesReportData.get("/", getAllReport);
RoutesReportData.post("/update/:id" , updateStatusReport)
RoutesReportData.get('/notification-stream', notificationStream);