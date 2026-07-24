#pragma once

#include <cstdint>
#include <string>
#include <queue>

// Native test ortamlarında std::string desteğini garanti altına al
#ifndef ARDUINOJSON_ENABLE_STD_STRING
#define ARDUINOJSON_ENABLE_STD_STRING 1
#endif
#include <ArduinoJson.h>

// PubSubClient ve WiFi kısımları sadece ESP32 derlemesinde aktif olur
#ifdef ARDUINO
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#endif

// Backend'den ESP32'ye gelebilecek komut tipleri
enum class CommandType {
    DOOR_OPEN,       // Uzaktan kapı açma
    PASSWORD_RENEW,  // Günlük şifre listesi yenileme
    BLOCK,           // Kartı geçici engelleme
    UNBLOCK,         // Kart engelini kaldırma
    UNKNOWN
};

// Prisma 'ErisimKaydi' (erisim_kaydi) tablosu ile %100 uyumlu olay yapısı
struct EntryEvent {
    std::string cihazOlayId;      // UUID (Çevrimdışı/Canlı kayıt benzersiz kimliği)
    int cihazId = 1;              // DB Cihaz ID
    int kapiId = 1;               // DB Kapı ID
    std::string okunanUid;        // Okunan RFID Kart UID ("A1:B2:C3:D4") veya PIN ise boş
    std::string dogrulamaYontemi; // "kart" | "pin" | "uzaktan"
    std::string sonuc;            // "izin" | "red"
    std::string redNedeni;        // "tanimsiz_kart", "gecersiz_pin", "yetkisiz"
    uint32_t timestampEpoch = 0;  // Unix Epoch Zaman Damgası (Saniye)
};

// Sunucudan (MQTT) ESP32'ye gelen komut yapısı
struct DeviceCommand {
    CommandType type = CommandType::UNKNOWN;
    std::string issuedByUserId;
    std::string newPasswordListJson; // PASSWORD_RENEW için gelen JSON dizisi
    std::string targetCardUid;       // BLOCK/UNBLOCK için hedef kart UID
    uint32_t timestampEpoch = 0;
};

class MqttManager {
public:
#ifdef ARDUINO
    MqttManager(const char *brokerHost, uint16_t brokerPort);

    void update();

    bool publishEntryEvent(const EntryEvent &event);
    bool publishHeartbeat(int cihazId = 1);
    bool publishPasswordAck(bool success);

    bool hasPendingCommand() const;
    DeviceCommand popPendingCommand();

    void handleIncomingMessage(char *topic, byte *payload, unsigned int length);
#endif

    // Donanımdan bağımsız static metodlar (Native testler için)
    static std::string buildEventTopic();
    static std::string buildCommandTopic();
    static std::string buildHeartbeatTopic();
    static std::string serializeEntryEvent(const EntryEvent &event);
    static DeviceCommand parseCommand(const std::string &jsonPayload);

private:
#ifdef ARDUINO
    WiFiClient _wifiClient;
    PubSubClient _mqttClient{_wifiClient};
    std::string _eventTopic;
    std::string _commandTopic;
    std::string _heartbeatTopic;

    std::queue<DeviceCommand> _commandQueue;

    uint32_t _lastReconnectAttemptMs = 0;
    uint32_t _reconnectBackoffMs = 1000;

    void attemptReconnect();
#endif
};
