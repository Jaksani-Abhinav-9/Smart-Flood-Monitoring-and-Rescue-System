#include <SPI.h>
#include <LoRa.h>
#include <SoftwareSerial.h>
#include <TinyGPSPlus.h>

// ============================================================================
// FLOODGUARD AI 2.0 — ARDUINO UNO + Ra-02 (433MHz) + NEO-6M GPS RECEIVER
// ============================================================================
// Matches Transmitter (Arduino Mega main.ino):
//   • Frequency : 433 MHz (433E6)
//   • Sync Word : 0x12
//   • Payload   : ID=FLOOD_POLE_01,TEMP=...,HUM=...,RAIN=...,RAIN_DETECTED=...,
//                 WIND=...,DIST=...,FLOOD_LEVEL=...,LAT=...,LON=...
//
// Arduino Uno Wiring:
//   [Ra-02 SX1278]  (IMPORTANT: 3.3V ONLY — DO NOT CONNECT TO 5V!)
//     3.3V  -> Uno 3.3V       NSS/CS -> Pin 10       MOSI -> Pin 11
//     GND   -> Uno GND        RST    -> Pin 9        MISO -> Pin 12
//     DIO0  -> Pin 2          SCK    -> Pin 13
//
//   [NEO-6M GPS]
//     VCC   -> Uno 5V (for GY-GPS6MV2 module)
//     GND   -> Uno GND
//     TX    -> Uno Pin 4 (RX)
//     RX    -> Uno Pin 3 (TX)  [optional]
//
// Required Arduino IDE Libraries:
//   1. LoRa (by Sandeep Mistry)
//   2. TinyGPSPlus (by Mikal Hart)
// ============================================================================

#define LORA_SS     10
#define LORA_RESET  9
#define LORA_DIO0   2
#define LORA_FREQ   433E6
#define LORA_SYNC   0x12

#define GPS_RX_PIN  4  // Connect to NEO-6M TX
#define GPS_TX_PIN  3  // Connect to NEO-6M RX

// Reference distance from ultrasonic sensor down to normal riverbed base (cm)
#define POLE_SENSOR_HEIGHT_CM 45.0

SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;

// Fixed SRAM buffers (avoids String heap fragmentation on 2KB Uno SRAM)
char nmeaBuf[112];
uint8_t nmeaIdx = 0;
char pktBuf[192];

unsigned long lastGgaForwardMs = 0;
unsigned long lastRmcForwardMs = 0;
unsigned long lastDiagMs       = 0;
unsigned long loraPacketCount  = 0;

// ----------------------------------------------------------------------------
// Zero-heap key=value field extractor for main.ino payload
// ----------------------------------------------------------------------------
bool extractField(const char* pkt, const char* key, char* out, uint8_t outSize) {
  out[0] = '\0';
  uint8_t keyLen = strlen(key);
  const char* p = pkt;

  while (p && *p) {
    if (strncmp(p, key, keyLen) == 0 && p[keyLen] == '=') {
      if (p == pkt || *(p - 1) == ',') {
        const char* valStart = p + keyLen + 1;
        const char* comma = strchr(valStart, ',');
        uint8_t len = comma ? (uint8_t)(comma - valStart) : (uint8_t)strlen(valStart);
        if (len >= outSize) len = outSize - 1;
        memcpy(out, valStart, len);
        out[len] = '\0';
        return true;
      }
    }
    p = strchr(p, ',');
    if (p) p++;
  }
  return false;
}

bool isValidNum(const char* s) {
  if (!s || s[0] == '\0') return false;
  if (strcmp(s, "NA") == 0 || strcmp(s, "NAN") == 0 || strcmp(s, "nan") == 0) return false;
  return (isdigit(s[0]) || s[0] == '-' || s[0] == '+');
}

const __FlashStringHelper* mapFloodStatus(const char* floodLevel) {
  if (strcmp(floodLevel, "CRITICAL") == 0 || strcmp(floodLevel, "HIGH_ALERT") == 0) {
    return F("CRITICAL_SURGE");
  }
  if (strcmp(floodLevel, "WARNING") == 0) {
    return F("SURGE_WARNING");
  }
  if (strcmp(floodLevel, "NORMAL") == 0) {
    return F("NORMAL_FLOW");
  }
  return F("ACTIVE_TRANSMISSION");
}

