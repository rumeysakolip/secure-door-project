const express = require('express');
const router = express.Router();

const mockKapilar = [
    { kapiId: 1, ad: "Bilgisayar Lab Kapısı", bina: "Mühendislik Fakültesi", kat: 2, durum: "aktif" },
    { kapiId: 2, ad: "Dekanlık Girişi", bina: "İdari Bina", kat: 1, durum: "bakimda" }
];

router.get('/', (req, res) => res.json(mockKapilar));

module.exports = router;