import { prisma } from "../Config/Prisma.js";
import { sendError } from "../Utils/Response.js";
import { sendSSEntNotification } from "./Notifications.controller.js";

export const createReport = async (req, res) => {
  try {
    const { userId, catatan } = req.body;
    if (!userId || !catatan) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }
    // CHECKuser
    const checkUser = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    const laporan = await prisma.reportKesalahanData.create({
      data: {
        userId,
        catatan,
        status: "PENDING",
      },
    });
    // simpan notifikasi untuk admin
    await prisma.notifikasi.create({
      data: {
        message: "Laporan kesalahan data",
        status: "PENDING",
      },
    });
    // stream notification
    sendSSEntNotification({
      message: "Ada laporan kesalahan data baru!",
      data: laporan,
    });
    res.status(201).json({
      message: "Laporan berhasil dibuat",
      data: laporan,
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, "Terjadi kesalahan saat membuat laporan");
  }
};

export const updateStatusReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const laporan = await prisma.reportKesalahanData.update({
      where: {
        id: id,
      },
      data: {
        status: status,
      },
    });
    res.status(200).json({
      message: "Status laporan berhasil diupdate",
      data: laporan,
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, "Terjadi kesalahan saat mengupdate status laporan");
  }
};

export const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const laporan = await prisma.reportKesalahanData.delete({
      where: {
        id: id,
      },
    });
    res.status(200).json({
      message: "Laporan berhasil dihapus",
      data: laporan,
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, "Terjadi kesalahan saat menghapus laporan");
  }
};

export const getAllReport = async (req, res) => {
  try {
    const laporan = await prisma.reportKesalahanData.findMany();
    res.status(200).json({
      message: "Laporan berhasil diambil",
      data: laporan,
    });
  } catch (error) {
    console.error(error);
    sendError(res, 500, "Terjadi kesalahan saat mengambil laporan");
  }
};
