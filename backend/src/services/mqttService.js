const mqtt = require('mqtt');

// Docker içi veya .env'deki MQTT Broker URL'i (Örn: mqtt://mosquitto:1883)
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
let client = null;

function getMqttClient() {
  if (!client) {
    client = mqtt.connect(MQTT_BROKER_URL);
    client.on('connect', () => {
      console.log('✓ MQTT Broker\'a başarıyla bağlandı.');
    });
    client.on('error', (err) => {
      console.error('MQTT Bağlantı Hatası:', err.message);
    });
  }
  return client;
}

/**
 * Şifre değişikliği bildirimini tek sabit topic'e publish eder
 */
function publishSifreGuncelleme(payload) {
  try {
    const mqttClient = getMqttClient();
    const topic = 'kapi/sifre-guncelleme';
    const message = JSON.stringify({
      olay: 'SIFRE_GUNCELLENDI',
      zaman: new Date().toISOString(),
      ...payload
    });

    mqttClient.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT] ${topic} adresine mesaj gönderilemedi:`, err);
      } else {
        console.log(`📡 [MQTT] Yayın yapıldı -> Topic: ${topic}`);
      }
    });
  } catch (error) {
    console.error('[MQTT] Publish hatası:', error.message);
  }
}

module.exports = { publishSifreGuncelleme };