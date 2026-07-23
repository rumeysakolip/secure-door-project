const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Tüm ihlalleri veritabanından getir
router.get('/', async (req, res) => {
    try {
        const ihlaller = await prisma.ihlal.findMany({
            include: {
                kullanici: true
            }
        });
        res.json(ihlaller);
    } catch (error) {
        console.error("İhlaller listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// ID'ye göre tek bir ihlal getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const ihlal = await prisma.ihlal.findUnique({
            where: { ihlalId: parseInt(id) },
            include: {
                kullanici: true
            }
        });
        
        if (!ihlal) return res.status(404).json({ hata: "İhlal bulunamadı" });
        res.json(ihlal);
    } catch (error) {
        console.error("İhlal getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;