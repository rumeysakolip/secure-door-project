#include "AccessControl.h"

#ifndef ARDUINOJSON_ENABLE_STD_STRING
#define ARDUINOJSON_ENABLE_STD_STRING 1
#endif
#include <ArduinoJson.h>

#ifdef ARDUINO
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>

AccessControl::AccessControl() {
    _lastOfflineUserId = "";
}

void AccessControl::begin() {
    preferences.begin("securedoor", false);
    Serial.println("[AUTH] Erisim Kontrol Sistemi baslatildi.");
}

void AccessControl::loop() {
    // Arka plan senkronizasyon döngüsü (gerekirse)
}

bool AccessControl::verifyAccess(String authData, bool isCard) {
    // 1. DURUM: Cihaz ONLINE (İnternet var)
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        String endpoint = String(SERVER_URL) + (isCard ? "/verify_card" : "/verify_pin");
        http.begin(endpoint);
        http.addHeader("Content-Type", "application/json");
        http.setTimeout(HTTP_TIMEOUT_MS);

        String payload = "{\"" + String(isCard ? "card_uid" : "pin") + "\":\"" + authData + "\"}";
        int httpResponseCode = http.POST(payload);

        if (httpResponseCode == 200) {
            String response = http.getString();
            http.end();
            if (response.indexOf("true") != -1 || response.indexOf("success") != -1) {
                Serial.println("[AUTH] Sunucu dogrulamasi BASARILI.");
                return true;
            }
        } else {
            http.end();
        }

        Serial.println("[AUTH] Sunucu dogrulamasi REDDEDILDI.");
        return false;
    }
    // 2. DURUM: Cihaz OFFLINE (İnternet yok)
    else {
        if (isCard) {
            Serial.println("[AUTH-OFFLINE] Internet yok! Kart dogrulamasi OFFLINE iken yapilamaz.");
            return false;
        }

        String jsonList = preferences.getString("offline_pins", "[]");
        std::string bulunanUserId = findUserByOfflinePin(
            std::string(jsonList.c_str()),
            std::string(authData.c_str())
        );

        if (!bulunanUserId.empty()) {
            _lastOfflineUserId = String(bulunanUserId.c_str());
            Serial.println("[AUTH-OFFLINE] Sifre dogrulandi. Kullanici ID: " + _lastOfflineUserId);
            return true;
        }

        Serial.println("[AUTH-OFFLINE] Yanlis sifre veya kayitli liste yok.");
        return false;
    }
}

// MQTT/HTTP ile push edilen yeni JSON listesini NVS belleğe yazar
void AccessControl::syncOfflinePins(String jsonList) {
    preferences.putString("offline_pins", jsonList);
    Serial.println("[AUTH] Yeni offline kisi/sifre listesi NVS hafizaya kaydedildi.");
}

// main.cpp'nin offline log atarken kullanıcı ID'sini çekmesini sağlar
String AccessControl::getLastOfflineUserId() {
    return _lastOfflineUserId;
}
#endif

// Donanımdan bağımsız saf fonksiyon: test edilebilir
std::string AccessControl::findUserByOfflinePin(const std::string& jsonList, const std::string& pin) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, jsonList);

    if (!err && doc.is<JsonArray>()) {
        JsonArray arr = doc.as<JsonArray>();
        for (JsonObject user : arr) {
            std::string storedPin = user["p"].as<std::string>();
            if (pin == storedPin) {
                return user["u"].as<std::string>();
            }
        }
    }
    return "";
}