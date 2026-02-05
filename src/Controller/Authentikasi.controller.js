import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../Config/Prisma.js";
import { createToken } from "../Utils/CreateToken.js";
import { sendError, sendResponse } from "../Utils/Response.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
export const handleLogin = async (req, res) => {
  const { nip, security } = req.body;
  try {
    if (!nip || !security) {
      return sendResponse(res, 400, "NIP dan security harus diisi");
    }

    const findUser = await prisma.user.findFirst({
      where: { nip },
    });

    if (!findUser) {
      return sendResponse(res, 400, "NIP atau security salah");
    }

    const isMatch = await bcrypt.compare(security, findUser.security);
    if (!isMatch) {
      return sendResponse(res, 400, "NIP atau security salah");
    }

    const token = createToken({ id: findUser.id, role: findUser.role });

    // simpan token dulu (pending login)
    await prisma.user.update({
      where: { id: findUser.id },
      data: {
        token,
        status_login: false,
      },
    });

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
    sendError(res, error);
  }
};

export const verifyMFA = async (req, res) => {
  const { userId, otp } = req.body;

  console.log(userId, otp);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const valid = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: "base32",
      token: otp,
      window: 1,
    });

    if (!valid) {
      return res.json({ status: false, message: "OTP salah" });
    }

    // login sukses
    const jwt = createToken({ id: user.id, role: user.role });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        token: jwt,
        status_login: true,
      },
    });

    res.json({
      status: true,
      message: "Login berhasil",
      token: jwt,
    });
  } catch (err) {
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

  try {
    const user = await prisma.user.findFirst({ where: { nip } });
    if (!user)
      return res
        .status(404)
        .json({ status: false, message: "User tidak ditemukan" });

    // verifikasi password dulu biar aman
    const isMatch = await bcrypt.compare(password, user.password);
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
  const { username, password, name } = req.body;

  try {
    if (!username || !password) {
      return sendResponse(res, 400, "Username dan password harus diisi");
    }
    const findUser = await prisma.user.findFirst({
      where: {
        username: username,
      },
    });

    if (findUser) {
      return sendResponse(res, 400, "Email sudah terdaftar");
    }

    const hashedPassword = await bcrypt.hash("12345678", 10);

    await prisma.user.create({
      data: {
        username: username,
        name: name,
        role: "user",

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
  const { token } = req.body;

  if (!token) {
    return sendResponse(res, 409, "Silahkan login terlebih dahulu");
  }

  try {
    const findUser = await prisma.user.findFirst({
      where: { token },
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
  
      return sendResponse(res, 409, "Silahkan login terlebih dahulu");
    }

    sendResponse(res, 200, "Success", findUser);
  } catch (error) {
    const findUsers = await prisma.user.findFirst({
      where: { token },
      select: {
        id: true,
      },
    });
    if (!findUsers) {
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
      data: { status_login: false, token: null },
    });
    sendResponse(res, 200, "Logout berhasil");
  } catch (error) {
    sendError(res, error);
  }
};

export const GetUser = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const data = await prisma.user.findMany({
      where: {
        role: "user",
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        jabatan: true,
        role: true,
        status_login: true,
        index: true,
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
      },
      orderBy: {
        index: "asc",
      },
    });

    sendResponse(res, 200, "Success", data);
  } catch (error) {
    sendError(res, 500, "Terjadi kesalahan saat mengambil data user", error);
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
  console.log(id);

  const currentDate = new Date();
  const today = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    const user = await prisma.user.findUnique({
      where: { id: id },
      select: {
        id: true,
        username: true,
        name: true,
        jabatan: true,
        avatar: true,
        role: true,
        status_login: true,
      },
    });

    if (!user) {
      return sendResponse(res, 404, "User not found");
    }

    // Cek apakah user sudah absen hari ini
    const absensiHariIni = await prisma.absen.findFirst({
      where: {
        userId: id,
        createdAt: {
          gte: new Date(`${today}T00:00:00.000Z`),
          lte: new Date(`${today}T23:59:59.999Z`),
        },
      },
    });

    if (absensiHariIni) {
      return sendResponse(res, 400, "Kamu sudah absen hari ini");
    }

    return sendResponse(res, 200, "User belum absen hari ini", {
      ...user,
      tanggal_sekarang: today,
      sudah_absen: false,
    });
  } catch (error) {
    sendError(res, error);
  }
};

import { v4 as uuidv4 } from "uuid";

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
