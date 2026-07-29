#include "MqttManager.h"
#include <algorithm>

#ifdef ARDUINO
#include "config.h"

static MqttManager *g_activeInstance = nullptr;

// PubSubClient C-style callback yönlendiricisi
static void mqttCallbackTrampoline(char *topic, byte *payload, unsigned int length) {
    if (g_activeInstance != nullptr) {
        g_activeInstance->handleIncomingMessage(topic, payload, length);
    }
}

MqttManager::MqttManager(const char *brokerHost, uint16_t brokerPort) {
    _eventTopic = buildEventTopic();
    _commandTopic = buildCommandTopic();
    _heartbeatTopic = buildHeartbeatTopic();
    _statusTopic = "kapi/" + std::to_string(DEVICE_ID) + "/durum";

    _mqttClient.setServer(brokerHost, brokerPort);
    _mqttClient.setCallback(mqttCallbackTrampoline);
    _mqttClient.setBufferSize(4096);
    g_activeInstance = this;
}

void MqttManager::attemptReconnect() {
    if (WiFi.status() != WL_CONNECTED) {
        return;
    }

    Serial.print("[MqttManager] Broker'a baglaniliyor... ");
    const std::string clientId = "SecureDoor_ESP32_" + std::to_string(DEVICE_ID);
    if (_mqttClient.connect(clientId.c_str())) {
        Serial.println("Baglandi!");
        _mqttClient.subscribe(_commandTopic.c_str());
        _reconnectBackoffMs = 1000;
    } else {
        Serial.print("Basarisiz, rc=");
        Serial.print(_mqttClient.state());
        Serial.printf(". %lu ms sonra tekrar denenecek.\n", (unsigned long)_reconnectBackoffMs);
        _lastReconnectAttemptMs = millis();
        _reconnectBackoffMs = std::min((uint32_t)30000, _reconnectBackoffMs * 2);
    }
}

void MqttManager::update() {
    if (!_mqttClient.connected()) {
        uint32_t now = millis();
        if (now - _lastReconnectAttemptMs >= _reconnectBackoffMs) {
            attemptReconnect();
        }
    } else {
        _mqttClient.loop();
    }
}

bool MqttManager::publishEntryEvent(const EntryEvent &event) {
    if (!_mqttClient.connected()) return false;
    std::string payload = serializeEntryEvent(event);
    return _mqttClient.publish(_eventTopic.c_str(), payload.c_str());
}

bool MqttManager::publishHeartbeat(int cihazId) {
    if (!_mqttClient.connected()) return false;

    JsonDocument doc;
    doc["cihaz_id"] = cihazId;
    doc["durum"] = "cevrimici";
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["zaman"] = millis();

    std::string payload;
    serializeJson(doc, payload);
    return _mqttClient.publish(_heartbeatTopic.c_str(), payload.c_str());
}

bool MqttManager::publishDoorStatus(bool isOpen) {
    if (!_mqttClient.connected()) return false;

    JsonDocument doc;
    doc["cihaz_id"] = DEVICE_ID;
    doc["kapi_durumu"] = isOpen ? "acik" : "kapali";
    doc["durum"] = "cevrimici";
    doc["zaman"] = millis();

    std::string payload;
    serializeJson(doc, payload);
    std::string topic = "kapi/" + std::to_string(DEVICE_ID) + "/durum";
    return _mqttClient.publish(topic.c_str(), payload.c_str());
}

bool MqttManager::publishPasswordAck(bool success) {
    if (!_mqttClient.connected()) return false;

    JsonDocument doc;
    doc["durum"] = success ? "BASARILI" : "HATA";
    doc["mesaj"] = success ? "Sifre listesi guncellendi" : "Sifre guncellenemedi";

    std::string payload;
    serializeJson(doc, payload);
    std::string topic = "kapi/" + std::to_string(DEVICE_ID) + "/durum";
    return _mqttClient.publish(topic.c_str(), payload.c_str());
}

bool MqttManager::isConnected() {
    return _mqttClient.connected();
}

bool MqttManager::hasPendingCommand() const {
    return !_commandQueue.empty();
}

DeviceCommand MqttManager::popPendingCommand() {
    if (_commandQueue.empty()) {
        return DeviceCommand{};
    }
    DeviceCommand cmd = _commandQueue.front();
    _commandQueue.pop();
    return cmd;
}

