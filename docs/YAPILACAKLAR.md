# SecureDoor - Yapılacaklar Listesi

Kod incelemesine dayalı eksiklik listesi. Öncelik sırasına göre bölümlere ayrılmıştır.

## Bölüm 1 — Backend'i Ayağa Kaldırma (Blocker, önce bunlar)

- [x] `backend/src/routes/kullanicilar.js`: dosyada `const router = express.Router()` ve `module.exports = router` iki kez tanımlanmıştı (SyntaxError veriyordu, backend hiç başlamıyordu). Tek `router` tanımı ve tek `module.exports` kalacak şekilde birleştirildi.
- [x] `backend/src/index.js`: dosya sonundaki merge artığı (ikinci `app.listen(...)`, sıraya girmiş `passwordService` require'ı) temizlendi; `passwordService.initCron()` dosyanın başına, diğer cron init'lerinin yanına taşındı.
- [x] `backend/package.json`: `pinService.js`'in kullandığı `bcrypt` paketi `dependencies`'e hiç eklenmemişti — eklendi.
- [x] `backend/src/services/passwordService.js`: kendi başına adapter'sız `new PrismaClient()` oluşturuyordu (Prisma 7 adapter zorunlu kılıyor, `PrismaClientInitializationError` veriyordu) — paylaşılan `../config/prisma` client'ını kullanacak şekilde düzeltildi.
- [x] `backend/src/services/ihlalService.js`: `ihlalCron.js`'in import ettiği bu dosya hiç yoktu (`MODULE_NOT_FOUND`) — oluşturuldu. Şu an tespit ettiği ihlal türü: iptal/kayıp durumundaki bir kartla yapılan ve reddedilen erişim denemesi (mevcut şemayla gerçekten tespit edilebilen tek ihlal türü bu). "Çıkış kaçırma" türü şemada giriş/çıkış yönünü belirten bir alan olmadığı için eklenmedi — bkz. Bölüm 8.
- [x] Temizlik sonrası `docker compose up --build` ile backend'in gerçekten ayağa kalktığı doğrulandı (`🚀 Backend sunucusu 3000 portunda başlatıldı.`, `curl http://localhost:3000/` ve `curl http://localhost:3000/api/kullanicilar` başarılı 200 döndü).

## Bölüm 2 — Kimlik Doğrulama (Auth)

- [ ] Backend'e `/api/auth/login` (ve gerekirse `/logout`, `/me`) endpoint'i ekle.
- [ ] Şifre/PIN doğrulama + oturum yönetimi (JWT ya da session) kur.
- [ ] Admin'e özel route'ları (kullanıcı/kart/kapı yönetimi vb.) auth middleware ile koru.
- [ ] `frontend/login.html`'i gerçek login endpoint'ine bağla, token/session saklama akışını ekle.

## Bölüm 3 — Eksik CRUD Endpoint'leri

Şu an tüm route'lar sadece `GET`. Eklenmesi gerekenler:

- [ ] Kullanıcılar: `POST` (yeni hoca/admin ekle), `PUT/PATCH` (bilgi güncelle, durum aktif/pasif/askıya al), `DELETE`.
- [ ] Kartlar: `POST` (yeni kart tanımla), `PUT/PATCH` (durum değiştir: kayıp/iptal/hasarlı), `DELETE`.
- [ ] Kart Yetkilendirmeler: `POST` (kart-kullanıcı eşleştir), `PUT/PATCH` (yetki iptal/pasif et).
- [ ] Kapılar / Cihazlar / Cihaz-Kapı Atama: `POST`/`PUT`/`DELETE` (yeni kapı/cihaz ekleme, atama yapma).
- [ ] Gruplar: `POST`/`PUT`/`DELETE` (grup oluştur, üye ekle/çıkar).
- [ ] Yetki Kuralları (`YetkiKurali` modeli için hiç route yok): gün/saat bazlı erişim kuralı CRUD.
- [ ] İhlal Kayıtları: `POST` (manuel ihlal kaydı açma) — şu an sadece listeleme var.

## Bölüm 4 — Bağlanmamış Servisleri Devreye Alma

- [ ] `issueReportService.js` (arıza bildirimi): bellek içi diziyi (`issueReportsQueue`) kaldır, Prisma'daki `ArizaBildirimi` modeline bağla; `backend/src/routes/arizalar.js` diye yeni bir route dosyası oluşturup `index.js`'e ekle (`POST /api/arizalar`, `GET /api/arizalar`, `PATCH /api/arizalar/:id`).
- [ ] `remoteDoorService.js` (uzaktan kapı açma): TODO'daki DB log kaydını ve MQTT publish (`securedoor/commands`) entegrasyonunu tamamla, bir route üzerinden erişilebilir yap.
- [ ] `cardApprovalService.js` (kart onay akışı): TODO'daki Prisma entegrasyonunu tamamla (kart-kullanıcı atamasını DB'ye yaz), bir route üzerinden erişilebilir yap.

