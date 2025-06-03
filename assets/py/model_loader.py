#!/usr/bin/env python3
import requests
import json
import sys

MODEL_NAME = "Deepseek-coder-6.7B/deepseek-coder-6.7b-instruct.Q4_0.gguf"
LOAD_API_URL = "http://localhost:5000/v1/internal/model/load"
TIMEOUT_SECONDS = 10

def load_model():
    try:
        response = requests.post(
            LOAD_API_URL,
            json={"model_name": MODEL_NAME},
            headers={"Content-Type": "application/json"},
            timeout=TIMEOUT_SECONDS
        )
        response.raise_for_status()

        # Try to decode JSON
        try:
            data = response.json()
        except json.JSONDecodeError:
            data = {"message": response.text.strip()}

        # If it's a dict and contains useful info, great
        result = {
            "model": MODEL_NAME,
            "status": "loading",
            "loader": "internal"
        }

    except requests.exceptions.ConnectionError:
        result = {
            "model": "API not reachable",
            "status": "error",
            "loader": "none"
        }
    except requests.exceptions.Timeout:
        result = {
            "model": "API timeout",
            "status": "error",
            "loader": "none"
        }
    except requests.exceptions.RequestException as e:
        result = {
            "model": f"Request error: {str(e)}",
            "status": "error",
            "loader": "none"
        }
    except Exception as e:
        result = {
            "model": f"Unexpected error: {str(e)}",
            "status": "error",
            "loader": "none"
        }

    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result["status"] != "error" else 1)

if __name__ == "__main__":
    load_model()
