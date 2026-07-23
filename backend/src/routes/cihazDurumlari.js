const express = require('express');
const router = express.Router();

const mockCihazDurumlari = [
    { 
        cihazDurumuId: 1, 
        cihazId: 1, 
        kapiDurumu: "kapali", 
        cihazDurumu: "cevrimici", 
        bataryaSeviyesi: 95, 
        wifiSignali: -50, 
        sonHeartbeat: new Date() 
    }
];

router.get('/', (req, res) => res.json(mockCihazDurumlari));

module.exports = router;