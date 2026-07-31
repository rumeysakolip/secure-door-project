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
            "(39=TIMEOUT, 201=AP_BULUNAMADI, 202=AUTH_FAIL, "
            "203=ASSOC_FAIL, 204=HANDSHAKE_TIMEOUT, "
            "205=CONNECTION_FAIL)\n",
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
    WiFi.disconnect(true, true);
    delay(100);
    WiFi.mode(WIFI_STA); // ESP32'yi bir istemci (istasyon) moduna alıyoruz
    WiFi.setAutoReconnect(false);
    WiFi.setScanMethod(WIFI_ALL_CHANNEL_SCAN);
    WiFi.setSortMethod(WIFI_CONNECT_AP_BY_SIGNAL);
    WiFi.setSleep(false);
    WiFi.setTxPower(WIFI_POWER_19_5dBm);

    startConnection();
    
    Serial.print("\n[Wi-Fi] Baglaniliyor: ");
    Serial.println(ssid);
    
    // Zaman sunucularını (NTP) ayarlıyoruz. 
    // Türkiye UTC+3 dilimindedir (3 saat * 3600 saniye = 10800). Yaz saati uygulamamız yok (0).
    configTime(10800, 0, "pool.ntp.org", "time.nist.gov");
}

void NetworkManager::startConnection() {
    if (identity != nullptr && strlen(identity) > 0) {
        // SUBU eduroam: EAP-TTLS + PAP. Her denemede temiz olarak yeniden
        // uygulanir; bu, eski bir EAP oturumunun kullanilmasini onler.
        esp_wifi_sta_wpa2_ent_disable();
        const esp_err_t identityResult = esp_wifi_sta_wpa2_ent_set_identity(
            reinterpret_cast<const uint8_t*>(identity),
            strlen(identity)
        );
        const esp_err_t usernameResult = esp_wifi_sta_wpa2_ent_set_username(
            reinterpret_cast<const uint8_t*>(username),
            strlen(username)
        );
        const esp_err_t passwordResult = esp_wifi_sta_wpa2_ent_set_password(
            reinterpret_cast<const uint8_t*>(password),
            strlen(password)
        );
        const esp_err_t phase2Result =
            esp_wifi_sta_wpa2_ent_set_ttls_phase2_method(ESP_EAP_TTLS_PHASE2_PAP);
        const esp_err_t enableResult = esp_wifi_sta_wpa2_ent_enable();
        const wl_status_t beginResult = WiFi.begin(ssid);
        Serial.printf(
            "[Wi-Fi] eduroam EAP-TTLS/PAP baslatildi "
            "(kimlik=%d, kullanici=%d, parola=%d, phase2=%d, enable=%d, "
            "baslangic=%d; 0=ayar OK).\n",
            identityResult,
            usernameResult,
            passwordResult,
            phase2Result,
            enableResult,
            static_cast<int>(beginResult)
        );
    } else {
        WiFi.begin(ssid, password);
    }

    previousMillis = millis();
}

// 3. Arka Plan Güncelleyici (loop içinde sürekli çağrılacak)
void NetworkManager::update() {
    unsigned long currentMillis = millis();

    // --- A. Wi-Fi KOPMA VE YENİDEN BAĞLANMA MANTIĞI ---
    // Eğer internet yoksa VE son denemeden beri 10 saniye (interval) geçtiyse
    if ((WiFi.status() != WL_CONNECTED) && (currentMillis - previousMillis >= interval)) {
        Serial.println("[Wi-Fi] Baglanti koptu! Yeniden baglaniliyor...");
        WiFi.disconnect();
        delay(100);
        startConnection();
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
