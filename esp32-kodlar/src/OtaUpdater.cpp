#include "OtaUpdater.h"

#ifdef ARDUINO

#include <Arduino.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <algorithm>
#include <cctype>

#include "config.h"
#include "FirmwareVersion.h"

OtaUpdater::OtaUpdater(MqttManager &mqttManager)
    : _mqttManager(mqttManager) {}

bool OtaUpdater::isValidHttpUrl(const std::string &url) {
    return url.size() >= 10
        && url.size() <= 1024
        && url.rfind("http://", 0) == 0;
}

bool OtaUpdater::isValidMd5(const std::string &md5) {
    return md5.size() == 32
        && std::all_of(md5.begin(), md5.end(), [](unsigned char value) {
            return std::isxdigit(value) != 0;
        });
}

bool OtaUpdater::performUpdate(const DeviceCommand &command) {
    const std::string &version = command.firmwareVersion;

    if (WiFi.status() != WL_CONNECTED || !_mqttManager.isConnected()) {
        Serial.println("[OTA] Wi-Fi/MQTT baglantisi yok; guncelleme baslatilmadi.");
        _mqttManager.publishOtaStatus("HATA", "Wi-Fi veya MQTT baglantisi yok", version);
        return false;
    }

    if (!isValidHttpUrl(command.firmwareUrl)) {
        Serial.println("[OTA] Gecersiz firmware URL; yalnizca http:// destekleniyor.");
        _mqttManager.publishOtaStatus("HATA", "Gecersiz firmware URL", version);
        return false;
    }

    if (version.empty() || !isValidMd5(command.firmwareMd5) || command.firmwareSize == 0) {
        Serial.println("[OTA] Firmware surum/hash/boyut bilgisi eksik veya gecersiz.");
        _mqttManager.publishOtaStatus("HATA", "Firmware metadata gecersiz", version);
        return false;
    }

    if (!command.forceFirmwareUpdate && version == FIRMWARE_VERSION) {
        Serial.printf("[OTA] Firmware zaten guncel: %s\n", FIRMWARE_VERSION);
        _mqttManager.publishOtaStatus("GUNCEL", "Cihaz zaten bu surumde", version, 100);
        return true;
    }

    const uint32_t availableSpace = ESP.getFreeSketchSpace();
    if (command.firmwareSize > availableSpace) {
        Serial.printf(
            "[OTA] Firmware sigmiyor: gereken=%lu, uygun=%lu bayt.\n",
            (unsigned long)command.firmwareSize,
            (unsigned long)availableSpace
        );
        _mqttManager.publishOtaStatus("HATA", "Firmware OTA bolumune sigmiyor", version);
        return false;
    }

    Serial.printf(
        "[OTA] Guncelleme basliyor: %s -> %s (%lu bayt).\n",
        FIRMWARE_VERSION,
        version.c_str(),
        (unsigned long)command.firmwareSize
    );
    _mqttManager.publishOtaStatus("BASLADI", "Firmware indiriliyor", version, 0);
    delay(150);

    WiFiClient otaClient;
    httpUpdate.rebootOnUpdate(false);
    httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

    int lastReportedProgress = -10;
    httpUpdate.onProgress([&](int current, int total) {
        if (total <= 0) return;
        const int percent = (current * 100) / total;
        if (percent - lastReportedProgress >= 10) {
            lastReportedProgress = percent;
            Serial.printf("[OTA] Ilerleme: %d%%\n", percent);
        }
    });

    const String expectedMd5(command.firmwareMd5.c_str());
    const HTTPUpdateResult result = httpUpdate.update(
        otaClient,
        String(command.firmwareUrl.c_str()),
        String(FIRMWARE_VERSION),
        [&](HTTPClient *http) {
            http->addHeader("x-OTA-Expected-MD5", expectedMd5);
            http->addHeader("x-Device-Id", String(DEVICE_ID));
        }
    );

    if (result == HTTP_UPDATE_OK) {
        Serial.printf("[OTA] Firmware %s basariyla yazildi; yeniden baslatiliyor.\n", version.c_str());
        _mqttManager.publishOtaStatus("BASARILI", "Firmware yazildi; cihaz yeniden baslatiliyor", version, 100);
        delay(750);
        ESP.restart();
        return true;
    }

    if (result == HTTP_UPDATE_NO_UPDATES) {
        Serial.println("[OTA] Sunucu yeni firmware olmadigini bildirdi.");
        _mqttManager.publishOtaStatus("GUNCEL", "Yeni firmware yok", version, 100);
        return true;
    }

    const String error = httpUpdate.getLastErrorString();
    Serial.printf(
        "[OTA] Guncelleme basarisiz: kod=%d, hata=%s\n",
        httpUpdate.getLastError(),
        error.c_str()
    );
    _mqttManager.publishOtaStatus("HATA", error.c_str(), version);
    return false;
}

#endif
