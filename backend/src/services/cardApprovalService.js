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
          durum: 'onay_bekliyor',
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
    // Kartın gerçek durumuna göre bekleyenleri getir. Yarım kalmış eski
    // yetkilendirme kayıtları kartın listeden kaybolmasına neden olmamalı.
    const pendingCards = await prisma.kart.findMany({
      where: {
        durum: 'onay_bekliyor'
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
    const normalizedKartUid = String(kartUid).trim().toUpperCase();
    const kullaniciIdBigInt = BigInt(userId);
    const adminIdBigInt = adminId ? BigInt(adminId) : null;

    const kullanici = await prisma.kullanici.findUnique({
      where: { kullaniciId: kullaniciIdBigInt },
      select: { kullaniciId: true, birimId: true, durum: true }
    });

    if (!kullanici || kullanici.durum !== 'aktif') {
      return {
        success: false,
        message: 'Kart yalnızca aktif bir kullanıcıya atanabilir.'
      };
    }

    // Kart durumu ile kullanıcı yetkisini tek transaction içinde güncelle.
    // Böylece aynı kart tekrar onaylandığında duplicate hatası oluşmaz ve
    // "yetki aktif / kart onay bekliyor" şeklinde yarım kayıt kalmaz.
    const yetkilendirme = await prisma.$transaction(async (tx) => {
      await tx.kart.upsert({
        where: { kartUid: normalizedKartUid },
        update: {
          durum: 'aktif',
          iptalTarihi: null,
          iptalNedeni: null
        },
        create: {
          kartUid: normalizedKartUid,
          durum: 'aktif'
        }
      });

      return tx.kartYetkilendirme.upsert({
        where: { kartUid: normalizedKartUid },
        update: {
          kullaniciId: kullaniciIdBigInt,
          birimId: kullanici.birimId,
          durum: 'aktif',
          yetkilendiren: adminIdBigInt,
          yetkilendirilmeTarihi: new Date(),
          notlar: 'Yönetici Paneli Üzerinden Onaylandı'
        },
        create: {
          kartUid: normalizedKartUid,
          kullaniciId: kullaniciIdBigInt,
          birimId: kullanici.birimId,
          durum: 'aktif',
          yetkilendiren: adminIdBigInt,
          notlar: 'Yönetici Paneli Üzerinden Onaylandı'
        }
      });
    });

    console.log(`[KART ONAYLANDI] ${normalizedKartUid} UID'li kart, User ID: ${userId} kişisine tanımlandı.`);

    return {
      success: true,
      message: "Kart başarıyla yetkilendirildi ve kullanıcıya atandı.",
      kartUid: normalizedKartUid,
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
