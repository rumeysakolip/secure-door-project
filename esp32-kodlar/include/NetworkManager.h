#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <time.h> // NTP'den saat çekmek için gerekli standart kütüphane

class NetworkManager {
private:
    const char* ssid;
    const char* password;
    
    unsigned long previousMillis;
    const long interval = 10000; // Wi-Fi koptuğunda her 10 saniyede bir bağlanmayı dener
    
    bool timeSynced;

    // Sadece bu sınıfın içinde kullanılacak özel saat çekme fonksiyonu
    void syncTime(); 

public:
    // Kurucu: Hangi ağa bağlanacağımızı parametre olarak alır
    NetworkManager(const char* wifi_ssid, const char* wifi_password);
    
    void begin();
    void update(); // Sistemin kalbi gibi sürekli dönecek
    
    bool isConnected(); // İnternet var mı yok mu durumunu döndürür
    bool isTimeSet();   // Saat internetten başarıyla çekildi mi?
    
    void printLocalTime(); // Saati terminalde test etmek için yazdırır
};

#endif