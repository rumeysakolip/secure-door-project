const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const cardApprovalService = require('../services/cardApprovalService');

// GET /api/kartlar - Tüm kartları listele (durum parametresine göre isteğe bağlı filtreleme)
router.get('/', async (req, res) => {
    try {
        const { durum } = req.query;
        const whereClause = durum ? { durum } : {};

        const kartlar = await prisma.kart.findMany({
            where: whereClause
        });
        
        res.json(kartlar);
    } catch (error) {
        console.error("Kartlar listelenirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

// GET /api/kartlar/onay-bekleyenler - Henüz bir kullanıcıya atanmamış kartları getir
router.get('/onay-bekleyenler', async (req, res) => {
    try {
        const pendingCards = await cardApprovalService.getPendingCards();
        res.json({ success: true, data: pendingCards });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/kartlar/bilinmeyen-okuma - ESP32'den gelen bilinmeyen kart bildirimini işle
router.post('/bilinmeyen-okuma', async (req, res) => {
    try {
        const { kartUid } = req.body;
        if (!kartUid) {
            return res.status(400).json({ success: false, error: 'kartUid parametresi gereklidir.' });
        }

        const result = await cardApprovalService.handleUnknownCardScan(kartUid);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/kartlar/onayla - Yönetici panelinden kartı kullanıcıya ata
router.post('/onayla', async (req, res) => {
    try {
        const { kartUid, userId, adminId } = req.body;

        if (!kartUid || !userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'kartUid ve userId alanları zorunludur.' 
            });
        }

        const result = await cardApprovalService.approveCard(kartUid, userId, adminId);
        
        if (result.success) {
            return res.json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/kartlar/:id - ID'ye göre tek bir kart getir
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const kart = await prisma.kart.findUnique({
            where: { kartId: parseInt(id) }
        });
        
        if (!kart) return res.status(404).json({ hata: "Kart bulunamadı" });
        res.json(kart);
    } catch (error) {
        console.error("Kart getirilirken hata:", error);
        res.status(500).json({ hata: "Sunucu hatası" });
    }
});

module.exports = router;