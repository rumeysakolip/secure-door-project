const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'securelab-development-only-secret';
const DEVICE_SECRET = process.env.ESP32_SECRET_KEY || 'securelab-device-development-key';

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
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.rol === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Bu işlem için yetkiniz yok (Admin rolü gerekli).' });
  }
};

// 3. Admin veya Hoca Yetkisi Kontrolü Middleware (Web paneli işlemleri için)
const requireAdminOrHoca = (req, res, next) => {
  if (req.user && (req.user.rol === 'admin' || req.user.rol === 'hoca')) {
    next();
  } else {
    return res.status(403).json({ message: 'Bu işlem için yetkiniz yok.' });
  }
};

const requireSelfOrAdmin = (req, res, next) => {
  const requestedUserId = String(req.params.id || req.params.kullaniciId || '');
  const authenticatedUserId = String(req.user?.kullaniciId || '');

  if (req.user?.rol === 'admin' || (authenticatedUserId && authenticatedUserId === requestedUserId)) {
    return next();
  }

  return res.status(403).json({ message: 'Yalnızca kendi hesabınız üzerinde işlem yapabilirsiniz.' });
};

const authenticateDevice = (req, res, next) => {
  const suppliedSecret = String(req.get('x-device-key') || '');
  const suppliedBuffer = Buffer.from(suppliedSecret);
  const expectedBuffer = Buffer.from(DEVICE_SECRET);
  const secretMatches = suppliedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
  if (!secretMatches) {
    return res.status(401).json({ message: 'Cihaz kimlik doğrulaması başarısız.' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireAdminOrHoca,
  requireSelfOrAdmin,
  authenticateDevice,
  JWT_SECRET
};
