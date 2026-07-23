const express = require('express');
const cors = require('cors');

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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware'ler
app.use(express.json());
app.use(cors());

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

app.get('/', (req, res) => {
    res.json({ message: 'Backend tüm tablolara uygun mock API ile çalışıyor!' });
});

app.listen(PORT, () => {
    console.log(`Backend sunucusu ${PORT} portunda başlatıldı.`);
});