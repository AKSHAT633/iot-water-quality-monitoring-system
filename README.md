# AquaWatch — Automatic Water Quality Monitoring System

An end-to-end IoT + Java full-stack project. An **ESP32** reads pH, TDS,
Turbidity, and Temperature sensors and posts readings to a **Spring Boot**
REST backend, which validates the data, stores it in **MySQL** (or **H2 in-memory DB** for zero-setup local dev), evaluates
water-quality thresholds, and instructs the ESP32 to switch a **relay**
(simulating a purification system) ON or OFF. A live **HTML/CSS/JS
dashboard** displays real-time readings, historical data, and trend charts.

---

## Tech Stack

| Layer        | Technology                                |
|--------------|--------------------------------------------|
| Firmware     | ESP32 (Arduino C++), analog + OneWire sensors |
| Backend      | Java 17, Spring Boot 3, Spring Data JPA, REST |
| Database     | MySQL 8 or H2 In-Memory (Zero-setup Dev)   |
| Frontend     | HTML5, CSS3, vanilla JavaScript, Chart.js   |
| Build Tool   | Maven                                       |

---

## Project Structure

```
water-quality-monitoring-system/
├── backend/                         # Spring Boot application
│   ├── pom.xml
│   └── src/
│       ├── main/java/com/wqms/watermonitor/
│       │   ├── WaterMonitorApplication.java
│       │   ├── controller/          # REST controllers (/sensor-data, /health)
│       │   ├── service/             # Business logic interfaces + impl
│       │   ├── repository/          # Spring Data JPA repositories
│       │   ├── entity/              # JPA entities (SensorData)
│       │   ├── dto/                 # Request/response DTOs & ApiResponse
│       │   ├── exception/           # Custom exceptions + global handler
│       │   ├── enums/               # WaterQualityStatus, RelayStatus
│       │   ├── util/                # Threshold constants
│       │   └── config/              # CORS configuration & DataInitializer
│       ├── main/resources/
│       │   ├── application.properties    # MySQL profile (default)
│       │   ├── application-h2.properties # H2 zero-setup profile
│       │   └── static/              # Dashboard served directly at http://localhost:8080/
│       └── test/java/...            # Unit tests (SensorDataServiceTest)
├── database/
│   ├── schema.sql                   # MySQL table creation script
│   └── sample_data.sql              # Sample rows for testing
├── esp32/
│   └── WaterQualityMonitor.ino      # Arduino sketch (ArduinoJson v6 & v7 compatible)
├── frontend/                        # Standalone copy of the dashboard
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── scripts/                         # ESP32 Sensor Simulators (No hardware needed!)
│   ├── simulate_esp32.js            # Node.js simulator
│   ├── simulate_esp32.ps1           # PowerShell simulator
│   └── simulate_esp32.py            # Python simulator
├── docs/
│   └── API_DOCUMENTATION.md
├── .gitignore
└── README.md
```

---

## How It Works

1. The ESP32 reads all four sensors every 10 seconds and sends a JSON payload via `POST /api/v1/sensor-data`.
2. The Spring Boot backend validates the payload, compares each value against safe thresholds, computes an overall `SAFE`/`UNSAFE` status, and persists the reading.
3. If the reading is `UNSAFE`, the backend responds with `relayStatus: "ON"`. The ESP32 reads this field and energizes the relay pin (activating the purification system). Once subsequent readings return to the safe range, the response switches back to `relayStatus: "OFF"` and the ESP32 de-energizes the relay automatically.
4. The web dashboard polls `/latest`, `/stats`, `/trend`, and `/history` every 10 seconds and updates live gauges, the SAFE/UNSAFE banner, the relay indicator, a trend chart, and a paginated history table.

---

## Prerequisites

- **Java 17** (JDK)
- **Maven 3.8+** (or IntelliJ / Eclipse / VS Code Maven runner)
- **MySQL 8** (Optional: you can also run with H2 in-memory DB without installing MySQL)
- **Arduino IDE 2.x** (for the ESP32 firmware)
- Hardware: ESP32 dev board + pH / TDS / Turbidity / DS18B20 temperature sensors + relay module (or use the included sensor simulators to test without hardware)

---

## Running the Backend

### Option A: Zero-Setup Mode (H2 In-Memory DB)

No MySQL installation required! Simply run with the `h2` profile:

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=h2
```
*Note: The built-in `DataInitializer` will automatically seed initial sensor readings so the dashboard is immediately populated.*
*H2 Web Console is available at `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:water_quality_db`).*

### Option B: MySQL Mode (Standard)

1. **Create the database in MySQL**:
   ```bash
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/sample_data.sql   # optional: sample data
   ```

2. **Verify credentials**:
   In `backend/src/main/resources/application.properties`:
   ```properties
   spring.datasource.username=root
   spring.datasource.password=root
   ```

3. **Run the backend**:
   ```bash
   cd backend
   mvn spring-boot:run
   ```

---

## Opening the Dashboard

The frontend is served directly by the Spring Boot backend at:

```
http://localhost:8080/
```

Or, open `frontend/index.html` directly in any web browser.

---

## Testing Without ESP32 Hardware (Simulator)

You can simulate a live ESP32 device sending real-time sensor telemetry and triggering the relay:

- **Using Node.js**:
  ```bash
  node scripts/simulate_esp32.js
  ```
- **Using PowerShell**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\simulate_esp32.ps1
  ```
- **Using Python**:
  ```bash
  python scripts/simulate_esp32.py
  ```

Every 5th reading simulates contaminated water (acidic pH / high TDS / high turbidity) so you can watch the dashboard trigger the purification relay live!

---

## Flashing the ESP32

1. Open `esp32/WaterQualityMonitor.ino` in **Arduino IDE 2.x**.
2. Install the **ESP32 board package** via Boards Manager.
3. Install these libraries via **Library Manager**:
   - `ArduinoJson` (v6 or v7 both supported)
   - `OneWire`
   - `DallasTemperature`
4. Update your WiFi credentials and your computer's LAN IP address:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* SERVER_BASE_URL = "http://192.168.1.10:8080";
   ```
5. Select your ESP32 board and COM port, then click **Upload**.
6. Open the Serial Monitor (115200 baud).

---

## Safe Drinking Water Thresholds

| Parameter    | Safe Range        | Unit |
|--------------|-------------------|------|
| pH           | 6.5 – 8.5         | pH   |
| TDS          | 50 – 500          | ppm  |
| Turbidity    | ≤ 5.0             | NTU  |
| Temperature  | 10.0 – 35.0       | °C   |

Customizable in `com.wqms.watermonitor.util.WaterQualityThresholds.java`.

---

## Running Unit Tests

```bash
cd backend
mvn test
```

Includes unit tests validating the SAFE/UNSAFE classification and relay ON/OFF business logic (`SensorDataServiceTest`).
