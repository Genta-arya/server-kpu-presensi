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
      return sendResponse(res, 400, "Password salah");
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
    const data = await prisma.user.findMany({
      where: {
        role: "user",
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        status_login: true,
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
