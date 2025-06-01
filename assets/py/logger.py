import os
import datetime
from pathlib import Path

class Logger:
    def __init__(self, log_dir="assets/logs"):
        self.verbose = True
        self.log_dir = log_dir
        self._ensure_log_directory_exists()
        
    def _ensure_log_directory_exists(self):
        """Create log directory if it doesn't exist"""
        path = Path(self.log_dir)
        try:
            path.mkdir(parents=True, exist_ok=True)
        except PermissionError as e:
            print(f"Logger error: Cannot create log directory '{self.log_dir}': {e}")
            raise
        except Exception as e:
            print(f"Logger error: Unexpected error creating '{self.log_dir}': {e}")
            raise
        
    def _write_log(self, level, message, log_file):
        timestamp = datetime.datetime.now().strftime("[%Y-%m-%d %H:%M:%S.%f]")
        log_line = f"{timestamp} {level}: {message}\n"
        log_path = os.path.join(self.log_dir, log_file)
        
        try:
            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(log_line)
        except IOError as e:
            print(f"Logger error: Failed to write to log file '{log_path}': {e}")

    def event(self, message):
        self._write_log("EVENT", message, "event.log")
        
    def debug(self, message):
        if self.verbose:
            self._write_log("DEBUG", message, "debug.log")
            
    def error(self, message):
        self._write_log("ERROR", message, "error.log")
        
    def debug_php(self, message):
        """Special method for PHP debug logs"""
        if self.verbose:
            self._write_log("DEBUG_PHP", message, "debug_php.log")

# Initialize logger
logger = Logger()
