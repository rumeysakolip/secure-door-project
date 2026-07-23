const express = require('express');
const router = express.Router();

const mockKullanicilar = [
    { kullaniciId: 1, ad: "Ahmet", soyad: "Yılmaz", eposta: "ahmet@uni.edu.tr", durum: "aktif", rol: "hoca", birimId: 1 },
    { kullaniciId: 2, ad: "Ayşe", soyad: "Kaya", eposta: "ayse@uni.edu.tr", durum: "aktif", rol: "hoca", birimId: 2 }
];

router.get('/', (req, res) => {
    let sonuc = mockKullanicilar;
    const { durum, rol } = req.query;
    if (durum) sonuc = sonuc.filter(k => k.durum === durum);
    if (rol) sonuc = sonuc.filter(k => k.rol === rol);
    res.json(sonuc);
});

router.get('/:id', (req, res) => {
    const kullanici = mockKullanicilar.find(k => k.kullaniciId === parseInt(req.params.id));
    if (!kullanici) return res.status(404).json({ hata: "Kullanıcı bulunamadı" });
    res.json(kullanici);
});

module.exports = router;