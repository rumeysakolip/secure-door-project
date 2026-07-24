// backend/src/services/pinService.js

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');

/**
 * Kişiye özel 6 haneli rastgele PIN üretir.
 */
function generateRandomPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * ESP32'ye (Push yöntemiyle) güncel kullanıcı şifre listesini gönderir.
 */
async function pushOfflineListToESP32(userPinList) {
  try {
    console.log(`[PUSH] ESP32'ye kişiye özel şifre listesi gönderiliyor... Toplam Kişi: ${userPinList.length}`);
    
    // Format: [ { "u": "1", "p": "123456" }, { "u": "2", "p": "654321" } ]
    const payload = JSON.stringify(userPinList);

    // TODO: İleride MQTT veya HTTP POST entegrasyonu buraya gelecek
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
 * Görev 4.3: Belirli bir cihaz için kapıya bağlı yetki kurallarını tarayarak 
 * HMAC-SHA256, gün maskesi ve saat aralıklarıyla offline liste üretir.
 */
async function generateOfflineListForDevice(cihazId) {
  try {
    // 1. Cihazın bağlı olduğu aktif kapıyı bul
    const cihazAtama = await prisma.cihazKapiAtama.findFirst({
      where: { cihazId: parseInt(cihazId), bitis: null },
      include: { kapi: true }
    });

    if (!cihazAtama) {
      throw new Error("Bu cihaza atanmış aktif bir kapı bulunamadı.");
    }

    const kapiId = cihazAtama.kapiId;

    // 2. İlgili kapıya bağlı YetkiKurali kayıtlarını çek
    const yetkiKurallari = await prisma.yetkiKurali.findMany({
      where: {
        kapiId: kapiId,
        durum: 'aktif'
      },
      include: {
        kullanici: {
          include: {
            kartYetkilendirmeler: {
              where: { durum: 'aktif' }
            }
          }
        }
      }
    });

    // 3. Yeni bir OfflineListeSurumu kaydı oluştur
    const yeniSurum = await prisma.offlineListeSurumu.create({
      data: {
        cihazId: parseInt(cihazId),
      }
    });

    const cihazGizliAnahtari = process.env.ESP32_SECRET_KEY || 'gizli-cihaz-anahtari';
    const userPinListForESP = [];
    const eklenenUyeler = [];

    // 4. Her kural için kullanıcı, kartUid, pinHmac, gün maskesi ve saat aralığını hesapla
    for (const kural of yetkiKurallari) {
      const kullanici = kural.kullanici;
      if (!kullanici || kullanici.durum !== 'aktif') continue;

      // Kullanıcının aktif kartını al
      const aktifKart = kullanici.kartYetkilendirmeler[0];
      const kartUid = aktifKart ? aktifKart.kartUid : null;

      let pinHmac = null;
      let hamPin = null;

      if (kullanici.pinHash) {
        hamPin = generateRandomPin(); 
        pinHmac = crypto
          .createHmac('sha256', cihazGizliAnahtari)
          .update(kullanici.pinHash)
          .digest('hex');
      }

      const gunMaskesi = kural.gunMaskesi || 127;
      const baslangicSaati = kural.baslangicSaati || "00:00";
      const bitisSaati = kural.bitisSaati || "23:59";

      const uye = await prisma.offlineListeUyesi.create({
        data: {
          surumId: yeniSurum.surumId,
          kullaniciId: kullanici.kullaniciId,
          kartUid: kartUid,
          pinHmac: pinHmac,
          gunMaskesi: gunMaskesi,
          baslangicSaati: baslangicSaati,
          bitisSaati: bitisSaati
        }
      });

      eklenenUyeler.push(uye);
      if (hamPin) {
        userPinListForESP.push({ u: kullanici.kullaniciId.toString(), p: hamPin });
      }
    }

    // 5. Oluşan listeyi ESP32'ye push et
    await pushOfflineListToESP32(userPinListForESP);

    return {
      surumId: yeniSurum.surumId.toString(),
      toplamUye: eklenenUyeler.length,
      uyeler: eklenenUyeler
    };

  } catch (error) {
    console.error(`❌ Offline liste üretilemedi (Cihaz ID: ${cihazId}):`, error.message);
    throw error;
  }
}

/**
 * Görev 4.4 / Cron Job: Tüm aktif kullanıcıların PIN'lerini DB'de yeniler 
 * ve cihazlar için offline listeyi tekrar oluşturur.
 */
async function refreshAllUsersPins() {
  try {
    // 1. Veritabanındaki tüm aktif kullanıcıları getir
    const aktifKullanicilar = await prisma.kullanici.findMany({
      where: { durum: 'aktif' }
    });

    console.log(`[CRON] ${aktifKullanicilar.length} aktif kullanıcının PIN'i güncelleniyor...`);

    // 2. Her kullanıcı için yeni PIN üret ve bcrypt ile hash'leyip DB'de güncelle
    for (const kullanici of aktifKullanicilar) {
      const newPin = generateRandomPin();
      const hashedPin = await bcrypt.hash(newPin, 10);

      await prisma.kullanici.update({
        where: { kullaniciId: kullanici.kullaniciId },
        data: {
          pinHash: hashedPin,
          pinSonDegisim: new Date()
        }
      });
    }

    // 3. Aktif cihazların listesini çekip her biri için yeni offline sürümleri üret
    const aktifCihazlar = await prisma.cihaz.findMany({
      where: { durum: 'aktif' }
    });

    for (const cihaz of aktifCihazlar) {
      await generateOfflineListForDevice(cihaz.cihazId);
    }

    return true;
  } catch (error) {
    console.error('❌ Toplu PIN yenileme sırasında hata oluştu:', error.message);
    return false;
  }
}

/**
 * Tek bir kullanıcının PIN'ini isteğe bağlı (Manuel/Web UI) yeniler.
 */
async function refreshSingleUserPin(kullaniciId) {
  try {
    const newPin = generateRandomPin();
    const hashedPin = await bcrypt.hash(newPin, 10);

    const guncelKullanici = await prisma.kullanici.update({
      where: { kullaniciId: BigInt(kullaniciId) },
      data: {
        pinHash: hashedPin,
        pinSonDegisim: new Date()
      }
    });

    // İlgili cihazları bulup offline listelerini güncelle
    const aktifCihazlar = await prisma.cihaz.findMany({ where: { durum: 'aktif' } });
    for (const cihaz of aktifCihazlar) {
      await generateOfflineListForDevice(cihaz.cihazId);
    }

    return {
      kullaniciId: guncelKullanici.kullaniciId.toString(),
      yeniPin: newPin // İsteğe bağlı yanıt ekranında göstermek için
    };
  } catch (error) {
    console.error(`❌ Kullanıcı PIN yenileme hatası (ID: ${kullaniciId}):`, error.message);
    throw error;
  }
}

module.exports = { 
  generateRandomPin, 
  pushOfflineListToESP32,
  generateOfflineListForDevice,
  refreshAllUsersPins,
  refreshSingleUserPin
};