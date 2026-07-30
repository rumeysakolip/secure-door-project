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
#include "LcdDisplay.h"
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
LockController lock(RELAY_PIN);
NetworkManager network(WIFI_SSID, WIFI_IDENTITY, WIFI_USERNAME, WIFI_PASSWORD);
AccessControl accessControl;
// Kullandigimiz buzzer modulu LOW seviyesinde ses verir.
AlertSystem alertSystem(
    BUZZER_PIN,
    LED_GREEN_PIN,
    false,
    false,
    LED_BLUE_PIN,
    false,
    LED_RED_PIN,
    false
);
LcdDisplay lcdDisplay(I2C_SDA_PIN, I2C_SCL_PIN);
KeypadInput keypadInput(
    rowPins,
    colPins,
    KEYPAD_MIN_LEN,
    KEYPAD_MAX_LEN,
    KEYPAD_TIMEOUT
);

struct PendingAccessRequest {
    bool active = false;
    std::string requestId;
    bool isCard = false;
    uint32_t sentAtMs = 0;
};

static PendingAccessRequest pendingAccess;
static constexpr uint32_t ACCESS_RESPONSE_TIMEOUT_MS = 6000;
static uint32_t lastHeartbeatMs = 0;
static bool doorSensorInitialized = false;
// Harici pull-up baglantisinda sensor kapali kontakta GPIO35'i GND'ye
// ceker: LOW = kapi KAPALI, HIGH = kapi ACIK.
static constexpr uint8_t DOOR_SENSOR_CLOSED_LEVEL = LOW;
static bool lastDoorPhysicallyOpen = false;
static bool pendingDoorSensorState = false;
static uint32_t doorSensorChangedAtMs = 0;
static constexpr uint32_t DOOR_SENSOR_DEBOUNCE_MS = 500;
static uint32_t doorOpenedAtMs = 0;
static bool doorOpenAlarmActive = false;
static constexpr uint32_t DOOR_OPEN_ALARM_DELAY_MS = 20000;
static Durum lastLcdWorkflowState = Durum::ALARM;

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

static void applyAccessDecision(bool allowed, const std::string &reason = "") {
    if (allowed) {
        Serial.println("[AUTH] MQTT sunucu karari: ONAYLANDI.");
        DoorState::durumGecisiYap(Durum::ONAYLANDI);
        alertSystem.playSuccess();

        if (doorSensorInitialized && lastDoorPhysicallyOpen) {
            Serial.println("[KILIT] Kapi zaten ACIK; role tetiklenmedi.");
        } else if (!lock.unlockDoor()) {
            Serial.println("[KILIT] Role darbesi devam ettigi icin yeni tetikleme atlandi.");
        }
    } else {
        Serial.printf(
            "[AUTH] MQTT sunucu karari: REDDEDILDI%s%s.\n",
            reason.empty() ? "" : " - ",
            reason.c_str()
        );
        DoorState::durumGecisiYap(Durum::REDDEDILDI);
        alertSystem.playAccessDenied();
    }
}

static void processCredential(const String &credential, bool isCard) {
    if (DoorState::mevcutDurumuAl() != Durum::BEKLEMEDE) {
        Serial.println("[AUTH] Kapi islemi devam ediyor; yeni kart/PIN okumasi atlandi.");
        return;
    }

    if (pendingAccess.active) {
        Serial.println("[AUTH] Onceki MQTT dogrulama cevabi bekleniyor; yeni okuma atlandi.");
        return;
    }

    EntryEvent event;
    event.cihazOlayId = createEventId();
    event.cihazId = DEVICE_ID;
    event.kapiId = DOOR_ID;
    event.dogrulamaYontemi = isCard ? "kart" : "pin";
    event.timestampEpoch = time(nullptr);

    if (isCard) {
        event.okunanUid = std::string(credential.c_str());
    } else {
        event.pin = std::string(credential.c_str());
    }

    if (mqttManager.publishEntryEvent(event)) {
        pendingAccess.active = true;
        pendingAccess.requestId = event.cihazOlayId;
        pendingAccess.isCard = isCard;
        pendingAccess.sentAtMs = millis();
        DoorState::durumGecisiYap(Durum::OKUNUYOR);
        Serial.printf(
            "[AUTH] %s dogrulama istegi MQTT ile gonderildi. Cevap bekleniyor...\n",
            isCard ? "Kart" : "PIN"
        );
        return;
    }

    Serial.println("[AUTH] MQTT baglantisi yok; yerel offline kontrol uygulanacak.");
    const bool allowed = accessControl.verifyOfflineAccess(credential, isCard);
    event.sonuc = allowed ? "izin" : "red";

    if (!isCard) {
        event.kullaniciId = std::string(accessControl.getLastOfflineUserId().c_str());
    }
    if (!allowed) {
        event.redNedeni = isCard ? "mqtt_yok_kart_dogrulanamadi" : "gecersiz_pin";
    }

    applyAccessDecision(allowed, event.redNedeni);
    const String queueValue = isCard ? credential : accessControl.getLastOfflineUserId();
    publishOrQueue(event, queueValue);
}

