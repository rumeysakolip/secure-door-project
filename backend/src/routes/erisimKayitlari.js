const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Erişim kayıtlarını sayfalama (limit ve offset) desteğiyle getir
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const erisimKayitlari = await prisma.erisimKaydi.findMany({
            take: limit,
            skip: offset,
            orderBy: {
                olayZamani: 'desc' // Kayıtları en yeniden eskiye sıralar
            },
            include: {
                cihaz: true,
                kapi: true,
                kullanici: true
            }
        });

        res.json(erisimKayitlari);
    } catch (error) {
        console.error("Erişim kayıtları listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;