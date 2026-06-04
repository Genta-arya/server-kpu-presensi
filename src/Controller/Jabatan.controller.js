import { prisma } from "../Config/Prisma.js";
import { sendError, sendResponse } from "../Utils/Response.js";

export const createJabatan = async (req, res) => {
  const { nama_jabatan } = req.body;

  if (!nama_jabatan) {
    return res.status(400).json({ message: "Nama jabatan is required" });
  }
  try {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // Generate random code
    const existingJabatan = await prisma.jabatan.findFirst({
      where: {
        nama: nama_jabatan,
      },
    });

    if (existingJabatan) {
      return res.status(400).json({ message: "Nama jabatan sudah digunakan" });
    }

    // Create new jabatan
    const newJabatan = await prisma.jabatan.create({
      data: {
        nama: nama_jabatan,
        kode: randomCode,
      },
    });
    sendResponse(res, 201, "Jabatan created successfully", newJabatan);
  } catch (error) {
    sendError(res, 500, error.message);
  }
};

export const updateJabatan = async (req, res) => {
  const { id } = req.params;
  const { nama_jabatan } = req.body;

  if (!nama_jabatan) {
    return res.status(400).json({ message: "Nama jabatan is required" });
  }

  try {
    const duplicateJabatan = await prisma.jabatan.findFirst({
      where: {
        nama: nama_jabatan,
        NOT: {
          id: id, // Kecualikan jabatan yang sedang di-update
        },
      },
    });

    if (duplicateJabatan) {
      return res
        .status(400)
        .json({ message: "Nama jabatan sudah digunakan oleh jabatan lain" });
    }

    const updatedJabatan = await prisma.jabatan.update({
      where: { id: id },
      data: { nama: nama_jabatan },
    });

    sendResponse(res, 200, "Jabatan updated successfully", updatedJabatan);
  } catch (error) {
    console.error(error);
    sendError(res, 500, error.message);
  }
};

export const deleteJabatan = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedJabatan = await prisma.jabatan.delete({
      where: {
        id: id,
      },
    });
    sendResponse(res, 200, "Jabatan deleted successfully", deletedJabatan);
  } catch (error) {
    sendError(res, 500, error.message);
  }
};

export const getAllJabatan = async (req, res) => {
  try {
    const jabatans = await prisma.jabatan.findMany();
    sendResponse(res, 200, "Jabatan retrieved successfully", jabatans);
  } catch (error) {
    sendError(res, 500, error.message);
  }
};
