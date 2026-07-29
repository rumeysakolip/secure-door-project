const express = require('express');
const argon2 = require('argon2');
const prisma = require('../config/prisma');
const { authenticateDevice } = require('../middlewares/authMiddleware');
const cardApprovalService = require('../services/cardApprovalService');

const router = express.Router();
router.use(authenticateDevice);

function parsePositiveInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function resolveDoor(cihazId, requestedDoorId) {
  const atama = await prisma.cihazKapiAtama.findFirst({
    where: {
      cihazId,
      bitis: null,
      ...(requestedDoorId ? { kapiId: requestedDoorId } : {})
    },
    include: { kapi: true }
  });

  return atama?.kapi || null;
}

function ruleMatchesNow(rule, now = new Date()) {
  const jsDay = now.getDay();
  const dayMask = jsDay === 0 ? 64 : 2 ** (jsDay - 1);
  if ((rule.gunMaskesi & dayMask) === 0) return false;

  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (rule.saatBaslangic <= rule.saatBitis) {
    return currentTime >= rule.saatBaslangic && currentTime <= rule.saatBitis;
  }

  return currentTime >= rule.saatBaslangic || currentTime <= rule.saatBitis;
}

async function userCanAccessDoor(kullaniciId, kapiId) {
  const doorRules = await prisma.yetkiKurali.findMany({
    where: { kapiId, aktif: true },
    select: {
      kullaniciId: true,
      grupId: true,
      gunMaskesi: true,
      saatBaslangic: true,
      saatBitis: true
    }
  });

  if (doorRules.length === 0) return true;

  const groupIds = doorRules
    .map((rule) => rule.grupId)
    .filter((groupId) => groupId !== null);
  const memberships = groupIds.length
    ? await prisma.kullaniciGrup.findMany({
        where: { kullaniciId, grupId: { in: groupIds } },
        select: { grupId: true }
      })
    : [];
  const userGroupIds = new Set(memberships.map((membership) => membership.grupId));

  return doorRules.some((rule) => (
    (rule.kullaniciId === kullaniciId || (rule.grupId !== null && userGroupIds.has(rule.grupId)))
    && ruleMatchesNow(rule)
  ));
}

router.post('/verify-card', async (req, res) => {
  const kartUid = String(req.body.card_uid || req.body.kartUid || '').trim();
  const cihazId = parsePositiveInt(req.body.cihaz_id || req.body.cihazId);
  const requestedDoorId = parsePositiveInt(req.body.kapi_id || req.body.kapiId);

  if (!kartUid || !cihazId) {
    return res.status(400).json({ success: false, allowed: false, message: 'card_uid ve cihaz_id zorunludur.' });
  }

  try {
    const kapi = await resolveDoor(cihazId, requestedDoorId);
    if (!kapi || kapi.durum !== 'aktif') {
      return res.status(400).json({ success: false, allowed: false, message: 'Cihaza atanmış aktif kapı bulunamadı.' });
    }

    const kart = await prisma.kart.findUnique({
      where: { kartUid },
      include: {
        kartYetkilendirmeler: {
          where: { durum: 'aktif' },
          include: { kullanici: true }
        }
      }
    });
    const yetki = kart?.kartYetkilendirmeler?.[0];
    const identityAllowed = kart?.durum === 'aktif' && yetki?.kullanici?.durum === 'aktif';
    const doorAllowed = identityAllowed
      ? await userCanAccessDoor(yetki.kullaniciId, kapi.kapiId)
      : false;
    const allowed = identityAllowed && doorAllowed;
    const redNedeni = allowed
      ? null
      : !kart ? 'tanimsiz_kart'
        : kart.durum !== 'aktif' ? 'kart_aktif_degil'
          : !doorAllowed ? 'kapi_yetkisi_yok'
            : 'yetkilendirilmemis';

    const isRejectedRequest = kart?.durum === 'iptal'
      && kart?.iptalNedeni === 'Yetkilendirme isteği reddedildi';
    if (!kart || isRejectedRequest) {
      await cardApprovalService.handleUnknownCardScan(kartUid);
    }

    return res.status(allowed ? 200 : 403).json({
      success: allowed,
      allowed,
      kullaniciId: yetki?.kullaniciId?.toString() || null,
      message: allowed ? 'Erişim onaylandı.' : 'Erişim reddedildi.',
      reason: redNedeni
    });
  } catch (error) {
    console.error('Kart doğrulama hatası:', error);
    return res.status(500).json({ success: false, allowed: false, message: 'Kart doğrulanamadı.' });
  }
});

router.post('/verify-pin', async (req, res) => {
  const pin = String(req.body.pin || '').trim();
  const cihazId = parsePositiveInt(req.body.cihaz_id || req.body.cihazId);
  const requestedDoorId = parsePositiveInt(req.body.kapi_id || req.body.kapiId);

  if (!/^\d{4,16}$/.test(pin) || !cihazId) {
    return res.status(400).json({ success: false, allowed: false, message: 'Geçerli PIN ve cihaz_id zorunludur.' });
  }

  try {
    const kapi = await resolveDoor(cihazId, requestedDoorId);
    if (!kapi || kapi.durum !== 'aktif') {
      return res.status(400).json({ success: false, allowed: false, message: 'Cihaza atanmış aktif kapı bulunamadı.' });
    }

    const users = await prisma.kullanici.findMany({
      where: {
        durum: 'aktif',
        pinHash: { not: null },
        OR: [
          { pinGecerlilikBitis: null },
          { pinGecerlilikBitis: { gt: new Date() } }
        ]
      },
      select: { kullaniciId: true, pinHash: true }
    });

    let matchedUser = null;
    for (const user of users) {
      if (await argon2.verify(user.pinHash, pin)) {
        matchedUser = user;
        break;
      }
    }

    const doorAllowed = matchedUser
      ? await userCanAccessDoor(matchedUser.kullaniciId, kapi.kapiId)
      : false;
    const allowed = Boolean(matchedUser && doorAllowed);

    return res.status(allowed ? 200 : 403).json({
      success: allowed,
      allowed,
      kullaniciId: matchedUser?.kullaniciId?.toString() || null,
      message: allowed ? 'Erişim onaylandı.' : 'Erişim reddedildi.',
      reason: allowed ? null : matchedUser ? 'kapi_yetkisi_yok' : 'gecersiz_pin'
    });
  } catch (error) {
    console.error('PIN doğrulama hatası:', error);
    return res.status(500).json({ success: false, allowed: false, message: 'PIN doğrulanamadı.' });
  }
});

module.exports = router;
