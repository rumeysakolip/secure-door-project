// backend/src/services/remoteDoorService.js

/**
 * Yönetici panelinden atılan uzaktan kapı açma isteğini işler ve ESP32'ye sinyal gönderir.
 * @param {string} adminId - İstek atan yöneticinin ID'si
 * @param {string} reason - Kapının neden açıldığına dair isteğe bağlı açıklama
 */
async function triggerRemoteDoorOpen(adminId, reason = "Yönetici Panelinden Uzaktan Açıldı") {
  try {
    console.log(`[UZAKTAN AÇMA İSTEĞİ] Admin ID: ${adminId} kapıyı açma emri verdi. Sebep: ${reason}`);

    // 1. ESP32 ile iletişim kurulup kurulamadığını kontrol et / Komut gönder
    const commandSent = await sendOpenCommandToESP32();

    if (!commandSent) {
      return {
        success: false,
        message: "Kapı cihazına (ESP32) ulaşılamadı. Kapı açılamadı!"
      };
    }

    // TODO: Prisma DB entegrasyonu sağlandığında veritabanına log yazılacak:
    // await prisma.command.create({
    //   data: { commandType: "UNLOCK_DOOR", adminId, status: "SUCCESS" }
    // });

    return {
      success: true,
      message: "Uzaktan kapı açma emri kapıya başarıyla iletildi.",
      triggeredAt: new Date()
    };
  } catch (error) {
    console.error(`[UZAKTAN AÇMA HATA]`, error.message);
    return {
      success: false,
      message: "Sistemsel bir hata nedeniyle komut gönderilemedi."
    };
  }
}

/**
 * ESP32'ye HTTP/MQTT üzerinden kilit açma sinyali gönderir.
 */
async function sendOpenCommandToESP32() {
  try {
    console.log(`[ESP32 KOMUT] 'UNLOCK_DOOR' sinyali ESP32 cihazına iletiliyor...`);
    // TODO: İleride HTTP POST veya MQTT Publish (securedoor/commands) buraya bağlanacak.
    
    // Test amaçlı şimdilik cihazı aktif sayıyoruz:
    const isDeviceOnline = true; 
    return isDeviceOnline;
  } catch (error) {
    console.error(`[ESP32 İLETİŞİM HATA]`, error);
    return false;
  }
}

module.exports = {
  triggerRemoteDoorOpen,
  sendOpenCommandToESP32
};