const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const remoteDoorService = require('../services/remoteDoorService');

// Tüm kapıları veritabanından getir
router.get('/', async (req, res) => {
    try {
        const kapilar = await prisma.kapi.findMany();
        res.json(kapilar);
    } catch (error) {
        console.error("Kapılar listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// POST /api/kapilar/:id/ac - Uzaktan Kapı Açma Endpoint'i
router.post('/:id/ac', async (req, res) => {
    try {
        const { id } = req.params;
        const { adminId, reason } = req.body;

        const result = await remoteDoorService.triggerRemoteDoorOpen(id, adminId, reason);

        if (result.success) {
            return res.json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ID'ye göre tek bir kapı getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const kapi = await prisma.kapi.findUnique({
            where: { kapiId: parseInt(id) }
        });
        
        if (!kapi) return res.status(404).json({ hata: "Kapı bulunamadı" });
        res.json(kapi);
    } catch (error) {
        console.error("Kapı getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;