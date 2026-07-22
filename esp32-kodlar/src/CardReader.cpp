#include "CardReader.h"

#ifdef ARDUINO
#include <SPI.h>

CardReader::CardReader(uint8_t ssPin, uint8_t rstPin)
    : _mfrc522(ssPin, rstPin), _ssPin(ssPin), _rstPin(rstPin) {}

bool CardReader::okuyucuyuBaslat() {
    _mfrc522.PCD_Init();
    byte version = _mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
    return !(version == 0x00 || version == 0xFF);
}

void CardReader::begin() {
    SPI.begin();
    _status = okuyucuyuBaslat() ? ReaderStatus::ACTIVE : ReaderStatus::DISCONNECTED;
    _sonBaglantiDenemesi = millis();
}

void CardReader::update() {
    _newReadFlag = false;

    // Okuyucu bağlantısı koptuysa 3 saniyede bir donanımı otomatik yeniden başlatmayı dener
    if (_status == ReaderStatus::DISCONNECTED) {
        if (millis() - _sonBaglantiDenemesi >= 3000) {
            _sonBaglantiDenemesi = millis();
            if (okuyucuyuBaslat()) {
                _status = ReaderStatus::ACTIVE;
                Serial.println("[CardReader] RFID Okuyucu baglantisi yeniden kuruldu.");
            }
        }
        return; 
    }

    if (!_mfrc522.PICC_IsNewCardPresent() || !_mfrc522.PICC_ReadCardSerial()) {
        return; 
    }

    std::string uid = uidToString(_mfrc522.uid.uidByte, _mfrc522.uid.size);
    _mfrc522.PICC_HaltA();
    _mfrc522.PCD_StopCrypto1();

    if (uid.empty() || !uidGecerliMi(uid)) {
        _status = ReaderStatus::READ_ERROR;
        Serial.println("[CardReader] Gecersiz veya bozuk UID okundu!");
        return;
    }

    unsigned long simdi = millis();
    if (isDuplicateRead(uid, _lastCardId, simdi, _lastReadTimestamp, 1000)) {
        return; 
    }

    _lastCardId = uid;
    _lastReadTimestamp = simdi;
    _newReadFlag = true;
    _status = ReaderStatus::ACTIVE;
}

bool CardReader::hasNewRead() const { return _newReadFlag; }
std::string CardReader::getLastCardId() const { return _lastCardId; }
unsigned long CardReader::getLastReadTimestamp() const { return _lastReadTimestamp; }
ReaderStatus CardReader::getStatus() const { return _status; }

#ifdef DEBUG_FAKE_CARD
void CardReader::injectFakeRead(const std::string &fakeUid, unsigned long timestampMs) {
    if (isDuplicateRead(fakeUid, _lastCardId, timestampMs, _lastReadTimestamp)) {
        _newReadFlag = false;
        return;
    }
    _lastCardId = fakeUid;
    _lastReadTimestamp = timestampMs;
    _newReadFlag = true;
    _status = ReaderStatus::ACTIVE;
}
#endif
#endif

std::string CardReader::uidToString(const uint8_t *uidBytes, uint8_t uidSize) {
    if (uidSize < CardReader::UID_MIN_BAYT || uidSize > CardReader::UID_MAX_BAYT) {
        return "";
    }

    static const char hexChars[] = "0123456789ABCDEF";
    std::string result;
    result.reserve(uidSize * 3 - 1);

    for (uint8_t i = 0; i < uidSize; i++) {
        if (i > 0) {
            result += ':';
        }
        result += hexChars[(uidBytes[i] >> 4) & 0x0F];
        result += hexChars[uidBytes[i] & 0x0F];
    }
    return result;
}

bool CardReader::uidGecerliMi(const std::string &uid) {
    if (uid.size() < UID_MIN_BAYT * 3 - 1 || uid.size() > UID_MAX_BAYT * 3 - 1) {
        return false;
    }
    if ((uid.size() + 1) % 3 != 0) {
        return false;   
    }

    for (size_t i = 0; i < uid.size(); i++) {
        const bool ayiracKonumu = (i % 3 == 2);
        const char c = uid[i];
        if (ayiracKonumu) {
            if (c != ':') return false;
        } else {
            const bool hexMi = (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F');
            if (!hexMi) return false;   
        }
    }
    return true;
}

bool CardReader::isDuplicateRead(const std::string &newUid, const std::string &lastUid,
                                 uint32_t newTimestampMs, uint32_t lastTimestampMs,
                                 uint32_t debounceMs) {
    if (newUid != lastUid) {
        return false;
    }
    return (newTimestampMs - lastTimestampMs) < debounceMs;
}