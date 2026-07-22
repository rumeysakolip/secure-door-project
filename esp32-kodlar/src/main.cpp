#include <Arduino.h>
#include <WiFi.h>
#include <time.h>

#include "config.h"
#include "CardReader.h"
#include "MqttManager.h"
#include "DoorState.h"
#include "OfflineQueue.h"
#include "LockController.h"
#include "NetworkManager.h"
#include "AccessControl.h"
#include "AlertSystem.h"
#include "KeypadInput.h"
#include <HTTPClient.h>

// Keypad pin matrisi
static byte rowPins[KeypadInput::ROW_COUNT] = {
    KEYPAD_ROW_1, KEYPAD_ROW_2, KEYPAD_ROW_3, KEYPAD_ROW_4
};
static byte colPins[KeypadInput::COLUMN_COUNT] = {
    KEYPAD_COL_1, KEYPAD_COL_2, KEYPAD_COL_3
};

// Nesne Tanımlamaları
CardReader cardReader(RFID_SS_PIN, RFID_RST_PIN);
MqttManager mqttManager(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
LockController lock(RELAY_PIN, BUZZER_PIN);
NetworkManager network(WIFI_SSID, WIFI_PASSWORD);
AccessControl ac;

AlertSystem alertSystem(BUZZER_PIN, LED_GREEN_PIN, true, true);
KeypadInput keypadInput(rowPins, colPins, KEYPAD_MIN_LEN, KEYPAD_MAX_LEN, 10000);

void setup() {
    Serial.begin(115200);
    network.begin();
    OfflineQueue::baslat();
    DoorState::baslat();
    cardReader.begin();
    lock.begin();
    ac.begin();
    alertSystem.begin();
    keypadInput.begin();
}

void loop() {
    network.update();
    mqttManager.update();
    keypadInput.update();

    // 1. MQTT Komut İşleme
    if (mqttManager.hasPendingCommand()) {
        DeviceCommand cmd = mqttManager.popPendingCommand();
        if (cmd.type == CommandType::DOOR_OPEN) {
            DoorState::durumGecisiYap(Durum::ONAYLANDI);
            alertSystem.playSuccess();
        } else if (cmd.type == CommandType::PASSWORD_RENEW) {
            // YENİ JSON LİSTESİ BURADA HAFIZAYA YAZILIR
            if (WiFi.status() == WL_CONNECTED && cmd.newPassword.length() > 0) {
                ac.syncOfflinePins(String(cmd.newPassword.c_str()));
                mqttManager.publishPasswordAck(true);
            }
        }
    }

    // 2. Keypad Şifre Giriş Kontrolü
    CustomKeypadEvent kpEvent = keypadInput.getLastEvent();
    if (kpEvent.type == KeypadEventType::PinCompleted) {
        String pinStr = keypadInput.consumePin();
        
        bool accessResult = false;
        EntryEvent ev;
        ev.method = "sifre";
        ev.timestampEpoch = time(nullptr);

        // YENİ ÇEVRİMİÇİ / ÇEVRİMDIŞI KONTROLÜ
        if (WiFi.status() == WL_CONNECTED) {
            accessResult = ac.verifyAccess(pinStr, false);
            // Online ise loga genel bir tanım yazıyoruz, backend API'de şifreden kim olduğunu zaten çözer.
            ev.cardId = "SifreGiris"; 
        } else {
            accessResult = ac.verifyAccess(pinStr, false);
            // Çevrimdışıysa AccessControl'ün JSON içinden bulduğu Kullanıcı ID'sini çekip loga yazıyoruz!
            ev.cardId = accessResult ? ac.getLastOfflineUserId().c_str() : "BilinmeyenSifre";
        }

        ev.result = accessResult ? "basarili" : "basarisiz";

        if (accessResult) {
            DoorState::durumGecisiYap(Durum::ONAYLANDI);
            alertSystem.playSuccess();
            mqttManager.publishEntryEvent(ev);

            // Eğer offline iken şifreyle giriş yapıldıysa kuyruğa da ekle ki internet gelince sunucuya gitsin
            if (WiFi.status() != WL_CONNECTED) {
                // DİKKAT: Artık şifreyi değil, JSON'dan yakaladığımız Kullanıcı ID'sini (ev.cardId) offline kuyruğa atıyoruz!
                OfflineQueue::olayEkle(ev.cardId.c_str(), "sifre", true, ev.timestampEpoch);
            }
        } else {
            DoorState::durumGecisiYap(Durum::REDDEDILDI);
            alertSystem.playInvalidPin();
            mqttManager.publishEntryEvent(ev);
        }
    }

    // 3. RFID Kart Okuma İşlemleri (Sadece Online)
    cardReader.update();
    if (cardReader.hasNewRead()) {
        std::string cardUid = cardReader.getLastCardId();
        String authData = String(cardUid.c_str());
        Serial.printf("[SYSTEM] Kart okundu: %s\n", authData.c_str());

        bool accessResult = false;
        if (WiFi.status() == WL_CONNECTED) {
            accessResult = ac.verifyAccess(authData, true);
        } else {
            Serial.println("[SYSTEM] Offline durumda kartla geçiş yapılamaz!");
            accessResult = false;
        }

        EntryEvent ev;
        ev.cardId = cardUid;
        ev.method = "kart";
        ev.result = accessResult ? "basarili" : "reddedildi";
        ev.timestampEpoch = time(nullptr);

        if (accessResult) {
            DoorState::durumGecisiYap(Durum::ONAYLANDI);
            alertSystem.playSuccess();
            mqttManager.publishEntryEvent(ev);
        } else {
            DoorState::durumGecisiYap(Durum::REDDEDILDI);
            alertSystem.playAccessDenied();
            mqttManager.publishEntryEvent(ev);

            // Tanımsız kart okutulduğunda ve internet varsa backend'e bildir
            if (WiFi.status() == WL_CONNECTED) {
                HTTPClient http;
                http.begin(String(SERVER_URL) + "/cards/scan");
                http.addHeader("Content-Type", "application/json");
                String payload = "{\"cardUid\":\"" + authData + "\"}";
                http.POST(payload);
                http.end();
            }
        }
    }

    // 4. Sensör, Kilit ve Durum Makinesi Güncellemeleri
    bool doorSensorState = (digitalRead(SENSOR_PIN) == HIGH);
    lock.update(doorSensorState);
    DoorState::guncelle();

    // 5. Arka Plan Senkronizasyonu
    ac.loop();
}