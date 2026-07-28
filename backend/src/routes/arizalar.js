const express = require('express');
const router = express.Router();
const issueReportService = require('../services/issueReportService');

// POST /api/arizalar - QR kod veya form ile yeni arıza bildirimi yapma
router.post('/', async (req, res) => {
    try {
        const { reportedBy, issueType, description } = req.body;
        
        if (!issueType || !description) {
            return res.status(400).json({ 
                success: false, 
                error: 'Arıza türü ve açıklaması zorunludur.' 
            });
        }

        const result = await issueReportService.createIssueReport({
            reportedBy,
            issueType,
            description
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
router.get('/', async (req, res) => {
    try {
        const reports = await issueReportService.getAllIssueReports();
        return res.json({ success: true, data: reports });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /api/arizalar/:id - Arıza durumunu güncelleme (OPEN, IN_PROGRESS, RESOLVED)
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ 
                success: false, 
                error: 'Güncellenecek durum (status) belirtilmelidir.' 
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