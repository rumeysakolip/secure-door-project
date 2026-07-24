const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Kullanıcıları listele (durum ve rol parametrelerine göre isteğe bağlı filtreleme ile)
router.get('/', async (req, res) => {
    try {
        const { durum, rol } = req.query;
        const whereClause = {};
        
        if (durum) whereClause.durum = durum;
        if (rol) whereClause.rol = rol;

        const kullanicilar = await prisma.kullanici.findMany({
            where: whereClause,
            include: {
                birim: true
            }
        });
        
        res.json(kullanicilar);
    } catch (error) {
        console.error("Kullanıcılar listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// ID'ye göre tek bir kullanıcı getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const kullanici = await prisma.kullanici.findUnique({
            where: { kullaniciId: parseInt(id) },
            include: {
                birim: true
            }
        });
        
        if (!kullanici) return res.status(404).json({ hata: "Kullanıcı bulunamadı" });
        res.json(kullanici);
    } catch (error) {
        console.error("Kullanıcı getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;