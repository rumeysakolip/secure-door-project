#ifndef ACCESS_CONTROL_H
#define ACCESS_CONTROL_H

#include <string>

#ifdef ARDUINO
#include <Arduino.h>
#include <Preferences.h>
#include "config.h"
#endif

class AccessControl {
private:
#ifdef ARDUINO
    Preferences preferences;
    static const unsigned long HTTP_TIMEOUT_MS = 2000;
    String _lastOfflineUserId; // Çevrimdışı girişte şifreden yakalanan kullanıcı ID'si
#endif

public:
#ifdef ARDUINO
    AccessControl();
    void begin();
    void loop();

    // Tek yönlü doğrulama (isCard = true ise kart, false ise şifre)
    bool verifyAccess(String authData, bool isCard);

    // Kişiye Özel Çevrimdışı Şifre Yönetimi
    void syncOfflinePins(String jsonList);
    String getLastOfflineUserId();
#endif

    // Donanımdan bağımsız, native test edilebilir saf mantık: JSON listede
    // PIN arar, bulursa kullanıcı ID'sini döner, bulamazsa boş string döner.
    static std::string findUserByOfflinePin(const std::string& jsonList, const std::string& pin);
};

#endif