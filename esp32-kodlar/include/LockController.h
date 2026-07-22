#ifndef LOCK_CONTROLLER_H
#define LOCK_CONTROLLER_H

#include <Arduino.h>

class LockController {
private:
    uint8_t relayPin;
    uint8_t buzzerPin;
    
    // Zamanlayıcılar (millis için)
    unsigned long unlockTimer;
    unsigned long cooldownTimer;
    unsigned long doorOpenTimer;
    unsigned long buzzerToggleTimer;
    
    // Durum Bayrakları
    bool isUnlocked;
    bool isCoolingDown;
    bool isDoorPhysicallyOpen;
    bool buzzerState;

    // Süre Ayarları (Milisaniye cinsinden - İstediğin gibi değiştirebilirsin)
    const unsigned long UNLOCK_DURATION = 5000;      // Kilit 5 saniye açık kalır
    const unsigned long COOLDOWN_DURATION = 2000;    // Kondansatör için 2 saniye bekleme
    const unsigned long DOOR_WARNING_TIME = 20000;   // 20 saniye sonra uyarı başlar
    const unsigned long BUZZER_INTERVAL = 500;       // 0.5 saniyede bir kesikli ötme (bip...bip)

public:
    // Kurucu Fonksiyon (Hangi pinleri kullanacağımızı burada belirteceğiz)
    LockController(uint8_t relay_pin, uint8_t buzzer_pin);
    
    // Başlatma fonksiyonu (setup içinde çağrılacak)
    void begin();
    
    // Kapıyı açma komutu (AccessControl'den tetiklenecek)
    // True dönerse kapı açılmıştır, False dönerse kondansatör doluyordur (reddedilir)
    bool unlockDoor(); 
    
    // Sistemin kalbi: Sürekli arkaplanda çalışıp zamanı kontrol edecek
    void update(bool currentDoorSensorState); 
};

#endif