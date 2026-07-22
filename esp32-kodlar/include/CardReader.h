#pragma once

#include <cstdint>
#include <string>

#ifdef ARDUINO
#include <Arduino.h>
#include <MFRC522.h>
#endif

enum class ReaderStatus { ACTIVE, READ_ERROR, DISCONNECTED };

class CardReader {
public:
    static constexpr uint8_t UID_MIN_BAYT = 4;
    static constexpr uint8_t UID_MAX_BAYT = 10;

#ifdef ARDUINO
    CardReader(uint8_t ssPin, uint8_t rstPin);

    void begin();          
    void update();         

    bool hasNewRead() const;                    
    std::string getLastCardId() const;           
    unsigned long getLastReadTimestamp() const;   
    ReaderStatus getStatus() const;               

#ifdef DEBUG_FAKE_CARD
    void injectFakeRead(const std::string &fakeUid, unsigned long timestampMs);
#endif
#endif

    static std::string uidToString(const uint8_t *uidBytes, uint8_t uidSize);
    static bool uidGecerliMi(const std::string &uid);
    static bool isDuplicateRead(const std::string &newUid, const std::string &lastUid,
                                 uint32_t newTimestampMs, uint32_t lastTimestampMs,
                                 uint32_t debounceMs = 1000);

private:
#ifdef ARDUINO
    MFRC522 _mfrc522;
    uint8_t _ssPin;
    uint8_t _rstPin;
    ReaderStatus _status = ReaderStatus::DISCONNECTED;
    std::string _lastCardId;
    unsigned long _lastReadTimestamp = 0;
    bool _newReadFlag = false;
    unsigned long _sonBaglantiDenemesi = 0;

    bool okuyucuyuBaslat();
#endif
};