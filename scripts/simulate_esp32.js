#!/usr/bin/env node

/**
 * =========================================================
 * AquaWatch — ESP32 Sensor Simulator (Node.js)
 * =========================================================
 * Simulates an ESP32 microcontroller reading pH, TDS, Turbidity,
 * and Temperature sensors and posting data to the backend.
 *
 * Runs without needing any external npm packages!
 * Usage:
 *   node scripts/simulate_esp32.js
 * =========================================================
 */

const http = require('http');

const SERVER_HOST = 'localhost';
const SERVER_PORT = 8080;
const API_PATH = '/api/v1/sensor-data';
const DEVICE_ID = 'ESP32-SIMULATOR';
const INTERVAL_MS = 5000; // send reading every 5 seconds

let iteration = 0;

function getRandomInRange(min, max, decimals = 2) {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function generateReading() {
  iteration++;

  // Introduce an intentional unsafe spike every 5th reading to demonstrate relay activation
  const isSpike = iteration % 5 === 0;

  if (isSpike) {
    console.log(`\n[#${iteration}] Simulating CONTAMINATED water sample (exceeds thresholds)...`);
    return {
      deviceId: DEVICE_ID,
      phValue: getRandomInRange(5.2, 5.9),            // acidic (safe is 6.5 - 8.5)
      tdsValue: getRandomInRange(520.0, 750.0),       // high TDS (safe is 50 - 500)
      turbidityValue: getRandomInRange(6.5, 12.0),    // high turbidity (safe <= 5)
      temperatureValue: getRandomInRange(26.0, 31.0)
    };
  }

  // Normal safe reading
  return {
    deviceId: DEVICE_ID,
    phValue: getRandomInRange(6.8, 7.8),              // safe pH
    tdsValue: getRandomInRange(180.0, 340.0),         // safe TDS
    turbidityValue: getRandomInRange(1.0, 3.8),       // safe turbidity
    temperatureValue: getRandomInRange(22.0, 26.5)
  };
}

function sendSensorReading(reading) {
  const postData = JSON.stringify(reading);

  const options = {
    hostname: SERVER_HOST,
    port: SERVER_PORT,
    path: API_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const relay = json.data && json.data.relayStatus ? json.data.relayStatus : 'UNKNOWN';
        const status = json.data && json.data.status ? json.data.status : 'UNKNOWN';

        const relayMsg = relay === 'ON'
          ? '⚡ RELAY ACTIVE (Purification ON)'
          : '✓ Relay Standby (Safe Water)';

        console.log(`[${new Date().toLocaleTimeString()}] Sent: pH=${reading.phValue}, TDS=${reading.tdsValue}ppm, Turb=${reading.turbidityValue}NTU, Temp=${reading.temperatureValue}°C`);
        console.log(`  --> Status: ${status} | Relay: ${relay} [${relayMsg}]`);
      } catch (e) {
        console.log(`Response received (HTTP ${res.statusCode}):`, data);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`Connection error to http://${SERVER_HOST}:${SERVER_PORT}${API_PATH}:`, err.message);
    console.error('Make sure the Spring Boot backend is running!');
  });

  req.write(postData);
  req.end();
}

console.log('====================================================');
console.log('   AquaWatch — ESP32 Sensor Data Simulator');
console.log(`   Target: http://${SERVER_HOST}:${SERVER_PORT}${API_PATH}`);
console.log(`   Device ID: ${DEVICE_ID}`);
console.log(`   Interval: ${INTERVAL_MS / 1000} seconds`);
console.log('   Press Ctrl+C to stop');
console.log('====================================================');

// Send first reading immediately, then loop
sendSensorReading(generateReading());
setInterval(() => {
  sendSensorReading(generateReading());
}, INTERVAL_MS);
