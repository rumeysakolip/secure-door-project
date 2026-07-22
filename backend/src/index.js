const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Backend çalışıyor!' });
});

app.listen(PORT, () => {
  console.log(`Backend ${PORT} portunda başlatıldı`);
});
