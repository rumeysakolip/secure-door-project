const argon2 = require('argon2');
const crypto = require('crypto');
const prisma = require('../src/config/prisma');

async function ensureUser({ ad, soyad, eposta, rol, birimId, password }) {
  const existing = await prisma.kullanici.findFirst({
    where: { eposta: { equals: eposta, mode: 'insensitive' } }
  });
  const passwordHash = await argon2.hash(password);

  if (existing) {
    return prisma.kullanici.update({
      where: { kullaniciId: existing.kullaniciId },
      data: {
        ad,
        soyad,
        eposta,
        rol,
        birimId,
        durum: 'aktif',
        ...(existing.sifreHash ? {} : { sifreHash: existing.pinHash || passwordHash }),
        ...(existing.pinHash ? {} : { pinHash: passwordHash })
      }
    });
  }

  return prisma.kullanici.create({
    data: {
      ad,
      soyad,
      eposta,
      rol,
      birimId,
      durum: 'aktif',
      sifreHash: passwordHash,
      pinHash: passwordHash,
      pinSonDegisim: new Date()
    }
  });
}

async function main() {
  const birim = await prisma.birim.upsert({
    where: { kod: 'CENG' },
    update: { ad: 'Bilgisayar Mühendisliği', aktif: true },
    create: { kod: 'CENG', ad: 'Bilgisayar Mühendisliği', aktif: true }
  });

  const admin = await ensureUser({
    ad: 'Sistem',
    soyad: 'Yöneticisi',
    eposta: 'admin@subu.edu.tr',
    rol: 'admin',
    birimId: birim.birimId,
    password: process.env.SEED_ADMIN_PASSWORD || '123456'
  });

  const hoca = await ensureUser({
    ad: 'Ahmet',
    soyad: 'Yılmaz',
    eposta: 'ahmet@subu.edu.tr',
    rol: 'hoca',
    birimId: birim.birimId,
    password: process.env.SEED_TEACHER_PASSWORD || '123456'
  });

  const kapi = await prisma.kapi.findFirst({ where: { ad: 'Laboratuvar Kapısı' } })
    || await prisma.kapi.create({
      data: {
        ad: 'Laboratuvar Kapısı',
        bina: 'A',
        kat: 2,
        aciklama: 'Bilgisayar Laboratuvarı',
        durum: 'aktif'
      }
    });

  const cihaz = await prisma.cihaz.upsert({
    where: { seriNo: 'ESP32-LAB-001' },
    update: { durum: 'aktif' },
    create: { seriNo: 'ESP32-LAB-001', durum: 'aktif' }
  });

  const atama = await prisma.cihazKapiAtama.findFirst({
    where: { cihazId: cihaz.cihazId, kapiId: kapi.kapiId, bitis: null }
  });
  if (!atama) {
    await prisma.cihazKapiAtama.create({
      data: { cihazId: cihaz.cihazId, kapiId: kapi.kapiId }
    });
  }

  const durumSayisi = await prisma.cihazDurumu.count({ where: { cihazId: cihaz.cihazId } });
  if (!durumSayisi) {
    await prisma.cihazDurumu.create({
      data: {
        cihazId: cihaz.cihazId,
        kapiDurumu: 'kapali',
        cihazDurumTip: 'cevrimdisi',
        firmwareVersiyon: '1.0.0',
        sonHeartbeat: new Date()
      }
    });
  }

  const kart = await prisma.kart.upsert({
    where: { kartUid: 'A0:B0:C0:D0' },
    update: {},
    create: { kartUid: 'A0:B0:C0:D0', durum: 'aktif' }
  });

  const kartYetkisi = await prisma.kartYetkilendirme.findUnique({
    where: { kartUid: kart.kartUid }
  });
  if (!kartYetkisi) {
    await prisma.kartYetkilendirme.create({
      data: {
        kartUid: kart.kartUid,
        kullaniciId: hoca.kullaniciId,
        birimId: birim.birimId,
        yetkilendiren: admin.kullaniciId,
        durum: 'aktif',
        notlar: 'Başlangıç verisi'
      }
    });
  }

  const accessCount = await prisma.erisimKaydi.count();
  if (!accessCount) {
    await prisma.erisimKaydi.create({
      data: {
        kayitId: 1n,
        cihazOlayId: crypto.randomUUID(),
        cihazId: cihaz.cihazId,
        kapiId: kapi.kapiId,
        kullaniciId: hoca.kullaniciId,
        kartId: kart.kartId,
        okunanUid: kart.kartUid,
        dogrulamaYontemi: 'kart',
        sonuc: 'izin',
        olayTamani: new Date()
      }
    });
  }

  console.log('Başlangıç verileri hazır.');
  console.log('Yönetici: admin@subu.edu.tr');
  console.log('Öğretim görevlisi: ahmet@subu.edu.tr');
}

main()
  .catch((error) => {
    console.error('Seed hatası:', error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
