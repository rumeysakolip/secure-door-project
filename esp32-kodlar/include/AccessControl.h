#ifndef ACCESS_CONTROL_H
#define ACCESS_CONTROL_H

#include <Arduino.h>
#include <Preferences.h>
#include "config.h"

// Kullanıcı durumu için sabitler
enum UserStatus {
    STATUS_NONE = 0,    // Hafızada yok
    STATUS_ACTIVE = 1,  // Aktif/Girebilir
    STATUS_BLOCKED = 2  // Bloke edilmiş
};

// İçeride mi Dışarıda mı durumu
enum PresenceState {
    PRESENCE_OUT = 0,   // Dışarıda
    PRESENCE_IN = 1     // İçeride
};

class AccessControl {
private:
    Preferences preferences;
    int failedAttempts;
    unsigned long lockoutStartTime;
    bool systemLocked;

    // HTTP için belirlenen maksimum tolerans süresi (2000 ms)
    static const unsigned long HTTP_TIMEOUT_MS = 2000;

    // Özel Yardımcı Metodlar
    String hashOnly(String authData);
    String buildKey(char prefix, String authData, bool isCard);
    int getTodayIndex();
    
    // Durum ve İhlal Yönetimi (Private - Dahili işlemler)
    UserStatus getUserStatus(String authData, bool isCard);
    PresenceState getPresenceState(String authData, bool isCard);
    void setPresenceState(String authData, bool isCard, PresenceState state);
    void setEntryDay(String authData, bool isCard, int dayIndex);
    int getEntryDay(String authData, bool isCard);
    int getMissedExitCount(String authData, bool isCard);
    void incrementMissedExit(String authData, bool isCard);

public:
    AccessControl();
    void begin();
    void loop();

    // Doğrulama İstekleri
    bool verifyAccess(String authData, bool isCard, bool &outWasEntry);

    // Güvenlik Durumu
    bool isSystemLockedOut();
    int getRemainingLockoutSeconds();

    // Yönetim Fonksiyonları
    void blockUser(String authData, bool isCard);
    void unblockUser(String authData, bool isCard);
    
    void addLocalUser(String authData, bool isCard);
    void removeLocalUser(String authData, bool isCard);

    // Senkronizasyon ve Şifre Yönetimi
    void syncWithServer(); 
    bool syncTeacherPassword(); 
    void setTeacherPassword(const String& newPassword); // Anlık MQTT güncellemesi için
    String getTodayTeacherPassword(); 
};

#endif // ACCESS_CONTROL_H