#include "AccessControl.h"

#ifndef ARDUINOJSON_ENABLE_STD_STRING
#define ARDUINOJSON_ENABLE_STD_STRING 1
#endif
#include <ArduinoJson.h>

#ifdef ARDUINO
AccessControl::AccessControl() {
    _lastOfflineUserId = "";
}

void AccessControl::begin() {
    preferences.begin("securedoor", false);
    Serial.println("[AUTH] Erisim Kontrol Sistemi baslatildi (MQTT).");
}

void AccessControl::loop() {
}

bool AccessControl::verifyOfflineAccess(String authData, bool isCard) {
    _lastOfflineUserId = "";

    if (isCard) {
        Serial.println("[AUTH-OFFLINE] MQTT yok; kart dogrulamasi yapilamaz.");
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

void AccessControl::syncOfflinePins(String jsonList, bool replaceList) {
    String listToStore = jsonList;

    if (!replaceList) {
        JsonDocument incomingDoc;
        DeserializationError incomingError = deserializeJson(incomingDoc, jsonList);
        if (incomingError || !incomingDoc.is<JsonArray>()) {
            Serial.println("[AUTH] Gelen offline sifre listesi gecersiz, kaydedilmedi.");
            return;
        }

        String currentJson = preferences.getString("offline_pins", "[]");
        JsonDocument currentDoc;
        DeserializationError currentError = deserializeJson(currentDoc, currentJson);

        JsonDocument mergedDoc;
        JsonArray mergedList = mergedDoc.to<JsonArray>();
        JsonArray incomingList = incomingDoc.as<JsonArray>();

        if (!currentError && currentDoc.is<JsonArray>()) {
            for (JsonObject currentUser : currentDoc.as<JsonArray>()) {
                const String currentUserId = currentUser["u"] | "";
                bool replaced = false;

                for (JsonObject incomingUser : incomingList) {
                    const String incomingUserId = incomingUser["u"] | "";
                    if (currentUserId == incomingUserId) {
                        replaced = true;
                        break;
                    }
                }

                if (!replaced) {
                    mergedList.add(currentUser);
                }
            }
        }

        for (JsonObject incomingUser : incomingList) {
            mergedList.add(incomingUser);
        }

        listToStore = "";
        serializeJson(mergedDoc, listToStore);
    }

    preferences.putString("offline_pins", listToStore);
    Serial.println("[AUTH] Yeni offline kisi/sifre listesi NVS hafizaya kaydedildi.");
}

String AccessControl::getLastOfflineUserId() {
    return _lastOfflineUserId;
}
#endif

std::string AccessControl::findUserByOfflinePin(
    const std::string &jsonList,
    const std::string &pin
) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, jsonList);

    if (!err && doc.is<JsonArray>()) {
        for (JsonObject user : doc.as<JsonArray>()) {
            std::string storedPin = user["p"].as<std::string>();
            if (pin == storedPin) {
                return user["u"].as<std::string>();
            }
        }
    }

    return "";
}
