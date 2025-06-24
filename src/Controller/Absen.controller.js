import { prisma } from "../Config/Prisma.js";



export const createAbsen = async (req, res) => {
  try {
    const { userId, img_ttd, status } = req.body;

    if (!userId || !img_ttd) {
      return res.status(400).json({ message: 'userId dan img_ttd wajib diisi' });
    }

  
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const besok = new Date(today);
    besok.setDate(today.getDate() + 1);

    const sudahAbsen = await prisma.absen.findFirst({
      where: {
        userId,
        createdAt: {
          gte: today,  // >= jam 00:00 hari ini
          lt: besok    // < jam 00:00 besok
        }
      }
    });

    if (sudahAbsen) {
      return res.status(409).json({ message: 'Kamu sudah absen hari ini!' });
    }

    // Simpan absen baru
    const absen = await prisma.absen.create({
      data: {
        userId,
        img_ttd,
        status: status || 'hadir',
      },
    });

    res.status(201).json({ message: 'Absen berhasil', data: absen });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Terjadi kesalahan', error: error.message });
  }
};
