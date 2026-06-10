import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../Config/Prisma.js";
import { createToken } from "../Utils/CreateToken.js";
import { sendError, sendResponse } from "../Utils/Response.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { randomBytes } from "crypto";

export const verifyMFA = async (req, res) => {
  const { userId, otp } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // 1. Verifikasi OTP
    const valid = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: "base32",
      token: otp,
      window: 1,
    });

    if (!valid) {
      return res.json({ status: false, message: "OTP salah" });
    }

    // 2. Logic Multiple Login & Patch untuk secretCode yang null
    if (user.token) {
      let currentSecret = user.secret;

      // KASUS KHUSUS: Jika dia admin_ppid tapi secret-nya belum ada di DB
      if (user.role === "ADMIN_PPID" && !user.secret) {
        currentSecret = randomBytes(32).toString("hex");

        await prisma.user.update({
          where: { id: user.id },
          data: { secret: currentSecret },
        });
      }

      return res.json({
        status: true,
        message: "Login berhasil",
        token: user.token,
        role: user.role,
        userId: user.id,
        secretCode: user.role === "admin_ppid" ? currentSecret : undefined,
      });
    }

    // 3. Jika token belum ada sama sekali (Login Baru)
    const jwt = createToken({ id: user.id, role: user.role });
    let secretCode = null;

    const updateData = {
      token: jwt,
      status_login: true,
    };

    if (user.role === "admin_ppid") {
      // Gunakan secret yang sudah ada jika tersedia, jika tidak buat baru
      secretCode = user.secret || randomBytes(32).toString("hex");
      updateData.secret = secretCode;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    res.json({
      status: true,
      message: "Login berhasil",
      token: jwt,
      role: user.role,
      userId: user.id,
      secretCode: user.role === "admin_ppid" ? secretCode : undefined,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: err.message });
  }
};

export const verifySetupMFA = async (req, res) => {
  const { userId, otp } = req.body;
  console.log(userId, otp);
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfa_secret) {
      return res
        .status(400)
        .json({ status: false, message: "User belum setup MFA" });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret, // pakai field khusus MFA secret
      encoding: "base32",
      token: otp,
      window: 1,
    });

    if (!verified) {
      return res.json({ status: false, message: "OTP salah" });
    }

    // MFA aktif
    await prisma.user.update({
      where: { id: userId },
      data: {
        status_mfa: true,
      },
    });

    res.json({
      status: true,
      message: "MFA berhasil diaktifkan",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const setupMFA = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ status: false, message: "User tidak ada" });
    }

    // jika status mfa sudah true
    if (user.status_mfa) {
      return res
        .status(200)
        .json({ status: false, message: "MFA sudah diaktifkan" });
    }

    const secret = speakeasy.generateSecret({
      name: `Presensi-KPU : ${user.nip}`,
    });

    const qr = await QRCode.toDataURL(secret.otpauth_url);

    // simpan secret di mfa_secret
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfa_secret: secret.base32,
      },
    });

    res.json({
      status: true,
      data: {
        qr,
        secret: secret.base32,
      },
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

export const resetMFA = async (req, res) => {
  const { nip, password } = req.body;
  console.log(nip, password);

  try {
    const user = await prisma.user.findFirst({ where: { nip } });
    if (!user)
      return res
        .status(404)
        .json({ status: false, message: "User tidak ditemukan" });

    // verifikasi password dulu biar aman
    const isMatch = await bcrypt.compare(password, user.security);
    if (!isMatch)
      return res.status(401).json({ status: false, message: "Password salah" });

    // reset MFA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status_mfa: false,
        mfa_secret: null, // hapus secret lama
      },
    });

    res.json({
      status: true,
      message: "MFA berhasil di-reset, silakan setup ulang",
      userId: user.id, // supaya frontend bisa redirect
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ status: false, message: err.message });
  }
};

