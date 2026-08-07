const express = require('express');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const prisma = require('../config/prisma');
const { authenticateToken, JWT_SECRET } = require('../middlewares/authMiddleware');
const {
  validateWebPassword,
  generateTemporaryWebPassword
} = require('../services/webPasswordService');

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

    const temporaryPassword = generateTemporaryWebPassword();
    await prisma.kullanici.update({
      where: { kullaniciId: user.kullaniciId },
      data: {
        sifreHash: await argon2.hash(temporaryPassword),
        sifreGecerlilikBitis: null
      }
    });

    return res.json({
      message: 'Yeni geçici web giriş şifresi oluşturuldu.',
      temporaryPassword
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

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const currentPassword = String(req.body.mevcutSifre || '');
    const newPassword = String(req.body.yeniSifre || '');
    const confirmation = String(req.body.yeniSifreTekrar || '');
    if (!currentPassword || !newPassword || !confirmation) {
      return res.status(400).json({ message: 'Mevcut şifre, yeni şifre ve şifre tekrarı gereklidir.' });
    }
    if (newPassword !== confirmation) {
      return res.status(400).json({ message: 'Yeni şifre ile şifre tekrarı eşleşmiyor.' });
    }
    const validation = validateWebPassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(req.user.kullaniciId) }
    });
    const credentialHash = user?.sifreHash || user?.pinHash;
    if (!user || !credentialHash || !(await argon2.verify(credentialHash, currentPassword))) {
      return res.status(401).json({ message: 'Mevcut web şifresi hatalı.' });
    }
    if (await argon2.verify(credentialHash, newPassword)) {
      return res.status(400).json({ message: 'Yeni şifre mevcut şifreyle aynı olamaz.' });
    }

    await prisma.kullanici.update({
      where: { kullaniciId: user.kullaniciId },
      data: {
        sifreHash: await argon2.hash(newPassword),
        sifreGecerlilikBitis: null
      }
    });
    return res.json({ message: 'Web arayüzü şifreniz başarıyla değiştirildi.' });
  } catch (error) {
    console.error('Web şifresi değiştirme hatası:', error);
    return res.status(500).json({ message: 'Web şifresi değiştirilemedi.' });
  }
});

router.post('/logout', authenticateToken, (req, res) => {
  return res.json({ message: 'Çıkış yapıldı.' });
});

module.exports = router;
