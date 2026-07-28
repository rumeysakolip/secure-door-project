const express = require('express');
const router = express.Router();
const issueReportService = require('../services/issueReportService');
const { authenticateToken, requireAdmin, requireAdminOrHoca } = require('../middlewares/authMiddleware');

// POST /api/arizalar - QR kod veya form ile yeni arıza bildirimi yapma
// NOT: Bu, QR kod okutan herkesin (giriş yapmadan) kullandığı bir form,
// bu yüzden bilerek korumasız bırakıldı.
router.post('/', async (req, res) => {
    try {
        const { reportedBy, issueType, description, photoName, photoData } = req.body;
        
        if (!issueType || !description) {
            return res.status(400).json({ 
                success: false, 
                error: 'Arıza türü ve açıklaması zorunludur.' 
            });
        }
        const supportedImage = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
        if (photoData && (!supportedImage.test(String(photoData)) || String(photoData).length > 4_000_000)) {
            return res.status(400).json({
                success: false,
                error: 'Fotoğraf geçersiz veya izin verilen boyuttan büyük.'
            });
        }

        const result = await issueReportService.createIssueReport({
            reportedBy,
            issueType,
            description,
            photoName,
            photoData
        });

        if (result.success) {
            return res.status(201).json(result);
        } else {
            return res.status(500).json(result);
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/arizalar - Tüm arıza bildirimlerini listeleme (Yönetici Paneli)
router.get('/', authenticateToken, requireAdminOrHoca, async (req, res) => {
    try {
        const reports = await issueReportService.getAllIssueReports();
        return res.json({ success: true, data: reports });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /api/arizalar/:id - Arıza durumunu güncelleme (OPEN, IN_PROGRESS, RESOLVED)
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ 
                success: false, 
                error: 'Güncellenecek durum (status) belirtilmelidir.' 
            });
        }
        if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Geçersiz arıza durumu.'
            });
        }

        const result = await issueReportService.updateReportStatus(id, status);
        
        if (result.success) {
            return res.json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