export const verifikasiPin = async (req, res) => {
  const { id, password } = req.body;
  try {
    if (!id || !password) {
      return sendResponse(res, 400, "ID dan password harus diisi");
    }

    const checkUser = await prisma.user.findFirst({
      where: { id: id },
    });
    if (!checkUser) {
      return sendResponse(res, 400, "User tidak ditemukan");
    }

    const findUser = await prisma.user.findFirst({
      where: {
        id: id,
      },
    });

    if (!findUser) {
      return sendResponse(res, 400, "User tidak ditemukan");
    }

    const isMatch = await bcrypt.compare(password, findUser.password);

    if (!isMatch) {
      return sendResponse(res, 400, "Pin salah");
    }

    sendResponse(res, 200, "Verifikasi berhasil", { userId: findUser.id });
  } catch (error) {
    sendError(res, error);
  }
};

export const handleRegister = async (req, res) => {
  const { name, jabatanId } = req.body;
  const nip = String(req.body.nip);

  try {
    if (!nip || !jabatanId) {
      return sendResponse(res, 400, "NIP dan Jabatan harus diisi");
    }

    // 1. Cek apakah NIP sudah ada
    const findUser = await prisma.user.findFirst({
      where: { nip: nip },
    });

    if (findUser) {
      return sendResponse(res, 400, "NIP sudah terdaftar");
    }

    // 2. Cari index tertinggi saat ini
    const lastUser = await prisma.user.findFirst({
      orderBy: {
        index: "desc", // Ambil yang paling besar
      },
      select: {
        index: true,
      },
    });

    // Jika belum ada user, mulai dari 0. Jika sudah ada, ambil index terakhir + 1
    const newIndex = lastUser ? lastUser.index + 1 : 0;

    const hashedPassword = await bcrypt.hash("12345678", 10);

    // 3. Buat user baru dengan index yang sudah dihitung
    await prisma.user.create({
      data: {
        nip: nip,
        name: name,
        role: ROLES.USER,
        jabatanId: jabatanId,
        index: newIndex, // Menggunakan hasil perhitungan
        active: true,
        avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
        password: hashedPassword,
      },
    });

    sendResponse(res, 200, "Registrasi berhasil");
  } catch (error) {
    sendError(res, error);
  }
};
export const Session = async (req, res) => {
  const { token, secretCode } = req.body;

  try {
    if (token) {
      if (!token) {
        console.log("Token tidak ditemukan");
        return sendResponse(res, 409, "Silahkan login terlebih dahulu");
      }
      const findUser = await prisma.user.findFirst({
        where: { token },
        select: {
          id: true,
          username: true,
          name: true,
          jabatan: true,
          nip: true,
          index: true,
          npwp: true,
          noHp: true,
          email: true,
          avatar: true,
          role: true,
          status_login: true,
          secret: true,
          token: true,
        },
      });
      if (!findUser) {
        // hapus token di db
        await prisma.user.update({
          where: { token },
          data: { status_login: false, token: null },
        });

        return sendResponse(res, 409, "Silahkan login terlebih dahulu");
      }
      sendResponse(res, 200, "Success", findUser);
    } else {
      if (!secretCode) {
        await prisma.user.update({
          where: { secret: secretCode },
          data: { status_login: false, token: null },
        })
        return sendResponse(res, 409, "Silahkan login terlebih dahulu");
      } else {
        const findUser = await prisma.user.findFirst({
          where: { secret: secretCode },
          select: {
            id: true,
            username: true,
            name: true,
            jabatan: true,
            nip: true,
            index: true,
            avatar: true,
            role: true,
            status_login: true,
            token: true,
          },
        });
        if (!findUser) {
          // hapus token di db
          await prisma.user.update({
            where: { secret: secretCode },
            data: { status_login: false, token: null },
          });
          return sendResponse(res, 409, "Silahkan login terlebih dahulu");
        }
        sendResponse(res, 200, "Success", findUser);
      }
    }
  } catch (error) {
    const findUsers = await prisma.user.findFirst({
      where: { token },
      select: {
        id: true,
      },
    });
    if (!findUsers) {
      console.log("Token tidak ditemukan error");
      return sendResponse(res, 409, "Silahkan login terlebih dahulu");
    }
    if (error instanceof jwt.TokenExpiredError) {
      await prisma.user.update({
        where: { id: findUsers.id },
        data: { status_login: false, token: null },
      });
      return sendResponse(res, 409, "Token telah kedaluwarsa");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      await prisma.user.update({
        where: { id: findUsers.id },
        data: { status_login: false, token: null },
      });
      return sendResponse(res, 409, "Token tidak valid atau format salah");
    }
    return sendError(res, error);
  }
};

