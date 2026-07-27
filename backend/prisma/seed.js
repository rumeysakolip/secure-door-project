const { faker } = require('@faker-js/faker');
const argon2 = require('argon2'); // 1. Argon2 kütüphanesini içeri aktardık

// Uygulamanın kullandığı, driver adapter ile kurulmuş aynı Prisma client'ı
const prisma = require('../src/config/prisma');

async function main() {
  console.log('🌱 Seed script başlıyor...\n');

  // 1. Bölüm oluştur
  const bolum = await prisma.birim.create({
    data: {
      kod: 'CENG',
      ad: 'Bilgisayar Mühendisliği',
      aktif: true,
    },
  });
  console.log('✓ Bölüm oluşturuldu:', bolum.ad);

  // Argon2 ile '123456' şifresini hash'liyoruz
  const hashedPassword = await argon2.hash('123456');

  // 2. Hocalar oluştur (12 tane)
  const hocalar = [];

  // Sabit Giriş Kullanıcısı (Ahmet)
  const ahmet = await prisma.kullanici.create({
    data: {
      ad: 'Ahmet',
      soyad: 'Yılmaz',
      eposta: 'ahmet@subu.edu.tr',
      pinHash: hashedPassword, // Hashlenmiş şifreyi verdik
      birimId: bolum.birimId,
      durum: 'aktif',
      rol: 'hoca',
    },
  });
  hocalar.push(ahmet);

  // Geri kalan 11 rastgele hoca
  for (let i = 0; i < 11; i++) {
    const hoca = await prisma.kullanici.create({
      data: {
        ad: faker.person.firstName('male'),
        soyad: faker.person.lastName(),
        eposta: faker.internet.email(),
        pinHash: hashedPassword, // Hashlenmiş şifreyi verdik
        birimId: bolum.birimId,
        durum: 'aktif',
        rol: 'hoca',
      },
    });
    hocalar.push(hoca);
  }
  console.log(`✓ ${hocalar.length} hoca oluşturuldu`);

  // 3. Kartlar oluştur (12 tane - her hocaya 1)
  const kartlar = [];
  for (let i = 0; i < 12; i++) {
    const kart = await prisma.kart.create({
      data: {
        kartUid: `A${i}:B${i}:C${i}:D${i}`,
        durum: 'aktif',
      },
    });
    kartlar.push(kart);
  }
  console.log(`✓ ${kartlar.length} kart oluşturuldu`);

  // 4. Kartları hocalara yetkilendir
  for (let i = 0; i < kartlar.length; i++) {
    await prisma.kartYetkilendirme.create({
      data: {
        kartUid: kartlar[i].kartUid,
        kullaniciId: hocalar[i].kullaniciId,
        birimId: bolum.birimId,
        durum: 'aktif',
        yetkilendirilmeTarihi: faker.date.past(),
        notlar: 'Seed ile oluşturuldu',
      },
    });
  }
  console.log(`✓ Kartlar hocalara yetkilendirildi`);

  // 5. Kapı oluştur (1 tane)
  const kapi = await prisma.kapi.create({
    data: {
      ad: 'Laboratuvar Kapısı',
      bina: 'A',
      kat: 2,
      aciklama: 'Bilgisayar Lab',
      durum: 'aktif',
    },
  });
  console.log('✓ Kapı oluşturuldu:', kapi.ad);

  // 6. Cihaz oluştur (1 ESP32)
  const cihaz = await prisma.cihaz.create({
    data: {
      seriNo: 'ESP32-LAB-001',
      durum: 'aktif',
    },
  });
  console.log('✓ Cihaz oluşturuldu:', cihaz.seriNo);

  // 7. Cihaz-Kapı Atama
  await prisma.cihazKapiAtama.create({
    data: {
      cihazId: cihaz.cihazId,
      kapiId: kapi.kapiId,
      baslangic: new Date(),
    },
  });
  console.log('✓ ESP32 → Kapı atandı');

  // 8. Cihaz Durumu
  await prisma.cihazDurumu.create({
    data: {
      cihazId: cihaz.cihazId,
      kapiDurumu: 'kapali',
      cihazDurumTip: 'cevrimici',
      bataryaSeviyesi: 85,
      wifiSignali: -55,
      firmwareVersiyon: '1.0.0',
      sonHeartbeat: new Date(),
    },
  });
  console.log('✓ Cihaz durumu kaydedildi');

  // 9. Erişim Kayıtları oluştur (20 giriş/çıkış kaydı)
  for (let i = 0; i < 20; i++) {
    const hoca = hocalar[Math.floor(Math.random() * hocalar.length)];
    const kart = kartlar[Math.floor(Math.random() * kartlar.length)];
    const olayTamani = faker.date.recent({ days: 7 });

    await prisma.erisimKaydi.create({
      data: {
        kayitId: BigInt(i + 1),
        cihazOlayId: faker.string.uuid(),
        cihazId: cihaz.cihazId,
        kapiId: kapi.kapiId,
        kullaniciId: hoca.kullaniciId,
        kartId: kart.kartId,
        okunanUid: kart.kartUid,
        dogrulamaYontemi: 'kart',
        sonuc: 'izin',
        olayTamani: olayTamani,
      },
    });
  }
  console.log('✓ 20 erişim kaydı oluşturuldu');

  console.log('\n✅ Seed tamamlandı!\n');
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });