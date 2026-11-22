<#
.SYNOPSIS
    AquaWatch - ESP32 Sensor Simulator (PowerShell)
.DESCRIPTION
    Simulates real-time sensor transmissions from an ESP32 device
    to the Spring Boot REST API.
    Runs natively in PowerShell without any dependencies.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\simulate_esp32.ps1
#>

$ServerUrl = "http://localhost:8080/api/v1/sensor-data"
$DeviceId = "ESP32-SIMULATOR"
$IntervalSeconds = 5

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   AquaWatch - ESP32 Sensor Data Simulator (PS)" -ForegroundColor Cyan
Write-Host "   Target: $ServerUrl" -ForegroundColor Gray
Write-Host "   Device: $DeviceId" -ForegroundColor Gray
Write-Host "   Interval: $IntervalSeconds seconds" -ForegroundColor Gray
Write-Host "   Press Ctrl+C to terminate" -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Cyan

$iteration = 0

while ($true) {
    $iteration++
    $isSpike = ($iteration % 5 -eq 0)

    if ($isSpike) {
        Write-Host "`n[#$iteration] Simulating CONTAMINATED water sample..." -ForegroundColor Yellow
        $ph = [Math]::Round((Get-Random -Minimum 5.2 -Maximum 5.9), 2)
        $tds = [Math]::Round((Get-Random -Minimum 520.0 -Maximum 750.0), 1)
        $turbidity = [Math]::Round((Get-Random -Minimum 6.5 -Maximum 12.0), 2)
        $temp = [Math]::Round((Get-Random -Minimum 26.0 -Maximum 30.0), 1)
    } else {
        $ph = [Math]::Round((Get-Random -Minimum 6.8 -Maximum 7.8), 2)
        $tds = [Math]::Round((Get-Random -Minimum 180.0 -Maximum 340.0), 1)
        $turbidity = [Math]::Round((Get-Random -Minimum 1.0 -Maximum 3.8), 2)
        $temp = [Math]::Round((Get-Random -Minimum 22.0 -Maximum 26.0), 1)
    }

    $body = @{
        deviceId = $DeviceId
        phValue = $ph
        tdsValue = $tds
        turbidityValue = $turbidity
        temperatureValue = $temp
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $ServerUrl -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        $relay = $response.data.relayStatus
        $status = $response.data.status
        $timeStr = (Get-Date).ToString("HH:mm:ss")

        if ($relay -eq "ON") {
            Write-Host "[$timeStr] Sent: pH=$ph, TDS=${tds}ppm, Turb=${turbidity}NTU, Temp=${temp}C -> Status: $status | Relay: ON (PURIFICATION ACTIVE)" -ForegroundColor Red
        } else {
            Write-Host "[$timeStr] Sent: pH=$ph, TDS=${tds}ppm, Turb=${turbidity}NTU, Temp=${temp}C -> Status: $status | Relay: OFF (STANDBY)" -ForegroundColor Green
        }
    } catch {
        Write-Host "Failed to send data to $ServerUrl : $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Make sure the Spring Boot backend is running on port 8080." -ForegroundColor Gray
    }

    Start-Sleep -Seconds $IntervalSeconds
}
