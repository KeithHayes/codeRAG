#!/usr/bin/env python3
import os
import sys
import time
import subprocess
from pathlib import Path
import logging

# Configuration - matches bash launcher exactly
WEBUI_DIR = Path("/home/kdog/text-generation-webui")
VENV_DIR = WEBUI_DIR / "venv"
LOG_FILE = WEBUI_DIR / "launch.log"
RAG_DIR = WEBUI_DIR / "extensions" / "documents"

def setup_logging():
    """Identical logging setup to bash tee behavior"""
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # File handler (matches bash >)
    fh = logging.FileHandler(LOG_FILE, mode='w')
    fh.setLevel(logging.INFO)
    
    # Console handler (matches bash tee)
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    
    formatter = logging.Formatter('%(message)s')
    fh.setFormatter(formatter)
    ch.setFormatter(formatter)
    
    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger

def check_dependencies():
    """More thorough dependency checks"""
    try:
        subprocess.run(
            ['python3', '--version'],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
    except subprocess.CalledProcessError as e:
        logging.error("ERROR: Python3 not found")
        sys.exit(1)

def check_rag_extension():
    """Verifies RAG extension exists"""
    if not (RAG_DIR / "rag.py").exists():
        logging.error(f"ERROR: RAG extension not found at {RAG_DIR}")
        sys.exit(1)

def preinitialize_rag():
    """Identical RAG initialization to bash version"""
    try:
        # Ensure proper Python path for extensions
        sys.path.insert(0, str(WEBUI_DIR))
        from extensions.documents.rag import rag
        
        logging.info("Initializing system...")
        rag.initialize()
        logging.info("RAG initialization successful")
    except Exception as e:
        logging.warning(f"RAG initialization warning: {str(e)}")
        logging.warning("The system will still launch but RAG may not work")

def launch_server():
    """Matches exact server launch behavior"""
    os.chdir(WEBUI_DIR)
    
    # Identical server launch command
    cmd = [
        str(VENV_DIR / "bin" / "python3"),
        "server.py",
        "--listen",
        "--api",
        "--trust-remote-code"
    ]
    
    # Duplicate bash exec behavior exactly
    logging.info("Starting server...")
    os.execv(cmd[0], cmd)

def main():
    """Main execution matching bash script sequence"""
    logger = setup_logging()
    
    # Identical header
    logger.info("=== Launching Text Generation WebUI with RAG ===")
    logger.info(time.ctime())
    logger.info("----------------------------------------")
    
    logger.info("Activating virtual environment...")
    os.environ['PATH'] = f"{VENV_DIR}/bin:{os.environ['PATH']}"
    os.environ['VIRTUAL_ENV'] = str(VENV_DIR)
    
    logger.info("Checking system requirements...")
    check_dependencies()
    
    logger.info("Checking RAG extension...")
    check_rag_extension()
    
    preinitialize_rag()
    launch_server()

if __name__ == "__main__":
    main()