// ----------------------------------------------------------------------------
// Read NEO-6M NMEA stream and forward clean GGA/RMC sentences line-by-line
// ----------------------------------------------------------------------------
void processGpsSerial() {
  while (gpsSerial.available() > 0) {
    char c = (char)gpsSerial.read();
    gps.encode(c);

    if (c == '$') {
      nmeaIdx = 0;
      nmeaBuf[nmeaIdx++] = c;
    } else if (nmeaIdx > 0) {
      if (c == '\r') {
        continue;
      } else if (c == '\n') {
        nmeaBuf[nmeaIdx] = '\0';
        nmeaIdx = 0;

        if (strchr(nmeaBuf, '*') != NULL && strlen(nmeaBuf) >= 6) {
          unsigned long now = millis();
          bool isGGA = (strncmp(nmeaBuf + 3, "GGA", 3) == 0);
          bool isRMC = (strncmp(nmeaBuf + 3, "RMC", 3) == 0);

          if (isGGA && (now - lastGgaForwardMs >= 1500)) {
            lastGgaForwardMs = now;
            Serial.println(nmeaBuf);
          } else if (isRMC && (now - lastRmcForwardMs >= 1500)) {
            lastRmcForwardMs = now;
            Serial.println(nmeaBuf);
          }
        }
      } else if (nmeaIdx < sizeof(nmeaBuf) - 1) {
        nmeaBuf[nmeaIdx++] = c;
      } else {
        nmeaIdx = 0;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Receive LoRa 433 MHz packet from Flood Pole (main.ino) -> emit 1-line JSON
// ----------------------------------------------------------------------------
void processLoRaPacket() {
  int packetSize = LoRa.parsePacket();
  if (packetSize == 0) return;

  uint8_t idx = 0;
  while (LoRa.available()) {
    char c = (char)LoRa.read();
    if (c != '\r' && c != '\n' && idx < sizeof(pktBuf) - 1) {
      pktBuf[idx++] = c;
    }
  }
  pktBuf[idx] = '\0';
  if (idx == 0) return;

  loraPacketCount++;
  int rssi = LoRa.packetRssi();
  float snr = LoRa.packetSnr();

  char id[28], temp[12], hum[12], rain[10], rainDet[8], wind[8], dist[12], fLevel[16], lat[16], lon[16];
  extractField(pktBuf, "ID", id, sizeof(id));
  extractField(pktBuf, "TEMP", temp, sizeof(temp));
  extractField(pktBuf, "HUM", hum, sizeof(hum));
  extractField(pktBuf, "RAIN", rain, sizeof(rain));
  extractField(pktBuf, "RAIN_DETECTED", rainDet, sizeof(rainDet));
  extractField(pktBuf, "WIND", wind, sizeof(wind));
  extractField(pktBuf, "DIST", dist, sizeof(dist));
  extractField(pktBuf, "FLOOD_LEVEL", fLevel, sizeof(fLevel));
  extractField(pktBuf, "LAT", lat, sizeof(lat));
  extractField(pktBuf, "LON", lon, sizeof(lon));

  if (id[0] == '\0') {
    Serial.print(F("{\"raw\":\""));
    Serial.print(pktBuf);
    Serial.print(F("\",\"rssi\":"));
    Serial.print(rssi);
    Serial.println(F("}"));
    return;
  }

  float waterMeters = 0.0;
  if (isValidNum(dist)) {
    float deltaCm = POLE_SENSOR_HEIGHT_CM - atof(dist);
    if (deltaCm < 0.0) deltaCm = 0.0;
    waterMeters = deltaCm / 30.0;
  }

  Serial.print(F("{\"id\":\""));
  Serial.print(id);
  Serial.print(F("\",\"water\":"));
  Serial.print(waterMeters, 2);
  Serial.print(F(",\"rate\":0.00,\"dist_cm\":"));
  Serial.print(isValidNum(dist) ? dist : "null");
  Serial.print(F(",\"temp\":"));
  Serial.print(isValidNum(temp) ? temp : "null");
  Serial.print(F(",\"hum\":"));
  Serial.print(isValidNum(hum) ? hum : "null");
  Serial.print(F(",\"rain\":"));
  Serial.print(isValidNum(rain) ? rain : "0");
  Serial.print(F(",\"rain_detected\":\""));
  Serial.print(rainDet[0] ? rainDet : "NO");
  Serial.print(F("\",\"wind\":"));
  Serial.print(isValidNum(wind) ? wind : "0");
  Serial.print(F(",\"flood_level\":\""));
  Serial.print(fLevel[0] ? fLevel : "UNKNOWN");
  Serial.print(F("\",\"status\":\""));
  Serial.print(mapFloodStatus(fLevel));
  Serial.print(F("\""));

  if (isValidNum(lat) && isValidNum(lon)) {
    Serial.print(F(",\"lat\":"));
    Serial.print(lat);
    Serial.print(F(",\"lng\":"));
    Serial.print(lon);
  }

  Serial.print(F(",\"rssi\":"));
  Serial.print(rssi);
  Serial.print(F(",\"snr\":"));
  Serial.print(snr, 1);
  Serial.println(F("}"));
}

// ----------------------------------------------------------------------------
// Setup & Main Loop
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(9600);
  gpsSerial.begin(9600);

  pinMode(LORA_SS, OUTPUT);
  digitalWrite(LORA_SS, HIGH);

  Serial.println(F("# FLOODGUARD UNO RECEIVER STARTING..."));

  LoRa.setPins(LORA_SS, LORA_RESET, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println(F("# ERROR: Ra-02 LORA INIT FAILED (Check 3.3V power & SPI pins 10/11/12/13/9/2)"));
    while (true) {
      delay(1000);
    }
  }

  LoRa.setSyncWord(LORA_SYNC);
  LoRa.receive();

  Serial.println(F("# LORA READY (Ra-02 433MHz, SyncWord=0x12) + NEO-6M GPS READY (Pins 4/3, 9600)"));
}

void loop() {
  processGpsSerial();
  processLoRaPacket();

  unsigned long now = millis();
  if (now - lastDiagMs >= 10000) {
    lastDiagMs = now;
    Serial.print(F("# STATUS | GPS_chars="));
    Serial.print(gps.charsProcessed());
    Serial.print(F(" | GPS_fix="));
    if (gps.location.isValid()) {
      Serial.print(gps.location.lat(), 5);
      Serial.print(F(","));
      Serial.print(gps.location.lng(), 5);
      Serial.print(F(" (sats="));
      Serial.print(gps.satellites.value());
      Serial.print(F(")"));
    } else {
      Serial.print(F("WAITING"));
    }
    Serial.print(F(" | LoRa_pkts="));
    Serial.println(loraPacketCount);
  }
}
