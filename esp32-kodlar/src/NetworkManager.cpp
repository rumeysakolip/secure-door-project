#include "NetworkManager.h"

// 1. Kurucu: Wi-Fi bilgilerini al ve değişkenleri sıfırla
NetworkManager::NetworkManager(const char* wifi_ssid, const char* wifi_password) {
    ssid = wifi_ssid;
    password = wifi_password;
    previousMillis = 0;
    timeSynced = false;
}

// 2. Başlangıç Ayarları
void NetworkManager::begin() {
    Serial.begin(115200); // Terminal (Seri Port) ekranı için
    
    WiFi.mode(WIFI_STA); // ESP32'yi bir istemci (istasyon) moduna alıyoruz
    WiFi.begin(ssid, password);
    
    Serial.print("\n[Wi-Fi] Baglaniliyor: ");
    Serial.println(ssid);
    
    // Zaman sunucularını (NTP) ayarlıyoruz. 
    // Türkiye UTC+3 dilimindedir (3 saat * 3600 saniye = 10800). Yaz saati uygulamamız yok (0).
    configTime(10800, 0, "pool.ntp.org", "time.nist.gov");
}

// 3. Arka Plan Güncelleyici (loop içinde sürekli çağrılacak)
void NetworkManager::update() {
    unsigned long currentMillis = millis();

    // --- A. Wi-Fi KOPMA VE YENİDEN BAĞLANMA MANTIĞI ---
    // Eğer internet yoksa VE son denemeden beri 10 saniye (interval) geçtiyse
    if ((WiFi.status() != WL_CONNECTED) && (currentMillis - previousMillis >= interval)) {
        Serial.println("[Wi-Fi] Baglanti koptu! Yeniden baglaniliyor...");
        WiFi.disconnect();
        WiFi.reconnect();
        previousMillis = currentMillis;
        timeSynced = false; // İnternet koptuğu için saatin güncelliği tehlikeye girer
    } 
    
    // --- B. SAAT SENKRONİZASYON MANTIĞI ---
    // Eğer internet BAĞLIYSA ve saat henüz internetten ÇEKİLMEDİYSE
    else if (WiFi.status() == WL_CONNECTED && !timeSynced) {
        syncTime();
    }
}

// 4. İnternetten Saati Çekme İşlemi
void NetworkManager::syncTime() {
    struct tm timeinfo;
    
    // getLocalTime fonksiyonu ESP32'nin saati internetten alıp alamadığını dener
    if (!getLocalTime(&timeinfo)) {
        // Eğer çekemediyse update fonksiyonu sayesinde bir sonraki turda tekrar deneyecek
        return; 
    }
    
    Serial.println("[NTP] Saat internetten basariyla cekildi!");
    timeSynced = true; // Saati çektik, artık sistemi yormamak için tekrar denemeyi bırakıyoruz
    printLocalTime();
    
    // NOT: Donanımlar birleştiğinde, ileride buraya "RTC Modülünü Güncelle" kodunu da ekleyeceğiz.
}

// 5. Durum Döndürücüler
bool NetworkManager::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

bool NetworkManager::isTimeSet() {
    return timeSynced;
}

// 6. Test için Terminale Saati Yazdırma
void NetworkManager::printLocalTime() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        Serial.println("[Hata] Saat henuz ayarlanmadi.");
        return;
    }
    // Saati "Gün Ay Tarih Yıl Saat:Dakika:Saniye" formatında ekrana yazar
    Serial.println(&timeinfo, "[Tarih/Saat] %A, %B %d %Y %H:%M:%S");
}