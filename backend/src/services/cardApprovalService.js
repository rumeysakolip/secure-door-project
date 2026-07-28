const prisma = require('../config/prisma');

/**
 * 1. ESP32'den bilinmeyen/tanımsız bir kart ID geldiğinde çalışır.
 * Kartı veritabanındaki Kart tablosuna kaydeder (varsa günceller).
 */
async function handleUnknownCardScan(kartUid) {
  try {
    // Kart daha önce kaydedilmiş mi kontrol et
    let kart = await prisma.kart.findUnique({
      where: { kartUid }
    });

    if (!kart) {
      // Veritabanına yeni kart olarak ekle
      kart = await prisma.kart.create({
        data: {
          kartUid,
          durum: 'aktif', // Varsayılan aktif kart kaydı
          iptalNedeni: 'Onay Bekliyor'
        }
      });
      console.log(`[YENİ KART] Onay bekleyen yeni kart DB'ye eklendi: ${kartUid}`);
    } else {
      console.log(`[KART UYARI] Tanımsız kart tekrar okutuldu: ${kartUid}`);
    }

    return {
      success: false,
      message: "Kartınız sisteme kayıtlı değil. Onay isteği yöneticiye iletildi.",
      kartUid
    };
  } catch (error) {
    console.error(`[KART OKUMA HATA]`, error.message);
    return { success: false, message: "Kart okuma veritabanına kaydedilemedi." };
  }
}

/**
 * 2. Yöneticinin panelde yetkilendirilmemiş/onay bekleyen kartları listelemesini sağlar.
 */
async function getPendingCards() {
  try {
    // KartYetkilendirme tablosunda hiç kaydı olmayan kartları getir
    const pendingCards = await prisma.kart.findMany({
      where: {
        kartYetkilendirmeler: {
          none: {}
        }
      },
      orderBy: { verilicTarihi: 'desc' }
    });

    return pendingCards;
  } catch (error) {
    console.error(`[ONAY BEKLEYEN KARTLAR HATA]`, error.message);
    return [];
  }
}

/**
 * 3. Yönetici kartı bir kullanıcıya (userId) atayıp onayladığında çalışır.
 * KartYetkilendirme tablosuna kayıt atar.
 */
async function approveCard(kartUid, userId, adminId = null) {
  try {
    const kullaniciIdBigInt = BigInt(userId);

    // Kartın DB'de olup olmadığını kontrol et
    let kart = await prisma.kart.findUnique({
      where: { kartUid }
    });

    if (!kart) {
      // Kart DB'de yoksa önce oluşturalım
      kart = await prisma.kart.create({
        data: { kartUid, durum: 'aktif' }
      });
    }

    // Kart yetkilendirme kaydını oluştur
    const yetkilendirme = await prisma.kartYetkilendirme.create({
      data: {
        kartUid: kartUid,
        kullaniciId: kullaniciIdBigInt,
        durum: 'aktif',
        yetkilendiren: adminId ? BigInt(adminId) : null,
        notlar: 'Yönetici Paneli Üzerinden Onaylandı'
      }
    });

    // Kart durumunu aktif ve temiz hale getir
    await prisma.kart.update({
      where: { kartUid },
      data: { durum: 'aktif', iptalNedeni: null }
    });

    console.log(`[KART ONAYLANDI] ${kartUid} UID'li kart, User ID: ${userId} kişisine tanımlandı.`);

    return {
      success: true,
      message: "Kart başarıyla yetkilendirildi ve kullanıcıya atandı.",
      kartUid,
      userId,
      yetkiId: yetkilendirme.kartYetkiId.toString()
    };
  } catch (error) {
    console.error(`[KART ONAYLAMA HATA]`, error.message);
    return {
      success: false,
      message: "Kart onaylanırken bir hata oluştu.",
      error: error.message
    };
  }
}

module.exports = {
  handleUnknownCardScan,
  getPendingCards,
  approveCard
};