## Bölüm 5 — Frontend Entegrasyonu

Şu an sadece `index.html` backend'e bağlı (yalnızca health-check). Sırayla:

- [ ] `login.html` → Bölüm 2'deki auth endpoint'ine bağla.
- [ ] `admin.html` → kullanıcı/kart/kapı listeleme ve yönetim ekranlarını gerçek API'ye bağla.
- [ ] `yetkilendirme.html` → kart yetkilendirme CRUD'una bağla.
- [ ] `ariza-bildir.html` / `ariza-gecmisi.html` → arıza bildirimi API'sine bağla (Bölüm 4).
- [ ] `gecici-sifre.html` → PIN/şifre yenileme akışına (`pinService`/`passwordService`) bağla.
- [ ] `gecmis-girisler.html` → `erisim-kayitlari` endpoint'ine bağla.

## Bölüm 6 — Güvenlik / Konfigürasyon

- [ ] `esp32-kodlar/include/config.h` içindeki gerçek Wi-Fi şifresi ve MQTT broker IP'sini repodan çıkar; `.gitignore`'a ekle, yerine örnek/placeholder değerler içeren bir `config.example.h` koy.
- [ ] Proje köküne `.env.example` ekle (README bunu referans alıyor ama dosya yok).
- [ ] Auth eklendikten sonra tüm admin endpoint'lerinin yetkisiz erişime kapalı olduğunu doğrula.

## Bölüm 7 — Test ve Doğrulama

- [ ] Backend için temel entegrasyon testleri (en azından auth + CRUD endpoint'leri) ekle — `esp32-kodlar/test` ve backend'de şu an hiç test yok.
- [ ] `docker-compose.yml`'e backend ve frontend servisleri için healthcheck ekle (şu an sadece db'de var).
- [ ] Uçtan uca senaryo testi: kart okut → erişim kaydı oluşsun → admin panelde görünsün.

## Bölüm 8 — Bölüm 1 Sırasında Fark Edilen Ek Konular

- [ ] `backend/src/services/mqttService.js`: container loglarında sürekli `[MQTT] Bağlantı hatası: connect ECONNREFUSED 127.0.0.1:1883` tekrarlanıyor. `docker-compose.yml`'de backend'e `MQTT_BROKER_HOST=mqtt` / `MQTT_BROKER_PORT=1883` env değişkenleri veriliyor ama servis muhtemelen bunları okumak yerine `localhost`/`127.0.0.1`'e sabit bağlanmaya çalışıyor. `mqttService.js` içindeki bağlantı adresini `process.env.MQTT_BROKER_HOST`/`MQTT_BROKER_PORT`'u kullanacak şekilde düzeltmek gerekiyor.
- [ ] "Çıkış kaçırma" ihlal türünü tespit edebilmek için `ErisimKaydi` şemasına giriş/çıkış yönünü belirten bir alan (örn. `yon: giris | cikis`) ekleyen yeni bir migration yazılmalı; bu olmadan `ihlalService.js` bu türü tespit edemez.

---
Öncelik sırası: Bölüm 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.
