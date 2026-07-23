const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Tüm yetkileri veritabanından getir
router.get('/', async (req, res) => {
    try {
        const yetkiler = await prisma.kartYetki.findMany({
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
        const yetki = await prisma.kartYetki.findUnique({
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

module.exports = router;