export const Logout = async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return sendResponse(res, 409, "Silahkan login terlebih dahulu");
  }
  try {
    const findUser = await prisma.user.findFirst({
      where: { token },
    });
    if (!findUser) {
      return sendResponse(res, 409, "Silahkan login terlebih dahulu");
    }
    await prisma.user.update({
      where: { id: findUser.id },
      data: { status_login: false, token: null, secret: null },
    });
    sendResponse(res, 200, "Logout berhasil");
  } catch (error) {
    sendError(res, error);
  }
};

export const handleLogin = async (req, res) => {
  const { nip, security } = req.body;

  try {
    if (!nip || !security) {
      return sendResponse(res, 400, "NIP dan Password harus diisi");
    }

    const findUser = await prisma.user.findFirst({
      where: { nip },
    });

    if (!findUser) {
      return sendResponse(res, 400, "NIP atau Password salah");
    }

    const isMatch = await bcrypt.compare(security, findUser.security);
    if (!isMatch) {
      return sendResponse(res, 400, "NIP atau Password salah");
    }

    // --- LOGIKA MULTIPLE LOGIN (CHECK EXISTING TOKEN) ---
    // Jika user belum punya token, baru kita buatkan dan simpan ke DB
    if (!findUser.token) {
      const newToken = createToken({ id: findUser.id, role: findUser.role });

      await prisma.user.update({
        where: { id: findUser.id },
        data: {
          token: newToken,
          status_login: false, // Masih false karena butuh MFA
        },
      });
    }

    // Jika token sudah ada, kita skip proses update token dan langsung ke MFA Flow

    // ===== MFA FLOW =====
    if (!findUser.status_mfa) {
      return sendResponse(res, 200, "Setup MFA dulu", {
        mfa: "setup",
        userId: findUser.id,
      });
    }

    return sendResponse(res, 200, "Verifikasi OTP", {
      mfa: "verify",
      userId: findUser.id,
    });
  } catch (error) {
    console.log(error);
    sendError(res, error);
  }
};

export const ResetPassword = async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  try {
    // 1. Validasi input data
    if (!userId || !oldPassword || !newPassword) {
      return sendResponse(res, 400, "Semua kolom harus diisi");
    }

    if (newPassword.length < 6) {
      return sendResponse(res, 400, "Kata sandi baru minimal harus 6 karakter");
    }

    // 2. Cari user berdasarkan ID (userId dikirim dari frontend yang sudah login)
    const findUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!findUser) {
      return sendResponse(res, 404, "Pengguna tidak ditemukan");
    }

    // 3. Verifikasi kata sandi lama dengan field 'security' di DB
    const isMatch = await bcrypt.compare(oldPassword, findUser.security);
    if (!isMatch) {
      return sendResponse(res, 400, "Kata sandi lama yang Anda masukkan salah");
    }

    // 4. Hash kata sandi baru
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // 5. Update kata sandi baru ke database
    await prisma.user.update({
      where: { id: findUser.id },
      data: {
        security: hashedNewPassword,
      },
    });

    return sendResponse(res, 200, "Kata sandi berhasil diperbarui");
  } catch (error) {
    sendError(res, error);
  }
};
export const GetUser = async (req, res) => {
  try {
    // 1. Tangkap query parameter dari URL frontend (default ke 'active' jika tidak diisi)
    const { status } = req.query;
    console.log(status);

    // Tentukan kondisi boolean untuk field 'active' di database
    const isActiveFilter = status === "inactive" ? false : true;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

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
              gte: todayStart,
              lte: todayEnd,
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
export const DateTime = async (req, res) => {
  try {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour12: false,
    });
    sendResponse(res, 200, "Success", { date: formattedDate });
  } catch (error) {
    sendError(res, error);
  }
};

