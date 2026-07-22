const express = require('express');
const kullaniciRotalari = require('./routes/kullanicilar');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Ana sayfa testi
app.get('/', (req, res) => {
  res.json({ message: 'Backend çalışıyor!' });
});

// Kullanıcı rotasını sisteme tanıtıyoruz
app.use('/api/kullanicilar', kullaniciRotalari);

// Sunucuyu başlatıyoruz
app.listen(PORT, () => {
  console.log(`Backend ${PORT} portunda başlatıldı`);
});