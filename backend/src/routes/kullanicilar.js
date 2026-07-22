const express = require('express');
const router = express.Router();

// Test kullanıcı verilerimiz
router.get('/', (req, res) => {
  res.json([
    { id: 1, ad: 'Ahmet', rol: 'Admin' },
    { id: 2, ad: 'Ayşe', rol: 'Kullanıcı' }
  ]);
});

// Bu dosyayı index.js'in okuyabilmesi için dışa aktarıyoruz
module.exports = router;