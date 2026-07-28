const express = require('express');
const prisma = require('../config/prisma');
const {
  authenticateToken,
  requireAdmin,
  requireAdminOrHoca
} = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(authenticateToken);

const permissionInclude = {
  kullanici: {
    select: {
      kullaniciId: true,
      ad: true,
      soyad: true,
      eposta: true,
      birimId: true,
      durum: true,
      rol: true
    }
  },
  birim: true
};

router.get('/', requireAdminOrHoca, async (req, res) => {
  try {
    const permissions = await prisma.kartYetkilendirme.findMany({
      include: permissionInclude,
      orderBy: { yetkilendirilmeTarihi: 'desc' }
    });
    return res.json(permissions);
  } catch (error) {
    console.error('Yetkiler listelenirken hata:', error);
    return res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.get('/:id', requireAdminOrHoca, async (req, res) => {
  try {
    const permission = await prisma.kartYetkilendirme.findUnique({
      where: { kartYetkiId: BigInt(req.params.id) },
      include: permissionInclude
    });
    if (!permission) return res.status(404).json({ hata: 'Yetki bulunamadı' });
    return res.json(permission);
  } catch (error) {
    return res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.post('/', requireAdminOrHoca, async (req, res) => {
  try {
    const { kartUid, kullaniciId, birimId, notlar } = req.body;
    if (!kartUid || kullaniciId == null) {
      return res.status(400).json({ hata: "'kartUid' ve 'kullaniciId' alanları zorunludur" });
    }

    const permission = await prisma.kartYetkilendirme.create({
      data: {
        kartUid: String(kartUid).trim(),
        kullaniciId: BigInt(kullaniciId),
        birimId: birimId != null ? Number.parseInt(birimId, 10) : null,
        yetkilendiren: BigInt(req.user.kullaniciId),
        notlar: notlar ?? null
      },
      include: permissionInclude
    });
    return res.status(201).json(permission);
  } catch (error) {
    console.error('Yetki oluşturulurken hata:', error);
    if (error.code === 'P2002') return res.status(409).json({ hata: 'Bu kart için zaten bir yetkilendirme kaydı var' });
    if (error.code === 'P2003') return res.status(400).json({ hata: 'Kart, kullanıcı veya birim bilgisi geçersiz' });
    return res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.put('/:id', requireAdminOrHoca, async (req, res) => {
  try {
    const { durum, notlar, sonKullanilmaTarihi } = req.body;
    const permission = await prisma.kartYetkilendirme.update({
      where: { kartYetkiId: BigInt(req.params.id) },
      data: {
        ...(durum !== undefined ? { durum } : {}),
        ...(notlar !== undefined ? { notlar } : {}),
        ...(sonKullanilmaTarihi !== undefined
          ? { sonKullanilmaTarihi: sonKullanilmaTarihi ? new Date(sonKullanilmaTarihi) : null }
          : {})
      },
      include: permissionInclude
    });
    return res.json(permission);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ hata: 'Yetki bulunamadı' });
    return res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

module.exports = router;
