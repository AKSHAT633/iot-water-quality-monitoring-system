package com.wqms.watermonitor.config;

import com.wqms.watermonitor.entity.SensorData;
import com.wqms.watermonitor.enums.RelayStatus;
import com.wqms.watermonitor.enums.WaterQualityStatus;
import com.wqms.watermonitor.repository.SensorDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Automatically seeds initial sample sensor readings if the database is empty,
 * ensuring the web dashboard has immediate data and trends to display upon first launch.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final SensorDataRepository sensorDataRepository;

    @Value("${app.data-loader.enabled:true}")
    private boolean dataLoaderEnabled;

    @Override
    public void run(String... args) {
        if (!dataLoaderEnabled) {
            log.info("Sample data loader is disabled.");
            return;
        }

        if (sensorDataRepository.count() == 0) {
            log.info("No sensor data found. Seeding initial sample readings for dashboard demo...");
            LocalDateTime now = LocalDateTime.now();

            List<SensorData> sampleReadings = List.of(
                SensorData.builder().deviceId("ESP32-01").phValue(7.10).tdsValue(210.5).turbidityValue(1.8).temperatureValue(24.5).status(WaterQualityStatus.SAFE).relayStatus(RelayStatus.OFF).recordedAt(now.minusHours(6)).build(),
                SensorData.builder().deviceId("ESP32-01").phValue(7.05).tdsValue(230.0).turbidityValue(2.1).temperatureValue(25.0).status(WaterQualityStatus.SAFE).relayStatus(RelayStatus.OFF).recordedAt(now.minusHours(5)).build(),
                SensorData.builder().deviceId("ESP32-01").phValue(6.90).tdsValue(480.0).turbidityValue(3.5).temperatureValue(26.2).status(WaterQualityStatus.SAFE).relayStatus(RelayStatus.OFF).recordedAt(now.minusHours(4)).build(),
                SensorData.builder().deviceId("ESP32-01").phValue(5.80).tdsValue(520.0).turbidityValue(7.2).temperatureValue(27.0).status(WaterQualityStatus.UNSAFE).relayStatus(RelayStatus.ON).recordedAt(now.minusHours(3)).build(),
                SensorData.builder().deviceId("ESP32-01").phValue(5.95).tdsValue(510.0).turbidityValue(6.5).temperatureValue(27.4).status(WaterQualityStatus.UNSAFE).relayStatus(RelayStatus.ON).recordedAt(now.minusHours(2)).build(),
                SensorData.builder().deviceId("ESP32-01").phValue(6.80).tdsValue(460.0).turbidityValue(4.0).temperatureValue(26.0).status(WaterQualityStatus.SAFE).relayStatus(RelayStatus.OFF).recordedAt(now.minusHours(1)).build(),
                SensorData.builder().deviceId("ESP32-01").phValue(7.20).tdsValue(300.0).turbidityValue(2.2).temperatureValue(24.8).status(WaterQualityStatus.SAFE).relayStatus(RelayStatus.OFF).recordedAt(now.minusMinutes(30)).build(),
                SensorData.builder().deviceId("ESP32-01").phValue(7.15).tdsValue(280.0).turbidityValue(1.9).temperatureValue(24.6).status(WaterQualityStatus.SAFE).relayStatus(RelayStatus.OFF).recordedAt(now.minusMinutes(10)).build(),
                SensorData.builder().deviceId("ESP32-01").phValue(7.08).tdsValue(260.0).turbidityValue(2.0).temperatureValue(24.7).status(WaterQualityStatus.SAFE).relayStatus(RelayStatus.OFF).recordedAt(now).build()
            );

            sensorDataRepository.saveAll(sampleReadings);
            log.info("Successfully seeded {} sample sensor readings.", sampleReadings.size());
        }
    }
}
