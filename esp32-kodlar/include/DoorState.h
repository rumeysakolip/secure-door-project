#ifndef DOOR_STATE_H
#define DOOR_STATE_H

#include <Arduino.h>

enum class Durum {
    BEKLEMEDE,      // Kart/Şifre bekleniyor, kapı kilitli
    OKUNUYOR,       // Veri alındı, doğrulama bekleniyor
    ONAYLANDI,      // GİRİŞ İZNİ verildi, kilit açık
    CIKIS_YAPILDI,  // ÇIKIŞ İŞLEMİ yapıldı, KİLİT AÇILMAZ
    REDDEDILDI,     // Geçiş/İşlem izni yok
    ALARM           // Zorla açılma veya uzun süre açık kalma
};

class DoorState {
private:
    static Durum mevcutDurum;
    static unsigned long durumDegisimZamani;
    static const unsigned long DURUM_SURELERI[];

public:
    static void baslat();
    static void guncelle();
    static bool durumGecisiYap(Durum yeniDurum);
    static Durum mevcutDurumuAl();
    static const char* durumMetni(Durum durum);
};

#endif