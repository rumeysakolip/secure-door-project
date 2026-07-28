const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { authenticateToken, requireAdminOrHoca } = require('../middlewares/authMiddleware');
router.use(authenticateToken, requireAdminOrHoca);
// Not: Bu dosya daha önce hiç yoktu; YetkiKurali modeli (gün/saat bazlı
// erişim yetkisi) için hiçbir endpoint bulunmuyordu. Diğer route
// dosyalarıyla aynı üslup ve hata yönetimi deseniyle yazıldı.

// Tüm yetki kurallarını getir (isteğe bağlı grupId/kullaniciId/kapiId filtreleriyle)
router.get('/', async (req, res) => {
    try {
        const { grupId, kullaniciId, kapiId } = req.query;
        const whereClause = {};

        if (grupId) whereClause.grupId = parseInt(grupId);
        if (kullaniciId) whereClause.kullaniciId = parseInt(kullaniciId);
        if (kapiId) whereClause.kapiId = parseInt(kapiId);

        const kurallar = await prisma.yetkiKurali.findMany({
            where: whereClause,
            include: {
                grup: true,
                kullanici: true,
                kapi: true
            }
        });

        res.json(kurallar);
    } catch (error) {
        console.error("Yetki kuralları listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// ID'ye göre tek bir yetki kuralı getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const kural = await prisma.yetkiKurali.findUnique({
            where: { yetkiKuraliId: parseInt(id) },
            include: {
                grup: true,
                kullanici: true,
                kapi: true
            }
        });

        if (!kural) return res.status(404).json({ hata: "Yetki kuralı bulunamadı" });
        res.json(kural);
    } catch (error) {
        console.error("Yetki kuralı getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Yeni yetki kuralı oluştur (bir gruba ya da doğrudan bir kullanıcıya tanımlanabilir)
router.post('/', async (req, res) => {
    try {
        const { grupId, kullaniciId, kapiId, gunMaskesi, saatBaslangic, saatBitis, aktif } = req.body;

        if (kapiId == null || gunMaskesi == null || !saatBaslangic || !saatBitis) {
            return res.status(400).json({ hata: "'kapiId', 'gunMaskesi', 'saatBaslangic' ve 'saatBitis' alanları zorunludur" });
        }
        if (grupId == null && kullaniciId == null) {
            return res.status(400).json({ hata: "Kural ya bir 'grupId' ya da bir 'kullaniciId'ye bağlanmalıdır" });
        }

        const yeniKural = await prisma.yetkiKurali.create({
            data: {
                grupId: grupId != null ? parseInt(grupId) : null,
                kullaniciId: kullaniciId != null ? parseInt(kullaniciId) : null,
                kapiId: parseInt(kapiId),
                gunMaskesi: parseInt(gunMaskesi),
                saatBaslangic,
                saatBitis,
                ...(aktif !== undefined ? { aktif: !!aktif } : {})
            },
            include: { grup: true, kullanici: true, kapi: true }
        });

        res.status(201).json(yeniKural);
    } catch (error) {
        console.error("Yetki kuralı oluşturulurken hata:", error);
        if (error.code === 'P2003') {
            return res.status(400).json({ hata: "Belirtilen grupId, kullaniciId veya kapiId geçerli değil" });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Yetki kuralını güncelle
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { gunMaskesi, saatBaslangic, saatBitis, aktif } = req.body;

        const guncellenmisKural = await prisma.yetkiKurali.update({
            where: { yetkiKuraliId: parseInt(id) },
            data: {
                ...(gunMaskesi !== undefined ? { gunMaskesi: parseInt(gunMaskesi) } : {}),
                ...(saatBaslangic !== undefined ? { saatBaslangic } : {}),
                ...(saatBitis !== undefined ? { saatBitis } : {}),
                ...(aktif !== undefined ? { aktif: !!aktif } : {})
            },
            include: { grup: true, kullanici: true, kapi: true }
        });

        res.json(guncellenmisKural);
    } catch (error) {
        console.error("Yetki kuralı güncellenirken hata:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ hata: "Yetki kuralı bulunamadı" });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Yetki kuralını sil
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.yetkiKurali.delete({
            where: { yetkiKuraliId: parseInt(id) }
        });

        res.status(200).json({ mesaj: "Yetki kuralı silindi" });
    } catch (error) {
        console.error("Yetki kuralı silinirken hata:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ hata: "Yetki kuralı bulunamadı" });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;