void MqttManager::handleIncomingMessage(char *topic, byte *payload, unsigned int length) {
    if (_eventTopic == topic || _heartbeatTopic == topic || _statusTopic == topic) {
        return;
    }

    std::string payloadStr(reinterpret_cast<char*>(payload), length);
    DeviceCommand cmd = parseCommand(payloadStr);
    if (cmd.type == CommandType::ACCESS_RESPONSE) {
        Serial.println(cmd.accessAllowed
            ? "[MQTT] Erisim cevabi: ONAY - kapi acilacak."
            : "[MQTT] Erisim cevabi: RED - kapi kapali kalacak.");
    } else {
        Serial.printf("[MqttManager] Komut Geldi [%s]: %s\n", topic, payloadStr.c_str());
    }

    if (cmd.type != CommandType::UNKNOWN) {
        _commandQueue.push(cmd);
    }
}

#endif // ARDUINO

// Native ortam ve Genel Statik Metodlar
std::string MqttManager::buildEventTopic() {
#ifdef ARDUINO
    return "kapi/" + std::to_string(DEVICE_ID) + "/erisim-istek";
#else
    return "kapi/1/erisim-istek";
#endif
}

std::string MqttManager::buildCommandTopic() {
#ifdef ARDUINO
    return "kapi/" + std::to_string(DEVICE_ID) + "/+";
#else
    return "kapi/1/+";
#endif
}

std::string MqttManager::buildHeartbeatTopic() {
#ifdef ARDUINO
    return "kapi/" + std::to_string(DEVICE_ID) + "/saglik";
#else
    return "kapi/1/saglik";
#endif
}

// EntryEvent nesnesini DB ile tam uyumlu JSON string'e çevirir
std::string MqttManager::serializeEntryEvent(const EntryEvent &event) {
    JsonDocument doc;
    doc["mesaj_tipi"] = "ACCESS_REQUEST";
    doc["cihaz_olay_id"] = event.cihazOlayId;
    doc["cihaz_id"] = event.cihazId;
    doc["kapi_id"] = event.kapiId;
    if (!event.okunanUid.empty()) {
        doc["okunan_uid"] = event.okunanUid;
    }
    if (!event.pin.empty()) {
        doc["pin"] = event.pin;
    }
    if (!event.kullaniciId.empty()) {
        doc["kullanici_id"] = event.kullaniciId;
    }
    doc["dogrulama_yontemi"] = event.dogrulamaYontemi;
    if (!event.sonuc.empty()) {
        doc["sonuc"] = event.sonuc;
    }
    if (!event.redNedeni.empty()) {
        doc["red_nedeni"] = event.redNedeni;
    }
    doc["olay_zamani"] = event.timestampEpoch;

    std::string output;
    serializeJson(doc, output);
    return output;
}

// Sunucudan gelen JSON komutu parse eder
DeviceCommand MqttManager::parseCommand(const std::string &jsonPayload) {
    DeviceCommand cmd;

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, jsonPayload);
    if (err) return cmd;

    std::string komutTipi = doc["komut_tipi"] | std::string("");
    cmd.issuedByUserId = doc["kullanici_id"] | std::string("");
    cmd.timestampEpoch = doc["zaman"] | 0;

    if (komutTipi == "DOOR_OPEN") {
        cmd.type = CommandType::DOOR_OPEN;
    } else if (komutTipi == "PASSWORD_RENEW") {
        cmd.type = CommandType::PASSWORD_RENEW;
        cmd.replacePasswordList = doc["replace"] | true;
        if (doc["yeni_liste"].is<JsonArray>()) {
            std::string serializedList;
            serializeJson(doc["yeni_liste"], serializedList);
            cmd.newPasswordListJson = serializedList;
        }
    } else if (komutTipi == "BLOCK") {
        cmd.type = CommandType::BLOCK;
        cmd.targetCardUid = doc["kart_uid"] | std::string("");
    } else if (komutTipi == "UNBLOCK") {
        cmd.type = CommandType::UNBLOCK;
        cmd.targetCardUid = doc["kart_uid"] | std::string("");
    } else if (komutTipi == "ACCESS_RESPONSE" || komutTipi == "erisim-yanit") {
        cmd.type = CommandType::ACCESS_RESPONSE;
        cmd.requestId = doc["cihaz_olay_id"] | std::string("");
        if (cmd.requestId.empty()) {
            cmd.requestId = doc["istek_id"] | std::string("");
        }
        cmd.accessAllowed = doc["onay"] | false;
        cmd.accessUserId = doc["kullanici_id"] | std::string("");
        cmd.accessReason = doc["red_nedeni"] | std::string("");
    }

    return cmd;
}
