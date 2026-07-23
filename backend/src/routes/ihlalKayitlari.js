const express = require('express');
const router = express.Router();

const mockIhlaller = [
    { 
        ihlalId: 1, 
        kullaniciId: 2, 
        tarih: "2026-07-22", 
        tur: "cikis_kacirma", 
        aciklama: "Kullanıcı çıkış yapmadı.", 
        olusturmaTamani: new Date() 
    }
];

router.get('/', (req, res) => res.json(mockIhlaller));

module.exports = router;