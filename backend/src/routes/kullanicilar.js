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

const router = express.Router();
const { refreshSingleUserPin } = require('../services/pinService');

// POST /api/kullanicilar/:id/sifre-yenile
router.post('/:id/sifre-yenile', async (req, res) => {
  try {
    const sonuc = await refreshSingleUserPin(req.params.id);
    return res.status(200).json({
      mesaj: 'Kullanıcının şifresi başarıyla yenilendi ve MQTT ile cihaza bildirildi.',
      veri: sonuc
    });
  } catch (error) {
    return res.status(400).json({
      hata: error.message
    });
  }
});

module.exports = router;

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