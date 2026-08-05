import { prisma } from "../Config/Prisma.js";
import { ROLES } from "../Utils/Constants.js";
import { sendError, sendResponse } from "../Utils/Response.js";

const getRandomOffset = () => (Math.random() - 0.5) * 0.0002;

const getCoordsForStatus = (status) => {
  if (status !== "hadir") return null; // Koordinat jadi null jika bukan hadir

  const target = { lat: 0.009752495103421941, lng: 110.95552433438533 };
  const getRandomOffset = () => (Math.random() - 0.5) * 0.0002;

  const lat = target.lat + getRandomOffset();
  const lng = target.lng + getRandomOffset();

  return `${lat},${lng}`;
};

const randomCoordinates = () => {
  const target = { lat: 0.009752495103421941, lng: 110.95552433438533 };
  const getRandomOffset = () => (Math.random() - 0.5) * 0.0002;

  const lat = target.lat + getRandomOffset();
  const lng = target.lng + getRandomOffset();

  return `${lat},${lng}`;
};
export const ImportMonthlyAbsensi = async (req, res) => {
  try {
    const { tahun, bulan } = req.body;

    if (!tahun || !bulan) {
      return sendResponse(res, 400, "Parameter 'tahun' dan 'bulan' wajib diisi.");
    }

    const year = parseInt(tahun, 10);
    const month = parseInt(bulan, 10);

    if (year !== 2026 || month < 1 || month > 12) {
      return sendResponse(res, 400, "Bulan atau tahun tidak valid.");
    }

    // 1. Ambil seluruh user sekali saja di awal
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    if (!allUsers || allUsers.length === 0) {
      return sendResponse(res, 404, "Tidak ada user yang ditemukan di database.");
    }

    const totalDays = new Date(year, month, 0).getDate();
    const finalStatus = "hadir";
    const finalKeterangan = "";
    const coordsString = getCoordsForStatus(finalStatus);

    const getRandomTime = (dateOnly, hour, startMinute, endMinute) => {
      const d = new Date(`${dateOnly}T00:00:00.000Z`);
      const randomMinute = startMinute + Math.floor(Math.random() * (endMinute - startMinute + 1));
      const randomSecond = Math.floor(Math.random() * 60);
      d.setUTCHours(hour, randomMinute, randomSecond, 0);
      return d;
    };

    let bulkDataToCreate = [];
    let dateRangesToDelete = [];

    // 2. Looping hari dan user untuk merakit array data (Sangat cepat karena di memori)
    for (let day = 1; day <= totalDays; day++) {
      const formattedDay = String(day).padStart(2, '0');
      const formattedMonth = String(month).padStart(2, '0');
      const dateOnly = `${year}-${formattedMonth}-${formattedDay}`;

      const targetDate = new Date(`${dateOnly}T00:00:00.000Z`);
      const startDate = new Date(`${dateOnly}T00:00:00.000Z`);
      const endDate = new Date(`${dateOnly}T23:59:59.999Z`);
      const dayOfWeek = targetDate.getUTCDay();

      // Lewati Sabtu (6) dan Minggu (0)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }

      // Kumpulkan rentang tanggal untuk dihapus datanya sekaligus (menghindari duplikasi)
      dateRangesToDelete.push({
        createdAt: { gte: startDate, lte: endDate }
      });

      let jamMasuk = getRandomTime(dateOnly, 7 - 7, 30, 59); // 07:30 - 07:59 WIB
      let jamKeluar = null;

      if (dayOfWeek === 5) {
        jamKeluar = getRandomTime(dateOnly, 16 - 7, 30, 50); // Jumat
      } else {
        jamKeluar = getRandomTime(dateOnly, 16 - 7, 1, 30);  // Senin - Kamis
      }

      for (const user of allUsers) {
        bulkDataToCreate.push({
          userId: user.id,
          status: finalStatus,
          keterangan: finalKeterangan,
          koordinat: coordsString,
          jam_masuk: jamMasuk,
          jam_keluar: jamKeluar,
          img_ttd: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png",
          createdAt: targetDate,
        });
      }
    }

    // 3. Eksekusi ke Database dengan Transaksi Cepat (Hapus data lama di bulan itu, lalu insert massal)
    await prisma.$transaction(async (tx) => {
      // Hapus data absen lama di rentang tanggal tersebut untuk semua user
      if (dateRangesToDelete.length > 0) {
        await tx.absen.deleteMany({
          where: {
            OR: dateRangesToDelete
          }
        });
      }

      // Masukkan seluruh data baru secara massal (Bulk Insert) dalam 1 perintah query!
      if (bulkDataToCreate.length > 0) {
        await tx.absen.createMany({
          data: bulkDataToCreate,
          skipDuplicates: true,
        });
      }
    });

    return sendResponse(
      res, 
      200, 
      `Berhasil import massal kilat untuk Bulan ${month} Tahun ${year}`
    );

  } catch (error) {
    console.error(error);
    return sendError(res, 500, "Terjadi kesalahan server", error);
  }
};

