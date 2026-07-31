#include "NetworkManager.h"
#include <esp_wpa2.h>

// WiFi olaylarini (ozellikle kopma nedenini) terminale yazdirir. Sadece
// "Baglanti koptu, tekrar deneniyor" demek yerine ESP-IDF'in verdigi gercek
// sebep kodunu (yanlis sifre/kimlik, RADIUS reddi, AP bulunamadi vb.)
// gorebilmek icin eklendi; sorun giderirken bu satirlar cok onemli.
static void logWifiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
    if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
        Serial.printf(
            "[Wi-Fi] Baglanti KOPTU. Sebep kodu: %d "
            "(bu kodu ESP-IDF wifi_err_reason_t listesinde arayin; "
            "orn. 2=AUTH_EXPIRE, 15=4WAY_HANDSHAKE_TIMEOUT, "
            "202-207 arasi EAP/kimlik dogrulama hatalarini gosterir)\n",
            info.wifi_sta_disconnected.reason
        );
    } else if (event == ARDUINO_EVENT_WIFI_STA_CONNECTED) {
        Serial.println("[Wi-Fi] Erisim noktasina baglandi (henuz IP alinmadi).");
    } else if (event == ARDUINO_EVENT_WIFI_STA_GOT_IP) {
        Serial.print("[Wi-Fi] IP alindi: ");
        Serial.println(WiFi.localIP());
    }
}

// 1. Kurucu: Wi-Fi bilgilerini al ve değişkenleri sıfırla
NetworkManager::NetworkManager(
    const char* wifi_ssid,
    const char* wifi_identity,
    const char* wifi_username,
    const char* wifi_password
) {
    ssid = wifi_ssid;
    identity = wifi_identity;
    username = wifi_username;
    password = wifi_password;
    previousMillis = 0;
    timeSynced = false;
}

// 2. Başlangıç Ayarları
void NetworkManager::begin() {
    Serial.begin(115200); // Terminal (Seri Port) ekranı için
    
    WiFi.onEvent(logWifiEvent);
    WiFi.disconnect(true);
    WiFi.mode(WIFI_STA); // ESP32'yi bir istemci (istasyon) moduna alıyoruz

    if (identity != nullptr && strlen(identity) > 0) {
        esp_wifi_sta_wpa2_ent_set_identity(
            reinterpret_cast<const uint8_t*>(identity),
            strlen(identity)
        );
        esp_wifi_sta_wpa2_ent_set_username(
            reinterpret_cast<const uint8_t*>(username),
            strlen(username)
        );
        esp_wifi_sta_wpa2_ent_set_password(
            reinterpret_cast<const uint8_t*>(password),
            strlen(password)
        );
        // subu.edu.tr eduroam RADIUS'u Windows'un varsayilan EAP-TTLS
        // istemcisiyle (MSCHAPv2) calisiyor; ESP32 tarafinda da ayni ic
        // (phase2) yontemi kullanmak gerekiyor. PAP kabul edilmiyorsa
        // baglanti sessizce (auth reddi ile) basarisiz olur.
        esp_wifi_sta_wpa2_ent_set_ttls_phase2_method(ESP_EAP_TTLS_PHASE2_MSCHAPV2);
        esp_wifi_sta_wpa2_ent_enable();
        WiFi.begin(ssid);
    } else {
        WiFi.begin(ssid, password);
    }
    
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
