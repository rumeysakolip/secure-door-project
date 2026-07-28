const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const prisma = require('../config/prisma');
const { authenticateToken, JWT_SECRET } = require('../middlewares/authMiddleware');

// BigInt veritabanı ID'lerini JSON uyumlu hale getiren yardımcı fonksiyon
const serializeUser = (user) => {
  return {
    kullaniciId: user.kullaniciId.toString(),
    ad: user.ad,
    soyad: user.soyad,
    eposta: user.eposta,
    rol: user.rol,
    durum: user.durum
  };
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { eposta, pin } = req.body;

    if (!eposta || !pin) {
      return res.status(400).json({ message: 'E-posta ve PIN / Şifre gereklidir.' });
    }

    // Kullanıcıyı veritabanında bul
    const user = await prisma.kullanici.findFirst({
      where: { eposta: eposta }
    });

    if (!user || !user.pinHash) {
      return res.status(401).json({ message: 'Hatalı e-posta veya PIN.' });
    }

    // PIN / Şifre doğrula
    const isMatch = await argon2.verify(user.pinHash, pin);
    if (!isMatch) {
      return res.status(401).json({ message: 'Hatalı e-posta veya PIN.' });
    }

    if (user.durum !== 'aktif') {
      return res.status(403).json({ message: 'Kullanıcı hesabı aktif değil.' });
    }

    // JWT token üret
    const payload = {
      kullaniciId: user.kullaniciId.toString(),
      eposta: user.eposta,
      rol: user.rol
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      message: 'Giriş başarılı',
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error('Login hatası:', error);
    return res.status(500).json({ message: 'Sunucu hatası oluştu.' });
  }
});

// GET /api/auth/me (Oturumu açık kullanıcının bilgilerini döner)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(req.user.kullaniciId) }
    });

    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
    }

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  return res.json({ message: 'Çıkış yapıldı.' });
});

module.exports = router;