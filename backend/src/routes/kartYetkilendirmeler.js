const express = require('express');
const router = express.Router();

const mockYetkiler = [
    { kartYetkiId: 1, kartUid: "A1B2C3D4E5", kullaniciId: 1, birimId: 1, durum: "aktif", yetkilendirilmeTarihi: new Date() }
];

router.get('/', (req, res) => res.json(mockYetkiler));

module.exports = router;