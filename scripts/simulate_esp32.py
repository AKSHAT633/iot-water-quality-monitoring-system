#!/usr/bin/env python3
"""
=========================================================
AquaWatch — ESP32 Sensor Simulator (Python)
=========================================================
Simulates real-time sensor transmissions from an ESP32 device
to the Spring Boot REST API.
Uses only the standard library (urllib.request).

Usage:
    python scripts/simulate_esp32.py
=========================================================
"""

import json
import random
import time
import urllib.request
import urllib.error
from datetime import datetime

SERVER_URL = "http://localhost:8080/api/v1/sensor-data"
DEVICE_ID = "ESP32-SIMULATOR"
INTERVAL_SECONDS = 5

def generate_reading(iteration: int) -> dict:
    is_spike = (iteration % 5 == 0)
    if is_spike:
        print(f"\n[#{iteration}] Simulating CONTAMINATED water sample...")
        return {
            "deviceId": DEVICE_ID,
            "phValue": round(random.uniform(5.2, 5.9), 2),
            "tdsValue": round(random.uniform(520.0, 750.0), 1),
            "turbidityValue": round(random.uniform(6.5, 12.0), 2),
            "temperatureValue": round(random.uniform(26.0, 31.0), 1)
        }
    return {
        "deviceId": DEVICE_ID,
        "phValue": round(random.uniform(6.8, 7.8), 2),
        "tdsValue": round(random.uniform(180.0, 340.0), 1),
        "turbidityValue": round(random.uniform(1.0, 3.8), 2),
        "temperatureValue": round(random.uniform(22.0, 26.5), 1)
    }

def send_reading(reading: dict):
    payload = json.dumps(reading).encode("utf-8")
    req = urllib.request.Request(
        SERVER_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            data = res_body.get("data", {})
            relay = data.get("relayStatus", "UNKNOWN")
            status = data.get("status", "UNKNOWN")
            now_str = datetime.now().strftime("%H:%M:%S")

            relay_label = "⚡ PURIFICATION RELAY ON" if relay == "ON" else "✓ Standby (Safe)"
            print(f"[{now_str}] Sent: pH={reading['phValue']}, TDS={reading['tdsValue']}ppm, Turb={reading['turbidityValue']}NTU, Temp={reading['temperatureValue']}C -> Status: {status} | Relay: {relay} [{relay_label}]")
    except urllib.error.URLError as e:
        print(f"Failed to send data to {SERVER_URL}: {e.reason}")
        print("Ensure the Spring Boot backend is running on port 8080.")

def main():
    print("=" * 55)
    print("   AquaWatch — ESP32 Sensor Data Simulator (Python)")
    print(f"   Target: {SERVER_URL}")
    print(f"   Device ID: {DEVICE_ID}")
    print(f"   Interval: {INTERVAL_SECONDS} seconds")
    print("   Press Ctrl+C to terminate")
    print("=" * 55)

    iteration = 0
    while True:
        iteration += 1
        reading = generate_reading(iteration)
        send_reading(reading)
        time.sleep(INTERVAL_SECONDS)

if __name__ == "__main__":
    main()
