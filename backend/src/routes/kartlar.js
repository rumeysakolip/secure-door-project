const express = require('express');
const router = express.Router();

const mockKartlar = [
    { kartId: 1, kartUid: "A1B2C3D4E5", durum: "aktif", verilicTarihi: "2026-01-01" },
    { kartId: 2, kartUid: "F6G7H8I9J0", durum: "iptal", verilicTarihi: "2026-01-05", iptalNedeni: "Kayıp" }
];

router.get('/', (req, res) => {
    let sonuc = mockKartlar;
    const { durum } = req.query;
    if (durum) sonuc = sonuc.filter(k => k.durum === durum);
    res.json(sonuc);
});

module.exports = router;