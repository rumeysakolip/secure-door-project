const express = require('express');
const router = express.Router();

const mockCihazlar = [
    { cihazId: 1, seriNo: "ESP32-DEV-001", durum: "aktif", kurulumuTarihi: "2026-01-01" },
    { cihazId: 2, seriNo: "ESP32-DEV-002", durum: "arizali", kurulumuTarihi: "2026-01-02" }
];

router.get('/', (req, res) => res.json(mockCihazlar));

module.exports = router;