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

    let dateCondition = {};
    if (isDateValid) {
      // Ambil string tanggal secara mentah (misal: "2026-08-05")
      // Ambil 10 karakter pertama untuk memastikan format YYYY-MM-DD
      const dateStr = date.split("T")[0]; 
      const [year, month, day] = dateStr.split("-").map(Number);

      // Buat rentang awal hari (00:00:00.000) dan akhir hari (23:59:59.999) 
      // disesuaikan dengan offset WIB (-7 jam dari UTC) agar pas 1 hari penuh di database
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0 - 7, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23 - 7, 59, 59, 999));

      dateCondition = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const whereCondition = {
      ...(idUser && { userId: idUser }),
      ...(isDateValid && { createdAt: dateCondition }),
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



