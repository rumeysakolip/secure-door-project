const express = require('express');
const cors = require('cors');

// BigInt dönüşümü (res.json serialization çözümü)
BigInt.prototype.toJSON = function () {
    return this.toString();
};

// Rotaları içe aktarma
const birimRotalari = require('./routes/birimler');
const kullaniciRotalari = require('./routes/kullanicilar');
const kartRotalari = require('./routes/kartlar');
const kartYetkilendirmeRotalari = require('./routes/kartYetkilendirmeler');
const kapiRotalari = require('./routes/kapilar');
const cihazRotalari = require('./routes/cihazlar');
const cihazKapiAtamaRotalari = require('./routes/cihazKapiAtama');
const cihazDurumuRotalari = require('./routes/cihazDurumlari');
const erisimKaydiRotalari = require('./routes/erisimKayitlari');
const ihlalKaydiRotalari = require('./routes/ihlalKayitlari');
const grupRotalari = require('./routes/gruplar');

const app = express();
const PORT = process.env.PORT || 3000;
const mqttService = require('./services/mqttService');
const { initSifreCron } = require('./cron/sifreCron');
const { initIhlalCron } = require('./cron/ihlalCron');

// Cron zamanlayıcılarını başlat
mqttService.connect();
initSifreCron();
initIhlalCron();


// Middleware'ler
app.use(express.json());
app.use(cors());

// Healthcheck Route
app.get('/', (req, res) => {
    res.json({ message: 'Backend, Prisma ORM ve PostgreSQL veritabanı ile aktif olarak çalışıyor!' });
});

// Endpoint Bağlantıları
app.use('/api/birimler', birimRotalari);
app.use('/api/kullanicilar', kullaniciRotalari);
app.use('/api/kartlar', kartRotalari);
app.use('/api/kart-yetkilendirmeler', kartYetkilendirmeRotalari);
app.use('/api/kapilar', kapiRotalari);
app.use('/api/cihazlar', cihazRotalari);
app.use('/api/cihaz-kapi-atamalar', cihazKapiAtamaRotalari);
app.use('/api/cihaz-durumlari', cihazDurumuRotalari);
app.use('/api/erisim-kayitlari', erisimKaydiRotalari);
app.use('/api/ihlal-kayitlari', ihlalKaydiRotalari);
app.use('/api/gruplar', grupRotalari);

// -------------------------------------------------------------
// EKLEYEBİLECEĞİN YERLER: (Rotalar bittikten sonra)
// -------------------------------------------------------------

// 1. Tanımsız Rota (404) Yakalayıcı
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'İstenen endpoint bulunamadı.' });
});

// 2. Global Hata (500) Yakalayıcı
app.use((err, req, res, next) => {
    console.error('❌ Beklenmeyen Sunucu Hatası:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Sunucu tarafında bir hata oluştu.',
        message: err.message
    });
});

// -------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`🚀 Backend sunucusu ${PORT} portunda başlatıldı.`);
});
const passwordService = require('./services/passwordService');


   app.listen(PORT, () => {
     console.log(`Sunucu ${PORT} portunda çalışıyor.`);
     mqttService.connect();
     passwordService.initCron();

   });
const express = require('express');
const cors = require('cors');

// Auth Route ve Middleware İçe Aktarmaları
const authRoutes = require('./routes/authRoutes');
const { authenticateToken, requireAdmin } = require('./middlewares/authMiddleware');

const app = express();

// Body Parser ve CORS
app.use(express.json());
app.use(cors());

// 1. Auth Endpoint'lerini Tanımla (Giriş yapma / Token alma herkese açık)
app.use('/api/auth', authRoutes);

// 2. Korumak İstediğin Admin Route'ları Varsa (Örnek Kullanım):
// app.use('/api/kullanicilar', authenticateToken, requireAdmin, kullaniciRoutes);
// app.use('/api/kapilar', authenticateToken, requireAdmin, kapiRoutes);
// app.use('/api/kartlar', authenticateToken, requireAdmin, kartRoutes);

// Test Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API çalışıyor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});