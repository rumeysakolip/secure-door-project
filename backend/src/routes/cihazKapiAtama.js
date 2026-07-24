const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Tüm cihaz-kapı atamalarını veritabanından getir
router.get('/', async (req, res) => {
    try {
        const atamalar = await prisma.cihazKapiAtama.findMany({
            include: {
                // Eğer ilişkili tabloları (cihaz ve kapi) de beraber çekmek istersen:
                cihaz: true,
                kapi: true
            }
        });
        res.json(atamalar);
    } catch (error) {
        console.error("Atamalar listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// ID'ye göre tek bir atama getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const atama = await prisma.cihazKapiAtama.findUnique({
            where: { atamaId: parseInt(id) },
            include: {
                cihaz: true,
                kapi: true
            }
        });
        
        if (!atama) return res.status(404).json({ hata: "Atama bulunamadı" });
        res.json(atama);
    } catch (error) {
        console.error("Atama getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;