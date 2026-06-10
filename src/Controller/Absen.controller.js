import { prisma } from "../Config/Prisma.js";
import { sendError, sendResponse } from "../Utils/Response.js";

export const createAbsen = async (req, res) => {
  try {
    const { userId, img_ttd, status, koordinat } = req.body;

    if (!userId || !img_ttd || !koordinat) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const besok = new Date(today);
    besok.setDate(today.getDate() + 1);

    const sudahAbsen = await prisma.absen.findFirst({
      where: {
        userId,
        createdAt: {
          gte: today, // >= jam 00:00 hari ini
          lt: besok, // < jam 00:00 besok
        },
      },
    });

    if (sudahAbsen) {
      return res.status(409).json({ message: "Kamu sudah absen hari ini!" });
    }

    // Simpan absen baru
    const absen = await prisma.absen.create({
      data: {
        userId,
        img_ttd,
        koordinat: koordinat,
        status: status || "hadir",
      },
    });

    res.status(201).json({ message: "Absen berhasil", data: absen });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan", error: error.message });
  }
};

export const getAbsen = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    let whereCondition = {
      userId: id,
    };

    if (month && year) {
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endOfMonth = new Date(
        parseInt(year),
        parseInt(month),
        0,
        23,
        59,
        59,
        999,
      );

      whereCondition.createdAt = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    }

    const absen = await prisma.absen.findMany({
      where: whereCondition,
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      message: "Absen berhasil diambil",
      count: absen.length,
      data: absen,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan", error: error.message });
  }
};