export const getSingleUser = async (req, res) => {
  const { id } = req.params;

  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    const user = await prisma.user.findUnique({
      where: { id: id },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        nip: true, // Tambahkan ini agar NIP bisa tampil di detail
        role: true,
        status_login: true,
        status_mfa: true,
        jabatan: true, // Mengambil object data Jabatan (id, nama, kode)

        // JALUR RELASI BARU: Ambil data pivot sekaligus JOIN ke tabel UnitKerja (Subbagian)
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
    });

    if (!user) {
      return sendResponse(res, 404, "User tidak ditemukan");
    }

    // Cek status absen hari ini
    const absensiHariIni = await prisma.absen.findFirst({
      where: {
        userId: id,
        createdAt: {
          gte: new Date(`${today}T00:00:00.000Z`),
          lte: new Date(`${today}T23:59:59.999Z`),
        },
      },
    });

    // Kembalikan data user lengkap dengan info penanda absensi hari ini
    return sendResponse(res, 200, "User data retrieved", {
      ...user,
      tanggal_sekarang: today,
      sudah_absen: !!absensiHariIni, // Mengubah object/null menjadi boolean true/false dengan aman
    });
  } catch (error) {
    console.error("Error getSingleUser:", error);
    return sendError(
      res,
      500,
      "Terjadi kesalahan saat mengambil detail user",
      error,
    );
  }
};
import { v4 as uuidv4 } from "uuid";
import { ROLES } from "../Utils/Constants.js";

export const automaticInsert = async () => {
  const defaultPassword = "12345678";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  const avatar = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
  const role = "user";

  const names = [
    "FRANSISKUS KHOMAN, S.Pd",
    "GITA RANTAU, S.Sos",
    "NUR SOLEH, S.H.I",
    "ROBBY SUGARA ROMANUS, S.Ag",
    "SITI NUR AISAH, S.Pd",
    "THERIAN AFFANDY, S.Sos",
    "HENDRASYAH PUTRA, S.H, M.A",
    "KADEK SUYADNYANA, S.Kom",
    "ROSDIANA, A.Md",
    "DORI KURNIAWAN, S.IP",
    "MUHADIS EKO SURYANTO, S.IP",
    "SHAIFUL BARRY, S.E",
    "SYAFI'U NIZAR, S.H",
    "RIKO PURWANTO, ST.",
    "RIKI IRMANDA, S.H",
    "ANGELIKA NINDYA PARAWATI BR. GULTOM, S.H",
    "TIYA NARALITA, S.Kom",
    "LAMBANG WARNA, S.Kom",
    "M. GENTHA ARYA PRATAMA, S.Kom",
    "RINALDO FARERA, S.Sos",
    "RADHA FLORIDA, S.Pd",
    "TRI SUCI NURHANDAYANI,A.Md",
    "AGUNG PUJO NUGROHO, S.I.Kom",
    "MELIGUN",
    "DIMUS",
    "YUSPEIN",
    "MARYAN",
    "APNI JULIANUS PETERA",
    "HERMANDA KASITA EDO, S.Kom",
    "FLAGIA DENATA, S.E",
    "LIDIA WENNY, S.Ak",
    "NADYA NANDA HERDA",
    "YOPAN JAYADI",
  ];

  try {
    for (let i = 0; i < names.length; i++) {
      const fullName = names[i];
      const username = fullName
        .split(" ")[0]
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      const id = uuidv4();

      await prisma.user.create({
        data: {
          id,
          name: fullName,
          username,
          password: hashedPassword,
          avatar,
          role,
          index: i + 1, // kamu harus pastikan kolom ini ada di model Prisma
        },
      });
    }

    console.log("Insert otomatis berhasil!");
  } catch (error) {
    console.error("Insert otomatis gagal:", error);
  }
};

