const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Kartları listele (durum parametresine göre isteğe bağlı filtreleme ile)
router.get('/', async (req, res) => {
    try {
        const { durum } = req.query;
        const whereClause = durum ? { durum } : {};

        const kartlar = await prisma.kart.findMany({
            where: whereClause
        });
        
        res.json(kartlar);
    } catch (error) {
        console.error("Kartlar listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// ID'ye göre tek bir kart getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const kart = await prisma.kart.findUnique({
            where: { kartId: parseInt(id) }
        });
        
        if (!kart) return res.status(404).json({ hata: "Kart bulunamadı" });
        res.json(kart);
    } catch (error) {
        console.error("Kart getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Yeni kart tanımla
router.post('/', async (req, res) => {
    try {
        const { kartUid, durum, verilicTarihi } = req.body;

        if (!kartUid) {
            return res.status(400).json({ hata: "'kartUid' alanı zorunludur" });
        }

        const yeniKart = await prisma.kart.create({
            data: {
                kartUid,
                ...(durum ? { durum } : {}),
                ...(verilicTarihi ? { verilicTarihi: new Date(verilicTarihi) } : {})
            }
        });

        res.status(201).json(yeniKart);
    } catch (error) {
        console.error("Kart oluşturulurken hata:", error);
        if (error.code === 'P2002') {
            return res.status(409).json({ hata: "Bu kartUid ile kayıtlı bir kart zaten var" });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Kart durumunu / bilgilerini güncelle (örn. durum: kayip/iptal/hasarli)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { durum, iptalTarihi, iptalNedeni } = req.body;

        const guncellenmisKart = await prisma.kart.update({
            where: { kartId: parseInt(id) },
            data: {
                ...(durum !== undefined ? { durum } : {}),
                ...(iptalTarihi !== undefined ? { iptalTarihi: iptalTarihi ? new Date(iptalTarihi) : null } : {}),
                ...(iptalNedeni !== undefined ? { iptalNedeni } : {})
            }
        });

        res.json(guncellenmisKart);
    } catch (error) {
        console.error("Kart güncellenirken hata:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ hata: "Kart bulunamadı" });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Kartı sil
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.kart.delete({
            where: { kartId: parseInt(id) }
        });

        res.status(200).json({ mesaj: "Kart silindi" });
    } catch (error) {
        console.error("Kart silinirken hata:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ hata: "Kart bulunamadı" });
        }
        if (error.code === 'P2003') {
            return res.status(409).json({ hata: "Bu karta bağlı kayıtlar (yetkilendirme, erişim kaydı vb.) olduğu için silinemedi. Bunun yerine durumu 'iptal' yapmayı deneyin." });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;