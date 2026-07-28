const express = require('express');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const prisma = require('../config/prisma');
const { authenticateToken, JWT_SECRET } = require('../middlewares/authMiddleware');

const router = express.Router();

const serializeUser = (user) => ({
  kullaniciId: user.kullaniciId.toString(),
  ad: user.ad,
  soyad: user.soyad,
  eposta: user.eposta,
  birimId: user.birimId,
  rol: user.rol,
  durum: user.durum
});

router.post('/login', async (req, res) => {
  try {
    const normalizedEmail = String(req.body.eposta || '').trim().toLowerCase();
    const pin = String(req.body.pin || '');

    if (!normalizedEmail || !pin) {
      return res.status(400).json({ message: 'E-posta ve PIN / şifre gereklidir.' });
    }

    const user = await prisma.kullanici.findFirst({
      where: { eposta: { equals: normalizedEmail, mode: 'insensitive' } }
    });

    const credentialHash = user?.sifreHash || user?.pinHash;
    if (!credentialHash) {
      return res.status(401).json({ message: 'Hatalı e-posta veya PIN.' });
    }

    const isMatch = await argon2.verify(credentialHash, pin);

    if (!isMatch) {
      return res.status(401).json({ message: 'Hatalı e-posta veya PIN.' });
    }

    if (user.durum !== 'aktif') {
      return res.status(403).json({ message: 'Kullanıcı hesabı aktif değil.' });
    }

    const token = jwt.sign({
      kullaniciId: user.kullaniciId.toString(),
      eposta: user.eposta,
      rol: user.rol
    }, JWT_SECRET, { expiresIn: '8h' });

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

router.post('/forgot-password', async (req, res) => {
  const normalizedEmail = String(req.body.eposta || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ message: 'E-posta adresi gereklidir.' });
  }

  try {
    const user = await prisma.kullanici.findFirst({
      where: { eposta: { equals: normalizedEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return res.json({ message: 'Hesap bulunursa sıfırlama talimatı oluşturulacaktır.' });
    }

    if (process.env.ALLOW_DEV_PASSWORD_RESET !== 'true') {
      return res.status(503).json({ message: 'Şifre sıfırlama e-posta servisi yapılandırılmamış.' });
    }

    const temporaryPin = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.kullanici.update({
      where: { kullaniciId: user.kullaniciId },
      data: {
        sifreHash: await argon2.hash(temporaryPin),
        sifreGecerlilikBitis: null
      }
    });

    return res.json({
      message: 'Yeni giriş şifresi oluşturuldu.',
      temporaryPin
    });
  } catch (error) {
    console.error('Şifre sıfırlama hatası:', error);
    return res.status(500).json({ message: 'Şifre sıfırlama işlemi tamamlanamadı.' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(req.user.kullaniciId) }
    });

    if (!user || user.durum !== 'aktif') {
      return res.status(401).json({ message: 'Aktif kullanıcı oturumu bulunamadı.' });
    }

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Sunucu hatası.' });
  }
});

router.post('/logout', authenticateToken, (req, res) => {
  return res.json({ message: 'Çıkış yapıldı.' });
});

module.exports = router;
