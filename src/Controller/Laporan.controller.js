import { prisma } from "../Config/Prisma.js";

export const PostLaporan = async (req, res) => {
  try {
    const { deskripsi, date, judul, userId } = req.body;
    if (!deskripsi || !date || !judul || !userId) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }
    const laporan = await prisma.laporanHarian.create({
      data: {
        deskripsi,

        tanggal: new Date(date),
        userId,
        judul,
      },
    });
    res.status(201).json({
      message: "Laporan berhasil dibuat",
      data: laporan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const GetLaporan = async (req, res) => {
  try {
    const { idUser, date } = req.query;
    const isDateValid = date && date !== "undefined" && date !== "null" && !isNaN(Date.parse(date));

    const whereCondition = {
      ...(idUser && { userId: idUser }),
      ...(isDateValid && {
        createdAt: {
          gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
          lte: new Date(new Date(date).setHours(23, 59, 59, 999)),
        },
      }),
    };

    const laporan = await prisma.laporanHarian.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ message: "Berhasil", count: laporan.length, data: laporan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const DeleteLaporan = async (req, res) => {
  try {
    const { id } = req.params;
    const laporan = await prisma.laporanHarian.delete({
      where: {
        id: id,
      },
    });
    res.status(200).json({
      message: "Laporan berhasil dihapus",
      data: laporan,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const EditLaporan = async (req, res) => {
  try {
    const { id } = req.params;
    const { deskripsi, date, judul } = req.body;
    const laporan = await prisma.laporanHarian.update({
      where: {
        id: id,
      },
      data: {
        deskripsi,
        tanggal: new Date(date),
        judul,
      },
    });
    res.status(200).json({
      message: "Laporan berhasil diupdate",
      data: laporan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

export const GetLaporanById = async (req, res) => {
  try {
    const { id } = req.params;
    const laporan = await prisma.laporanHarian.findUnique({
      where: {
        id: id,
      },
    });
    res.status(200).json({
      message: "Laporan berhasil diambil",
      data: laporan,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