static void processPendingCommands() {
    while (mqttManager.hasPendingCommand()) {
        DeviceCommand command = mqttManager.popPendingCommand();

        if (command.type == CommandType::DOOR_OPEN) {
            const bool opened =
                (!doorSensorInitialized || !lastDoorPhysicallyOpen)
                && lock.unlockDoor();
            Serial.println(opened
                ? "[KAPI] Uzaktan acma komutu uygulandi."
                : "[KAPI] Uzaktan acma atlandi; kapi acik veya role zaten tetiklenmis.");
            mqttManager.publishPasswordAck(opened);
        } else if (command.type == CommandType::PASSWORD_RENEW) {
            accessControl.syncOfflinePins(
                String(command.newPasswordListJson.c_str()),
                command.replacePasswordList
            );
            mqttManager.publishPasswordAck(true);
        } else if (command.type == CommandType::ACCESS_RESPONSE) {
            if (!pendingAccess.active || command.requestId != pendingAccess.requestId) {
                Serial.println("[AUTH] Eslesmeyen veya gecikmis MQTT erisim cevabi atlandi.");
                continue;
            }

            applyAccessDecision(command.accessAllowed, command.accessReason);
            pendingAccess = PendingAccessRequest{};
        }
    }
}

static void checkAccessResponseTimeout() {
    if (
        pendingAccess.active
        && millis() - pendingAccess.sentAtMs >= ACCESS_RESPONSE_TIMEOUT_MS
    ) {
        Serial.println("[AUTH] MQTT erisim cevabi zaman asimina ugradi; kapi KAPALI kaldi.");
        DoorState::durumGecisiYap(Durum::REDDEDILDI);
        alertSystem.playAccessDenied();
        pendingAccess = PendingAccessRequest{};
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

static void updatePhysicalDoorState() {
    const uint8_t sensorLevel = digitalRead(SENSOR_PIN);
    const uint32_t now = millis();
    const bool rawDoorOpen = sensorLevel != DOOR_SENSOR_CLOSED_LEVEL;

    if (!doorSensorInitialized) {
        doorSensorInitialized = true;
        lastDoorPhysicallyOpen = rawDoorOpen;
        pendingDoorSensorState = rawDoorOpen;
        doorSensorChangedAtMs = now;
        doorOpenedAtMs = rawDoorOpen ? now : 0;
        Serial.printf(
            "[KAPI] Baslangic fiziksel durumu: %s "
            "(GPIO%d=%d, LOW=KAPALI / HIGH=ACIK).\n",
            lastDoorPhysicallyOpen ? "ACIK" : "KAPALI",
            SENSOR_PIN,
            sensorLevel
        );
        mqttManager.publishDoorStatus(lastDoorPhysicallyOpen);
        if (DoorState::mevcutDurumuAl() == Durum::BEKLEMEDE) {
            lcdDisplay.showIdle(lastDoorPhysicallyOpen);
        }
        return;
    }

    if (rawDoorOpen != pendingDoorSensorState) {
        pendingDoorSensorState = rawDoorOpen;
        doorSensorChangedAtMs = now;
    } else if (
        pendingDoorSensorState != lastDoorPhysicallyOpen
        && now - doorSensorChangedAtMs >= DOOR_SENSOR_DEBOUNCE_MS
    ) {
        lastDoorPhysicallyOpen = pendingDoorSensorState;
        doorOpenedAtMs = lastDoorPhysicallyOpen ? now : 0;
        Serial.printf(
            "[KAPI] Fiziksel durum: %s (GPIO%d=%d)\n",
            lastDoorPhysicallyOpen ? "ACIK" : "KAPALI",
            SENSOR_PIN,
            sensorLevel
        );
        mqttManager.publishDoorStatus(lastDoorPhysicallyOpen);
        if (DoorState::mevcutDurumuAl() == Durum::BEKLEMEDE) {
            lcdDisplay.showIdle(lastDoorPhysicallyOpen);
        }
    }
}

static void updateDoorOpenAlarm() {
    if (!doorSensorInitialized) return;

    if (
        lastDoorPhysicallyOpen
        && !doorOpenAlarmActive
        && millis() - doorOpenedAtMs >= DOOR_OPEN_ALARM_DELAY_MS
    ) {
        doorOpenAlarmActive = true;
        alertSystem.playDoorOpenTooLong();
        lcdDisplay.showAlarm();
        Serial.println(
            "[ALARM] Kapi 20 saniyeden uzun suredir ACIK: "
            "buzzer surekli, mavi LED aktif."
        );
        return;
    }

    if (!lastDoorPhysicallyOpen && doorOpenAlarmActive) {
        doorOpenAlarmActive = false;
        alertSystem.stop(AlertPattern::DoorOpenTooLong);
        lcdDisplay.showIdle(false);
        Serial.println("[ALARM] Kapi KAPANDI: buzzer ve mavi LED kapatildi.");
    }
}

static void updateLcdWorkflowState() {
    if (doorOpenAlarmActive) {
        lcdDisplay.showAlarm();
        return;
    }

    const Durum currentState = DoorState::mevcutDurumuAl();
    if (currentState == lastLcdWorkflowState) return;

    switch (currentState) {
        case Durum::BEKLEMEDE:
            lcdDisplay.showIdle(lastDoorPhysicallyOpen);
            break;
        case Durum::OKUNUYOR:
            lcdDisplay.showChecking();
            break;
        case Durum::ONAYLANDI:
            lcdDisplay.showApproved();
            break;
        case Durum::REDDEDILDI:
            lcdDisplay.showDenied();
            break;
        case Durum::ALARM:
            lcdDisplay.showAlarm();
            break;
    }

    lastLcdWorkflowState = currentState;
}

void setup() {
    Serial.begin(115200);
    Serial.println("[SYSTEM] SecureDoor baslatiliyor...");

    pinMode(SENSOR_PIN, INPUT);
    lcdDisplay.begin();
    lcdDisplay.showBoot();
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
    Serial.println(
        "[DoorState] BEKLEMEDE = kart/PIN bekleniyor; "
        "fiziksel kapi durumu ayri olarak KAPALI/ACIK yazilir."
    );
    alertSystem.playSuccess();
    Serial.println("[BUZZER] Acilis icin bir kisa test sesi verildi.");
    Serial.println("[SYSTEM] Hazir.");
}

void loop() {
    network.update();
    mqttManager.update();
    accessControl.loop();
    processPendingCommands();
    checkAccessResponseTimeout();
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
    if (keypadInput.wasKeyPressed()) {
        alertSystem.playKeypress();

        const CustomKeypadEvent keypadEvent = keypadInput.getLastEvent();
        if (keypadEvent.type == KeypadEventType::KeyPressed) {
            alertSystem.setPinEntryActive(true);
            lcdDisplay.showPinEntry(keypadEvent.pinLength);
        } else if (
            keypadEvent.type == KeypadEventType::PinCleared
            || keypadEvent.type == KeypadEventType::PinCancelled
            || keypadEvent.type == KeypadEventType::PinCompleted
        ) {
            alertSystem.setPinEntryActive(false);
            lcdDisplay.showIdle(lastDoorPhysicallyOpen);
        } else if (keypadEvent.type == KeypadEventType::InvalidLength) {
            alertSystem.setPinEntryActive(false);
            lcdDisplay.showPinInvalid();
        }
    }
    if (keypadInput.hasTimedOut()) {
        alertSystem.setPinEntryActive(false);
    }
    if (keypadInput.isPinReady()) {
        processCredential(keypadInput.consumePin(), false);
    }

    alertSystem.update();
    updatePhysicalDoorState();
    updateDoorOpenAlarm();
    lock.update();
    DoorState::guncelle();
    updateLcdWorkflowState();
    lcdDisplay.update();
}
