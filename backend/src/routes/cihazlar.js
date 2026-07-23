const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
// Tüm cihazları veritabanından getir
router.get('/', async (req, res) => {
    try {
        const cihazlar = await prisma.cihaz.findMany();
        res.json(cihazlar);
    } catch (error) {
        console.error("Cihazlar listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// ID'ye göre tek bir cihaz getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const cihaz = await prisma.cihaz.findUnique({
            where: { cihazId: parseInt(id) }
        });
        
        if (!cihaz) return res.status(404).json({ hata: "Cihaz bulunamadı" });
        res.json(cihaz);
    } catch (error) {
        console.error("Cihaz getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;