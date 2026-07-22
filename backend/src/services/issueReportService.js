// backend/src/services/issueReportService.js

// Geçici hafıza (Prisma DB bağlanana kadar bildirilen arızaları tutar)
let issueReportsQueue = [];

/**
 * 1. QR kod ile gelen yeni bir arıza bildirimini kaydeder.
 * @param {Object} reportData - Arıza detayları
 * @param {string} reportData.reportedBy - Bildiren kişinin adı/e-postası (isteğe bağlı)
 * @param {string} reportData.issueType - Arıza türü (örn: "KEYPAD_BROKEN", "CARD_NOT_READING", "DOOR_STUCK")
 * @param {string} reportData.description - Arıza açıklaması
 */
function createIssueReport({ reportedBy = "Anonim", issueType, description }) {
  const newReport = {
    id: issueReportsQueue.length + 1,
    reportedBy,
    issueType,
    description,
    createdAt: new Date(),
    status: "OPEN" // OPEN, IN_PROGRESS, RESOLVED
  };

  issueReportsQueue.push(newReport);
  console.log(`[ARIZA BİLDİRİMİ] Yeni arıza kaydı oluşturuldu: ID ${newReport.id} - ${issueType}`);

  return {
    success: true,
    message: "Arıza bildiriminiz başarıyla yöneticilere iletildi. Teşekkür ederiz.",
    report: newReport
  };
}

/**
 * 2. Yöneticinin panelde tüm arıza bildirimlerini görmesini sağlar.
 */
function getAllIssueReports() {
  return issueReportsQueue;
}

/**
 * 3. Yöneticinin arıza durumunu güncellemesini sağlar (Örn: Çözüldü olarak işaretleme).
 */
function updateReportStatus(reportId, status) {
  const report = issueReportsQueue.find(r => r.id === Number(reportId));

  if (!report) {
    return {
      success: false,
      message: "Belirtilen arıza kaydı bulunamadı."
    };
  }

  report.status = status;
  console.log(`[ARIZA GÜNCELLENDİ] ID: ${reportId} durumu yeni hali: ${status}`);

  return {
    success: true,
    message: `Arıza durumu '${status}' olarak güncellendi.`,
    report
  };
}

module.exports = {
  createIssueReport,
  getAllIssueReports,
  updateReportStatus
};