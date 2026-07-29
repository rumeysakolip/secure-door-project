#ifndef ACCESS_CONTROL_H
#define ACCESS_CONTROL_H

#include <string>

#ifdef ARDUINO
#include <Arduino.h>
#include <Preferences.h>
#endif

class AccessControl {
private:
#ifdef ARDUINO
    Preferences preferences;
    String _lastOfflineUserId;
#endif

public:
#ifdef ARDUINO
    AccessControl();
    void begin();
    void loop();

    // Yalnizca MQTT baglantisi yokken yerel PIN listesini kontrol eder.
    // Kart dogrulamasi her zaman backend tarafinda MQTT ile yapilir.
    bool verifyOfflineAccess(String authData, bool isCard);

    void syncOfflinePins(String jsonList, bool replaceList = true);
    String getLastOfflineUserId();
#endif

    static std::string findUserByOfflinePin(
        const std::string &jsonList,
        const std::string &pin
    );
};

#endif
