// backend/src/services/pinService.js

/**
 * Kişiye özel 6 haneli rastgele PIN üretir.
 */
function generateRandomPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * ESP32'ye (Push yöntemiyle) güncel kullanıcı şifre listesini gönderir.
 * Çıkış senaryosu kaldırıldığı için sadece giriş yetkisi olanların listesi basılır.
 */
async function pushOfflineListToESP32(userPinList) {
  try {
    console.log(`[PUSH] ESP32'ye kişiye özel şifre listesi gönderiliyor... Toplam Kişi: ${userPinList.length}`);
    
    // Format örneği: [ { "u": "USR01", "p": "123456" }, { "u": "USR02", "p": "654321" } ]
    // ESP32'nin RAM'ini şişirmemek için key'leri "u" (userId) ve "p" (pin) olarak kısalttık.
    const payload = JSON.stringify(userPinList);

    // TODO: ESP32 HTTP POST veya MQTT Publish işlemi burada yapılacak.
    // Şimdilik simülasyon:
    const isEspReachable = true; 

    if (!isEspReachable) {
      throw new Error("ESP32 cihazından yanıt alınamadı (Çevrimdışı).");
    }

    console.log(`[PUSH BAŞARILI] ESP32 yeni şifre listesini hafızasına kaydetti!`);
    return true;
  } catch (error) {
    console.error(`[PUSH BAŞARISIZ] ESP32'ye liste itilemedi: ${error.message}`);
    return false;
  }
}

/**
 * Her gece cron job ile tüm kullanıcıların şifrelerini yenileyecek fonksiyon.
 */
async function refreshAllUsersPins(users) {
  const userPinList = [];
  
  for (let user of users) {
    const newPin = generateRandomPin();
    // TODO: Veritabanında kullanıcının yeni pin_hash değerini güncelle
    
    userPinList.push({ u: user.id, p: newPin });
  }

  // Yeni listeyi ESP32'ye it
  const success = await pushOfflineListToESP32(userPinList);
  return success;
}

module.exports = { refreshAllUsersPins, generateRandomPin };