export const updateSingleUser = async (req, res) => {
  const { id } = req.params;
  const { name, jabatan, nip, status } = req.body;

  if (!name || !jabatan || !nip) {
    return sendResponse(res, 400, "Nama, Jabatan, dan NIP harus diisi");
  }
  // checkNip tidak boleh sama
  const checkNip = await prisma.user.findFirst({
    where: {
      nip: nip,
      NOT: {
        id: id,
      },
    },
  });
  if (checkNip) {
    return sendResponse(res, 400, "NIP sudah digunakan oleh user lain");
  }
  try {
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: {
        name: name,
        jabatanId: jabatan,
        nip: nip,
        active: status ? true : false,
      },
      select: {
        id: true,
        name: true,
        username: true,
        jabatan: true,
        nip: true,
        index: true,
        npwp: true,
        noHp: true,
        email: true,
        active: true,
      },
    });
    return sendResponse(res, 200, "User berhasil diupdate", updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    sendError(res, 500, "Terjadi kesalahan saat mengupdate user", error);
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const { id } = req.params;
    const { avatarUrl } = req.body;
    // checkuser
    const checkUser = await prisma.user.findFirst({
      where: { id: id },
    });
    if (!checkUser) {
      return sendResponse(res, 400, "User tidak ditemukan");
    }
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: {
        avatar: avatarUrl,
      },
      select: {
        id: true,
        name: true,
        username: true,
        jabatan: true,
        nip: true,
        index: true,
        npwp: true,
        noHp: true,
        email: true,
        avatar: true,
        role: true,
        status_login: true,
        token: true,
      },
    });
    return sendResponse(res, 200, "User berhasil diupdate", updatedUser);
  } catch (error) {}
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await prisma.user.delete({
      where: { id: id },
    });
    return sendResponse(res, 200, "User berhasil dihapus", deletedUser);
  } catch (error) {
    console.error("Error deleting user:", error);
    sendError(res, 500, "Terjadi kesalahan saat menghapus user", error);
  }
};

// Contoh logic sederhana di Controller
export const reorderUser = async (req, res) => {
  const { id1, index1, id2, index2 } = req.body;

  try {
    // 1. Update data pertama
    const user1 = await prisma.user.update({
      where: { id: id1 },
      data: { index: index1 },
    });

    // 2. Update data kedua
    const user2 = await prisma.user.update({
      where: { id: id2 },
      data: { index: index2 },
    });

    console.log("Sukses update:", user1.name, "dan", user2.name);
    return sendResponse(res, 200, "Urutan berhasil diubah");
  } catch (error) {
    // Log error asli ke console agar tahu penyebabnya (misal: ID tidak valid)
    console.error("Error Detail saat Reorder:", error);

    return sendResponse(res, 500, {
      message: "Gagal mengubah urutan",
      error: error.message,
    });
  }
};

export const updateProfilSingleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nip, noHp, email, npwp } = req.body;

    // 1. Validasi NIP (Tidak boleh sama dengan user lain)
    const checkNip = await prisma.user.findFirst({
      where: {
        nip: nip,
        NOT: { id: id },
      },
    });
    if (checkNip) {
      return sendResponse(res, 400, "NIP sudah digunakan oleh user lain");
    }

    // 2. Validasi Email (Tidak boleh sama dengan user lain)
    const checkEmail = await prisma.user.findFirst({
      where: {
        email: email,
        NOT: { id: id },
      },
    });
    if (checkEmail) {
      return sendResponse(res, 400, "Email sudah digunakan oleh user lain");
    }

    // 3. Update User & Gunakan 'select' agar password tidak ikut terkirim
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: {
        name,
        noHp,
        email,
        npwp,
        nip,
      },
      select: {
        id: true,
        name: true,
        nip: true,
        noHp: true,
        email: true,
        npwp: true,
        jabatan: true,
        golongan: true,
        gaji: true,
        avatar: true,
        role: true,
        username: true,
        // TIDAK ADA kolom password di sini
      },
    });

    return sendResponse(res, 200, "User berhasil diupdate", updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return sendError(res, 500, "Terjadi kesalahan saat mengupdate user", error);
  }
};
