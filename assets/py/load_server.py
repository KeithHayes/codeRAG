#!/usr/bin/env python3
import os
import sys
import subprocess
from pathlib import Path
import logging
from typing import Tuple

# Configuration
TG_DIR = Path("/home/kdog/text-generation-webui")
VENV_DIR = TG_DIR / "venv"
LOG_FILE = TG_DIR / "launch.log"
RAG_DIR = TG_DIR / "extensions" / "documents"

def setup_logging() -> logging.Logger:
    """Configure logging to both file and console"""
    logger = logging.getLogger("RAG_Launcher")
    logger.setLevel(logging.INFO)
    
    # File handler
    file_handler = logging.FileHandler(LOG_FILE)
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter('%(message)s'))
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

def check_requirements(logger: logging.Logger) -> bool:
    """Check system requirements"""
    logger.info("Checking system requirements...")
    
    # Check Python
    try:
        subprocess.run(["python3", "--version"], check=True, capture_output=True)
    except subprocess.CalledProcessError:
        logger.error("ERROR: Python3 not found or not working")
        return False
    
    # Check RAG extension
    if not (RAG_DIR / "rag.py").exists():
        logger.error(f"ERROR: RAG extension not found at {RAG_DIR}")
        return False
    
    return True

def initialize_rag(logger: logging.Logger) -> bool:
    """Initialize RAG system"""
    logger.info("Initializing system...")
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "rag", 
            str(RAG_DIR / "rag.py")
        )
        rag = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(rag)
        rag.initialize()
        logger.info("RAG initialization successful")
        return True
    except Exception as e:
        logger.warning(f"RAG initialization warning: {str(e)}")
        logger.warning("The system will still launch but RAG may not work")
        return False

def launch_server(logger: logging.Logger) -> int:
    """Launch the text generation webui server"""
    logger.info("Starting server...")
    
    # Prepare environment
    env = os.environ.copy()
    env["PATH"] = f"{VENV_DIR / 'bin'}:{env.get('PATH', '')}"
    env["VIRTUAL_ENV"] = str(VENV_DIR)
    
    # Prepare command
    server_command = [
        str(VENV_DIR / "bin" / "python3"),
        str(TG_DIR / "server.py"),
        "--listen",
        "--api",
        "--trust-remote-code"
    ]
    
    try:
        # Start the server process
        with open(LOG_FILE, 'a') as log_file:
            process = subprocess.Popen(
                server_command,
                cwd=str(TG_DIR),
                env=env,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                text=True
            )
        
        logger.info(f"Server started with PID: {process.pid}")
        return process.wait()
    except Exception as e:
        logger.error(f"Failed to start server: {str(e)}")
        return 1

def main() -> int:
    """Main entry point"""
    logger = setup_logging()
    
    logger.info("=== Launching Text Generation WebUI with RAG ===")
    logger.info(f"Log file: {LOG_FILE}")
    
    # Check requirements
    if not check_requirements(logger):
        return 1
    
    # Initialize RAG (optional)
    initialize_rag(logger)
    
    # Launch server
    return launch_server(logger)

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"Critical error: {str(e)}", file=sys.stderr)
        sys.exit(1)