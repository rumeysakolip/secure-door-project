const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Tüm kapıları veritabanından getir
router.get('/', async (req, res) => {
    try {
        const kapilar = await prisma.kapi.findMany();
        res.json(kapilar);
    } catch (error) {
        console.error("Kapılar listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// ID'ye göre tek bir kapı getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const kapi = await prisma.kapi.findUnique({
            where: { kapiId: parseInt(id) }
        });
        
        if (!kapi) return res.status(404).json({ hata: "Kapı bulunamadı" });
        res.json(kapi);
    } catch (error) {
        console.error("Kapı getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;