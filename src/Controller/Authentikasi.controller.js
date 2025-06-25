import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../Config/Prisma.js";
import { createToken } from "../Utils/CreateToken.js";
import { sendError, sendResponse } from "../Utils/Response.js";

export const handleLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return sendResponse(res, 400, "Username dan password harus diisi");
    }
    const findUser = await prisma.user.findFirst({
      where: {
        username: username,
      },
    });

    if (!findUser) {
      return sendResponse(res, 400, "Username atau password salah");
    }
    const isMatch = await bcrypt.compare(password, findUser.password);

    if (!isMatch) {
      return sendResponse(res, 400, "Username atau password salah");
    }
    const token = createToken({ id: findUser.id, role: findUser.role });

    if (findUser.token) {
      await prisma.user.update({
        where: {
          id: findUser.id,
        },
        data: {
          status_login: true,
        },
      });
    } else {
      await prisma.user.update({
        where: {
          id: findUser.id,
        },
        data: {
          token: token,
          status_login: true,
        },
      });
    }
    const findUserUpdate = await prisma.user.findFirst({
      where: {
        id: findUser.id,
      },
    });

    sendResponse(res, 200, "Login berhasil", { token: findUserUpdate.token });
  } catch (error) {
    sendError(res, error);
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
        email: true,
        avatar: true,
        role: true,
        status_login: true,
        token: true,
      },
    });

    if (!findUser) {
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
