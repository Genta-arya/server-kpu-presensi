import { prisma } from "../Config/Prisma.js";
import { sendResponse } from "../Utils/Response.js";

export const CreateSubbagian = async (req, res) => {
  const { nama_subbagian } = req.body;

  if (!nama_subbagian) {
    return res.status(400).json({ message: "Nama subbagian is required" });
  }
  try {
    // check if nama_subbagian already exists
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // Generate random code
    const existingSubbagian = await prisma.unitKerja.findFirst({
      where: {
        nama: nama_subbagian,
      },
    });

    if (existingSubbagian) {
      return res
        .status(400)
        .json({ message: "Nama subbagian sudah digunakan" });
    }

    // Create new subbagian
    const newSubbagian = await prisma.unitKerja.create({
      data: {
        nama: nama_subbagian,
        kode: randomCode,
      },
    });

    sendResponse(res, 201, "Subbagian created successfully", newSubbagian);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const updateSubbagian = async (req, res) => {
  const { id } = req.params;
  const { nama_subbagian } = req.body;

  if (!nama_subbagian) {
    return res.status(400).json({ message: "Nama subbagian is required" });
  }

  try {
    // 1. Cek apakah ada unit lain yang sudah menggunakan nama tersebut
    const duplicateSubbagian = await prisma.unitKerja.findFirst({
      where: {
        nama: nama_subbagian,
        NOT: {
          id: id, // Kecualikan unit yang sedang di-update
        },
      },
    });

    if (duplicateSubbagian) {
      return res
        .status(400)
        .json({ message: "Nama subbagian sudah digunakan oleh unit lain" });
    }

    // 2. Lakukan update
    const updatedSubbagian = await prisma.unitKerja.update({
      where: {
        id: id,
      },
      data: {
        nama: nama_subbagian,
      },
    });

    sendResponse(res, 200, "Subbagian updated successfully", updatedSubbagian);
  } catch (error) {
    // Tambahkan pengecekan jika ID tidak ditemukan (karena update akan error jika id tidak ada)
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Subbagian tidak ditemukan" });
    }
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const getSubbagian = async (req, res) => {
  try {
    const subbagian = await prisma.unitKerja.findMany({
      include: {
        // 1. Hitung pegawai berdasarkan data yang terdaftar di tabel pivot StrukturUnit
        _count: {
          select: { strukturUnits: true },
        },
        // 2. Jika di Frontend kamu butuh menampilkan pimpinan/Kasubbag di tabel Subbagian
        strukturUnits: {
          where: {
            posisi: "KASUBAG", // Mengambil pimpinan subbagian saja (Kasubbag)
          },
          include: {
            user: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // 2. Mapping data agar formatnya tetap sama dan mudah dibaca di Frontend
    const result = subbagian.map((item) => ({
      id: item.id,
      nama: item.nama,
      kode: item.kode,
      createdAt: item.createdAt,
      // Jumlah pegawai sekarang dihitung dari total baris di strukturUnits
      jumlahPegawai: item._count.strukturUnits,
      // Mengambil nama Kasubbag/Pimpinan jika ada yang terdaftar
      pimpinan: item.strukturUnits[0]?.user?.name || "Belum Ditentukan",
    }));

    sendResponse(res, 200, "Subbagian retrieved successfully", result);
  } catch (error) {
    console.error("Error getSubbagian:", error);
    // Menggunakan standarisasi fungsi sendError milikmu agar seragam
    return sendError(
      res,
      500,
      "Terjadi kesalahan saat mengambil data subbagian",
      error,
    );
  }
};
export const deleteSubbagian = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedSubbagian = await prisma.unitKerja.delete({
      where: {
        id: id,
      },
    });
    sendResponse(res, 200, "Subbagian deleted successfully", deletedSubbagian);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const GetSubbagianById = async (req, res) => {
  const { id } = req.params;
  try {
    const subbagian = await prisma.unitKerja.findUnique({
      where: {
        id: id,
      },
      include: {
        strukturUnits: {
          // Data Kasubag & Kepala Divisi
          include: {
            user: true, // Mengambil data profil user-nya juga
          },
        },
      },
    });

    if (!subbagian) {
      return res.status(404).json({ message: "Subbagian tidak ditemukan" });
    }

    sendResponse(res, 200, "Subbagian retrieved successfully", subbagian);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
export const addUsersToSubbagian = async (req, res) => {
  const { id } = req.params; // ID Subbagian / unitKerjaId
  const { userIds } = req.body; // Array of user IDs: ["uuid1", "uuid2"]

  // 1. Validasi pastikan input userIds berbentuk Array
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return sendResponse(
      res,
      400,
      "Daftar pegawai (userIds) tidak valid atau kosong",
    );
  }

  try {
    // 2. Gunakan prisma.strukturUnit.createMany untuk memasukkan data sekaligus
    // Logika ini akan membuat baris baru di tabel pivot Many-to-Many
    const newRelations = await prisma.strukturUnit.createMany({
      data: userIds.map((userId) => ({
        unitKerjaId: id,
        userId: userId,
        posisi: "STAFF", // Set posisi default menjadi STAFF saat pertama masuk tim
      })),
      skipDuplicates: true, // Amankan database jika data tersebut ternyata sudah pernah di-add sebelumnya
    });

    // 3. Kembalikan response sukses menggunakan helper standard proyekmu
    return sendResponse(
      res,
      200,
      "Pegawai berhasil ditambahkan ke subbagian",
      newRelations,
    );
  } catch (error) {
    console.error("Error addUsersToSubbagian:", error);
    // Menggunakan helper sendError agar format catch-error seragam
    return sendError(
      res,
      500,
      "Gagal menghubungkan pegawai ke subbagian",
      error,
    );
  }
};

export const assignPosisi = async (req, res) => {
  const { userId, posisi } = req.body;
  const { id } = req.params; // ID Subbagian (unitKerjaId)

  try {
    // 1. VALIDASI: Jika posisi yang diajukan adalah SEKRETARIS
    if (posisi === "SEKRETARIS") {
      const checkExistingSekretaris = await prisma.strukturUnit.findFirst({
        where: {
          unitKerjaId: id,
          posisi: "SEKRETARIS",
          NOT: {
            userId: userId, // Lewati pengecekan jika sekretarisnya adalah user ini sendiri (saat mode update posisi tetap)
          },
        },
      });

      if (checkExistingSekretaris) {
        return sendResponse(
          res,
          400,
          "Gagal! Subbagian ini sudah memiliki seorang Sekretaris. Kuota posisi hanya 1 orang.",
        );
      }
    }

    // 2. Cek apakah user sudah terdaftar di unit tersebut (Mode Update)
    const existing = await prisma.strukturUnit.findFirst({
      where: { unitKerjaId: id, userId: userId },
    });

    if (existing) {
      const updated = await prisma.strukturUnit.update({
        where: { id: existing.id },
        data: { posisi },
      });
      return sendResponse(res, 200, "Posisi berhasil diupdate", updated);
    }

    // 3. Jika belum terdaftar, buat baris relasi baru (Mode Create)
    const created = await prisma.strukturUnit.create({
      data: {
        unitKerjaId: id,
        userId: userId,
        posisi: posisi,
      },
    });

    return sendResponse(res, 201, "Posisi berhasil ditetapkan", created);
  } catch (error) {
    console.error("Error assignPosisi:", error);
    return sendError(
      res,
      500,
      "Terjadi kesalahan saat menetapkan posisi struktural",
      error,
    );
  }
};

export const unAssingn = async (req, res) => {
  // Ambil userIds dari body (sesuai dengan yang dikirim frontend)
  const { userIds } = req.body; 
  const { id } = req.params; // ID Subbagian (unitKerjaId)

  // Validasi jika data tidak dikirim atau bukan array
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return sendResponse(res, 400, "Daftar pegawai (userIds) tidak valid atau kosong");
  }

  try {
    // Gunakan deleteMany dengan operator 'in' untuk menghapus user yang dipilih saja
    const deleted = await prisma.strukturUnit.deleteMany({
      where: { 
        unitKerjaId: id, 
        userId: {
          in: userIds // Menghapus hanya ID yang ada di dalam array userIds
        }
      },
    });

    return sendResponse(
      res,
      200,
      "Pegawai berhasil dihapus dari subbagian",
      deleted,
    );
  } catch (error) {
    console.error("Error unAssingn:", error);
    return sendError(
      res,
      500,
      "Terjadi kesalahan saat menghapus pegawai dari subbagian",
      error,
    );
  }
};