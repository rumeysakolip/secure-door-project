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
// DİKKAT: <HTTPClient.h> kütüphanesini sistemden tamamen kaldırdık!

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
KeypadInput keypadInput(rowPins, colPins, KEYPAD_MIN_LEN, KEYPAD_MAX_LEN);

void setup() {
    Serial.begin(115200);
    Serial.println("[SYSTEM] SecureDoor Baslatiliyor...");

    lock.begin();
    cardReader.begin();
    network.begin();

    // Ağ bağlantısı kurulduysa saati NTP sunucusundan çek
    if (WiFi.status() == WL_CONNECTED) {
        configTime(ZAMAN_DILIMI_DK * 60, 0, NTP_SUNUCU_1, NTP_SUNUCU_2);
    }

    DoorState::durumGecisiYap(Durum::BEKLEMEDE);
    Serial.println("[SYSTEM] Hazir.");
}

void loop() {
    // 1. Ağ ve MQTT Güncellemeleri
    network.update();
    mqttManager.update();

    // 2. Kart Okuyucu Güncellemesi ve Kontrolü
    cardReader.update();
    if (cardReader.hasNewRead()) {
        std::string cardUid = cardReader.getLastCardId();
        std::string authData = cardUid;
        bool accessResult = false;

        Serial.printf("[AUTH] Kart Okundu: %s\n", cardUid.c_str());

        // Çevrimiçi (Online) Doğrulama
        if (WiFi.status() == WL_CONNECTED) {
            accessResult = ac.verifyAccess(authData, true);
        } else {
            Serial.println("[SYSTEM] Offline durumda kartla gecis yapilamaz!");
            accessResult = false;
        }

        // --- YENİ VERİTABANI ŞEMASINA UYGUN MQTT EVENT OLUŞTURMA ---
        EntryEvent ev;
        // Benzersiz olay kimliği (Basitçe zaman damgası kullanıyoruz)
        ev.cihazOlayId = "EVT-" + std::string(String(millis()).c_str());
        ev.cihazId = 1;
        ev.kapiId = 1;
        ev.okunanUid = authData;
        ev.dogrulamaYontemi = "kart";
        ev.timestampEpoch = time(nullptr); // İnternetten alınan gerçek saat

        if (accessResult) {
            DoorState::durumGecisiYap(Durum::ONAYLANDI);
            alertSystem.playSuccess();

            ev.sonuc = "izin";
            mqttManager.publishEntryEvent(ev);
        } else {
            DoorState::durumGecisiYap(Durum::REDDEDILDI);
            alertSystem.playAccessDenied();

            ev.sonuc = "red";
            ev.redNedeni = "tanimsiz_kart"; // Backend bu kelimeyi görünce kartı Onay Bekleyenlere alacak!
            mqttManager.publishEntryEvent(ev);
        }
    }

    // 3. Sensör, Kilit ve Durum Makinesi Güncellemeleri
    // Kapı sensörünün (SENSOR_PIN) durumu okunur, dijital okuma simülasyonu
    bool isDoorPhysicallyOpen = (digitalRead(SENSOR_PIN) == HIGH);
    DoorState::update(isDoorPhysicallyOpen, &lock, &alertSystem);
}
