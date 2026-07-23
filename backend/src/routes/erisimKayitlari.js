const express = require('express');
const router = express.Router();

const mockErisimKayitlari = [
    { 
        kayitId: 1, 
        cihazOlayId: "123e4567-e89b-12d3-a456-426614174000", 
        cihazId: 1, 
        kapiId: 1, 
        kullaniciId: 1, 
        dogrulamaYontemi: "kart", 
        sonuc: "izin", 
        olayTamani: new Date() 
    }
];

router.get('/', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    res.json(mockErisimKayitlari.slice(offset, offset + limit));
});

module.exports = router;