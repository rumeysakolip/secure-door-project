const express = require('express');
const argon2 = require('argon2');
const prisma = require('../config/prisma');
const { refreshSingleUserPin, generateRandomPin } = require('../services/pinService');
const {
  authenticateToken,
  requireAdmin,
  requireAdminOrHoca,
  requireSelfOrAdmin
} = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(authenticateToken);

const safeUserSelect = {
  kullaniciId: true,
  ad: true,
  soyad: true,
  eposta: true,
  birimId: true,
  durum: true,
  rol: true,
  pinSonDegisim: true,
  pinGecerlilikBitis: true,
  olusturmaTamani: true,
  guncellemeTamani: true,
  birim: true
};

router.get('/ozet', requireAdminOrHoca, async (req, res) => {
  try {
    const [toplam, aktif] = await Promise.all([
      prisma.kullanici.count(),
      prisma.kullanici.count({ where: { durum: 'aktif' } })
    ]);
    return res.json({ toplam, aktif });
  } catch (error) {
    return res.status(500).json({ hata: 'Kullanıcı özeti alınamadı.' });
  }
});

router.get('/', requireAdminOrHoca, async (req, res) => {
  try {
    const { durum, rol } = req.query;
    const where = {
      ...(durum ? { durum } : {}),
      ...(rol ? { rol } : {})
    };
    const users = await prisma.kullanici.findMany({
      where,
      select: safeUserSelect,
      orderBy: [{ ad: 'asc' }, { soyad: 'asc' }]
    });
    return res.json(users);
  } catch (error) {
    console.error('Kullanıcılar listelenirken hata:', error);
    return res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { ad, soyad, eposta, birimId, durum, rol, pin } = req.body;
    if (!String(ad || '').trim() || !String(soyad || '').trim()) {
      return res.status(400).json({ hata: "'ad' ve 'soyad' alanları zorunludur" });
    }

    const normalizedEmail = eposta ? String(eposta).trim().toLowerCase() : null;
    if (normalizedEmail) {
      const existing = await prisma.kullanici.findFirst({
        where: { eposta: { equals: normalizedEmail, mode: 'insensitive' } }
      });
      if (existing) return res.status(409).json({ hata: 'Bu e-posta adresi zaten kullanılıyor.' });
    }

    const initialPin = String(pin || generateRandomPin());
    if (!/^\d{6}$/.test(initialPin)) {
      return res.status(400).json({ hata: 'Başlangıç PIN değeri 6 haneli olmalıdır.' });
    }

    const initialHash = await argon2.hash(initialPin);
    const user = await prisma.kullanici.create({
      data: {
        ad: String(ad).trim(),
        soyad: String(soyad).trim(),
        eposta: normalizedEmail,
        birimId: birimId != null ? Number.parseInt(birimId, 10) : null,
        sifreHash: initialHash,
        pinHash: initialHash,
        pinSonDegisim: new Date(),
        ...(durum ? { durum } : {}),
        ...(rol ? { rol } : {})
      },
      select: safeUserSelect
    });

    return res.status(201).json({ ...user, initialPin });
  } catch (error) {
    console.error('Kullanıcı oluşturulurken hata:', error);
    if (error.code === 'P2003') return res.status(400).json({ hata: 'Geçersiz birimId.' });
    return res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { ad, soyad, eposta, birimId, durum, rol } = req.body;
    const normalizedEmail = eposta === undefined
      ? undefined
      : (eposta ? String(eposta).trim().toLowerCase() : null);

    if (normalizedEmail) {
      const existing = await prisma.kullanici.findFirst({
        where: {
          eposta: { equals: normalizedEmail, mode: 'insensitive' },
          NOT: { kullaniciId: BigInt(req.params.id) }
        }
      });
      if (existing) return res.status(409).json({ hata: 'Bu e-posta adresi zaten kullanılıyor.' });
    }

    const user = await prisma.kullanici.update({
      where: { kullaniciId: BigInt(req.params.id) },
      data: {
        ...(ad !== undefined ? { ad: String(ad).trim() } : {}),
        ...(soyad !== undefined ? { soyad: String(soyad).trim() } : {}),
        ...(normalizedEmail !== undefined ? { eposta: normalizedEmail } : {}),
        ...(birimId !== undefined ? { birimId: birimId != null ? Number.parseInt(birimId, 10) : null } : {}),
        ...(durum !== undefined ? { durum } : {}),
        ...(rol !== undefined ? { rol } : {})
      },
      select: safeUserSelect
    });
    return res.json(user);
  } catch (error) {
    console.error('Kullanıcı güncellenirken hata:', error);
    if (error.code === 'P2025') return res.status(404).json({ hata: 'Kullanıcı bulunamadı' });
    if (error.code === 'P2003') return res.status(400).json({ hata: 'Geçersiz birimId.' });
    return res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.kullanici.delete({ where: { kullaniciId: BigInt(req.params.id) } });
    return res.json({ mesaj: 'Kullanıcı silindi' });
  } catch (error) {
    console.error('Kullanıcı silinirken hata:', error);
    if (error.code === 'P2025') return res.status(404).json({ hata: 'Kullanıcı bulunamadı' });
    if (error.code === 'P2003') {
      return res.status(409).json({ hata: "Bağlı kayıtları bulunan kullanıcı silinemez; durumunu 'pasif' yapın." });
    }
    return res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

router.post('/:id/sifre-yenile', requireSelfOrAdmin, async (req, res) => {
  try {
    const result = await refreshSingleUserPin(req.params.id);
    return res.json({
      mesaj: 'Kullanıcının PIN değeri yenilendi ve aktif cihazlara bildirildi.',
      veri: result
    });
  } catch (error) {
    return res.status(400).json({ hata: error.message });
  }
});

router.get('/:id', requireSelfOrAdmin, async (req, res) => {
  try {
    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(req.params.id) },
      select: safeUserSelect
    });
    if (!user) return res.status(404).json({ hata: 'Kullanıcı bulunamadı' });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

module.exports = router;
