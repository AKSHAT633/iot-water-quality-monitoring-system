package com.wqms.watermonitor.controller;

import com.wqms.watermonitor.dto.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Health-check endpoint useful for verifying backend connectivity,
 * both for development and for the ESP32 to confirm server readiness.
 */
@RestController
public class HealthController {

    @GetMapping({"/api/v1/health", "/health"})
    public ApiResponse<Map<String, String>> health() {
        return ApiResponse.success("Service is up.", Map.of("status", "UP"));
    }
}
