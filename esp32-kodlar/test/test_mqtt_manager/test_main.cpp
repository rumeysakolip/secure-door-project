#include <unity.h>
#include "MqttManager.h"

void setUp(void) {}
void tearDown(void) {}

void test_buildEventTopic(void) {
    TEST_ASSERT_EQUAL_STRING("securedoor/events", MqttManager::buildEventTopic().c_str());
}

void test_buildCommandTopic(void) {
    TEST_ASSERT_EQUAL_STRING("securedoor/commands", MqttManager::buildCommandTopic().c_str());
}

void test_buildHeartbeatTopic(void) {
    TEST_ASSERT_EQUAL_STRING("securedoor/heartbeat", MqttManager::buildHeartbeatTopic().c_str());
}

void test_serializeEntryEvent_izin(void) {
    EntryEvent ev;
    ev.cihazOlayId = "EVT-123";
    ev.cihazId = 1;
    ev.kapiId = 2;
    ev.okunanUid = "A1:B2:C3:D4";
    ev.dogrulamaYontemi = "kart";
    ev.sonuc = "izin";
    ev.timestampEpoch = 1700000000;

    std::string json = MqttManager::serializeEntryEvent(ev);

    TEST_ASSERT_TRUE(json.find("\"cihaz_olay_id\":\"EVT-123\"") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("\"sonuc\":\"izin\"") != std::string::npos);
    TEST_ASSERT_TRUE(json.find("\"red_nedeni\"") == std::string::npos);
}

void test_serializeEntryEvent_red_nedeni_dahil(void) {
    EntryEvent ev;
    ev.cihazOlayId = "EVT-456";
    ev.sonuc = "red";
    ev.redNedeni = "tanimsiz_kart";

    std::string json = MqttManager::serializeEntryEvent(ev);

    TEST_ASSERT_TRUE(json.find("\"red_nedeni\":\"tanimsiz_kart\"") != std::string::npos);
}

void test_parseCommand_door_open(void) {
    std::string payload = "{\"komut_tipi\":\"DOOR_OPEN\",\"kullanici_id\":\"42\"}";
    DeviceCommand cmd = MqttManager::parseCommand(payload);

    TEST_ASSERT_TRUE(cmd.type == CommandType::DOOR_OPEN);
    TEST_ASSERT_EQUAL_STRING("42", cmd.issuedByUserId.c_str());
}

void test_parseCommand_block(void) {
    std::string payload = "{\"komut_tipi\":\"BLOCK\",\"kart_uid\":\"A1:B2:C3:D4\"}";
    DeviceCommand cmd = MqttManager::parseCommand(payload);

    TEST_ASSERT_TRUE(cmd.type == CommandType::BLOCK);
    TEST_ASSERT_EQUAL_STRING("A1:B2:C3:D4", cmd.targetCardUid.c_str());
}

void test_parseCommand_unblock(void) {
    std::string payload = "{\"komut_tipi\":\"UNBLOCK\",\"kart_uid\":\"FF:FF:FF:FF\"}";
    DeviceCommand cmd = MqttManager::parseCommand(payload);

    TEST_ASSERT_TRUE(cmd.type == CommandType::UNBLOCK);
    TEST_ASSERT_EQUAL_STRING("FF:FF:FF:FF", cmd.targetCardUid.c_str());
}

void test_parseCommand_password_renew_liste_iceriyor(void) {
    std::string payload = "{\"komut_tipi\":\"PASSWORD_RENEW\",\"yeni_liste\":[{\"u\":\"5\",\"p\":\"1234\"}]}";
    DeviceCommand cmd = MqttManager::parseCommand(payload);

    TEST_ASSERT_TRUE(cmd.type == CommandType::PASSWORD_RENEW);
    TEST_ASSERT_TRUE(cmd.newPasswordListJson.find("1234") != std::string::npos);
}

void test_parseCommand_gecersiz_json_unknown_doner(void) {
    std::string payload = "gecersiz-json-degil";
    DeviceCommand cmd = MqttManager::parseCommand(payload);

    TEST_ASSERT_TRUE(cmd.type == CommandType::UNKNOWN);
}

void test_parseCommand_bilinmeyen_komut_tipi_unknown_doner(void) {
    std::string payload = "{\"komut_tipi\":\"BILINMEYEN_KOMUT\"}";
    DeviceCommand cmd = MqttManager::parseCommand(payload);

    TEST_ASSERT_TRUE(cmd.type == CommandType::UNKNOWN);
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_buildEventTopic);
    RUN_TEST(test_buildCommandTopic);
    RUN_TEST(test_buildHeartbeatTopic);
    RUN_TEST(test_serializeEntryEvent_izin);
    RUN_TEST(test_serializeEntryEvent_red_nedeni_dahil);
    RUN_TEST(test_parseCommand_door_open);
    RUN_TEST(test_parseCommand_block);
    RUN_TEST(test_parseCommand_unblock);
    RUN_TEST(test_parseCommand_password_renew_liste_iceriyor);
    RUN_TEST(test_parseCommand_gecersiz_json_unknown_doner);
    RUN_TEST(test_parseCommand_bilinmeyen_komut_tipi_unknown_doner);
    return UNITY_END();
}