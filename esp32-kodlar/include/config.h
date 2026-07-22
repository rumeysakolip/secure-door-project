#ifndef CONFIG_H
#define CONFIG_H

// ==========================================
// AĞ VE SUNUCU AYARLARI
// ==========================================
#define WIFI_SSID        "WIFI_ADINIZ"
#define WIFI_PASSWORD    "WIFI_SIFRENIZ"

#define SERVER_URL       "http://192.168.1.50/api"
#define MQTT_BROKER_HOST "192.168.1.50"
#define MQTT_BROKER_PORT 1883

// ==========================================
// NTP ZAMAN SUNUCUSU AYARLARI
// ==========================================
#define NTP_SUNUCU_1     "tr.pool.ntp.org"
#define NTP_SUNUCU_2     "pool.ntp.org"
#define ZAMAN_DILIMI_DK  180          // Türkiye: UTC+3 -> 180 dakika

// ==========================================
// DONANIM PİN TANIMLAMALARI (ESP32-WROOM-32)
// ==========================================
#define RELAY_PIN       26  // Selenoid Kilit
#define SENSOR_PIN      27  // Manyetik Kapı Sensörü
#define BUZZER_PIN      14  // Buzzer
#define LED_GREEN_PIN   32  // Yeşil LED
#define LED_RED_PIN     33  // Kırmızı LED

// RFID Pinleri
#define RFID_SS_PIN     5
#define RFID_SCK_PIN    18
#define RFID_MOSI_PIN   23
#define RFID_MISO_PIN   19
#define RFID_RST_PIN    4

// I2C Pinleri
#define I2C_SDA_PIN     21
#define I2C_SCL_PIN     22

// Keypad Pin Tanımlamaları (3x4 Keypad)
#define KEYPAD_ROW_1     13
#define KEYPAD_ROW_2     12
#define KEYPAD_ROW_3     14
#define KEYPAD_ROW_4     27

#define KEYPAD_COL_1     25
#define KEYPAD_COL_2     33
#define KEYPAD_COL_3     32

#define KEYPAD_MIN_LEN   4
#define KEYPAD_MAX_LEN   6
#define KEYPAD_TIMEOUT   15000 // 15 Saniye

// ==========================================
// GÜVENLİK VE ZAMANLAMA SABİTLERİ
// ==========================================
#define MAX_FAILED_ATTEMPTS  3
#define LOCKOUT_DURATION_MS  30000

#endif