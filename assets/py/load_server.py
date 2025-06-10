#!/usr/bin/env python3
import os
import sys
import time
import subprocess
from pathlib import Path
import logging

WEBUI_DIR = Path("/home/kdog/text-generation-webui")
VENV_DIR = WEBUI_DIR / "venv"
LOG_FILE = WEBUI_DIR / "launch.log"

# Set TRITON_CACHE_DIR environment variable
triton_cache_dir = '/var/www/html/doomsteadRAG/assets/data'
os.makedirs(triton_cache_dir, exist_ok=True)
os.environ['TRITON_CACHE_DIR'] = triton_cache_dir

def setup_logging():
    """Sets up logging to both a file and the console."""
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    fh = logging.FileHandler(LOG_FILE, mode='w')
    fh.setLevel(logging.INFO)

    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)

    formatter = logging.Formatter('%(message)s')
    fh.setFormatter(formatter)
    ch.setFormatter(formatter)

    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger

def check_dependencies():
    """Checks for essential system dependencies, like Python3."""
    try:
        subprocess.run(
            ['python3', '--version'],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
    except subprocess.CalledProcessError as e:
        logging.error("ERROR: Python3 not found in system PATH. Please ensure Python3 is installed.")
        sys.exit(1)
    except FileNotFoundError:
        logging.error("ERROR: 'python3' command not found. Please ensure Python3 is installed and accessible.")
        sys.exit(1)

def launch_server():
    """Launches the text-generation-webui server."""
    os.chdir(WEBUI_DIR)

    cmd = [
        str(VENV_DIR / "bin" / "python3"),
        "server.py",
        "--listen",
        "--api",
        "--trust-remote-code"
    ]

    logging.info("Starting text-generation-webui server...")

    os.execv(cmd[0], cmd)

def main():
    """Main execution sequence for launching the web UI."""
    logger = setup_logging()

    logger.info("=== Launching Text Generation WebUI ===")
    logger.info(time.ctime())
    logger.info("----------------------------------------")

    logger.info("Activating virtual environment...")

    os.environ['PATH'] = f"{VENV_DIR}/bin:{os.environ['PATH']}"
    os.environ['VIRTUAL_ENV'] = str(VENV_DIR)

    logger.info("Checking system requirements...")
    check_dependencies()



    launch_server()

if __name__ == "__main__":
    main()