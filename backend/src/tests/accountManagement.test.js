const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index');
const prisma = require('../config/prisma');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

describe('Admin hesap yönetimi ve kişisel güvenlik', () => {
  const testEmail = `account_flow_${Date.now()}@example.com`;
  const newWebPassword = 'YeniGuvenli2026';
  let adminToken = '';
  let userToken = '';
  let createdUser = null;

  beforeAll(async () => {
    const admin = await prisma.kullanici.findFirst({
      where: { rol: 'admin', durum: 'aktif' }
    });
    if (!admin) throw new Error('Aktif yönetici hesabı bulunamadı.');
    adminToken = jwt.sign({
      kullaniciId: admin.kullaniciId.toString(),
      eposta: admin.eposta,
      rol: admin.rol
    }, JWT_SECRET, { expiresIn: '10m' });
  });

  afterAll(async () => {
    await prisma.kullanici.deleteMany({ where: { eposta: testEmail } });
    await prisma.$disconnect();
  });

  test('sistemde yalnızca bir admin hesabı bulunmalı', async () => {
    const adminCount = await prisma.kullanici.count({ where: { rol: 'admin' } });
    expect(adminCount).toBe(1);

    const res = await request(app)
      .post('/api/kullanicilar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ad: 'İkinci', soyad: 'Admin', eposta: testEmail, rol: 'admin' });
    expect(res.statusCode).toBe(400);
  });

  test('admin standart kullanıcı oluşturabilmeli', async () => {
    const res = await request(app)
      .post('/api/kullanicilar')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ad: 'Hesap', soyad: 'Test', eposta: testEmail });

    expect(res.statusCode).toBe(201);
    expect(res.body.rol).toBe('hoca');
    expect(res.body.initialPassword).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/);
    expect(res.body.initialPin).toMatch(/^\d{6}$/);
    createdUser = res.body;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ eposta: testEmail, pin: res.body.initialPassword });
    expect(login.statusCode).toBe(200);
    userToken = login.body.token;
  });

  test('standart kullanıcı başka kullanıcı oluşturamamalı', async () => {
    const res = await request(app)
      .post('/api/kullanicilar')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ad: 'Yetkisiz', soyad: 'İşlem', eposta: `blocked_${testEmail}` });
    expect(res.statusCode).toBe(403);
  });

  test('kullanıcı kendi web şifresini değiştirebilmeli', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        mevcutSifre: createdUser.initialPassword,
        yeniSifre: newWebPassword,
        yeniSifreTekrar: newWebPassword
      });
    expect(res.statusCode).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ eposta: testEmail, pin: createdUser.initialPassword });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ eposta: testEmail, pin: newWebPassword });
    expect(newLogin.statusCode).toBe(200);
    userToken = newLogin.body.token;
  });

  test('kullanıcı kendi kapı PIN geçmişini görebilmeli ve PIN şifreli saklanmalı', async () => {
    const res = await request(app)
      .get(`/api/kullanicilar/${createdUser.kullaniciId}/pin-gecmisi`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.kayitlar).toHaveLength(1);
    expect(res.body.kayitlar[0].pin).toBe(createdUser.initialPin);
    expect(res.body.kayitlar[0].aktif).toBe(true);

    const stored = await prisma.kapiSifreGecmisi.findFirst({
      where: { kullaniciId: BigInt(createdUser.kullaniciId) }
    });
    expect(stored.pinSifreli).not.toContain(createdUser.initialPin);
  });

  test('şifremi unuttum yalnızca web şifresini sıfırlamalı ve yeni şifreyle giriş açılmalı', async () => {
    const beforeReset = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(createdUser.kullaniciId) },
      select: { pinHash: true }
    });
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ eposta: testEmail });

    expect(res.statusCode).toBe(200);
    expect(res.body.temporaryPassword).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ eposta: testEmail, pin: newWebPassword });
    expect(oldLogin.statusCode).toBe(401);

    const temporaryLogin = await request(app)
      .post('/api/auth/login')
      .send({ eposta: testEmail, pin: res.body.temporaryPassword });
    expect(temporaryLogin.statusCode).toBe(200);
    userToken = temporaryLogin.body.token;

    const afterReset = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(createdUser.kullaniciId) },
      select: { pinHash: true }
    });
    expect(afterReset.pinHash).toBe(beforeReset.pinHash);
  });

  test('admin standart kullanıcıyı silebilmeli', async () => {
    const res = await request(app)
      .delete(`/api/kullanicilar/${createdUser.kullaniciId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    const deleted = await prisma.kullanici.findUnique({
      where: { kullaniciId: BigInt(createdUser.kullaniciId) }
    });
    expect(deleted).toBeNull();
    createdUser = null;
  });
});
