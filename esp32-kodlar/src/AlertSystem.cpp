#include "AlertSystem.h"

/*
 * Başarılı giriş:
 * Bir kısa bip ve kısa LED gösterimi.
 */
const AlertSystem::AlertStep AlertSystem::SUCCESS_STEPS[] = {
    {true,  true,  150},
    {false, true,  250},
    {false, false, 1}
};

/*
 * Hata veya yanlış PIN:
 * İki kısa bip.
 */
const AlertSystem::AlertStep AlertSystem::ERROR_STEPS[] = {
    {true,  true,  120},
    {false, false, 100},
    {true,  true,  120},
    {false, false, 1}
};

/*
 * Erişim reddedildi:
 * Daha belirgin üçlü uyarı.
 */
const AlertSystem::AlertStep AlertSystem::ACCESS_DENIED_STEPS[] = {
    {true,  true,  180},
    {false, false, 100},
    {true,  true,  180},
    {false, false, 100},
    {true,  true,  300},
    {false, false, 1}
};

/*
 * Kullanıcı geçici olarak kilitlendi:
 * Beş kısa bip, ardından bekleme.
 */
const AlertSystem::AlertStep AlertSystem::LOCKOUT_STEPS[] = {
    {true,  true,  100},
    {false, false, 100},

    {true,  true,  100},
    {false, false, 100},

    {true,  true,  100},
    {false, false, 100},

    {true,  true,  100},
    {false, false, 100},

    {true,  true,  100},
    {false, false, 700}
};

/*
 * Kapı uzun süre açık:
 * Her iki saniyede bir kısa bip.
 */
const AlertSystem::AlertStep AlertSystem::DOOR_OPEN_STEPS[] = {
    {true,  true,  150},
    {false, false, 1850}
};

/*
 * Zorla giriş:
 * Hızlı ve sürekli alarm.
 */
const AlertSystem::AlertStep AlertSystem::FORCED_ENTRY_STEPS[] = {
    {true,  true,  250},
    {false, false, 100},
    {true,  false, 250},
    {false, true,  100}
};

/*
 * İnternet bağlantısı yok:
 * Buzzer sürekli çalmaz.
 * LED yavaş şekilde yanıp söner.
 */
const AlertSystem::AlertStep AlertSystem::OFFLINE_STEPS[] = {
    {false, true,  300},
    {false, false, 1700}
};

/*
 * Genel cihaz hatası:
 * Uzun ve belirgin hata uyarısı.
 */
const AlertSystem::AlertStep AlertSystem::DEVICE_ERROR_STEPS[] = {
    {true,  true,  400},
    {false, false, 200},
    {true,  true,  400},
    {false, false, 800}
};

AlertSystem::AlertSystem(
    uint8_t buzzerPin,
    uint8_t ledPin,
    bool buzzerActiveHigh,
    bool ledActiveHigh
)
    : _buzzerPin(buzzerPin),
      _ledPin(ledPin),
      _buzzerActiveHigh(buzzerActiveHigh),
      _ledActiveHigh(ledActiveHigh),
      _activePattern(AlertPattern::None),
      _activeSteps(nullptr),
      _activeStepCount(0),
      _currentStep(0),
      _repeat(false),
      _started(false),
      _stepStartedAt(0) {}

void AlertSystem::begin() {
    pinMode(_buzzerPin, OUTPUT);
    pinMode(_ledPin, OUTPUT);

    setBuzzer(false);
    setLed(false);

    _activePattern = AlertPattern::None;
    _activeSteps = nullptr;
    _activeStepCount = 0;
    _currentStep = 0;
    _repeat = false;
    _stepStartedAt = 0;

    _started = true;
}

void AlertSystem::update() {
    if (
        !_started ||
        !isActive() ||
        _activeSteps == nullptr ||
        _activeStepCount == 0
    ) {
        return;
    }

    const uint32_t currentTime = millis();

    const uint32_t elapsedTime =
        static_cast<uint32_t>(
            currentTime - _stepStartedAt
        );

    const uint32_t currentStepDuration =
        _activeSteps[_currentStep].durationMs;

    if (elapsedTime < currentStepDuration) {
        return;
    }

    ++_currentStep;

    if (_currentStep >= _activeStepCount) {
        if (_repeat) {
            _currentStep = 0;
        } else {
            finishPattern();
            return;
        }
    }

    _stepStartedAt = currentTime;
    applyCurrentStep();
}

bool AlertSystem::play(AlertPattern pattern) {
    if (
        !_started ||
        pattern == AlertPattern::None
    ) {
        return false;
    }

    /*
     * Aynı alarm zaten çalışıyorsa baştan başlatılmaz.
     * Özellikle loop içerisinde tekrar tekrar playOffline()
     * çağrılması desenin sürekli sıfırlanmasını engeller.
     */
    if (_activePattern == pattern) {
        return true;
    }

    /*
     * Düşük öncelikli olay yüksek öncelikli alarmı kesemez.
     */
    if (
        isActive() &&
        getPriority(pattern) < getPriority(_activePattern)
    ) {
        return false;
    }

    const PatternDefinition definition =
        getPatternDefinition(pattern);

    if (
        definition.steps == nullptr ||
        definition.stepCount == 0
    ) {
        return false;
    }

    startPattern(pattern, definition);
    return true;
}

bool AlertSystem::playSuccess() {
    return play(AlertPattern::Success);
}

bool AlertSystem::playError() {
    return play(AlertPattern::Error);
}

bool AlertSystem::playInvalidPin() {
    return play(AlertPattern::InvalidPin);
}

bool AlertSystem::playAccessDenied() {
    return play(AlertPattern::AccessDenied);
}

bool AlertSystem::playLockout() {
    return play(AlertPattern::Lockout);
}

