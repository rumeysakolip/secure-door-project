#pragma once

#include <cstdint>
#include <string>
#include <queue>

// native ortamda da std::string desteğini garanti altına al
#ifndef ARDUINOJSON_ENABLE_STD_STRING
#define ARDUINOJSON_ENABLE_STD_STRING 1
#endif
#include <ArduinoJson.h>

// PubSubClient/WiFi gibi donanıma özgü kısımlar sadece esp32dev ortamında
// derlenir; native testte bu blok atlanır.
#ifdef ARDUINO
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#endif

enum class CommandType { DOOR_OPEN, PASSWORD_RENEW, BLOCK, UNBLOCK, UNKNOWN };

struct EntryEvent {
    std::string cardId;
    std::string method;          // "kart" | "sifre" | "uzaktan"
    std::string result;          // "basarili" | "basarisiz" | "bloke"
    unsigned long timestampEpoch = 0;
};

struct DeviceCommand {
    CommandType type = CommandType::UNKNOWN;
    std::string issuedByUserId;
    std::string newPassword;     // sadece PASSWORD_RENEW için doludur
    unsigned long timestampEpoch = 0;
};

class MqttManager {
public:
#ifdef ARDUINO
    MqttManager(const char *brokerHost, uint16_t brokerPort);

    void update();
    
    bool publishEntryEvent(const EntryEvent &event);
    bool publishHeartbeat();
    bool publishPasswordAck(bool success); // Sunucuya Şifre Onay (ACK) Yanıtı Fırlatır

    bool hasPendingCommand() const;
    DeviceCommand popPendingCommand();

    // PubSubClient'ın çağırdığı ham callback
    void handleIncomingMessage(char *topic, byte *payload, unsigned int length);
#endif

    // ---- Donanımdan bağımsız, native ortamda test edilebilen saf mantık ----
    static std::string buildEventTopic();
    static std::string buildCommandTopic();
    static std::string serializeEntryEvent(const EntryEvent &event);
    static DeviceCommand parseCommand(const std::string &jsonPayload);

private:
#ifdef ARDUINO
    WiFiClient _wifiClient;
    PubSubClient _mqttClient{_wifiClient};
    std::string _eventTopic;
    std::string _commandTopic;

    std::queue<DeviceCommand> _commandQueue;

    unsigned long _lastReconnectAttemptMs = 0;
    unsigned long _reconnectBackoffMs = 1000;
    static const unsigned long MAX_RECONNECT_BACKOFF_MS = 30000;

    void attemptReconnect();
#endif
};