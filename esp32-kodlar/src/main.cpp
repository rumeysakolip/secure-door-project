#include <Arduino.h>
#include <WiFi.h>
#include <esp_system.h>
#include <time.h>

#include "config.h"
#include "AccessControl.h"
#include "AlertSystem.h"
#include "CardReader.h"
#include "DoorState.h"
#include "KeypadInput.h"
#include "LockController.h"
#include "MqttManager.h"
#include "NetworkManager.h"
#include "OfflineQueue.h"

static byte rowPins[KeypadInput::ROW_COUNT] = {
    KEYPAD_ROW_1, KEYPAD_ROW_2, KEYPAD_ROW_3, KEYPAD_ROW_4
};
static byte colPins[KeypadInput::COLUMN_COUNT] = {
    KEYPAD_COL_1, KEYPAD_COL_2, KEYPAD_COL_3
};

CardReader cardReader(RFID_SS_PIN, RFID_RST_PIN, RFID_SCK_PIN, RFID_MISO_PIN, RFID_MOSI_PIN);
MqttManager mqttManager(MQTT_BROKER_HOST, MQTT_BROKER_PORT);
LockController lock(RELAY_PIN, BUZZER_PIN);
NetworkManager network(WIFI_SSID, WIFI_PASSWORD);
AccessControl accessControl;
AlertSystem alertSystem(BUZZER_PIN, LED_GREEN_PIN, true, true);
KeypadInput keypadInput(rowPins, colPins, KEYPAD_MIN_LEN, KEYPAD_MAX_LEN);

static uint32_t lastHeartbeatMs = 0;

static std::string createEventId() {
    uint32_t a = esp_random();
    uint32_t b = esp_random();
    uint32_t c = esp_random();
    uint32_t d = esp_random();
    char buffer[37];
    snprintf(
        buffer,
        sizeof(buffer),
        "%08lx-%04lx-4%03lx-%04lx-%08lx%04lx",
        (unsigned long)a,
        (unsigned long)(b & 0xffff),
        (unsigned long)((b >> 16) & 0x0fff),
        (unsigned long)(0x8000 | (c & 0x3fff)),
        (unsigned long)d,
        (unsigned long)((c >> 16) & 0xffff)
    );
    return std::string(buffer);
}

static void publishOrQueue(EntryEvent &event, const String &queueValue) {
    if (mqttManager.publishEntryEvent(event)) return;

    OfflineQueue::olayEkle(
        queueValue.c_str(),
        event.dogrulamaYontemi.c_str(),
        event.sonuc == "izin",
        event.timestampEpoch
    );
}

static void processCredential(const String &credential, bool isCard) {
    const bool allowed = accessControl.verifyAccess(credential, isCard);

    EntryEvent event;
    event.cihazOlayId = createEventId();
    event.cihazId = DEVICE_ID;
    event.kapiId = DOOR_ID;
    event.dogrulamaYontemi = isCard ? "kart" : "pin";
    event.timestampEpoch = time(nullptr);
    event.sonuc = allowed ? "izin" : "red";

    if (isCard) {
        event.okunanUid = std::string(credential.c_str());
    } else {
        event.kullaniciId = std::string(accessControl.getLastOfflineUserId().c_str());
    }

    if (allowed) {
        DoorState::durumGecisiYap(Durum::ONAYLANDI);
        alertSystem.playSuccess();
    } else {
        DoorState::durumGecisiYap(Durum::REDDEDILDI);
        alertSystem.playAccessDenied();
        event.redNedeni = isCard ? "yetkisiz_kart" : "gecersiz_pin";
    }

    const String queueValue = isCard ? credential : accessControl.getLastOfflineUserId();
    publishOrQueue(event, queueValue);
}

static void processPendingCommands() {
    while (mqttManager.hasPendingCommand()) {
        DeviceCommand command = mqttManager.popPendingCommand();
        if (command.type == CommandType::DOOR_OPEN) {
            mqttManager.publishPasswordAck(lock.unlockDoor());
        } else if (command.type == CommandType::PASSWORD_RENEW) {
            accessControl.syncOfflinePins(
                String(command.newPasswordListJson.c_str()),
                command.replacePasswordList
            );
            mqttManager.publishPasswordAck(true);
        }
    }
}

static void replayOneOfflineEvent() {
    if (!mqttManager.isConnected() || OfflineQueue::bekleyenOlaySayisi() == 0) return;

    CevrimdisiOlay queued;
    if (!OfflineQueue::okumayiBaslat()) return;
    const bool read = OfflineQueue::siradakiOlayiOku(queued);
    OfflineQueue::okumayiBitir();
    if (!read) return;

    EntryEvent event;
    event.cihazOlayId = createEventId();
    event.cihazId = DEVICE_ID;
    event.kapiId = DOOR_ID;
    event.dogrulamaYontemi = queued.yontem;
    event.sonuc = queued.basarili ? "izin" : "red";
    event.timestampEpoch = queued.zamanDamgasi;
    if (event.dogrulamaYontemi == "kart") event.okunanUid = queued.veri;
    else event.kullaniciId = queued.veri;

    if (mqttManager.publishEntryEvent(event)) OfflineQueue::ilkOlayiSil();
}

void setup() {
    Serial.begin(115200);
    Serial.println("[SYSTEM] SecureDoor baslatiliyor...");

    pinMode(SENSOR_PIN, INPUT);
    lock.begin();
    alertSystem.begin();
    cardReader.begin();
    keypadInput.begin();
    accessControl.begin();
    OfflineQueue::baslat();
    network.begin();

    if (WiFi.status() == WL_CONNECTED) {
        configTime(ZAMAN_DILIMI_DK * 60, 0, NTP_SUNUCU_1, NTP_SUNUCU_2);
    }

    DoorState::durumGecisiYap(Durum::BEKLEMEDE);
    Serial.println("[SYSTEM] Hazir.");
}

void loop() {
    network.update();
    mqttManager.update();
    accessControl.loop();
    processPendingCommands();
    replayOneOfflineEvent();

    const uint32_t now = millis();
    if (mqttManager.isConnected() && now - lastHeartbeatMs >= 30000) {
        mqttManager.publishHeartbeat(DEVICE_ID);
        lastHeartbeatMs = now;
    }

    cardReader.update();
    if (cardReader.hasNewRead()) {
        processCredential(String(cardReader.getLastCardId().c_str()), true);
    }

    keypadInput.update();
    if (keypadInput.isPinReady()) {
        processCredential(keypadInput.consumePin(), false);
    }

    alertSystem.update();
    const bool isDoorPhysicallyOpen = digitalRead(SENSOR_PIN) == HIGH;
    lock.update(isDoorPhysicallyOpen);
    DoorState::guncelle();
}
