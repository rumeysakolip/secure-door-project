#pragma once

#define WIFI_SSID "kablosuz-ag-adi"
#define WIFI_IDENTITY "" // Eduroam anonim kimliği; normal Wi-Fi için boş bırakın.
#define WIFI_USERNAME "" // Eduroam kullanıcı adı; normal Wi-Fi için boş bırakın.
#define WIFI_PASSWORD "kablosuz-ag-parolasi"
#define SERVER_URL "http://192.168.1.10:3000/api/device"
#define ESP32_SECRET_KEY "docker-env-ile-ayni-cihaz-anahtari"
#define MQTT_BROKER_HOST "192.168.1.10"
#define MQTT_BROKER_PORT 1883
#define DEVICE_ID 1
#define DOOR_ID 1

#define RFID_SS_PIN 5
#define RFID_RST_PIN 22
#define RFID_SCK_PIN 18
#define RFID_MISO_PIN 19
#define RFID_MOSI_PIN 23
#define RELAY_PIN 27
#define BUZZER_PIN 14
#define SENSOR_PIN 35
#define LED_RED_PIN 25
#define LED_GREEN_PIN 26
#define LED_BLUE_PIN 13
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 17
#define KEYPAD_ROW_1 4
#define KEYPAD_ROW_2 16
#define KEYPAD_ROW_3 32
#define KEYPAD_ROW_4 33
#define KEYPAD_COL_1 15
#define KEYPAD_COL_2 12
#define KEYPAD_COL_3 2
#define KEYPAD_MIN_LEN 4
#define KEYPAD_MAX_LEN 6
#define KEYPAD_TIMEOUT 15000
#define ZAMAN_DILIMI_DK 180
#define NTP_SUNUCU_1 "pool.ntp.org"
#define NTP_SUNUCU_2 "time.nist.gov"