export const getAllAbsensi = async (req, res) => {
  try {
    const { status, month, year } = req.query;

    // 1. Filter default: Kecualikan role manajemen/admin
    let userCondition = {
      role: {
        notIn: ["SUPER_ADMIN", "ADMIN", "ADMIN_PPID"],
      },
    };

    // Filter status keaktifan user pegawai
    if (status === "active") {
      userCondition.active = true;
    } else if (status === "inactive") {
      userCondition.active = false;
    }

    // 2. Tentukan range tanggal awal dan akhir bulan pilihan
    const selectedMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const selectedYear = year ? parseInt(year) : new Date().getFullYear();

    const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const endOfMonth = new Date(
      selectedYear,
      selectedMonth,
      0,
      23,
      59,
      59,
      999,
    );

    // 3. Ambil data User beserta Log Absens di bulan tersebut
    const usersWithAbsen = await prisma.user.findMany({
      where: userCondition,
      select: {
        id: true,
        name: true,
        nip: true,
        active: true,
        index: true,
        jabatan: {
          select: {
            nama: true,
          },
        },
        Absens: {
          where: {
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          select: {
            status: true,
            createdAt: true, // Diperlukan untuk mengekstrak tanggal harian (1-31)
          },
        },
      },
      orderBy: {
        index: "asc", // Urutkan berdasarkan index di db Anda
      },
    });

    // 4. Proses pemetaan data log ke format grid harian & rekapitulasi

    const rekapAbsensi = usersWithAbsen.map((user) => {
      const rekap = { H: 0, A: 0, C: 0, I: 0, S: 0, DL: 0, TB: 0 };
      const namaJabatan = user.jabatan?.nama?.toLowerCase() || "";
      const isFullAbsen =
        namaJabatan.includes("ketua") || namaJabatan.includes("anggota");
      // Inisialisasi object untuk menampung status per tanggal harian (1 sampai 31)
      const harian = {};
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      for (let d = 1; d <= 31; d++) {
        harian[d] = ""; // Default kosong jika tidak ada log absen di tanggal itu
      }

      if (!isFullAbsen) {
        user.Absens.forEach((log) => {
          const tgl = new Date(log.createdAt).getDate(); // Ambil angka hari (1-31)
          const currentStatus = log.status?.toLowerCase();

          // Tentukan kode singkatan untuk diletakkan di grid tanggal harian
          let singkatan = "";
          if (currentStatus === "hadir") {
            rekap.H++;
            singkatan = "H";
          } else if (
            currentStatus === "alpha" ||
            currentStatus === "tidak_hadir"
          ) {
            rekap.A++;
            singkatan = "A";
          } else if (currentStatus === "cuti") {
            rekap.C++;
            singkatan = "C";
          } else if (currentStatus === "izin") {
            rekap.I++;
            singkatan = "I";
          } else if (currentStatus === "sakit") {
            rekap.S++;
            singkatan = "S";
          } else if (currentStatus === "dinas_luar" || currentStatus === "dl") {
            rekap.DL++;
            singkatan = "DL";
          } else if (
            currentStatus === "tanpa_berita" ||
            currentStatus === "tb"
          ) {
            rekap.TB++;
            singkatan = "TB";
          }

          // Simpan singkatan status ke tanggal yang bersangkutan
          if (tgl >= 1 && tgl <= 31) {
            harian[tgl] = singkatan;
          }
        });
      } else {
        rekap.H = daysInMonth;
      }

      // Total hari kerja aktif terisi
      const totalHari =
        rekap.H + rekap.A + rekap.C + rekap.I + rekap.S + rekap.DL + rekap.TB;

      return {
        id: user.id,
        name: user.name || "Tanpa Nama",
        nip: user.nip || "-",
        jabatan: user.jabatan?.nama || "Umum",
        index: user.index || 0,
        active: user.active,
        harian: harian, // Array map tanggal 1-31 untuk grid Excel harian
        rekap: rekap, // Total ringkasan di kanan
        total: totalHari,
        keterangan: "",
      };
    });

    res.status(200).json({
      message: "Data rekap presensi harian berhasil diproses",
      count: rekapAbsensi.length,
      data: rekapAbsensi,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan server", error: error.message });
  }
};

const getRandomOffset = () => (Math.random() - 0.5) * 0.0002;

const getCoordsForStatus = (status) => {
  if (status !== "hadir") return null; // Koordinat jadi null jika bukan hadir

  const target = { lat: 0.009752495103421941, lng: 110.95552433438533 };
  const getRandomOffset = () => (Math.random() - 0.5) * 0.0002;

  const lat = target.lat + getRandomOffset();
  const lng = target.lng + getRandomOffset();

  return `${lat},${lng}`;
};
export const updateStatusAbsensi = async (req, res) => {
  try {
    const { userId, tanggal, status, keterangan } = req.body;
    const coordsString = getCoordsForStatus(status);

    const startDate = new Date(tanggal);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(tanggal);
    endDate.setHours(23, 59, 59, 999);

    const existingAbsen = await prisma.absen.findFirst({
      where: {
        userId: userId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    if (existingAbsen) {
      const updated = await prisma.absen.update({
        where: { id: existingAbsen.id },
        data: {
          status,
          keterangan,
          koordinat: coordsString,
        },
      });
      return sendResponse(res, 200, "Absensi berhasil diupdate", updated);
    } else {
      const created = await prisma.absen.create({
        data: {
          userId,
          status,
          keterangan,
          koordinat: coordsString,
          img_ttd:
            "https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png",
          createdAt: new Date(tanggal),
        },
      });
      return sendResponse(res, 201, "Absensi baru dibuat", created);
    }
  } catch (error) {
    console.error(error);

    return sendError(res, 500, "Terjadi kesalahan server", error);
  }
};

export const triggerAutoAbsen = async (req, res) => {
  try {
    const now = new Date();
    // Panggil fungsi generate yang sudah kita buat sebelumnya
    await generateFullAbsenForRole(now.getMonth() + 1, now.getFullYear());
    
    res.status(200).json({ message: "Absensi otomatis berhasil dijalankan" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const generateFullAbsenForRole = async (selectedMonth, selectedYear) => {
  const startDate = new Date(selectedYear, selectedMonth - 1, 1);
  const endDate = new Date(selectedYear, selectedMonth, 0);

  // Ambil user dengan jabatan "Ketua" atau "Anggota" (case-insensitive)
  const targetUsers = await prisma.user.findMany({
    where: {
      jabatan: {
        nama: { in: ["Ketua", "Anggota"] }
      }
    },
    select: { id: true }
  });

  const tasks = [];
  
  // Loop per hari
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const currentDay = new Date(d);
    
    for (const user of targetUsers) {
      tasks.push(
        prisma.absen.upsert({
          where: {
            userId_createdAt: {
              userId: user.id,
              createdAt: currentDay
            }
          },
          update: {}, // Jika sudah ada, jangan diubah (supaya tidak menimpa jika user mengubah status manual)
          create: {
            userId: user.id,
            img_ttd: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png",
            status: "hadir",
            createdAt: currentDay
          }
        })
      );
    }
  }

  await Promise.all(tasks);
};