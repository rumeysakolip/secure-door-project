const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-kapi-sistemi';

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

module.exports = {
  authenticateToken,
  requireAdmin,
  JWT_SECRET
};