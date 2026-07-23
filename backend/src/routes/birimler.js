const express = require('express');
const router = express.Router();

const mockBirimler = [
    { birimId: 1, kod: "BLM", ad: "Bilgisayar Mühendisliği", aktif: true },
    { birimId: 2, kod: "ELK", ad: "Elektronik Mühendisliği", aktif: true }
];

router.get('/', (req, res) => res.json(mockBirimler));
router.get('/:id', (req, res) => {
    const birim = mockBirimler.find(b => b.birimId === parseInt(req.params.id));
    if (!birim) return res.status(404).json({ hata: "Birim bulunamadı" });
    res.json(birim);
});

module.exports = router;