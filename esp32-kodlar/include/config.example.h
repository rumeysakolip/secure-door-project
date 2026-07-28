#ifndef CONFIG_H
#define CONFIG_H

// ==========================================
// AĞ VE SUNUCU AYARLARI
// ==========================================
// UYARI: Bu dosya örnektir. Gerçek değerlerle "config.h" adında bir kopya
// oluşturun ve kendi bilgilerinizi girin. config.h asla commit edilmemelidir.
#define WIFI_SSID        "your-wifi-ssid"
#define WIFI_PASSWORD    "your-wifi-password"
#define SERVER_URL       "http://your-server-ip:3000/api"
#define MQTT_BROKER_HOST "your-mqtt-broker-ip"
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
#define RELAY_PIN       12
#define SENSOR_PIN      2
#define BUZZER_PIN      14

#define LED_RED_PIN     25
#define LED_GREEN_PIN   26
#define LED_BLUE_PIN    27

#define RFID_RST_PIN    15
#define RFID_MISO_PIN   34
#define RFID_MOSI_PIN   13
#define RFID_SCK_PIN    32
#define RFID_SS_PIN     33

#define I2C_SDA_PIN     23
#define I2C_SCL_PIN     22

#define KEYPAD_ROW_1     4
#define KEYPAD_ROW_2     16
#define KEYPAD_ROW_3     17
#define KEYPAD_ROW_4     5
#define KEYPAD_COL_1     18
#define KEYPAD_COL_2     19
#define KEYPAD_COL_3     21
#define KEYPAD_MIN_LEN   4
#define KEYPAD_MAX_LEN   6
#define KEYPAD_TIMEOUT   15000

// ==========================================
// GÜVENLİK VE ZAMANLAMA SABİTLERİ
// ==========================================
#define MAX_FAILED_ATTEMPTS  3
#define LOCKOUT_DURATION_MS  30000

#endif