bool AlertSystem::playDoorOpenTooLong() {
    return play(AlertPattern::DoorOpenTooLong);
}

bool AlertSystem::playForcedEntry() {
    return play(AlertPattern::ForcedEntry);
}

bool AlertSystem::playOffline() {
    return play(AlertPattern::Offline);
}

bool AlertSystem::playDeviceError() {
    return play(AlertPattern::DeviceError);
}

void AlertSystem::stop() {
    finishPattern();
}

void AlertSystem::stop(AlertPattern pattern) {
    if (_activePattern == pattern) {
        finishPattern();
    }
}

bool AlertSystem::isActive() const {
    return _activePattern != AlertPattern::None;
}

AlertPattern AlertSystem::getActivePattern() const {
    return _activePattern;
}

void AlertSystem::setLed(bool enabled) {
    writeOutput(
        _ledPin,
        enabled,
        _ledActiveHigh
    );
}

void AlertSystem::setBuzzer(bool enabled) {
    writeOutput(
        _buzzerPin,
        enabled,
        _buzzerActiveHigh
    );
}

AlertSystem::PatternDefinition
AlertSystem::getPatternDefinition(
    AlertPattern pattern
) const {
    switch (pattern) {
        case AlertPattern::Success:
            return {
                SUCCESS_STEPS,
                static_cast<uint8_t>(
                    sizeof(SUCCESS_STEPS) /
                    sizeof(SUCCESS_STEPS[0])
                ),
                false
            };

        case AlertPattern::Error:
        case AlertPattern::InvalidPin:
            return {
                ERROR_STEPS,
                static_cast<uint8_t>(
                    sizeof(ERROR_STEPS) /
                    sizeof(ERROR_STEPS[0])
                ),
                false
            };

        case AlertPattern::AccessDenied:
            return {
                ACCESS_DENIED_STEPS,
                static_cast<uint8_t>(
                    sizeof(ACCESS_DENIED_STEPS) /
                    sizeof(ACCESS_DENIED_STEPS[0])
                ),
                false
            };

        case AlertPattern::Lockout:
            return {
                LOCKOUT_STEPS,
                static_cast<uint8_t>(
                    sizeof(LOCKOUT_STEPS) /
                    sizeof(LOCKOUT_STEPS[0])
                ),
                true
            };

        case AlertPattern::DoorOpenTooLong:
            return {
                DOOR_OPEN_STEPS,
                static_cast<uint8_t>(
                    sizeof(DOOR_OPEN_STEPS) /
                    sizeof(DOOR_OPEN_STEPS[0])
                ),
                true
            };

        case AlertPattern::ForcedEntry:
            return {
                FORCED_ENTRY_STEPS,
                static_cast<uint8_t>(
                    sizeof(FORCED_ENTRY_STEPS) /
                    sizeof(FORCED_ENTRY_STEPS[0])
                ),
                true
            };

        case AlertPattern::Offline:
            return {
                OFFLINE_STEPS,
                static_cast<uint8_t>(
                    sizeof(OFFLINE_STEPS) /
                    sizeof(OFFLINE_STEPS[0])
                ),
                true
            };

        case AlertPattern::DeviceError:
            return {
                DEVICE_ERROR_STEPS,
                static_cast<uint8_t>(
                    sizeof(DEVICE_ERROR_STEPS) /
                    sizeof(DEVICE_ERROR_STEPS[0])
                ),
                true
            };

        case AlertPattern::None:
        default:
            return {
                nullptr,
                0,
                false
            };
    }
}

uint8_t AlertSystem::getPriority(
    AlertPattern pattern
) const {
    switch (pattern) {
        case AlertPattern::ForcedEntry:
            return 100;

        case AlertPattern::DoorOpenTooLong:
            return 90;

        case AlertPattern::Lockout:
            return 80;

        case AlertPattern::DeviceError:
            return 70;

        case AlertPattern::AccessDenied:
            return 60;

        case AlertPattern::InvalidPin:
        case AlertPattern::Error:
            return 50;

        case AlertPattern::Success:
            return 30;

        case AlertPattern::Offline:
            return 20;

        case AlertPattern::None:
        default:
            return 0;
    }
}

void AlertSystem::startPattern(
    AlertPattern pattern,
    const PatternDefinition& definition
) {
    /*
     * Önce önceki çıkışları kapat.
     */
    setBuzzer(false);
    setLed(false);

    _activePattern = pattern;
    _activeSteps = definition.steps;
    _activeStepCount = definition.stepCount;
    _currentStep = 0;
    _repeat = definition.repeat;
    _stepStartedAt = millis();

    applyCurrentStep();
}

void AlertSystem::applyCurrentStep() {
    if (
        _activeSteps == nullptr ||
        _currentStep >= _activeStepCount
    ) {
        finishPattern();
        return;
    }

    setBuzzer(
        _activeSteps[_currentStep].buzzerOn
    );

    setLed(
        _activeSteps[_currentStep].ledOn
    );
}

void AlertSystem::finishPattern() {
    setBuzzer(false);
    setLed(false);

    _activePattern = AlertPattern::None;
    _activeSteps = nullptr;
    _activeStepCount = 0;
    _currentStep = 0;
    _repeat = false;
    _stepStartedAt = 0;
}

void AlertSystem::writeOutput(
    uint8_t pin,
    bool enabled,
    bool activeHigh
) {
    /*
     * activeHigh=true:
     * enabled=true  -> HIGH
     * enabled=false -> LOW
     *
     * activeHigh=false:
     * enabled=true  -> LOW
     * enabled=false -> HIGH
     */
    const uint8_t outputLevel =
        (enabled == activeHigh)
            ? HIGH
            : LOW;

    digitalWrite(pin, outputLevel);
}