#ifndef ACCESS_CONTROL_H
#define ACCESS_CONTROL_H

#include <Arduino.h>
#include <Preferences.h>
#include "config.h"

class AccessControl {
private:
    Preferences preferences;
    static const unsigned long HTTP_TIMEOUT_MS = 2000;
    String _lastOfflineUserId; // Çevrimdışı girişte şifreden yakalanan kullanıcı ID'si

public:
    AccessControl();
    void begin();
    void loop();

    // Tek yönlü doğrulama (isCard = true ise kart, false ise şifre)
    bool verifyAccess(String authData, bool isCard);

    // Kişiye Özel Çevrimdışı Şifre Yönetimi (Yeni Entegrasyon)
    void syncOfflinePins(String jsonList);  // Sunucudan (MQTT) gelen JSON listesini kaydeder
    String getLastOfflineUserId();          // Çevrimdışı girişte doğrulanan kişinin ID'sini döner
};

#endif