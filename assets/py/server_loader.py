#!/usr/bin/env python3
import subprocess
import os
import sys
import json
import logging
import time
import requests
from pathlib import Path

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
LOG_DIR = PROJECT_ROOT / "assets/logs"
API_CHECK_URL = "http://localhost:5000"
MAX_CHECK_ATTEMPTS = 30
CHECK_INTERVAL = 3

def setup_logging():
    """Configure logging for server operations"""
    LOG_FILE = LOG_DIR / "server_loader.log"
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        if LOG_FILE.exists():
            LOG_FILE.unlink()
        LOG_FILE.touch(mode=0o666, exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(LOG_FILE),
                logging.StreamHandler()
            ]
        )
        return logging.getLogger("ServerLoader")
    except Exception as e:
        print(json.dumps({
            "success": False,
            "status": "error",
            "message": f"Logging setup failed: {str(e)}"
        }))
        sys.exit(1)

logger = setup_logging()

def check_server_ready():
    """Check if the server API is responding"""
    attempts = 0
    while attempts < MAX_CHECK_ATTEMPTS:
        try:
            # Check basic API endpoint
            response = requests.get(f"{API_CHECK_URL}/", timeout=5)
            if response.status_code == 200:
                logger.info("API server is ready")
                return True
            logger.info(f"API responded with status {response.status_code}")
        except (requests.exceptions.ConnectionError, requests.exceptions.RequestException) as e:
            logger.info(f"API not ready yet: {str(e)}")
        
        attempts += 1
        if attempts < MAX_CHECK_ATTEMPTS:
            time.sleep(CHECK_INTERVAL)
    
    return False

def launch_server() -> dict:
    """Launch the text generation webui server with proper environment"""
    tg_dir = "/home/kdog/text-generation-webui"
    venv_dir = os.path.join(tg_dir, "venv")
    python_exec = os.path.join(venv_dir, "bin", "python")
    server_script = os.path.join(tg_dir, "server.py")

    logger.info("Attempting to launch text generation webui server")
    
    try:
        if not os.path.exists(python_exec):
            logger.error(f"Python executable not found at {python_exec}")
            return {
                "success": False,
                "status": "error",
                "message": "Python executable not found"
            }

        if not os.path.exists(server_script):
            logger.error(f"Server script not found at {server_script}")
            return {
                "success": False,
                "status": "error",
                "message": "Server script not found"
            }

        # Activate the virtual environment
        env = os.environ.copy()
        env["PATH"] = f"{os.path.join(venv_dir, 'bin')}:{env.get('PATH', '')}"
        env["VIRTUAL_ENV"] = venv_dir

        # Start the server process with required flags
        server_args = [
            python_exec, 
            server_script, 
            "--listen", 
            "--api", 
            "--trust-remote-code",
            "--extensions", "documents"
        ]
        
        logger.info(f"Starting server process: {' '.join(server_args)}")
        process = subprocess.Popen(
            server_args,
            cwd=tg_dir,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True
        )
        
        logger.info(f"Server started with PID: {process.pid}")
        
        # Wait for server to be ready
        if check_server_ready():
            return {
                "success": True,
                "status": "ready",
                "message": "Server started and ready",
                "pid": process.pid
            }
        else:
            process.terminate()
            return {
                "success": False,
                "status": "error",
                "message": "Server failed to start - API not responding after multiple attempts"
            }
            
    except Exception as e:
        logger.error(f"Failed to launch server: {str(e)}")
        return {
            "success": False,
            "status": "error",
            "message": f"Failed to launch server: {str(e)}"
        }

if __name__ == "__main__":
    try:
        logger.info("=== Starting server loader ===")
        result = launch_server()
        logger.info(f"Operation result: {json.dumps(result)}")
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0 if result["success"] else 1)
    except Exception as e:
        error_msg = f"Critical error: {str(e)}"
        logger.critical(error_msg)
        print(json.dumps({
            "success": False,
            "status": "error",
            "message": error_msg
        }))
        sys.exit(1)