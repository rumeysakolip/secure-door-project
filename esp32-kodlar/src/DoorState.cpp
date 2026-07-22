#include "DoorState.h"
#include "LockController.h" 

extern LockController lock;

Durum DoorState::mevcutDurum = Durum::BEKLEMEDE;
unsigned long DoorState::durumDegisimZamani = 0;

const unsigned long DoorState::DURUM_SURELERI[] = {
    0,      // BEKLEMEDE
    3000,   // OKUNUYOR
    5000,   // ONAYLANDI (GİRİŞ)
    2000,   // CIKIS_YAPILDI
    2000,   // REDDEDILDI
    0       // ALARM
};

void DoorState::baslat() {
    mevcutDurum = Durum::BEKLEMEDE;
    durumDegisimZamani = millis();
    Serial.println("[DoorState] Sistem baslatildi: BEKLEMEDE");
}

bool DoorState::durumGecisiYap(Durum yeniDurum) {
    bool izinVerildi = false;

    switch (mevcutDurum) {
        case Durum::BEKLEMEDE:
            izinVerildi = true;
            break;
        case Durum::OKUNUYOR:
            izinVerildi = (yeniDurum != Durum::OKUNUYOR);
            break;
        case Durum::ONAYLANDI:
        case Durum::CIKIS_YAPILDI:
        case Durum::REDDEDILDI:
            izinVerildi = (yeniDurum == Durum::BEKLEMEDE || yeniDurum == Durum::ALARM);
            break;
        case Durum::ALARM:
            izinVerildi = (yeniDurum == Durum::BEKLEMEDE);
            break;
    }

    if (izinVerildi) {
        mevcutDurum = yeniDurum;
        durumDegisimZamani = millis();
        Serial.printf("[DoorState] Durum Degisti -> %s\n", durumMetni(mevcutDurum));

        // Kilit Tetikleme Mantığı
        if (mevcutDurum == Durum::ONAYLANDI) {
            lock.unlockDoor(); // Sadece onaylı girişlerde kilit açılır
        }

        return true;
    }
    return false;
}

void DoorState::guncelle() {
    unsigned long zamanSiniri = DURUM_SURELERI[static_cast<int>(mevcutDurum)];
    
    if (zamanSiniri > 0 && (millis() - durumDegisimZamani >= zamanSiniri)) {
        if (mevcutDurum == Durum::OKUNUYOR || mevcutDurum == Durum::REDDEDILDI || 
            mevcutDurum == Durum::ONAYLANDI || mevcutDurum == Durum::CIKIS_YAPILDI) {
            durumGecisiYap(Durum::BEKLEMEDE);
        }
    }
}

Durum DoorState::mevcutDurumuAl() {
    return mevcutDurum;
}

const char* DoorState::durumMetni(Durum durum) {
    switch (durum) {
        case Durum::BEKLEMEDE:     return "BEKLEMEDE";
        case Durum::OKUNUYOR:      return "OKUNUYOR";
        case Durum::ONAYLANDI:     return "ONAYLANDI";
        case Durum::CIKIS_YAPILDI: return "CIKIS_YAPILDI";
        case Durum::REDDEDILDI:    return "REDDEDILDI";
        case Durum::ALARM:         return "ALARM";
        default:                   return "BILINMEYEN";
    }
}