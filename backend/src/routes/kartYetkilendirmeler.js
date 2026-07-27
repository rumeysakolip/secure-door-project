const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Tüm yetkileri veritabanından getir
router.get('/', async (req, res) => {
    try {
        const yetkiler = await prisma.kartYetkilendirme.findMany({
            include: {
                kullanici: true,
                birim: true
            }
        });
        res.json(yetkiler);
    } catch (error) {
        console.error("Yetkiler listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// ID'ye göre tek bir yetki getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const yetki = await prisma.kartYetkilendirme.findUnique({
            where: { kartYetkiId: parseInt(id) },
            include: {
                kullanici: true,
                birim: true
            }
        });
        
        if (!yetki) return res.status(404).json({ hata: "Yetki bulunamadı" });
        res.json(yetki);
    } catch (error) {
        console.error("Yetki getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Kart - kullanıcı eşleştirmesi (yeni yetkilendirme) oluştur
router.post('/', async (req, res) => {
    try {
        const { kartUid, kullaniciId, birimId, yetkilendiren, notlar, sonKullanilmaTarihi } = req.body;

        if (!kartUid || kullaniciId == null) {
            return res.status(400).json({ hata: "'kartUid' ve 'kullaniciId' alanları zorunludur" });
        }

        const yeniYetki = await prisma.kartYetkilendirme.create({
            data: {
                kartUid,
                kullaniciId: parseInt(kullaniciId),
                birimId: birimId != null ? parseInt(birimId) : null,
                yetkilendiren: yetkilendiren != null ? parseInt(yetkilendiren) : null,
                notlar: notlar ?? null,
                ...(sonKullanilmaTarihi ? { sonKullanilmaTarihi: new Date(sonKullanilmaTarihi) } : {})
            },
            include: { kullanici: true, birim: true }
        });

        res.status(201).json(yeniYetki);
    } catch (error) {
        console.error("Yetki oluşturulurken hata:", error);
        if (error.code === 'P2002') {
            return res.status(409).json({ hata: "Bu kart için zaten bir yetkilendirme kaydı var" });
        }
        if (error.code === 'P2003') {
            return res.status(400).json({ hata: "Belirtilen kartUid, kullaniciId veya birimId geçerli değil" });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Yetkiyi güncelle (örn. durum: iptal/pasif et)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { durum, notlar, sonKullanilmaTarihi } = req.body;

        const guncellenmisYetki = await prisma.kartYetkilendirme.update({
            where: { kartYetkiId: parseInt(id) },
            data: {
                ...(durum !== undefined ? { durum } : {}),
                ...(notlar !== undefined ? { notlar } : {}),
                ...(sonKullanilmaTarihi !== undefined ? { sonKullanilmaTarihi: sonKullanilmaTarihi ? new Date(sonKullanilmaTarihi) : null } : {})
            },
            include: { kullanici: true, birim: true }
        });

        res.json(guncellenmisYetki);
    } catch (error) {
        console.error("Yetki güncellenirken hata:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ hata: "Yetki bulunamadı" });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;