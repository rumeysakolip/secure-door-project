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
        _reconnectBackoffMs = std::min(_reconnectBackoffMs * 2, MAX_RECONNECT_BACKOFF_MS);
    }
}

void MqttManager::update() {
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
    if (!_mqttClient.connected()) {
        return false;
    }
    std::string payload = serializeEntryEvent(event);
    return _mqttClient.publish(_eventTopic.c_str(), payload.c_str());
}

bool MqttManager::publishHeartbeat() {
    if (!_mqttClient.connected()) {
        return false;
    }
    JsonDocument doc;
    doc["durum"] = "aktif";
    doc["zaman"] = millis();

    std::string output;
    serializeJson(doc, output);

    std::string hbTopic = "securedoor/heartbeat";
    return _mqttClient.publish(hbTopic.c_str(), output.c_str());
}

// Şifre güncellemesi başarılı bir şekilde yapıldığında sunucuya ACK (Onay) fırlatır
bool MqttManager::publishPasswordAck(bool success) {
    if (!_mqttClient.connected()) {
        return false;
    }
    JsonDocument doc;
    doc["komut_tipi"] = "sifre_guncelle";
    doc["durum"] = success ? "ONAYLANDI" : "HATA";
    doc["zaman"] = millis();

    std::string output;
    serializeJson(doc, output);

    return _mqttClient.publish(_eventTopic.c_str(), output.c_str());
}

bool MqttManager::hasPendingCommand() const {
    return !_commandQueue.empty();
}

DeviceCommand MqttManager::popPendingCommand() {
    if (_commandQueue.empty()) {
        DeviceCommand emptyCmd;
        return emptyCmd;
    }
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
    DeviceCommand cmd; // varsayılan: type = UNKNOWN

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, jsonPayload);
    if (err) {
        return cmd; 
    }

    std::string komutTipi = doc["komut_tipi"] | std::string("");
    cmd.issuedByUserId = doc["kullanici_id"] | std::string("");
    
    // ArduinoJson v7 güncel syntax (containsKey uyarısını kaldırır)
    if (doc["yeni_sifre"].is<const char*>()) {
        cmd.newPassword = doc["yeni_sifre"].as<std::string>();
    } else if (doc["password"].is<const char*>()) {
        cmd.newPassword = doc["password"].as<std::string>();
    } else {
        cmd.newPassword = "";
    }

    cmd.timestampEpoch = doc["zaman"] | 0UL;

    if (komutTipi == "kapi_ac") {
        cmd.type = CommandType::DOOR_OPEN;
    } else if (komutTipi == "sifre_guncelle" || komutTipi == "update_teacher_password") {
        cmd.type = CommandType::PASSWORD_RENEW;
    }

    return cmd;
}

#endif