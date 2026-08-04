import { prisma } from "../Config/Prisma.js";
import { sendError, sendResponse } from "../Utils/Response.js";

export const createAbsen = async (req, res) => {
  try {
    const { userId, img_ttd, status, koordinat } = req.body;

    if (!userId || !img_ttd || !koordinat) {
      return res.status(400).json({ message: "Semua field wajib diisi" });
    }

    // --- PENYESUAIAN WAKTU LOKAL (+7 JAM UNTUK WIB) ---
    const offsetMs = 7 * 60 * 60 * 1000;
    const nowLocal = new Date(Date.now() + offsetMs);

    // Ambil tanggal hari ini dalam format UTC
    const year = nowLocal.getUTCFullYear();
    const month = nowLocal.getUTCMonth();
    const day = nowLocal.getUTCDate();

    // Buat rentang awal hari (00:00:00.000) dan besok dalam waktu +7
    const todayStart = new Date(Date.UTC(year, month, day, 0 - 7, 0, 0, 0));
    const besokStart = new Date(Date.UTC(year, month, day + 1, 0 - 7, 0, 0, 0));

    const sudahAbsen = await prisma.absen.findFirst({
      where: {
        userId,
        createdAt: {
          gte: todayStart,
          lt: besokStart,
        },
      },
    });

    if (sudahAbsen) {
      return res.status(409).json({ message: "Kamu sudah absen hari ini!" });
    }

    // --- FITUR RANDOM JAM MASUK (DEFAULT: 08:01 - 08:15 WIB) ---
    // (Ke depannya, Anda bisa membungkus logika ini dengan pengecekan `if (isRandomSettingEnabled)`)
    const randomMinute = Math.floor(Math.random() * (15 - 1 + 1)) + 1; // Menghasilkan angka acak antara 1 sampai 15
    
    // Set jam ke 08 dan menit sesuai hasil acak (dalam format UTC karena nowLocal digeser +7)
    nowLocal.setUTCHours(8 - 7); // Jam 8 pagi WIB disesuaikan offset UTC
    nowLocal.setUTCMinutes(randomMinute);
    nowLocal.setUTCSeconds(Math.floor(Math.random() * 60)); // Detik acak agar natural

    // Simpan absen baru
    const absen = await prisma.absen.create({
      data: {
        userId,
        img_ttd,
        koordinat: koordinat,
        jam_masuk: nowLocal,
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

export const updateAbsenPulang = async (req, res) => {
  const { userId } = req.body;
  try {
    const nowLocal = new Date(Date.now() + 7 * 60 * 60 * 1000); // +7 jam untuk WIB
    const todayStart = new Date(
      Date.UTC(
        nowLocal.getFullYear(),
        nowLocal.getMonth(),
        nowLocal.getDate(),
        0 - 7,
        0,
        0,
        0,
      ),
    );

    const absen = await prisma.absen.findFirst({
      where: {
        userId,
        createdAt: {
          gte: todayStart,
        },
      },
    });

    if (!absen) {
      return res.status(404).json({ message: "Absen tidak ditemukan" });
    }

    // --- TAMBAHAN CHECK JAM MASUK ---
    if (!absen.jam_masuk) {
      return res.status(400).json({
        message: "Harap absen masuk terlebih dahulu",
      });
    }

    // --- TAMBAHAN CHECK JAM KELUAR ---
    if (absen.jam_keluar) {
      return res.status(400).json({
        message: "Anda sudah melakukan absen pulang hari ini",
      });
    }

    // --- LOGIKA RANDOM JAM KELUAR BERDASARKAN HARI ---
    // getUTCDay(): 0 = Minggu, 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu
    const hari = nowLocal.getUTCDay();
    let randomMinute = 1;

    if (hari === 5) {
      // Hari JUMAT: 16:30 - 16:50 (menit 30 sampai 50)
      randomMinute = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
      nowLocal.setUTCHours(16 - 7); // Jam 16 WIB disesuaikan offset UTC
      nowLocal.setUTCMinutes(randomMinute);
    } else {
      // Hari SENIN - KAMIS (1, 2, 3, 4): 16:01 - 16:30 (menit 1 sampai 30)
      randomMinute = Math.floor(Math.random() * (30 - 1 + 1)) + 1;
      nowLocal.setUTCHours(16 - 7); // Jam 16 WIB disesuaikan offset UTC
      nowLocal.setUTCMinutes(randomMinute);
    }

    // Detik acak agar terlihat natural
    nowLocal.setUTCSeconds(Math.floor(Math.random() * 60));

    const updatedAbsen = await prisma.absen.update({
      where: { id: absen.id },
      data: {
        jam_keluar: nowLocal,
      },
    });

    res.status(200).json({
      message: "Absen pulang berhasil diperbarui",
      data: updatedAbsen,
    });
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

    let whereCondition = { userId: id };

    if (month && year) {
      const parsedYear = parseInt(year);
      const parsedMonth = parseInt(month) - 1;

      // Membuat rentang waktu dengan memperhitungkan offset +8 jam (WITA)
      // Jika server UTC, kita set jam 00:00:00.000 dengan menggeser 8 jam ke belakang untuk awal bulan,
      // atau langsung buat objek Date dengan string ISO agar aman.

      // Contoh menggunakan pergeseran jam UTC+8:
      const startOfMonth = new Date(
        Date.UTC(parsedYear, parsedMonth, 1, 0 - 7, 0, 0, 0),
      );
      const endOfMonth = new Date(
        Date.UTC(parsedYear, parsedMonth + 1, 0, 23 - 7, 59, 59, 999),
      );

      whereCondition.createdAt = { gte: startOfMonth, lte: endOfMonth };
    }

    const absen = await prisma.absen.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
    });

    // --- PROSES MENGOSONGKAN SABTU-MINGGU DENGAN PENYESUAIAN +8 JAM ---
    const processedAbsen = absen.map((item) => {
      const date = new Date(item.createdAt);

      // Tambahkan 7 jam (dalam milidetik) ke waktu item.createdAt agar harinya akurat sesuai zona waktu +7
      const localTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
      const day = localTime.getUTCDay(); // Gunakan getUTCDay karena sudah digeser secara manual

      if (day === 0 || day === 6) {
        return {
          ...item,
          status: null, // Mengosongkan status
          keterangan: "Libur Akhir Pekan",
        };
      }
      return item;
    });

    res.status(200).json({
      message: "Absen berhasil diambil",
      count: processedAbsen.length,
      data: processedAbsen,
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

    let userCondition = {
      role: { notIn: ["SUPER_ADMIN", "ADMIN", "ADMIN_PPID"] },
    };
    if (status === "active") userCondition.active = true;
    else if (status === "inactive") userCondition.active = false;

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

    const usersWithAbsen = await prisma.user.findMany({
      where: userCondition,
      select: {
        id: true,
        name: true,
        nip: true,
        active: true,
        index: true,
        jabatan: { select: { nama: true } },
        Absens: {
          where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
          select: { status: true, createdAt: true },
        },
      },
      orderBy: { index: "asc" },
    });

    const isWeekend = (y, m, d) => {
      const date = new Date(y, m - 1, d);
      return date.getDay() === 0 || date.getDay() === 6;
    };

    const rekapAbsensi = usersWithAbsen.map((user) => {
      const rekap = { H: 0, A: 0, C: 0, I: 0, S: 0, DL: 0, TB: 0 };
      const namaJabatan = user.jabatan?.nama?.toLowerCase() || "";
      const isFullAbsen =
        namaJabatan.includes("ketua") || namaJabatan.includes("anggota");

      const harian = {};
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

      // Inisialisasi hari kerja
      for (let d = 1; d <= daysInMonth; d++) {
        harian[d] = isWeekend(selectedYear, selectedMonth, d) ? "W" : "";
      }

      if (!isFullAbsen) {
        // Filter unik: Ambil status terakhir jika ada log ganda di hari yang sama
        const dailyLogs = {};
        user.Absens.forEach((log) => {
          const tgl = new Date(log.createdAt).getDate();
          dailyLogs[tgl] = log.status?.toLowerCase();
        });

        for (let tgl = 1; tgl <= daysInMonth; tgl++) {
          if (isWeekend(selectedYear, selectedMonth, tgl)) continue;

          const status = dailyLogs[tgl];
          if (status) {
            let key = "";
            if (status === "hadir") {
              key = "H";
              rekap.H++;
            } else if (["alpha", "tidak_hadir"].includes(status)) {
              key = "A";
              rekap.A++;
            } else if (status === "cuti") {
              key = "C";
              rekap.C++;
            } else if (status === "izin") {
              key = "I";
              rekap.I++;
            } else if (status === "sakit") {
              key = "S";
              rekap.S++;
            } else if (["dinas_luar", "dl"].includes(status)) {
              key = "DL";
              rekap.DL++;
            } else if (["tanpa_berita", "tb"].includes(status)) {
              key = "TB";
              rekap.TB++;
            }

            harian[tgl] = key;
          }
        }
      } else {
        // Untuk Ketua/Anggota, isi "H" hanya untuk hari kerja
        for (let d = 1; d <= daysInMonth; d++) {
          if (!isWeekend(selectedYear, selectedMonth, d)) {
            harian[d] = "H";
            rekap.H++; // Ditambah hanya sekali per hari kerja
          }
        }
      }

      const totalHari =
        rekap.H + rekap.A + rekap.C + rekap.I + rekap.S + rekap.DL + rekap.TB;

      return {
        id: user.id,
        name: user.name,
        nip: user.nip,
        jabatan: user.jabatan?.nama || "Umum",
        index: user.index,
        active: user.active,
        harian,
        rekap,
        total: totalHari,
        keterangan: "",
      };
    });

    res.status(200).json({
      message: "Sukses",
      count: rekapAbsensi.length,
      data: rekapAbsensi,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
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

const randomCoordinates = () => {
  const target = { lat: 0.009752495103421941, lng: 110.95552433438533 };
  const getRandomOffset = () => (Math.random() - 0.5) * 0.0002;

  const lat = target.lat + getRandomOffset();
  const lng = target.lng + getRandomOffset();

  return `${lat},${lng}`;
};
export const updateStatusAbsensi = async (req, res) => {
  try {
    const { userId, tanggal, status, keterangan } = req.body;

    if (!tanggal || !userId) {
      return sendResponse(res, 400, "Parameter 'tanggal' dan 'userId' wajib diisi.");
    }

    // Ambil bagian tanggalnya saja (YYYY-MM-DD)
    const dateOnly = tanggal.split("T")[0]; // Contoh: "2026-08-20"

    // ✅ GUNAKAN UTC MURNI (.000Z) AGAR TIDAK MUNDUR HARI DI DATABASE
    const targetDate = new Date(`${dateOnly}T00:00:00.000Z`);
    const startDate = new Date(`${dateOnly}T00:00:00.000Z`);
    const endDate = new Date(`${dateOnly}T23:59:59.999Z`);

    if (isNaN(targetDate.getTime()) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return sendResponse(res, 400, "Format tanggal tidak valid.");
    }

    const coordsString = getCoordsForStatus(status);
    const dayOfWeek = targetDate.getUTCDay(); // Gunakan getUTCDay() untuk UTC murni

    // Helper untuk membuat waktu random dalam format UTC murni
    const getRandomTime = (hour, startMinute, endMinute) => {
      const d = new Date(`${dateOnly}T00:00:00.000Z`);
      const randomMinute = startMinute + Math.floor(Math.random() * (endMinute - startMinute + 1));
      const randomSecond = Math.floor(Math.random() * 60);
      
      // Karena kita ingin jam masuk sekitar jam 8 pagi WIB (yang mana jam 01:00 UTC),
      // atau jika ingin jam 08:00 UTC, sesuaikan method setUTCHours-nya:
      d.setUTCHours(hour, randomMinute, randomSecond, 0);
      return d;
    };

    const statusUpper = status ? status.toUpperCase() : "";
    const isLibur = statusUpper === "LIBUR";

    let jamMasuk = null;
    let jamKeluar = null;

    if (!isLibur) {
      // Jika ingin jam 8 pagi UTC (atau sesuaikan jam kerjanya)
      jamMasuk = getRandomTime(8, 0, 15);

      const isHadirOrValid = 
        statusUpper === "HADIR" || 
        (!statusUpper.includes("IZIN") && !statusUpper.includes("SAKIT"));

      if (isHadirOrValid) {
        if (dayOfWeek === 5) {
          jamKeluar = getRandomTime(16, 30, 45); // Jumat
        } else {
          jamKeluar = getRandomTime(16, 0, 15);  // Senin - Kamis
        }
      }
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
          status,
          keterangan,
          koordinat: coordsString,
          jam_masuk: jamMasuk,
          jam_keluar: jamKeluar,
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
          jam_masuk: jamMasuk,
          jam_keluar: jamKeluar,
          img_ttd:
            "https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png",
          createdAt: targetDate,
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
const getRandomTimeDate = (date) => {
  const d = new Date(date);
  // Jam 7
  const hour = 7;
  // Menit acak antara 30 - 50
  const minute = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
  // Detik acak antara 0 - 59
  const second = Math.floor(Math.random() * 60);

  d.setHours(hour, minute, second, 0);
  return d;
};
const generateFullAbsenForRole = async (selectedMonth, selectedYear) => {
  const startDate = new Date(selectedYear, selectedMonth - 1, 1);
  const endDate = new Date(selectedYear, selectedMonth, 0);

  // Ambil user dengan jabatan "Ketua" atau "Anggota"
  const targetUsers = await prisma.user.findMany({
    where: {
      jabatan: {
        nama: { in: ["Ketua", "Anggota"] },
      },
    },
    select: { id: true },
  });

  const tasks = [];

  // Loop per hari dalam bulan tersebut
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // Tentukan batas waktu awal dan akhir hari tersebut (00:00:00 - 23:59:59)
    const dayStart = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      0,
      0,
      0,
      0,
    );
    const dayEnd = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      23,
      59,
      59,
      999,
    );

    for (const user of targetUsers) {
      // 1. Cek apakah user sudah punya data absen di hari tersebut (abaikan jam)
      const existingAbsen = await prisma.absen.findFirst({
        where: {
          userId: user.id,
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      // 2. Jika belum ada, baru buat data baru dengan jam random
      if (!existingAbsen) {
        tasks.push(
          prisma.absen.create({
            data: {
              userId: user.id,
              img_ttd:
                "https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png",
              status: "hadir",
              koordinat: randomCoordinates(),
              createdAt: getRandomTimeDate(d), // Tetap gunakan jam random Anda
            },
          }),
        );
      }
    }
  }

  // Jalankan semua perintah create secara paralel
  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
};

export const addPengajuanCuti = async (req, res) => {
  try {
    const {
      userId,
      jenisCuti,
      tanggalMulai,
      tanggalSelesai,
      keterangan,
      suratDokter, // Berisi URL file atau path
    } = req.body;

    if (
      !userId ||
      !jenisCuti ||
      !tanggalMulai ||
      !tanggalSelesai ||
      !keterangan
    ) {
      return res.status(400).json({
        message: "Semua field wajib diisi",
      });
    }

    // Ambil data User lengkap dengan relasi Jabatan dan StrukturUnit-nya
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        jabatan: true,
        strukturUnit: true, // Mengambil posisi user (KASUBAG, STAFF, dll)
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    const mulai = new Date(tanggalMulai);
    const selesai = new Date(tanggalSelesai);

    if (isNaN(mulai) || isNaN(selesai)) {
      return res.status(400).json({
        message: "Format tanggal tidak valid",
      });
    }

    if (selesai < mulai) {
      return res.status(400).json({
        message: "Tanggal selesai tidak boleh lebih kecil dari tanggal mulai",
      });
    }

    // Hitung hari kerja (exclude Sabtu dan Minggu)
    let totalHari = 0;
    const currentDate = new Date(mulai);

    while (currentDate <= selesai) {
      const day = currentDate.getDay();
      if (day !== 0 && day !== 6) {
        totalHari++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (totalHari <= 0) {
      return res.status(400).json({
        message: "Tidak ada hari kerja yang dipilih",
      });
    }

    // UPDATE LOGIKA: Surat dokter hanya wajib jika Cuti Sakit LEBIH DARI 1 HARI
    if (
      jenisCuti === "Sakit" &&
      totalHari > 1 &&
      (!suratDokter || suratDokter.trim() === "")
    ) {
      return res.status(400).json({
        message:
          "Surat keterangan dokter wajib dilampirkan untuk cuti sakit lebih dari 1 hari",
      });
    }

    // Ambil atau generate saldo kuota tahunan berjalan
    const tahun = mulai.getFullYear();
    let saldo = await prisma.saldoCuti.findUnique({
      where: {
        userId_tahun: {
          userId,
          tahun,
        },
      },
    });

    if (!saldo) {
      saldo = await prisma.saldoCuti.create({
        data: {
          userId,
          tahun,
        },
      });
    }

    let sisaSaldo = 0;
    let namaCutiTeks = ""; // Variabel baru untuk menampung nama cuti yang rapi

    switch (jenisCuti) {
      case "Tahunan":
        sisaSaldo = saldo.sisaTahunan;
        namaCutiTeks = "Cuti Tahunan";
        break;

      case "Sakit":
        sisaSaldo = saldo.sisaSakit;
        namaCutiTeks = "Cuti Sakit";
        break;

      case "AlasanPenting":
        sisaSaldo = saldo.sisaAlasanPenting;
        namaCutiTeks = "Cuti Alasan Penting";
        break;

      case "CutiBesar":
        sisaSaldo = saldo.sisaBesar;
        namaCutiTeks = "Cuti Besar";
        break;

      case "Melahirkan":
        sisaSaldo = saldo.sisaMelahirkan;
        namaCutiTeks = "Cuti Melahirkan";
        break;

      default:
        return res.status(400).json({
          message: "Jenis cuti tidak valid",
        });
    }

    // PESAN ERROR SEKARANG MENYESUAIKAN DENGAN JENIS CUTI MASING-MASING
    if (totalHari > sisaSaldo) {
      return res.status(400).json({
        message: `Pengajuan ditolak! Kuota untuk ${namaCutiTeks} Anda tidak mencukupi. Sisa jatah saat ini hanya ${sisaSaldo} hari.`,
      });
    }

    // =================================================================
    // LOGIKA ATURAN STATUS BERDASARKAN JABATAN & POSISI ASN (WORKFLOW)
    // =================================================================
    let statusAwal = "MENUNGGU_KASUBAG"; // Default untuk STAFF / Umum

    const namaJabatan = user.jabatan?.nama?.toLowerCase() || "";
    const roleUser = user.role;

    // Cari tahu apakah user punya posisi KASUBAG di salah satu unit kerjanya
    const isKasubag = user.strukturUnit.some(
      (unit) => unit.posisi === "KASUBAG",
    );

    // Rule 1: Jika Ketua, Anggota, atau Sekretaris -> Tanpa persetujuan internal, langsung DISETUJUI oleh sistem/admin
    if (
      namaJabatan.includes("ketua") ||
      namaJabatan.includes("anggota") ||
      namaJabatan.includes("sekretaris") ||
      roleUser === "SEKRETARIS"
    ) {
      statusAwal = "DISETUJUI";
    }
    // Rule 2: Jika dia menjabat sebagai Kasubag -> Bypass Kasubag, langsung naik ke Sekretaris
    else if (isKasubag) {
      statusAwal = "MENUNGGU_SEKRETARIS";
    }
    // Rule 3: Selain itu (Staff / posisi lainnya) -> Harus lewat Kasubag dulu (Tetap default)

    // =================================================================

    // Simpan Pengajuan Cuti Baru dengan statusAwal hasil kalkulasi workflow
    const pengajuan = await prisma.pengajuanCuti.create({
      data: {
        userId,
        jenisCuti,
        tanggalMulai: mulai,
        tanggalSelesai: selesai,
        totalHari,
        keterangan,
        suratDokter: suratDokter || null,
        status: statusAwal,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nip: true,
          },
        },
      },
    });

    return res.status(201).json({
      message:
        statusAwal === "DISETUJUI"
          ? "Pengajuan cuti berhasil dibuat dan otomatis disetujui"
          : "Pengajuan cuti berhasil dibuat, menunggu persetujuan atasan",
      data: pengajuan,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const getPengajuanCuti = async (req, res) => {
  const { id } = req.params;
  const { tahun } = req.query;

  // Validasi parameter tahun wajib ada
  if (!tahun) {
    return res.status(400).json({
      message: "Parameter tahun wajib disertakan",
    });
  }

  try {
    // 1. Definisikan batas jangkauan tanggal berdasarkan tahun murni
    const awalTahun = new Date(`${tahun}-01-01T00:00:00.000Z`);
    const akhirTahun = new Date(`${tahun}-12-31T23:59:59.999Z`);

    if (isNaN(awalTahun.getTime()) || isNaN(akhirTahun.getTime())) {
      return res.status(400).json({
        message: "Format parameter tahun tidak valid",
      });
    }

    // 2. Eksekusi query dengan filter jarak tanggal (Date Range Filtering)
    const pengajuan = await prisma.pengajuanCuti.findMany({
      where: {
        userId: id,
        tanggalMulai: {
          gte: awalTahun, // Greater than or equal (Lebih besar atau sama dengan 1 Jan)
          lte: akhirTahun, // Less than or equal (Lebih kecil atau sama dengan 31 Des)
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nip: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Urutkan berkas dari yang paling terbaru
      },
    });

    return res.status(200).json({
      message: `Data pengajuan cuti tahun ${tahun} berhasil diambil`,
      data: pengajuan,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const getStaffPengajuanCutiForKasubag = async (req, res) => {
  const { id } = req.params; // ID Atasan (Kasubag / Sekretaris) dan parameter tahun
  const { tahun } = req.query;
  // Validasi parameter tahun wajib ada
  if (!tahun) {
    return res.status(400).json({
      message: "Parameter tahun wajib disertakan",
    });
  }

  try {
    // 1. Definisikan batas jangkauan tanggal berdasarkan tahun murni
    const awalTahun = new Date(`${tahun}-01-01T00:00:00.000Z`);
    const akhirTahun = new Date(`${tahun}-12-31T23:59:59.999Z`);

    if (isNaN(awalTahun.getTime()) || isNaN(akhirTahun.getTime())) {
      return res.status(400).json({
        message: "Format parameter tahun tidak valid",
      });
    }

    // 2. Ambil data user beserta posisi struktur unitnya
    const checkUser = await prisma.user.findUnique({
      where: { id },
      include: { strukturUnit: true },
    });

    if (!checkUser) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    const isSekretaris = checkUser.role === "SEKRETARIS";
    const kasubagUnit = checkUser.strukturUnit.find(
      (unit) => unit.posisi === "KASUBAG",
    );

    // Jika dia bukan Sekretaris DAN bukan juga Kasubag, tolak akses
    if (!isSekretaris && !kasubagUnit) {
      return res.status(403).json({
        message: "Akses ditolak. Anda tidak memiliki otoritas menyetujui cuti.",
      });
    }

    // 3. RANCANG LOGIKA FILTER BERDASARKAN JABATAN & TAHUN PENGAJUAN
    let databaseQueryFilter = {
      // Injeksi filter rentang tanggal pengajuan berlaku untuk semua role atasan
      tanggalMulai: {
        gte: awalTahun,
        lte: akhirTahun,
      },
    };

    if (isSekretaris) {
      // SEKRETARIS: Mengambil ALL subbagian pada tahun terkait
      databaseQueryFilter.status = "MENUNGGU_SEKRETARIS";
    } else {
      // KASUBAG: Dikunci rapat hanya untuk subbagian miliknya & posisi STAFF pada tahun terkait
      databaseQueryFilter.status = "MENUNGGU_KASUBAG";
      databaseQueryFilter.user = {
        strukturUnit: {
          some: {
            unitKerjaId: kasubagUnit.unitKerjaId,
            posisi: "STAFF",
          },
        },
      };
    }

    // 4. EKSEKUSI AMBIL DATA KE DATABASE
    const pengajuanStaff = await prisma.pengajuanCuti.findMany({
      where: databaseQueryFilter,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nip: true,
            avatar: true,
            strukturUnit: {
              include: {
                unitKerja: { select: { nama: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      message: isSekretaris
        ? `Data permohonan cuti masuk seluruh subbagian tahun ${tahun} berhasil diambil`
        : `Data permohonan cuti staff bawahan subbagian tahun ${tahun} berhasil diambil`,
      data: pengajuanStaff,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateStatusCuti = async (req, res) => {
  const { id } = req.params; // ID Pengajuan Cuti
  const { rolePenyetuju, aksi, catatan } = req.body;

  // 1. Validasi Input Dasar
  if (!aksi || !["setuju", "tolak"].includes(aksi)) {
    return res.status(400).json({
      message: "Aksi tidak valid. Harus 'setuju' atau 'tolak'.",
    });
  }

  if (
    !rolePenyetuju ||
    !["KASUBAG", "SEKRETARIS"].includes(rolePenyetuju?.toUpperCase())
  ) {
    return res.status(400).json({
      message: "Role penyetuju tidak valid atau tidak disertakan.",
    });
  }

  try {
    // Ambil data pengajuan cuti terlebih dahulu untuk validasi keamanan status
    const pengajuanEksis = await prisma.pengajuanCuti.findUnique({
      where: { id },
    });

    if (!pengajuanEksis) {
      return res
        .status(404)
        .json({ message: "Data pengajuan cuti tidak ditemukan." });
    }

    let statusBaru;
    const roleUpper = rolePenyetuju.toUpperCase();

    // ====================================================================
    // LOGIKA EVALUASI STATUS BERDASARKAN ROLE YANG MENYETUJUI / MENOLAK
    // ====================================================================
    if (roleUpper === "KASUBAG") {
      if (pengajuanEksis.status !== "MENUNGGU_KASUBAG") {
        return res.status(400).json({
          message: "Berkas ini sudah bukan ditahap verifikasi Kasubag.",
        });
      }
      statusBaru =
        aksi === "setuju" ? "MENUNGGU_SEKRETARIS" : "DITOLAK_KASUBAG";
    } else if (roleUpper === "SEKRETARIS") {
      if (pengajuanEksis.status !== "MENUNGGU_SEKRETARIS") {
        return res.status(400).json({
          message: "Berkas ini belum diverifikasi Kasubag atau sudah selesai.",
        });
      }
      statusBaru = aksi === "setuju" ? "DISETUJUI" : "DITOLAK_SEKRETARIS";
    }

    // ====================================================================
    // EKSEKUSI UPDATE KE DATABASE (DENGAN PROTEKSI OVERLAPPING DATE)
    // ====================================================================
    const result = await prisma.$transaction(async (tx) => {
      // KUNCI UTAMA: Jika disetujui penuh oleh Sekretaris, cek dulu apakah ada tanggal yang bentrok
      if (statusBaru === "DISETUJUI") {
        // Buat range pencarian tanggal murni tanpa jam (00:00:00)
        const tglMulaiCuti = new Date(pengajuanEksis.tanggalMulai);
        tglMulaiCuti.setHours(0, 0, 0, 0);

        const tglSelesaiCuti = new Date(pengajuanEksis.tanggalSelesai);
        tglSelesaiCuti.setHours(23, 59, 59, 999); // Amankan batas akhir hari

        // Cari apakah sudah ada records absen berstatus 'cuti' di range tanggal ini
        const absenBentrok = await tx.absen.findFirst({
          where: {
            userId: pengajuanEksis.userId,
            status: "cuti",
            createdAt: {
              gte: tglMulaiCuti,
              lte: tglSelesaiCuti,
            },
          },
        });

        // Jika ketemu, gagalkan transaksi secara otomatis (Rollback)
        if (absenBentrok) {
          throw new Error(
            "Persetujuan dibatalkan! Pegawai ini terpantau sudah memiliki status 'Cuti' aktif di salah satu tanggal dalam rentang periode yang dipilih.",
          );
        }
      }

      // Jalankan update status pengajuan
      const updatedPengajuan = await tx.pengajuanCuti.update({
        where: { id },
        data: {
          status: statusBaru,
          catatanAdmin: catatan || null,
        },
      });

      // JIKA CUTI DISETUJUI PENUH -> POTONG SALDO & SINKRONKAN ABSENSI
      if (statusBaru === "DISETUJUI") {
        const tahunBerjalan = new Date(
          updatedPengajuan.tanggalMulai,
        ).getFullYear();

        let fieldUpdate = {};
        switch (updatedPengajuan.jenisCuti) {
          case "Tahunan":
            fieldUpdate = {
              sisaTahunan: { decrement: updatedPengajuan.totalHari },
            };
            break;
          case "Sakit":
            fieldUpdate = {
              sisaSakit: { decrement: updatedPengajuan.totalHari },
            };
            break;
          case "AlasanPenting":
            fieldUpdate = {
              sisaAlasanPenting: { decrement: updatedPengajuan.totalHari },
            };
            break;
          case "CutiBesar":
            fieldUpdate = {
              sisaBesar: { decrement: updatedPengajuan.totalHari },
              sisaTahunan: 0,
            };
            break;
          case "Melahirkan":
            fieldUpdate = {
              sisaMelahirkan: { decrement: updatedPengajuan.totalHari },
            };
            break;
        }

        // Jalankan pemotongan jatah saldo cuti di DB
        await tx.saldoCuti.update({
          where: {
            userId_tahun: {
              userId: updatedPengajuan.userId,
              tahun: tahunBerjalan,
            },
          },
          data: fieldUpdate,
        });

        // Loop untuk menulis rekam medis/cuti ke kalender Absen harian
        const startLoopDate = new Date(updatedPengajuan.tanggalMulai);
        const endLoopDate = new Date(updatedPengajuan.tanggalSelesai);

        while (startLoopDate <= endLoopDate) {
          const dayOfWeek = startLoopDate.getDay();

          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const targetAbsenDate = new Date(startLoopDate);
            targetAbsenDate.setHours(0, 0, 0, 0);

            await tx.absen.upsert({
              where: {
                userId_createdAt: {
                  userId: updatedPengajuan.userId,
                  createdAt: targetAbsenDate,
                },
              },
              update: {
                status: "cuti",
                keterangan: `Cuti ${updatedPengajuan.jenisCuti}: ${updatedPengajuan.keterangan}`,
              },
              create: {
                userId: updatedPengajuan.userId,
                status: "cuti",
                img_ttd: "-",
                keterangan: `Cuti ${updatedPengajuan.jenisCuti}: ${updatedPengajuan.keterangan}`,
                createdAt: targetAbsenDate,
              },
            });
          }
          startLoopDate.setDate(startLoopDate.getDate() + 1);
        }
      }

      return updatedPengajuan;
    });

    // Kirim feedback pesan dinamis ke frontend
    let infoMessage = "Status permohonan berhasil diperbarui.";
    if (statusBaru === "MENUNGGU_SEKRETARIS")
      infoMessage =
        "Berkas berhasil diverifikasi Kasubag & diteruskan ke Sekretaris.";
    if (statusBaru === "DISETUJUI")
      infoMessage =
        "Cuti resmi disetujui penuh oleh Sekretaris. Saldo cuti & kalender harian berhasil disinkronkan.";
    if (statusBaru.startsWith("DITOLAK"))
      infoMessage = "Permohonan cuti resmi ditolak.";

    return res.status(200).json({
      message: infoMessage,
      data: result,
    });
  } catch (error) {
    console.error(error);
    return res.status(error.message?.includes("dibatalkan") ? 400 : 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const getRiwayatPengajuanCuti = async (req, res) => {
  const { id } = req.params; // ID Sekretaris dan parameter tahun
  const { tahun } = req.query;
  // 1. Validasi parameter tahun wajib ada
  if (!tahun) {
    return res.status(400).json({
      message: "Parameter tahun wajib disertakan",
    });
  }

  try {
    // 2. Cek apakah user yang mengakses benar-benar Sekretaris
    const checkUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!checkUser) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    if (checkUser.role !== "SEKRETARIS") {
      return res.status(403).json({
        message:
          "Akses ditolak. Fitur riwayat global ini hanya dapat diakses oleh Sekretaris.",
      });
    }

    // 3. Definisikan batas jangkauan tanggal berdasarkan tahun murni
    const awalTahun = new Date(`${tahun}-01-01T00:00:00.000Z`);
    const akhirTahun = new Date(`${tahun}-12-31T23:59:59.999Z`);

    // 4. Ambil data berkas cuti secara global (All Subbagian, All Status)
    const riwayatCutiGlobal = await prisma.pengajuanCuti.findMany({
      where: {
        tanggalMulai: {
          gte: awalTahun,
          lte: akhirTahun,
        },
        // Tidak mengunci status tertentu, agar DISETUJUI, DITOLAK, & MENUNGGU semuanya keluar
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            nip: true,
            avatar: true,
            strukturUnit: {
              include: {
                unitKerja: { select: { nama: true } }, // Agar Sekretaris tahu ini staff dari bagian mana
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      message: `Data seluruh riwayat pengajuan cuti staff tahun ${tahun} berhasil diambil`,
      data: riwayatCutiGlobal,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

export const cancelingCuti = async (req, res) => {
  const { id } = req.params; // ID Pengajuan Cuti yang akan dibatalkan
  const { catatanPembatalan } = req.body; // Alasan pembatalan (opsional)

  try {
    // 1. Ambil data pengajuan cuti yang akan dibatalkan
    const pengajuanEksis = await prisma.pengajuanCuti.findUnique({
      where: { id },
    });

    if (!pengajuanEksis) {
      return res.status(404).json({
        message: "Data pengajuan cuti tidak ditemukan.",
      });
    }

    // Validasi: Hanya cuti yang sudah berstatus DISETUJUI yang perlu proses pengembalian saldo & absen
    if (pengajuanEksis.status !== "DISETUJUI") {
      return res.status(400).json({
        message:
          "Hanya pengajuan cuti yang telah disetujui penuh yang dapat dibatalkan melalui sistem ini.",
      });
    }

    // 2. JALANKAN PROSES REVERSE (PENGEMBALIAN) VIA PRISMA TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      // A. Ubah status berkas cuti menjadi DIBATALKAN
      const updatedPengajuan = await tx.pengajuanCuti.update({
        where: { id },
        data: {
          status: "DIBATALKAN",
          catatanAdmin:
            catatanPembatalan || "Cuti dibatalkan oleh sistem/atasan.",
        },
      });

      // B. Kembalikan jatah saldo cuti pegawai (Increment Kembali)
      const tahunBerjalan = new Date(
        updatedPengajuan.tanggalMulai,
      ).getFullYear();
      let fieldUpdate = {};

      switch (updatedPengajuan.jenisCuti) {
        case "Tahunan":
          fieldUpdate = {
            sisaTahunan: { increment: updatedPengajuan.totalHari },
          };
          break;
        case "Sakit":
          fieldUpdate = {
            sisaSakit: { increment: updatedPengajuan.totalHari },
          };
          break;
        case "AlasanPenting":
          fieldUpdate = {
            sisaAlasanPenting: { increment: updatedPengajuan.totalHari },
          };
          break;
        case "CutiBesar":
          // Catatan: Jika pembatalan Cuti Besar, kuota tahunan tidak bisa otomatis pulih ke angka awal
          // secara instan jika aslinya hangus, namun kuota Cuti Besar-nya kita kembalikan.
          fieldUpdate = {
            sisaBesar: { increment: updatedPengajuan.totalHari },
          };
          break;
        case "Melahirkan":
          fieldUpdate = {
            sisaMelahirkan: { increment: updatedPengajuan.totalHari },
          };
          break;
      }

      await tx.saldoCuti.update({
        where: {
          userId_tahun: {
            userId: updatedPengajuan.userId,
            tahun: tahunBerjalan,
          },
        },
        data: fieldUpdate,
      });

      // C. Bersihkan tabel Absen (Hapus records status 'cuti' pada rentang tanggal tersebut)
      const tglMulaiCuti = new Date(updatedPengajuan.tanggalMulai);
      tglMulaiCuti.setHours(0, 0, 0, 0);

      const tglSelesaiCuti = new Date(updatedPengajuan.tanggalSelesai);
      tglSelesaiCuti.setHours(23, 59, 59, 999);

      await tx.absen.deleteMany({
        where: {
          userId: updatedPengajuan.userId,
          status: "cuti",
          createdAt: {
            gte: tglMulaiCuti,
            lte: tglSelesaiCuti,
          },
        },
      });

      return updatedPengajuan;
    });

    return res.status(200).json({
      message:
        "Cuti berhasil dibatalkan. Kuota jatah cuti pegawai telah dikembalikan dan kalender absensi telah dibersihkan.",
      data: result,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
    });
  }
};