export const GetDataUser = async (req, res) => {
  try {
    // 1. Tangkap query parameter dari URL frontend (default ke 'active' jika tidak diisi)
    const { status } = req.query;
    

    // Tentukan kondisi boolean untuk field 'active' di database
    const isActiveFilter = status === "inactive" ? false : true;

    // --- PENYESUAIAN ZONA WAKTU (+8 JAM / WITA) ---
    // Ambil waktu saat ini di server
    const now = new Date();

    // Konversi waktu server ke waktu UTC, lalu tambahkan offset +8 jam (dalam milidetik)
    const offsetHours = 7;
    const localTime = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);

    // Buat rentang awal hari (00:00:00.000) berdasarkan zona waktu +8
    const todayStart = new Date(localTime);
    todayStart.setUTCHours(0, 0, 0, 0);
    // Kembalikan lagi ke acuan waktu standar untuk prisma jika dibutuhkan,
    // atau biarkan dalam bentuk UTC yang sudah digeser
    const startUTC = new Date(
      todayStart.getTime() - offsetHours * 60 * 60 * 1000,
    );

    // Buat rentang akhir hari (23:59:59.999) berdasarkan zona waktu +8
    const todayEnd = new Date(localTime);
    todayEnd.setUTCHours(23, 59, 59, 999);
    const endUTC = new Date(todayEnd.getTime() - offsetHours * 60 * 60 * 1000);
    // ----------------------------------------------

    const data = await prisma.user.findMany({
      where: {
        role: {
          in: [ROLES.USER, ROLES.SEKRETARIS],
        },
        // 2. Filter status keaktifan/arsip dinamis sesuai tab yang diklik
        active: isActiveFilter,
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        jabatan: true,
        nip: true,
        role: true,
        status_login: true,
        noHp: true,
        email: true,
        index: true,
        active: true, // Sertakan ini agar frontend tahu status aslinya
        Absens: {
          where: {
            createdAt: {
              gte: startUTC,
              lte: endUTC,
            },
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
        strukturUnit: {
          select: {
            id: true,
            posisi: true,
            unitKerjaId: true,
            unitKerja: {
              select: {
                id: true,
                nama: true,
                kode: true,
              },
            },
          },
        },
      },
      orderBy: {
        index: "asc",
      },
    });

    return sendResponse(res, 200, "Success", data);
  } catch (error) {
    console.error("Error GetUser:", error);
    return sendError(
      res,
      500,
      "Terjadi kesalahan saat mengambil data user",
      error,
    );
  }
};


export const updateCuti = async (req, res) => {
  try {
    const { userId, tanggals, keterangan } = req.body; 

    if (!userId || !tanggals) {
      return sendResponse(res, 400, "Parameter 'userId' dan 'tanggals' wajib diisi.");
    }

    const tanggalArray = Array.isArray(tanggals) ? tanggals : [tanggals];
    const statusCuti = "cuti";
    let results = [];

    for (const rawTanggal of tanggalArray) {
      const dateOnly = rawTanggal.split("T")[0]; // "2026-08-04"
      const [year, month, day] = dateOnly.split("-");

      const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

      if (isNaN(targetDate.getTime())) {
        continue;
      }

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
            status: statusCuti,
            keterangan: keterangan || "Cuti",
            jam_masuk: targetDate,  // Diisi jam 00
            jam_keluar: targetDate, // Diisi jam 00
            koordinat: null,
          },
        });
        results.push(updated);
      } else {
        const created = await prisma.absen.create({
          data: {
            userId,
            status: statusCuti,
            keterangan: keterangan || "Cuti",
            jam_masuk: targetDate,  // Diisi jam 00
            jam_keluar: targetDate, // Diisi jam 00
            koordinat: null,
            img_ttd: "cuti",
            createdAt: targetDate, 
          },
        });
        results.push(created);
      }
    }

    return sendResponse(res, 200, "Data cuti berhasil disimpan/diupdate", results);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, "Terjadi kesalahan server saat menyimpan cuti", error);
  }
};