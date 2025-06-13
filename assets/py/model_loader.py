#!/usr/bin/env python3
import requests
import json
import sys
import yaml
import os
import shutil
from pathlib import Path

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
CONFIG_JSON_PATH = PROJECT_ROOT / "assets" / "data" / "config.json"
DATA_DIR = PROJECT_ROOT / "assets" / "data"

def get_config_path():
    """
    Determines the path to the configuration YAML file.
    It checks 'filesetconfig' in config.json, defaulting to 'ragcode.yaml'.
    """
    try:
        with open(CONFIG_JSON_PATH, 'r') as f:
            config = json.load(f)
            filesetconfig = config.get('filesetconfig', 'ragcode')
            return PROJECT_ROOT / "assets" / "py" / f"{filesetconfig}.yaml"
    except Exception:
        # Fallback if config.json is missing or malformed
        return PROJECT_ROOT / "assets" / "py" / "ragcode.yaml"

def load_config():
    """
    Loads the model name specified in the configuration YAML file.
    This is the name of the model that *should be* loaded.
    """
    config_path = get_config_path()
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
            return config['doomsteadRAG']['loaded_model']
    except FileNotFoundError:
        print(f"Error: Configuration file not found at {config_path}", file=sys.stderr)
        sys.exit(1)
    except KeyError:
        print(f"Error: 'doomsteadRAG' or 'loaded_model' key not found in {config_path}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error loading configuration from {config_path}: {e}", file=sys.stderr)
        sys.exit(1)

def clear_awq_data():
    """
    Clears the data directory of files added by previous AWQ models.
    """
    try:
        for item in DATA_DIR.iterdir():
            if item.is_dir():
                # Skip clearing vector store directories
                if item.name in ['doomstead', 'ragcode', 'ragdocs']:
                    continue
                shutil.rmtree(item)
            elif item.is_file() and item.name != 'config.json':
                item.unlink()
        return True
    except Exception as e:
        print(f"Error clearing AWQ data: {str(e)}", file=sys.stderr)
        return False

# Configuration for API calls
MODEL_NAME_TO_LOAD = load_config() # This is the *new* model we want to load
UNLOAD_API_URL = "http://localhost:5000/v1/internal/model/unload"
LOAD_API_URL = "http://localhost:5000/v1/internal/model/load"
STATUS_API_URL = "http://localhost:5000/v1/internal/model/status" # Assuming a status endpoint exists
TIMEOUT_SECONDS = 40

def get_current_loaded_model():
    """
    Attempts to get the name of the currently loaded model from the API server's status endpoint.
    Returns the model name string or None if it cannot be determined.
    """
    try:
        response = requests.get(STATUS_API_URL, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        data = response.json()
        return data.get("loaded_model_name") # Adjust key based on your API's response
    except requests.exceptions.ConnectionError:
        print("Warning: API status endpoint not reachable. Cannot determine currently loaded model.", file=sys.stderr)
    except requests.exceptions.Timeout:
        print("Warning: API status endpoint timed out. Cannot determine currently loaded model.", file=sys.stderr)
    except requests.exceptions.RequestException as e:
        print(f"Warning: Request error getting model status: {e}. Cannot determine currently loaded model.", file=sys.stderr)
    except json.JSONDecodeError:
        print("Warning: Could not decode JSON from API status endpoint. Cannot determine currently loaded model.", file=sys.stderr)
    return None

def unload_model(model_name_to_unload):
    """
    Attempts to unload a specified model from the API server.
    Prints the result as JSON and returns a status dict.
    """
    if not model_name_to_unload:
        result = {"model": "None", "status": "unloading_skipped", "message": "No model specified for unloading"}
        print(json.dumps(result, ensure_ascii=False))
        return result

    print(f"Attempting to unload model: {model_name_to_unload} via {UNLOAD_API_URL}")
    try:
        response = requests.post(
            UNLOAD_API_URL,
            json={"model_name": model_name_to_unload},
            headers={"Content-Type": "application/json"},
            timeout=TIMEOUT_SECONDS
        )
        response.raise_for_status()

        try:
            data = response.json()
        except json.JSONDecodeError:
            data = {"message": response.text.strip()}

        result = {
            "model": model_name_to_unload,
            "status": "unloading_success",
            "loader": "internal",
            "api_response": data
        }

    except requests.exceptions.ConnectionError:
        result = {
            "model": model_name_to_unload,
            "status": "unloading_error",
            "message": "API not reachable during unload",
            "loader": "none"
        }
    except requests.exceptions.Timeout:
        result = {
            "model": model_name_to_unload,
            "status": "unloading_error",
            "message": "API timeout during unload",
            "loader": "none"
        }
    except requests.exceptions.RequestException as e:
        result = {
            "model": model_name_to_unload,
            "status": "unloading_error",
            "message": f"Request error during unload: {str(e)}",
            "loader": "none"
        }
    except Exception as e:
        result = {
            "model": model_name_to_unload,
            "status": "unloading_error",
            "message": f"Unexpected error during unload: {str(e)}",
            "loader": "none"
        }
    finally:
        print(json.dumps(result, ensure_ascii=False))
        return result

def load_model(model_name_to_load):
    """
    Attempts to load a specified model to the API server.
    Prints the result as JSON and returns a status dict.
    """
    print(f"Attempting to load model: {model_name_to_load} via {LOAD_API_URL}")
    try:
        # Clear AWQ data before loading new model
        if "AWQ" in model_name_to_load or "awq" in model_name_to_load.lower():
            print("Clearing previous AWQ model data...")
            if not clear_awq_data():
                print("Warning: Failed to clear all AWQ data", file=sys.stderr)

        response = requests.post(
            LOAD_API_URL,
            json={"model_name": model_name_to_load},
            headers={"Content-Type": "application/json"},
            timeout=TIMEOUT_SECONDS
        )
        response.raise_for_status()

        try:
            data = response.json()
        except json.JSONDecodeError:
            data = {"message": response.text.strip()}

        result = {
            "model": model_name_to_load,
            "status": "loading_success",
            "loader": "internal",
            "api_response": data
        }

    except requests.exceptions.ConnectionError:
        result = {
            "model": "API not reachable",
            "status": "loading_error",
            "loader": "none"
        }
    except requests.exceptions.Timeout:
        result = {
            "model": "API timeout",
            "status": "loading_error",
            "loader": "none"
        }
    except requests.exceptions.RequestException as e:
        result = {
            "model": f"Request error: {str(e)}",
            "status": "loading_error",
            "loader": "none"
        }
    except Exception as e:
        result = {
            "model": f"Unexpected error: {str(e)}",
            "status": "loading_error",
            "loader": "none"
        }
    finally:
        print(json.dumps(result, ensure_ascii=False))
        return result

if __name__ == "__main__":
    currently_loaded_model = get_current_loaded_model()
    if currently_loaded_model and currently_loaded_model == MODEL_NAME_TO_LOAD:
        print(json.dumps({
            "model": MODEL_NAME_TO_LOAD,
            "status": "already_loaded",
            "message": "The desired model is already loaded. Skipping unload and load operations."
        }, ensure_ascii=False))
        sys.exit(0)
    if currently_loaded_model:
        print(f"Found {currently_loaded_model} currently loaded. Attempting to unload...")
        unload_result = unload_model(currently_loaded_model)
        if unload_result["status"] == "unloading_error":
            print("Unload failed. Deciding whether to proceed with load or exit.", file=sys.stderr)

    load_result = load_model(MODEL_NAME_TO_LOAD)

    sys.exit(0 if load_result["status"].startswith("loading_success") else 1)