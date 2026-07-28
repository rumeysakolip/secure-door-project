#include "AccessControl.h"
#include <WiFi.h>          
#include <HTTPClient.h>    
#include <time.h>          
#include <ArduinoJson.h>
#include <mbedtls/md.h>
#include "config.h"

static String hmacSha256(const String &value) {
    unsigned char digest[32];
    const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    mbedtls_md_hmac(
        info,
        reinterpret_cast<const unsigned char*>(ESP32_SECRET_KEY),
        strlen(ESP32_SECRET_KEY),
        reinterpret_cast<const unsigned char*>(value.c_str()),
        value.length(),
        digest
    );

    char hex[65];
    for (size_t i = 0; i < sizeof(digest); ++i) {
        snprintf(hex + (i * 2), 3, "%02x", digest[i]);
    }
    hex[64] = '\0';
    return String(hex);
}

static bool offlineRuleIsActive(JsonObject user) {
    time_t now = time(nullptr);
    if (now < 1600000000) return false;

    struct tm localTime;
    localtime_r(&now, &localTime);
    const int dayMask = localTime.tm_wday == 0 ? 64 : (1 << (localTime.tm_wday - 1));
    const int allowedDays = user["gunMaskesi"] | 127;
    if ((allowedDays & dayMask) == 0) return false;

    char currentBuffer[6];
    snprintf(currentBuffer, sizeof(currentBuffer), "%02d:%02d", localTime.tm_hour, localTime.tm_min);
    const String currentTime(currentBuffer);
    const String startTime = user["saatBaslangic"] | "00:00";
    const String endTime = user["saatBitis"] | "23:59";

    if (startTime <= endTime) {
        return currentTime >= startTime && currentTime <= endTime;
    }
    return currentTime >= startTime || currentTime <= endTime;
}

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
    _lastOfflineUserId = "";

    // 1. DURUM: Cihaz ONLINE (İnternet var)
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        String endpoint = String(SERVER_URL) + (isCard ? "/verify-card" : "/verify-pin");
        http.begin(endpoint);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Device-Key", ESP32_SECRET_KEY);
        http.setTimeout(HTTP_TIMEOUT_MS);

        JsonDocument requestDoc;
        requestDoc[isCard ? "card_uid" : "pin"] = authData;
        requestDoc["cihaz_id"] = DEVICE_ID;
        requestDoc["kapi_id"] = DOOR_ID;
        String payload;
        serializeJson(requestDoc, payload);
        int httpResponseCode = http.POST(payload);

        if (httpResponseCode == 200) {
            String response = http.getString();
            http.end();
            JsonDocument responseDoc;
            if (deserializeJson(responseDoc, response) == DeserializationError::Ok
                && responseDoc["allowed"].as<bool>()) {
                _lastOfflineUserId = responseDoc["kullaniciId"] | "";
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
        // NVS belleğindeki cihaz-özel HMAC ve kart listesini çek.
        String jsonList = preferences.getString("offline_pins", "[]");
        
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, jsonList);

        if (!err && doc.is<JsonArray>()) {
            JsonArray arr = doc.as<JsonArray>();
            for (JsonObject user : arr) {
                const String storedValue = isCard
                    ? String(user["kartUid"] | "")
                    : String(user["p"] | "");
                const String candidate = isCard ? authData : hmacSha256(authData);
                if (offlineRuleIsActive(user) && candidate.equals(storedValue)) {
                    _lastOfflineUserId = user["u"].as<String>(); // Şifrenin sahibi kullanıcı ID'si bulundu
                    Serial.println("[AUTH-OFFLINE] Kimlik bilgisi dogrulandi. Kullanici ID: " + _lastOfflineUserId);
                    return true;
                }
            }
        }

        Serial.println("[AUTH-OFFLINE] Kimlik bilgisi gecersiz, suresi disinda veya kayitli liste yok.");
        return false;
    }
}

// MQTT/HTTP ile push edilen yeni JSON listesini NVS belleğe yazar
void AccessControl::syncOfflinePins(String jsonList, bool replace) {
    if (replace) {
        preferences.putString("offline_pins", jsonList);
        Serial.println("[AUTH] Yeni offline kisi/sifre listesi NVS hafizaya kaydedildi.");
        return;
    }

    JsonDocument currentDoc;
    JsonDocument incomingDoc;
    deserializeJson(currentDoc, preferences.getString("offline_pins", "[]"));
    if (deserializeJson(incomingDoc, jsonList) != DeserializationError::Ok || !incomingDoc.is<JsonArray>()) {
        Serial.println("[AUTH] Gecersiz offline PIN guncellemesi reddedildi.");
        return;
    }

    JsonArray current = currentDoc.is<JsonArray>()
        ? currentDoc.as<JsonArray>()
        : currentDoc.to<JsonArray>();
    for (JsonObject incoming : incomingDoc.as<JsonArray>()) {
        String incomingUserId = incoming["u"] | "";
        bool updated = false;
        for (JsonObject existing : current) {
            if (String(existing["u"] | "") == incomingUserId) {
                existing.set(incoming);
                updated = true;
                break;
            }
        }
        if (!updated) current.add(incoming);
    }

    String mergedList;
    serializeJson(currentDoc, mergedList);
    preferences.putString("offline_pins", mergedList);
    Serial.println("[AUTH] Yeni offline kisi/sifre listesi NVS hafizaya kaydedildi.");
}

// main.cpp'nin offline log atarken kullanıcı ID'sini çekmesini sağlar
String AccessControl::getLastOfflineUserId() {
    return _lastOfflineUserId;
}
