const mqtt = require('mqtt');
const prisma = require('../config/prisma');

class MqttService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

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
      const sonDurum = await this.getSonBilinenDurum(cihaz.cihazId);

      await prisma.cihazDurumu.create({
        data: {
          cihazId: cihaz.cihazId,
          kapiDurumu: payload.kapiDurumu ?? sonDurum?.kapiDurumu ?? 'arizali',
          cihazDurumTip: 'cevrimici', // mesaj geldiyse cihaz aktif olarak haberleşiyor demektir
          bataryaSeviyesi: payload.bataryaSeviyesi ?? sonDurum?.bataryaSeviyesi ?? null,
          wifiSignali: payload.wifiSignali ?? sonDurum?.wifiSignali ?? null,
          firmwareVersiyon: payload.firmwareVersiyon ?? sonDurum?.firmwareVersiyon ?? null,
          bellekKullanimi: payload.bellekKullanimi ?? sonDurum?.bellekKullanimi ?? null,
          kapiAcilmaSayaci: payload.kapiAcilmaSayaci ?? sonDurum?.kapiAcilmaSayaci ?? null,
          kapiAcilmaSuresi: payload.kapiAcilmaSuresi ?? null,
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
          bataryaSeviyesi: payload.bataryaSeviyesi ?? null,
          wifiSignali: payload.wifiSignali ?? null,
          firmwareVersiyon: payload.firmwareVersiyon ?? sonDurum?.firmwareVersiyon ?? null,
          bellekKullanimi: payload.bellekKullanimi ?? null,
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

      await prisma.olay.create({
        data: {
          tur: payload.sonuc === 'basarili' ? 'erisim-basarili' : 'erisim-basarisiz',
          kaynak: 'cihaz',
          cihazId: cihaz.cihazId,
          kapiId: atama?.kapiId ?? null,
          detay: payload,
        },
      });

      this.publishCommand(cihaz.cihazId, 'erisim-yanit', {
        istekId: payload.istekId,
        onay: payload.sonuc === 'basarili',
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

    const topic = `kapi/${cihazId}/${komutTuru}`;
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) console.error(`[MQTT] Publish hatası (${topic}):`, err.message);
    });

    return true;
  }
}

module.exports = new MqttService();