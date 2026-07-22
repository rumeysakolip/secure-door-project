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

// Keypad pin matrisi (config.h tanımlarına bağlı)
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

// Modül Nesneleri
AlertSystem alertSystem(BUZZER_PIN, LED_GREEN_PIN, true, true);
KeypadInput keypadInput(rowPins, colPins, KEYPAD_MIN_LEN, KEYPAD_MAX_LEN, KEYPAD_TIMEOUT);

static unsigned long lastHeartbeatMillis = 0;
static unsigned long lastQueueCheckMillis = 0;
const unsigned long HEARTBEAT_ARALIK_MS = 30000;

unsigned long lastSyncTime = 0;
const unsigned long SYNC_INTERVAL = 3600000; // 1 Saat (Yedek senkronizasyon)

static bool zamanSenkronize = false;

// --- NTP SAAT SENKRONİZASYONU ---
void zamaniSenkronizeEt() {
    if (zamanSenkronize) return;

    configTime(ZAMAN_DILIMI_DK * 60, 0, NTP_SUNUCU_1, NTP_SUNUCU_2);
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 10)) {
        zamanSenkronize = true;
        Serial.println("[NTP] Saat Senkronizasyonu Başarılı.");
    }
}

// --- ÇEVRİMDIŞI LOGLARI SUNUCUYA BASMA ---
void processOfflineQueue() {
    if (!network.isConnected()) return;

    if (!OfflineQueue::okumayiBaslat()) return;

    CevrimdisiOlay olay;
    bool gonderilecekVar = OfflineQueue::siradakiOlayiOku(olay);
    OfflineQueue::okumayiBitir();

    if (gonderilecekVar) {
        EntryEvent ev;
        ev.cardId = olay.veri;
        ev.method = olay.yontem;
        ev.result = olay.basarili ? "ONAYLANDI" : "REDDEDILDI";
        ev.timestampEpoch = olay.zamanDamgasi;

        if (mqttManager.publishEntryEvent(ev)) {
            Serial.printf("[SYSTEM] Cevrimdisi log sunucuya basildi: %s\n", olay.veri);
            OfflineQueue::ilkOlayiSil();
        }
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n--- SECUREDOOR BAŞLATILIYOR ---");

    alertSystem.begin();
    keypadInput.begin();

    network.begin();
    cardReader.begin();
    lock.begin();
    DoorState::baslat();
    OfflineQueue::baslat();
    ac.begin();

    ac.syncWithServer();
    ac.syncTeacherPassword();
    lastSyncTime = millis();
}

void loop() {
    // 1. Non-Blocking Sürücüler ve Zamanlayıcılar
    network.update();
    alertSystem.update();
    keypadInput.update();

    // 2. Ağ ve NTP/MQTT Yönetimi
    if (network.isConnected()) {
        zamaniSenkronizeEt();
        mqttManager.update();

        if (mqttManager.hasPendingCommand()) {
            DeviceCommand cmd = mqttManager.popPendingCommand();
            
            // Komut 1: Uzaktan Kapı Açma
            if (cmd.type == CommandType::DOOR_OPEN) {
                Serial.println("[SYSTEM] Uzaktan KAPI AÇMA komutu alındı!");
                DoorState::durumGecisiYap(Durum::ONAYLANDI);
                alertSystem.playSuccess();
            } 
            // Komut 2: Anlık Öğretmen Şifresi Güncelleme & Sunucuya ACK Fırlatma
            else if (cmd.type == CommandType::PASSWORD_RENEW) {
                Serial.println("[SYSTEM] MQTT üzerinden ŞİFRE GÜNCELLEME bildirimi alındı!");
                bool success = false;
                if (!cmd.newPassword.empty()) {
                    ac.setTeacherPassword(cmd.newPassword.c_str());
                    success = true;
                } else {
                    success = ac.syncTeacherPassword(); // Şifre pakette yoksa HTTP GET ile çeker
                }
                
                // Sunucuya "Şifreyi aldım ve güncelledim" onay yanıtı (ACK) gönderilir
                mqttManager.publishPasswordAck(success);
                if (success) {
                    Serial.println("[SYSTEM] Sifre guncelleme ACK yaniti sunucuya iletildi.");
                }
            }
        }

        unsigned long currentMillis = millis();
        if (currentMillis - lastHeartbeatMillis >= HEARTBEAT_ARALIK_MS) {
            lastHeartbeatMillis = currentMillis;
            mqttManager.publishHeartbeat();
        }
    } else {
        alertSystem.playOffline();
    }

    // 3. KEYPAD (ŞİFRE) GİRİŞ İŞLEMLERİ
    if (keypadInput.isPinReady()) {
        String enteredPin = keypadInput.consumePin();
        Serial.println("[SYSTEM] Keypad şifresi alındı, doğrulanıyor...");

        bool isEntry = false;
        bool accessResult = ac.verifyAccess(enteredPin, false, isEntry);

        if (accessResult) {
            DoorState::durumGecisiYap(isEntry ? Durum::ONAYLANDI : Durum::CIKIS_YAPILDI);
            alertSystem.playSuccess();
        } else {
            DoorState::durumGecisiYap(Durum::REDDEDILDI);
            if (ac.isSystemLockedOut()) {
                alertSystem.playLockout();
            } else {
                alertSystem.playInvalidPin();
            }
        }
    }

    // 4. RFID KART OKUMA İŞLEMLERİ
    cardReader.update();
    if (cardReader.hasNewRead()) {
        std::string cardUid = cardReader.getLastCardId();
        String authData = String(cardUid.c_str());
        Serial.printf("[SYSTEM] Kart okundu: %s\n", authData.c_str());

        bool isEntry = false;
        bool accessResult = ac.verifyAccess(authData, true, isEntry);

        if (accessResult) {
            DoorState::durumGecisiYap(isEntry ? Durum::ONAYLANDI : Durum::CIKIS_YAPILDI);
            alertSystem.playSuccess();
        } else {
            DoorState::durumGecisiYap(Durum::REDDEDILDI);
            alertSystem.playAccessDenied();
        }
    }

    // 5. Sensör ve Kilit Kontrolü
    bool doorSensorState = (digitalRead(SENSOR_PIN) == HIGH);
    lock.update(doorSensorState);

    // 6. Durum Makinesi
    DoorState::guncelle();

    // 7. Arka Plan HTTP Senkronizasyonu (Yedek Güvence - 1 Saat)
    ac.loop();
    unsigned long now = millis();
    if (now - lastSyncTime > SYNC_INTERVAL) {
        Serial.println("[SYSTEM] Periyodik yedek senkronizasyon yapılıyor...");
        ac.syncWithServer();
        ac.syncTeacherPassword();
        lastSyncTime = now;
    }

    // 8. Çevrimdışı Log Fırlatma
    if (now - lastQueueCheckMillis >= 5000) {
        lastQueueCheckMillis = now;
        processOfflineQueue();
    }
}