#!/usr/bin/env python3
import subprocess
import os
import sys
import json
import logging
from pathlib import Path

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
LOG_DIR = PROJECT_ROOT / "assets/logs"

def setup_logging():
    """Configure logging for server operations"""
    LOG_FILE = LOG_DIR / "server_loader.log"
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
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

def launch_server() -> dict:
    """Launch the text generation webui server"""
    tg_dir = "/home/kdog/text-generation-webui"
    venv_dir = os.path.join(os.path.dirname(__file__), "venv")
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

        logger.info(f"Starting server process: {python_exec} {server_script}")
        process = subprocess.Popen(
            [python_exec, server_script, "--listen", "--api", "--trust-remote-code"],
            cwd=tg_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        logger.info(f"Server started with PID: {process.pid}")
        return {
            "success": True,
            "status": "starting",
            "message": "Server launch initiated"
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