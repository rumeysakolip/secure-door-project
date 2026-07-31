#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <time.h> // NTP'den saat çekmek için gerekli standart kütüphane

class NetworkManager {
private:
    const char* ssid;
    const char* identity;
    const char* username;
    const char* password;
    
    unsigned long previousMillis;
    const long interval = 60000; // Kurumsal EAP oturumunun tamamlanmasi icin 60 saniye bekle
    
    bool timeSynced;
    void startConnection();

    // Sadece bu sınıfın içinde kullanılacak özel saat çekme fonksiyonu
    void syncTime(); 

public:
    // Kurucu: Hangi ağa bağlanacağımızı parametre olarak alır
    NetworkManager(
        const char* wifi_ssid,
        const char* wifi_identity,
        const char* wifi_username,
        const char* wifi_password
    );
    
    void begin();
    void update(); // Sistemin kalbi gibi sürekli dönecek
    
    bool isConnected(); // İnternet var mı yok mu durumunu döndürür
    bool isTimeSet();   // Saat internetten başarıyla çekildi mi?
    
    void printLocalTime(); // Saati terminalde test etmek için yazdırır
};

#endif
