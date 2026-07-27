const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { refreshSingleUserPin } = require('../services/pinService');

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

// Yeni kullanıcı (hoca/admin) oluştur
router.post('/', async (req, res) => {
    try {
        const { ad, soyad, eposta, birimId, durum, rol } = req.body;

        if (!ad || !soyad) {
            return res.status(400).json({ hata: "'ad' ve 'soyad' alanları zorunludur" });
        }

        const yeniKullanici = await prisma.kullanici.create({
            data: {
                ad,
                soyad,
                eposta: eposta ?? null,
                birimId: birimId != null ? parseInt(birimId) : null,
                ...(durum ? { durum } : {}),
                ...(rol ? { rol } : {})
            },
            include: { birim: true }
        });

        res.status(201).json(yeniKullanici);
    } catch (error) {
        console.error("Kullanıcı oluşturulurken hata:", error);
        if (error.code === 'P2003') {
            return res.status(400).json({ hata: "Belirtilen birimId geçerli bir birime ait değil" });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Kullanıcı bilgilerini güncelle (durum: aktif/pasif/askida dahil)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { ad, soyad, eposta, birimId, durum, rol } = req.body;

        const guncellenmisKullanici = await prisma.kullanici.update({
            where: { kullaniciId: parseInt(id) },
            data: {
                ...(ad !== undefined ? { ad } : {}),
                ...(soyad !== undefined ? { soyad } : {}),
                ...(eposta !== undefined ? { eposta } : {}),
                ...(birimId !== undefined ? { birimId: birimId != null ? parseInt(birimId) : null } : {}),
                ...(durum !== undefined ? { durum } : {}),
                ...(rol !== undefined ? { rol } : {})
            },
            include: { birim: true }
        });

        res.json(guncellenmisKullanici);
    } catch (error) {
        console.error("Kullanıcı güncellenirken hata:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ hata: "Kullanıcı bulunamadı" });
        }
        if (error.code === 'P2003') {
            return res.status(400).json({ hata: "Belirtilen birimId geçerli bir birime ait değil" });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// Kullanıcıyı sil
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.kullanici.delete({
            where: { kullaniciId: parseInt(id) }
        });

        res.status(200).json({ mesaj: "Kullanıcı silindi" });
    } catch (error) {
        console.error("Kullanıcı silinirken hata:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ hata: "Kullanıcı bulunamadı" });
        }
        if (error.code === 'P2003') {
            return res.status(409).json({ hata: "Bu kullanıcıya bağlı kayıtlar (kart yetkisi, erişim kaydı vb.) olduğu için silinemedi. Bunun yerine durumu 'pasif' yapmayı deneyin." });
        }
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

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