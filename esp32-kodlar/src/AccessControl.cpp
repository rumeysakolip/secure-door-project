#include "AccessControl.h"
#include <WiFi.h>          
#include <HTTPClient.h>    
#include <time.h>          
#include "config.h"       

AccessControl::AccessControl() {
    failedAttempts = 0;
    lockoutStartTime = 0;
    systemLocked = false;
}

void AccessControl::begin() {
    preferences.begin("whitelist", false); 
    Serial.println("[AUTH] Erisim Kontrol Sistemi baslatildi.");
}

void AccessControl::loop() {
    if (systemLocked) {
        if (millis() - lockoutStartTime >= LOCKOUT_DURATION_MS) {
            systemLocked = false; 
            failedAttempts = 0;   
            Serial.println("[AUTH] Sistem kilidi acildi.");
        }
    }
}

String AccessControl::hashOnly(String authData) {
    uint32_t hash = 5381;
    for (size_t i = 0; i < authData.length(); i++) {
        hash = ((hash << 5) + hash) + (uint8_t)authData.charAt(i);
    }
    char buf[9];
    snprintf(buf, sizeof(buf), "%08X", hash);
    return String(buf);
}

String AccessControl::buildKey(char prefix, String authData, bool isCard) {
    String key = "";
    key += prefix;
    key += (isCard ? "C" : "P");
    key += hashOnly(authData);
    return key; 
}

bool AccessControl::verifyAccess(String authData, bool isCard, bool &outWasEntry) {
    if (systemLocked) {
        outWasEntry = false; 
        return false; 
    }

    if (!isCard && authData == getTodayTeacherPassword()) {
        failedAttempts = 0;    
        outWasEntry = true;    
        return true;
    }

    if (WiFi.status() != WL_CONNECTED) {
        if (!isCard) {
            failedAttempts++;
            if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                systemLocked = true;
                lockoutStartTime = millis();
            }
        }
        outWasEntry = false;
        return false; 
    }

    bool accessGranted = false;
    HTTPClient http;
    http.begin(SERVER_URL); 
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");
    
    // 2000 ms Katı Timeout Süresi
    http.setTimeout(HTTP_TIMEOUT_MS); 

    String httpRequestData = "authData=" + authData + "&isCard=" + (isCard ? "1" : "0");
    int httpResponseCode = http.POST(httpRequestData);

    if (httpResponseCode == 200) {
        String response = http.getString();
        if (response.startsWith("OK") || response == "1") {
            accessGranted = true;
            outWasEntry = response.indexOf("EXIT") == -1; 
        }
    }
    http.end(); 

    if (accessGranted) {
        failedAttempts = 0; 
        return true;
    } else {
        failedAttempts++;
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            systemLocked = true;
            lockoutStartTime = millis();
        }
        return false;
    }
}

void AccessControl::blockUser(String authData, bool isCard) {
    String key = buildKey('S', authData, isCard);
    preferences.putUChar(key.c_str(), STATUS_BLOCKED);
}

void AccessControl::unblockUser(String authData, bool isCard) {
    String statusKey = buildKey('S', authData, isCard);
    String violationKey = buildKey('V', authData, isCard);
    preferences.putUChar(statusKey.c_str(), STATUS_ACTIVE);
    preferences.putInt(violationKey.c_str(), 0);
}

bool AccessControl::isSystemLockedOut() { return systemLocked; }

int AccessControl::getRemainingLockoutSeconds() {
    if (!systemLocked) return 0;
    unsigned long passed = millis() - lockoutStartTime;
    if (passed >= (unsigned long)LOCKOUT_DURATION_MS) return 0;
    return (LOCKOUT_DURATION_MS - passed) / 1000;
}

void AccessControl::syncWithServer() {
    if (WiFi.status() != WL_CONNECTED) return; 

    HTTPClient http;
    http.begin(String(SERVER_URL) + "/get_all_users"); 
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.GET();
    http.end();
}

bool AccessControl::syncTeacherPassword() {
    if (WiFi.status() != WL_CONNECTED) return false; 

    bool success = false;
    HTTPClient http;
    http.begin(String(SERVER_URL) + "/get_teacher_password"); 
    http.setTimeout(HTTP_TIMEOUT_MS); 

    int httpResponseCode = http.GET();
    if (httpResponseCode == 200) {
        String newPassword = http.getString();
        newPassword.trim(); 
        if (newPassword.length() > 0) {
            setTeacherPassword(newPassword);
            success = true;
        }
    }
    http.end();
    return success;
}

// Yeni şifreyi kalıcı hafızaya tam eskisin üstüne yazar
void AccessControl::setTeacherPassword(const String& newPassword) {
    if (newPassword.length() > 0) {
        preferences.putString("today_pwd", newPassword);
        Serial.printf("[AUTH] Ogretmen sifresi guncellendi: %s\n", newPassword.c_str());
    }
}

String AccessControl::getTodayTeacherPassword() {
    return preferences.getString("today_pwd", "1234");
}