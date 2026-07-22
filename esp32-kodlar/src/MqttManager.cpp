#include "MqttManager.h"

#ifdef ARDUINO

static MqttManager *g_activeInstance = nullptr;

static void mqttCallbackTrampoline(char *topic, byte *payload, unsigned int length) {
    if (g_activeInstance != nullptr) {
        g_activeInstance->handleIncomingMessage(topic, payload, length);
    }
}

MqttManager::MqttManager(const char *brokerHost, uint16_t brokerPort) {
    _eventTopic = buildEventTopic();
    _commandTopic = buildCommandTopic();

    _mqttClient.setServer(brokerHost, brokerPort);
    _mqttClient.setCallback(mqttCallbackTrampoline);
    g_activeInstance = this;
}

void MqttManager::attemptReconnect() {
    if (WiFi.status() != WL_CONNECTED) {
        return; 
    }

    Serial.print("[MqttManager] Broker'a baglaniliyor... ");
    if (_mqttClient.connect("SecureDoor_Client")) {
        Serial.println("baglendi.");
        _mqttClient.subscribe(_commandTopic.c_str());
        _reconnectBackoffMs = 1000; 
    } else {
        Serial.print("basarisiz, rc=");
        Serial.print(_mqttClient.state());
        Serial.printf(". %lu ms sonra tekrar denenecek.\n", (unsigned long)_reconnectBackoffMs);
        _lastReconnectAttemptMs = millis();
        // HATA DÜZELTİLDİ: MAX_BACKOFF_MS yerine MAX_RECONNECT_BACKOFF_MS kullanıldı
        _reconnectBackoffMs = std::min(_reconnectBackoffMs * 2, MAX_RECONNECT_BACKOFF_MS);
    }
}

void MqttManager::update() {
    if (WiFi.status() != WL_CONNECTED) {
        return;
    }

    if (!_mqttClient.connected()) {
        unsigned long now = millis();
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

bool MqttManager::publishHeartbeat() {
    if (!_mqttClient.connected()) return false;
    return _mqttClient.publish("securedoor/heartbeat", "{\"status\":\"online\"}");
}

bool MqttManager::publishPasswordAck(bool success) {
    if (!_mqttClient.connected()) return false;
    String payload = "{\"status\":\"" + String(success ? "ok" : "error") + "\"}";
    return _mqttClient.publish("securedoor/acks", payload.c_str());
}

bool MqttManager::hasPendingCommand() const {
    return !_commandQueue.empty();
}

DeviceCommand MqttManager::popPendingCommand() {
    if (_commandQueue.empty()) return DeviceCommand{};
    DeviceCommand cmd = _commandQueue.front();
    _commandQueue.pop();
    return cmd;
}

void MqttManager::handleIncomingMessage(char *topic, byte *payload, unsigned int length) {
    std::string jsonPayload(reinterpret_cast<char *>(payload), length);
    DeviceCommand cmd = parseCommand(jsonPayload);
    if (cmd.type != CommandType::UNKNOWN) {
        _commandQueue.push(cmd);
    }
}

#endif // ARDUINO

// Native ortam ve genel statik metodlar
std::string MqttManager::buildEventTopic() {
    return "securedoor/events";
}

std::string MqttManager::buildCommandTopic() {
    return "securedoor/commands";
}

std::string MqttManager::serializeEntryEvent(const EntryEvent &event) {
    JsonDocument doc;
    doc["kart_id"] = event.cardId;
    doc["yontem"] = event.method;
    doc["sonuc"] = event.result;
    doc["zaman"] = event.timestampEpoch;

    std::string output;
    serializeJson(doc, output);
    return output;
}

DeviceCommand MqttManager::parseCommand(const std::string &jsonPayload) {
    DeviceCommand cmd;

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, jsonPayload);
    if (err) return cmd;

    std::string komutTipi = doc["komut_tipi"] | std::string("");
    cmd.issuedByUserId = doc["kullanici_id"] | std::string("");

    if (komutTipi == "PASSWORD_RENEW") {
        cmd.type = CommandType::PASSWORD_RENEW;
        if (doc["yeni_liste"].is<JsonArray>()) {
            std::string serializedList;
            serializeJson(doc["yeni_liste"], serializedList);
            cmd.newPassword = serializedList;
        } else if (doc["yeni_sifre"].is<const char*>()) {
            cmd.newPassword = doc["yeni_sifre"].as<std::string>();
        }
    } else if (komutTipi == "DOOR_OPEN" || komutTipi == "kapi_ac") {
        cmd.type = CommandType::DOOR_OPEN;
    }

    return cmd;
}