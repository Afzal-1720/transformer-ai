import json
import os
import time
from typing import Optional

import requests
import serial

SERIAL_PORT = os.getenv("ARDUINO_SERIAL_PORT")
BAUD_RATE = int(os.getenv("ARDUINO_BAUD_RATE", "9600"))
API_BASE_URL = os.getenv("BACKEND_API_URL", "http://127.0.0.1:8000")
TRANSFORMER_ID = os.getenv("TRANSFORMER_ID", "TX-001")
API_URL = f"{API_BASE_URL.rstrip('/')}/api/transformers/{TRANSFORMER_ID}/telemetry"


def find_serial_port() -> Optional[str]:
    if SERIAL_PORT:
        return SERIAL_PORT

    common_ports = [
        "COM3",
        "COM4",
        "COM5",
        "COM6",
        "COM7",
        "COM8",
        "COM9",
        "COM10",
        "COM11",
        "COM12",
        "/dev/ttyUSB0",
        "/dev/ttyACM0",
        "/dev/cu.usbmodem*",
        "/dev/tty.usbmodem*",
    ]
    for port in common_ports:
        try:
            with serial.Serial(port, BAUD_RATE, timeout=1):
                return port
        except serial.SerialException:
            continue
    return None


def validate_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Each line must decode to a JSON object")

    missing_required = [field for field in ("vrms", "irms", "temperature", "moisture") if field not in payload]
    if missing_required:
        raise ValueError(f"Missing required telemetry fields: {', '.join(missing_required)}")

    for field_name in ("vrms", "irms", "temperature", "moisture"):
        value = payload.get(field_name)
        if value is None or isinstance(value, bool):
            raise ValueError(f"Field '{field_name}' must be a non-null numeric value")
        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"Field '{field_name}' must be numeric")
        if not (numeric_value == numeric_value and numeric_value not in (float("inf"), float("-inf"))):
            raise ValueError(f"Field '{field_name}' must be finite")
        payload[field_name] = numeric_value

    numeric_checks = {
        "vrms": (0.0, 500.0),
        "irms": (0.0, 500.0),
        "temperature": (-40.0, 250.0),
        "moisture": (0.0, 100.0),
    }
    for field_name, (min_value, max_value) in numeric_checks.items():
        numeric_value = float(payload[field_name])
        if numeric_value < min_value or numeric_value > max_value:
            raise ValueError(f"Field '{field_name}' is out of range")

    payload["winding_hotspot_temperature"] = payload.pop("temperature")
    payload["transformer_id"] = TRANSFORMER_ID
    payload["sensor_status"] = "ONLINE"
    return payload


def send_telemetry(data: dict) -> None:
    response = requests.post(API_URL, json=data, timeout=5)
    response.raise_for_status()
    print("Sensor data:", data)
    print("API status:", response.status_code)
    try:
        print("API response:", response.json())
    except ValueError:
        print("API response text:", response.text)


def main() -> None:
    while True:
        port = find_serial_port()
        if not port:
            print("Could not detect a connected Arduino serial device. Retrying in 5 seconds...")
            time.sleep(5)
            continue

        try:
            print(f"Connecting to Arduino on {port}...")
            with serial.Serial(port, BAUD_RATE, timeout=2) as arduino:
                print("Arduino connected successfully!")
                time.sleep(2)

                while True:
                    line = arduino.readline()
                    if not line:
                        continue

                    try:
                        decoded = line.decode("utf-8", errors="replace").strip()
                        if not decoded:
                            continue
                        payload = json.loads(decoded)
                        validated = validate_payload(payload)
                        send_telemetry(validated)
                    except json.JSONDecodeError:
                        print("Invalid JSON received:", line)
                    except ValueError as exc:
                        print(f"Invalid telemetry payload: {exc}")
                    except requests.RequestException as exc:
                        print("Backend connection error:", exc)
                        time.sleep(2)
        except serial.SerialException as exc:
            print("Arduino serial connection error:", exc)
            print("Retrying connection in 5 seconds...")
            time.sleep(5)
        except KeyboardInterrupt:
            print("Serial bridge stopped.")
            break


if __name__ == "__main__":
    print("Install dependencies with: pip install pyserial requests")
    main()
