#include "AccessControl.h"
#include <WiFi.h>          
#include <HTTPClient.h>    
#include <time.h>          
#include <ArduinoJson.h>
#include "config.h"       

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

        // NVS belleğindeki JSON şifre listesini çek
        String jsonList = preferences.getString("offline_pins", "[]");
        
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, jsonList);

        if (!err && doc.is<JsonArray>()) {
            JsonArray arr = doc.as<JsonArray>();
            for (JsonObject user : arr) {
                String storedPin = user["p"].as<String>();
                if (authData.equals(storedPin)) {
                    _lastOfflineUserId = user["u"].as<String>(); // Şifrenin sahibi kullanıcı ID'si bulundu
                    Serial.println("[AUTH-OFFLINE] Sifre dogrulandi. Kullanici ID: " + _lastOfflineUserId);
                    return true;
                }
            }
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