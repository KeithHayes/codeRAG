import subprocess
import os
import sys

def launch_webui_no_rag():
    tg_dir = "/home/kdog/text-generation-webui"
    venv_dir = os.path.join(os.path.dirname(__file__), "venv")
    log_file = os.path.join(tg_dir, "launch_no_rag.log")

    with open(log_file, "w") as log:
        log.write("=== Launching Text Generation WebUI WITHOUT RAG ===\n")
        log.write(f"{subprocess.getoutput('date')}\n")
        log.write("----------------------------------------\n")

        # Activate the venv
        activate_script = os.path.join(venv_dir, "bin", "activate")
        if not os.path.isfile(activate_script):
            log.write("ERROR: Virtual environment activation script not found.\n")
            return

        log.write("Activating virtual environment...\n")
        
        # Launch the server using the venv's Python
        python_exec = os.path.join(venv_dir, "bin", "python")
        server_script = os.path.join(tg_dir, "server.py")
        if not os.path.isfile(server_script):
            log.write("ERROR: server.py not found in text-generation-webui directory.\n")
            return

        log.write("Starting server WITHOUT RAG extension...\n")
        try:
            subprocess.Popen(
                [python_exec, server_script, "--listen", "--api", "--trust-remote-code"],
                cwd=tg_dir,
                stdout=log,
                stderr=subprocess.STDOUT
            )
            log.write("WebUI launched successfully.\n")
        except Exception as e:
            log.write(f"ERROR: Failed to launch WebUI: {str(e)}\n")
            return

        log.write("----------------------------------------\n")
        log.write(f"Process started at {subprocess.getoutput('date')}\n")

if __name__ == "__main__":
    launch_webui_no_rag()
