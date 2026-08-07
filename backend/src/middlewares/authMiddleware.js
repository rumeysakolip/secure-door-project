const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'securelab-development-only-secret';

// 1. Token Doğrulama Middleware (Oturum açık mı?)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({ message: 'Erişim yetkisi yok, token bulunamadı.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Geçersiz veya süresi dolmuş token.' });
    }
    req.user = user;
    next();
  });
};

// 2. Admin Yetkisi Kontrolü Middleware
const requireAdmin = async (req, res, next) => {
  try {
    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(req.user?.kullaniciId || 0) },
      select: { rol: true, durum: true }
    });
    if (user?.rol === 'admin' && user.durum === 'aktif') return next();
    return res.status(403).json({ message: 'Bu işlem için yetkiniz yok (Admin rolü gerekli).' });
  } catch (error) {
    return res.status(403).json({ message: 'Yönetici yetkisi doğrulanamadı.' });
  }
};

// 3. Admin veya Hoca Yetkisi Kontrolü Middleware (Web paneli işlemleri için)
const requireAdminOrHoca = async (req, res, next) => {
  try {
    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(req.user?.kullaniciId || 0) },
      select: { rol: true, durum: true }
    });
    if (user?.durum === 'aktif' && (user.rol === 'admin' || user.rol === 'hoca')) return next();
    return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
  } catch (error) {
    return res.status(403).json({ message: 'Kullanıcı yetkisi doğrulanamadı.' });
  }
};

const requireSelfOrAdmin = async (req, res, next) => {
  const requestedUserId = String(req.params.id || req.params.kullaniciId || '');
  const authenticatedUserId = String(req.user?.kullaniciId || '');

  try {
    const user = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(authenticatedUserId || 0) },
      select: { rol: true, durum: true }
    });
    if (user?.durum === 'aktif'
      && (user.rol === 'admin' || (authenticatedUserId && authenticatedUserId === requestedUserId))) {
      return next();
    }
    return res.status(403).json({ message: 'Yalnızca kendi hesabınız üzerinde işlem yapabilirsiniz.' });
  } catch (error) {
    return res.status(403).json({ message: 'Kullanıcı yetkisi doğrulanamadı.' });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireAdminOrHoca,
  requireSelfOrAdmin,
  JWT_SECRET
};
