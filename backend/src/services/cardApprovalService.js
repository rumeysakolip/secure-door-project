// backend/src/services/cardApprovalService.js

// Geçici hafıza (Prisma DB bağlanana kadar bekleyen kartları tutar)
let pendingCardsQueue = [];

/**
 * 1. ESP32'den bilinmeyen/tanımsız bir kart ID geldiğinde çalışır.
 * Kartı "Onay Bekleyenler" listesine ekler.
 */
function handleUnknownCardScan(cardUid) {
  const existingIndex = pendingCardsQueue.findIndex(item => item.cardUid === cardUid);

  const scannedEvent = {
    cardUid,
    scannedAt: new Date(),
    status: "PENDING_APPROVAL"
  };

  if (existingIndex !== -1) {
    // Kart zaten listedeyse son okunma zamanını güncelle
    pendingCardsQueue[existingIndex] = scannedEvent;
    console.log(`[KART UYARI] Tanımsız kart tekrar okutuldu: ${cardUid}`);
  } else {
    pendingCardsQueue.push(scannedEvent);
    console.log(`[YENİ KART] Onay bekleyen yeni kart eklendi: ${cardUid}`);
  }

  return {
    success: false,
    message: "Kartınız sisteme kayıtlı değil. Onay isteği yöneticiye iletildi.",
    cardUid
  };
}

/**
 * 2. Yöneticinin panelde onay bekleyen kartları listelemesini sağlar.
 */
function getPendingCards() {
  return pendingCardsQueue;
}

/**
 * 3. Yönetici kartı bir kullanıcıya (userId) atayıp onayladığında çalışır.
 */
async function approveCard(cardUid, userId) {
  // Kartı onay bekleyenler listesinden çıkar
  pendingCardsQueue = pendingCardsQueue.filter(item => item.cardUid !== cardUid);

  // TODO: Prisma DB entegrasyonu sağlandığında karta kullanıcı atanıp DB'ye yazılacak:
  // await prisma.card.create({ data: { uid: cardUid, userId: userId, status: "ACTIVE" } });

  console.log(`[KART ONAYLANDI] ${cardUid} UID'li kart, User ID: ${userId} kişisine tanımlandı.`);

  return {
    success: true,
    message: "Kart başarıyla yetkilendirildi ve kullanıcıya atandı.",
    cardUid,
    userId
  };
}

module.exports = {
  handleUnknownCardScan,
  getPendingCards,
  approveCard
};