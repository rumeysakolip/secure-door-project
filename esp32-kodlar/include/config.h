#ifndef CONFIG_H
#define CONFIG_H
// ==========================================
// AĞ VE SUNUCU AYARLARI
// ==========================================
#define WIFI_SSID        "Wifi-esp"
#define WIFI_PASSWORD    "wzid7522"
#define SERVER_URL       "http://10.254.64.89:3000/api"
#define MQTT_BROKER_HOST "10.254.64.89"
#define MQTT_BROKER_PORT 1883
// ==========================================
// NTP ZAMAN SUNUCUSU AYARLARI
// ==========================================
#define NTP_SUNUCU_1     "tr.pool.ntp.org"
#define NTP_SUNUCU_2     "pool.ntp.org"
#define ZAMAN_DILIMI_DK  180          // Türkiye: UTC+3 -> 180 dakika
// ==========================================
// DONANIM PİN TANIMLAMALARI (ESP32)
// ==========================================
// UYARI: GPIO0, GPIO2 ve GPIO15 ESP32'nin "strapping" pinleridir
// (boot modunu belirlerler). Röle/sensör/RST hatti acilista bu pinleri
// LOW/HIGH'a cekerse ESP32 nadiren yanlis modda (indirme modu vb.)
// acilabilir ya da boot loglari kesilebilir. Sistem su an bu pinlerle
// boot edebiliyorsa dokunmaya gerek yok; ama ileride "bazen acilmiyor/
// resetleniyor" gibi kararsiz bir davranis gorursseniz once bu 3 pini
// suphelenin.
#define RELAY_PIN       0   // Röle IN Pini (Röle Tetikleme) -- strapping pin (GPIO0), dikkat
#define SENSOR_PIN      2   // Kilit Sarı Kablo (Kapı Durum Sensörü) -- strapping pin (GPIO2), dikkat
#define BUZZER_PIN      14  // Buzzer Pini
// RGB LED Pin Tanımlamaları
#define LED_RED_PIN     25  // RGB Kırmızı Pin
#define LED_GREEN_PIN   26  // RGB Yeşil Pin
#define LED_BLUE_PIN    27  // RGB Mavi Pin
// RFID (RC522) Pin Tanımlamaları
//
// ONEMLI: GPIO34/35/36/39 ESP32'de "input-only" pinlerdir; cikis (output)
// suruculeri yoktur. MOSI hatti ESP32'den RC522'ye VERI GONDERIR, yani
// mutlaka cikis yapabilen bir pin olmalidir. RFID_MOSI_PIN daha once 35
// idi -- bu pin fiziksel olarak MOSI olarak calisamaz (kablolama %100
// dogru olsa bile RC522 hicbir komut alamaz, PCD_ReadRegister hep
// 0x00/0xFF doner, yani "BAGLANTI YOK" mesaji budur). GPIO13'e tasindi
// (bos ve cikis yapabilen bir pin, strapping pin degil). Bu degisiklikle
// birlikte RC522 uzerindeki fiziksel MOSI/SDA kablosunu da GPIO13'e
// tasimaniz gerekiyor.
#define RFID_RST_PIN    15  // RST Pini -- strapping pin (GPIO15), dikkat
#define RFID_MISO_PIN   34  // MISO Pini (input-only olmasi sorun degil, MISO zaten giris yonlu)
#define RFID_MOSI_PIN   13  // MOSI Pini (DUZELTILDI: eskiden 35 idi, input-only oldugu icin hic calismiyordu)
#define RFID_SCK_PIN    32  // SCK Pini
#define RFID_SS_PIN     33  // SDA (SS) Pini
// I2C Pin Tanımlamaları (LCD Ekran Lojik Seviye Dönüştürücü)
#define I2C_SDA_PIN     23  // LV1 (SDA)
#define I2C_SCL_PIN     22  // LV2 (SCL)
// Keypad Pin Tanımlamaları (3x4 Keypad - 7 Pin)
#define KEYPAD_ROW_1     4
#define KEYPAD_ROW_2     16
#define KEYPAD_ROW_3     17
#define KEYPAD_ROW_4     5
#define KEYPAD_COL_1     18
#define KEYPAD_COL_2     19
#define KEYPAD_COL_3     21  // Klavye 7. pini için ayrıldı
#define KEYPAD_MIN_LEN   4
#define KEYPAD_MAX_LEN   6
#define KEYPAD_TIMEOUT   15000 // 15 Saniye
// ==========================================
// GÜVENLİK VE ZAMANLAMA SABİTLERİ
// ==========================================
#define MAX_FAILED_ATTEMPTS  3
#define LOCKOUT_DURATION_MS  30000
#endif
