const mqtt = require('mqtt');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const cardApprovalService = require('./cardApprovalService');

class MqttService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    const brokerHost = process.env.MQTT_BROKER_HOST || 'mqtt';
    const brokerPort = process.env.MQTT_BROKER_PORT || 1883;
    const brokerUrl = process.env.MQTT_BROKER_URL || `mqtt://${brokerHost}:${brokerPort}`; 

    this.client = mqtt.connect(brokerUrl, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: `backend_${Math.random().toString(16).slice(2, 10)}`,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      this.connected = true;
      console.log(`[MQTT] Broker'a bağlandı: ${brokerUrl}`);
      this.subscribeToTopics();
    });

    this.client.on('reconnect', () => console.log('[MQTT] Yeniden bağlanmaya çalışılıyor...'));
    this.client.on('error', (err) => console.error('[MQTT] Bağlantı hatası:', err.message));
    this.client.on('close', () => {
      this.connected = false;
      console.log('[MQTT] Bağlantı kapandı.');
    });

    this.client.on('message', (topic, message) => {
      this.handleIncomingMessage(topic, message).catch((err) =>
        console.error(`[MQTT] Mesaj işlenirken beklenmeyen hata (${topic}):`, err)
      );
    });
  }

  subscribeToTopics() {
    const topics = [
      'kapi/+/durum',
      'kapi/+/saglik',
      'kapi/+/erisim-istek',
    ];

    topics.forEach((topic) => {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) console.error(`[MQTT] Abone olunamadı: ${topic}`, err.message);
        else console.log(`[MQTT] Abone olundu: ${topic}`);
      });
    });
  }

  extractCihazId(topic) {
    const parcalar = topic.split('/');
    return parcalar.length >= 2 ? parseInt(parcalar[1], 10) : null;
  }

  async handleIncomingMessage(topic, messageBuffer) {
    let payload;
    try {
      payload = JSON.parse(messageBuffer.toString());
    } catch (err) {
      console.error(`[MQTT] Geçersiz JSON payload (${topic}):`, messageBuffer.toString());
      return;
    }

    const cihazId = this.extractCihazId(topic);
    if (!cihazId || Number.isNaN(cihazId)) {
      console.warn(`[MQTT] Topic'ten cihazId çıkarılamadı: ${topic}`);
      return;
    }

    const cihaz = await prisma.cihaz.findUnique({ where: { cihazId } });
    if (!cihaz) {
      console.warn(`[MQTT] Bilinmeyen cihazdan mesaj: cihazId=${cihazId}, topic=${topic}`);
      return;
    }

    if (topic.endsWith('/durum')) {
      await this.handleDurumMesaji(cihaz, payload);
    } else if (topic.endsWith('/saglik')) {
      await this.handleSaglikMesaji(cihaz, payload);
    } else if (topic.endsWith('/erisim-istek')) {
      await this.handleErisimIstegi(cihaz, payload);
    } else {
      console.log(`[MQTT] Tanımsız topic mesajı: ${topic}`, payload);
    }
  }

  // CihazDurumu.kapiDurumu ve cihazDurumTip zorunlu alanlar olduğu için,
  // gelen payload'da olmayan alanları son bilinen kayıttan tamamlıyoruz.
  async getSonBilinenDurum(cihazId) {
    return prisma.cihazDurumu.findFirst({
      where: { cihazId },
      orderBy: { guncellenmeTarihi: 'desc' },
    });
  }

  async handleDurumMesaji(cihaz, payload) {
    try {
      if (payload.durum === 'BASARILI' || payload.durum === 'HATA') {
        console.log(`[MQTT] Cihaz ${cihaz.cihazId} komut yanıtı: ${payload.durum} - ${payload.mesaj || ''}`);
        return;
      }
      const sonDurum = await this.getSonBilinenDurum(cihaz.cihazId);

      await prisma.cihazDurumu.create({
        data: {
          cihazId: cihaz.cihazId,
          kapiDurumu: payload.kapiDurumu ?? payload.kapi_durumu ?? sonDurum?.kapiDurumu ?? 'arizali',
          cihazDurumTip: 'cevrimici', // mesaj geldiyse cihaz aktif olarak haberleşiyor demektir
          bataryaSeviyesi: payload.bataryaSeviyesi ?? sonDurum?.bataryaSeviyesi ?? null,
          wifiSignali: payload.wifiSignali ?? payload.wifi_rssi ?? sonDurum?.wifiSignali ?? null,
          firmwareVersiyon: payload.firmwareVersiyon ?? payload.firmware_versiyon ?? sonDurum?.firmwareVersiyon ?? null,
          bellekKullanimi: payload.bellekKullanimi ?? payload.bellek_kullanimi ?? sonDurum?.bellekKullanimi ?? null,
          kapiAcilmaSayaci: payload.kapiAcilmaSayaci ?? payload.kapi_acilma_sayaci ?? sonDurum?.kapiAcilmaSayaci ?? null,
          kapiAcilmaSuresi: payload.kapiAcilmaSuresi ?? payload.kapi_acilma_suresi ?? null,
          sonHeartbeat: new Date(),
        },
      });

      console.log(`[MQTT] Cihaz ${cihaz.cihazId} kapı durumu güncellendi: ${payload.kapiDurumu}`);
    } catch (error) {
      console.error(`[MQTT] Durum mesajı işlenirken hata (cihaz ${cihaz.cihazId}):`, error);
    }
  }

  async handleSaglikMesaji(cihaz, payload) {
    try {
      const sonDurum = await this.getSonBilinenDurum(cihaz.cihazId);

      await prisma.cihazDurumu.create({
        data: {
          cihazId: cihaz.cihazId,
          kapiDurumu: sonDurum?.kapiDurumu ?? 'arizali',
          cihazDurumTip: 'cevrimici',
          bataryaSeviyesi: payload.bataryaSeviyesi ?? payload.batarya_seviyesi ?? null,
          wifiSignali: payload.wifiSignali ?? payload.wifi_rssi ?? null,
          firmwareVersiyon: payload.firmwareVersiyon ?? payload.firmware_versiyon ?? sonDurum?.firmwareVersiyon ?? null,
          bellekKullanimi: payload.bellekKullanimi ?? payload.bellek_kullanimi ?? null,
          kapiAcilmaSayaci: sonDurum?.kapiAcilmaSayaci ?? null,
          sonHeartbeat: new Date(),
        },
      });

      console.log(`[MQTT] Cihaz ${cihaz.cihazId} sağlık bilgisi güncellendi.`);
    } catch (error) {
      console.error(`[MQTT] Sağlık mesajı işlenirken hata (cihaz ${cihaz.cihazId}):`, error);
    }
  }

  // kapi/<cihazId>/erisim-istek -> Olay tablosuna logla, sonucu geri bildir
  async handleErisimIstegi(cihaz, payload) {
    try {
      const atama = await prisma.cihazKapiAtama.findFirst({
        where: { cihazId: cihaz.cihazId, bitis: null },
      });

      if (!atama) {
        console.warn(`[MQTT] Cihaz ${cihaz.cihazId} için aktif kapı ataması bulunamadı.`);
        return;
      }

      const allowed = payload.sonuc === 'izin' || payload.sonuc === 'basarili';
      const cardUid = payload.okunan_uid || payload.okunanUid || null;
      const card = cardUid
        ? await prisma.kart.findUnique({
            where: { kartUid: cardUid },
            include: {
              kartYetkilendirmeler: {
                where: { durum: 'aktif' },
                take: 1
              }
            }
          })
        : null;

      if (!card && cardUid) await cardApprovalService.handleUnknownCardScan(cardUid);
      const payloadUserId = payload.kullanici_id || payload.kullaniciId;
      const resolvedUserId = card?.kartYetkilendirmeler?.[0]?.kullaniciId
        || (payloadUserId ? BigInt(payloadUserId) : null);

      const suppliedEventId = payload.cihaz_olay_id || payload.cihazOlayId;
      const eventId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suppliedEventId || '')
        ? suppliedEventId
        : crypto.randomUUID();
      const rawEventTime = payload.olay_zamani || payload.olayTamani;
      const epochSeconds = Number(rawEventTime);
      let eventTime = Number.isFinite(epochSeconds) && epochSeconds >= 1600000000
        ? new Date(epochSeconds * 1000)
        : new Date();
      if (!Number.isFinite(epochSeconds) && rawEventTime) {
        const parsedTime = new Date(rawEventTime);
        if (!Number.isNaN(parsedTime.getTime()) && parsedTime.getTime() >= 1600000000000) {
          eventTime = parsedTime;
        }
      }
      const lastRecord = await prisma.erisimKaydi.aggregate({ _max: { kayitId: true } });

      await prisma.$transaction([
        prisma.olay.create({
          data: {
            tur: allowed ? 'erisim-basarili' : 'erisim-basarisiz',
            kaynak: 'cihaz',
            cihazId: cihaz.cihazId,
            kapiId: atama.kapiId,
            kullaniciId: resolvedUserId,
            detay: payload,
            olayTamani: eventTime
          }
        }),
        prisma.erisimKaydi.create({
          data: {
            kayitId: (lastRecord._max.kayitId || 0n) + 1n,
            cihazOlayId: eventId,
            cihazId: cihaz.cihazId,
            kapiId: atama.kapiId,
            kullaniciId: resolvedUserId,
            kartId: card?.kartId || null,
            okunanUid: cardUid,
            dogrulamaYontemi: payload.dogrulama_yontemi === 'pin' ? 'pin' : 'kart',
            sonuc: allowed ? 'izin' : 'red',
            redNedeni: allowed ? null : (payload.red_nedeni || 'yetkisiz'),
            olayTamani: eventTime
          }
        })
      ]);

      this.publishCommand(cihaz.cihazId, 'erisim-yanit', {
        istekId: payload.istekId,
        onay: allowed,
      });

      console.log(`[MQTT] Cihaz ${cihaz.cihazId} erişim isteği loglandı: ${payload.sonuc}`);
    } catch (error) {
      console.error(`[MQTT] Erişim isteği işlenirken hata (cihaz ${cihaz.cihazId}):`, error);
    }
  }

  // Sunucu -> cihaz genel amaçlı publish
  publishCommand(cihazId, komutTuru, payload) {
    if (!this.connected) {
      console.error('[MQTT] Bağlı değil, mesaj gönderilemedi.');
      return false;
    }

    const commandTypes = {
      'kapi-ac': 'DOOR_OPEN',
      'sifre-guncelleme': 'PASSWORD_RENEW',
      'kart-engelle': 'BLOCK',
      'kart-engel-kaldir': 'UNBLOCK'
    };
    const normalizedPayload = {
      ...payload,
      kullanici_id: payload.kullanici_id || payload.adminId || null,
      komut_tipi: payload.komut_tipi || commandTypes[komutTuru] || komutTuru,
      zaman: payload.zaman || Math.floor(Date.now() / 1000)
    };
    const topic = `kapi/${cihazId}/${komutTuru}`;
    this.client.publish(topic, JSON.stringify(normalizedPayload), { qos: 1 }, (err) => {
      if (err) console.error(`[MQTT] Publish hatası (${topic}):`, err.message);
    });

    return true;
  }
}

module.exports = new MqttService();
