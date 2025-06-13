#!/usr/bin/env python3
import json
import requests
import sys
from typing import Dict

MODEL_API_URL = "http://localhost:5000/v1/internal/model/info"
TIMEOUT_SECONDS = 5

def get_model_info() -> Dict[str, str]:
    """Query text-generation-webui's internal FastAPI endpoint for model info"""
    try:
        response = requests.get(
            MODEL_API_URL,
            timeout=TIMEOUT_SECONDS,
            headers={"Accept": "application/json"}
        )
        response.raise_for_status()
        data = response.json()

        if not data or 'model_name' not in data:
            return {
                "model": "No model loaded",
                "status": "error",
                "loader": "none"
            }

        return {
            "model": data.get('model_name', 'Unknown'),
            "status": "ready",
            "loader": data.get('loader', 'unknown')
        }

    except requests.exceptions.ConnectionError:
        return {
            "model": "API not reachable",
            "status": "error",
            "loader": "none"
        }
    except requests.exceptions.Timeout:
        return {
            "model": "API timeout",
            "status": "error", 
            "loader": "none"
        }
    except requests.exceptions.RequestException as e:
        return {
            "model": f"API Error: {str(e)}",
            "status": "error",
            "loader": "none"
        }
    except Exception as e:
        return {
            "model": f"Unexpected Error: {str(e)}",
            "status": "error",
            "loader": "none"
        }

if __name__ == "__main__":
    try:
        model_info = get_model_info()
        print(json.dumps(model_info, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({
            "model": f"Critical Error: {str(e)}",
            "status": "error",
            "loader": "none"
        }))
        sys.exit(1)
