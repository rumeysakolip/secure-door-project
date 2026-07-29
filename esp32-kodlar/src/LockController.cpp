#include "LockController.h"

LockController::LockController(uint8_t relayPin)
    : relayPin(relayPin),
      unlockTimer(0),
      cooldownTimer(0),
      isUnlocked(false),
      isCoolingDown(false) {}

void LockController::begin() {
    // Bu role karti HIGH seviyesinde tetikleniyor.
    // Guvenli bekleme durumunda giris LOW tutulur; boylece kilit
    // surekli enerji almaz.
    pinMode(relayPin, OUTPUT_OPEN_DRAIN);
    digitalWrite(relayPin, LOW);

    Serial.printf(
        "[KILIT] GPIO%d PASIF/LOW. Okunan lojik=%d.\n",
        relayPin,
        digitalRead(relayPin)
    );
}

bool LockController::unlockDoor() {
    if (isCoolingDown || isUnlocked) {
        return false;
    }

    digitalWrite(relayPin, HIGH);
    isUnlocked = true;
    unlockTimer = millis();

    Serial.printf(
        "[KILIT] GPIO%d AKTIF/HIGH (hat serbest). Okunan lojik=%d; 2000 ms.\n",
        relayPin,
        digitalRead(relayPin)
    );
    return true;
}

void LockController::update() {
    const unsigned long now = millis();

    if (isUnlocked && now - unlockTimer >= UNLOCK_DURATION) {
        digitalWrite(relayPin, LOW);
        isUnlocked = false;
        isCoolingDown = true;
        cooldownTimer = now;

        Serial.printf(
            "[KILIT] GPIO%d PASIF/LOW. Tetikleme suresi=%lu ms.\n",
            relayPin,
            now - unlockTimer
        );
    }

    if (isCoolingDown && now - cooldownTimer >= COOLDOWN_DURATION) {
        isCoolingDown = false;
    }
}
