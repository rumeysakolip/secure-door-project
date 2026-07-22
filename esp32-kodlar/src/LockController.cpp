#include "LockController.h"

LockController::LockController(uint8_t relay_pin, uint8_t buzzer_pin) {
    relayPin = relay_pin;
    buzzerPin = buzzer_pin;
    
    isUnlocked = false;
    isCoolingDown = false;
    isDoorPhysicallyOpen = false;
    buzzerState = false;
    
    unlockTimer = 0;
    cooldownTimer = 0;
    doorOpenTimer = 0;
    buzzerToggleTimer = 0;
}

void LockController::begin() {
    pinMode(relayPin, OUTPUT);
    pinMode(buzzerPin, OUTPUT);
    digitalWrite(relayPin, LOW);  
    digitalWrite(buzzerPin, LOW); 
}

bool LockController::unlockDoor() {
    if (isCoolingDown || isUnlocked) {
        return false; 
    }

    digitalWrite(relayPin, HIGH);
    isUnlocked = true;
    unlockTimer = millis(); 
    return true;
}

void LockController::update(bool currentDoorSensorState) {
    unsigned long currentMillis = millis(); 

    // A. KİLİT KAPATMA MANTIĞI
    if (isUnlocked) {
        if (currentMillis - unlockTimer >= UNLOCK_DURATION) {
            digitalWrite(relayPin, LOW); 
            isUnlocked = false;
            
            isCoolingDown = true;
            cooldownTimer = currentMillis;
        }
    }

    if (isCoolingDown) {
        if (currentMillis - cooldownTimer >= COOLDOWN_DURATION) {
            isCoolingDown = false; 
        }
    }

    // B. KAPI AÇIK KALMA UYARISI (HATA 5 ÇÖZÜMÜ ENTEGRELİ)
    if (currentDoorSensorState == true && isDoorPhysicallyOpen == false) {
        isDoorPhysicallyOpen = true;
        doorOpenTimer = currentMillis; 
    } 
    else if (currentDoorSensorState == false) {
        isDoorPhysicallyOpen = false;
        digitalWrite(buzzerPin, LOW);
        buzzerState = false;
    }

    if (isDoorPhysicallyOpen) {
        // Kapı 20 saniyeden uzun süre açık kalırsa kesikli ikaz ver (Zorla açılma hariç)
        if (currentMillis - doorOpenTimer >= DOOR_WARNING_TIME) {
            if (currentMillis - buzzerToggleTimer >= BUZZER_INTERVAL) {
                buzzerToggleTimer = currentMillis;
                buzzerState = !buzzerState; 
                digitalWrite(buzzerPin, buzzerState ? HIGH : LOW);
            }
        }
    }
}