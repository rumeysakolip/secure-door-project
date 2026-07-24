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

module.exports = router;