const express = require('express');
const cors = require('cors');

// BigInt dönüşümü (res.json serialization çözümü)
BigInt.prototype.toJSON = function () {
    return this.toString();
};

// Rotaları içe aktarma
// 'middlewares' (sonunda 's' var) olarak değiştirin:
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
const yetkiKuraliRotalari = require('./routes/yetkiKurallari');
const authRotalari = require('./routes/authRoutes');
const firmwareRotalari = require('./routes/firmware');

const arizaRotalari = require('./routes/arizalar');

const app = express();
const PORT = process.env.PORT || 3000;
const mqttService = require('./services/mqttService');
const { initSifreCron } = require('./cron/sifreCron');
const { initIhlalCron } = require('./cron/ihlalCron');

// Middleware'ler
app.use(express.json({ limit: '5mb' }));
app.use(cors({
    origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
        : true
}));

// Healthcheck Route
app.get('/', (req, res) => {
    res.json({ message: 'Backend, Prisma ORM ve PostgreSQL veritabanı ile aktif olarak çalışıyor!' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'API çalışıyor.' });
});

// Auth Endpoint'leri (giriş yapma / token alma herkese açık)
app.use('/api/auth', authRotalari);
app.use('/api/firmware', firmwareRotalari);

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
app.use('/api/yetki-kurallari', yetkiKuraliRotalari);

app.use('/api/arizalar', arizaRotalari);

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
    res.status(err.statusCode || err.status || 500).json({
        success: false,
        error: 'Sunucu tarafında bir hata oluştu.',
        message: err.message
    });
});

// -------------------------------------------------------------
if (require.main === module) {
    mqttService.connect();
    initSifreCron();
    initIhlalCron();

    app.listen(PORT, () => {
        console.log(`🚀 Backend sunucusu ${PORT} portunda başlatıldı.`);
    });
}

module.exports = app;
