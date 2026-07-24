const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

// Grupları, üye sayılarıyla birlikte listele
router.get('/', async (req, res) => {
    try {
        const gruplar = await prisma.grup.findMany({
            include: {
                _count: {
                    select: { uyeler: true }
                }
            },
            orderBy: {
                ad: 'asc'
            }
        });

        // _count.uyeler -> uyeSayisi olarak sadeleştir
        const sonuc = gruplar.map(grup => ({
            ...grup,
            uyeSayisi: grup._count.uyeler,
            _count: undefined
        }));

        res.json(sonuc);
    } catch (error) {
        console.error("Gruplar listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// ID'ye göre tek bir grubu, üyeleriyle birlikte getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const grupId = parseInt(id);

        if (isNaN(grupId)) {
            return res.status(400).json({ hata: "Geçersiz grup ID" });
        }

        const grup = await prisma.grup.findUnique({
            where: { grupId },
            include: {
                uyeler: {
                    include: {
                        kullanici: true
                    }
                }
            }
        });

        if (!grup) return res.status(404).json({ hata: "Grup bulunamadı" });
        res.json(grup);
    } catch (error) {
        console.error("Grup getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;
