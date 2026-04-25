=== modified: assets/py/api_server.py ===
#!/usr/bin/env python3
"""Python API server to replace PHP endpoints"""

import json
import subprocess
import os
import sys
import requests
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import traceback

app = Flask(__name__)
CORS(app)

# Paths
PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
START_SCRIPT = Path("/home/kdog/openwebui/start.sh")
STOP_SCRIPT = Path("/home/kdog/openwebui/stop.sh")
OLLAMA_API = "http://localhost:11434"

def log_message(msg):
    """Log messages to file for debugging"""
    log_file = '/tmp/api_server.log'
    with open(log_file, 'a') as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {msg}\n")
    print(msg)

def is_ollama_running():
    """Check if Ollama service is running"""
    try:
        response = requests.get('http://localhost:11434/api/tags', timeout=2)
        if response.status_code == 200:
            return True
    except Exception as e:
        log_message(f"Status check - Ollama API not responding: {e}")
    
    return False

@app.route('/assets/php/ollama_api.php', methods=['GET', 'POST', 'OPTIONS'])
def ollama_api():
    if request.method == 'OPTIONS':
        return '', 200
    
    action = request.args.get('action', '')
    log_message(f"API call: action={action}")
    
    if action == 'status':
        running = is_ollama_running()
        return jsonify({'success': True, 'running': running, 'timestamp': time.time()})
    
    elif action == 'start':
        log_message(f"Starting service using {START_SCRIPT}")
        
        if not START_SCRIPT.exists():
            log_message(f"ERROR: start.sh not found at {START_SCRIPT}")
            return jsonify({'success': False, 'error': f'start.sh not found at {START_SCRIPT}'})
        
        os.chmod(START_SCRIPT, 0o755)
        
        try:
            log_message("Executing start.sh...")
            result = subprocess.run(['bash', str(START_SCRIPT)], capture_output=True, text=True, timeout=60)
            log_message(f"Start script return code: {result.returncode}")
            log_message(f"Start script stdout: {result.stdout[:500]}")
            if result.stderr:
                log_message(f"Start script stderr: {result.stderr[:500]}")
        except subprocess.TimeoutExpired:
            log_message("ERROR: Start script timed out after 60 seconds")
            return jsonify({'success': False, 'error': 'Start script timed out'})
        except Exception as e:
            log_message(f"ERROR executing start.sh: {str(e)}")
            log_message(traceback.format_exc())
            return jsonify({'success': False, 'error': str(e)})
        
        log_message("Waiting for Ollama service to become responsive...")
        started = False
        for i in range(20):
            time.sleep(1)
            if is_ollama_running():
                started = True
                log_message(f"Service became responsive after {i+1} seconds")
                break
        
        return jsonify({
            'success': started,
            'running': started,
            'message': 'Ollama service started' if started else 'Service started but not yet responsive'
        })
    
    elif action == 'stop':
        log_message(f"Stopping service using {STOP_SCRIPT}")
        
        if not STOP_SCRIPT.exists():
            log_message(f"ERROR: stop.sh not found at {STOP_SCRIPT}")
            return jsonify({'success': False, 'error': f'stop.sh not found at {STOP_SCRIPT}'})
        
        os.chmod(STOP_SCRIPT, 0o755)
        
        try:
            log_message("Executing stop.sh...")
            result = subprocess.run(['bash', str(STOP_SCRIPT)], capture_output=True, text=True, timeout=30)
            log_message(f"Stop script return code: {result.returncode}")
            log_message(f"Stop script stdout: {result.stdout[:500]}")
            if result.stderr:
                log_message(f"Stop script stderr: {result.stderr[:500]}")
        except subprocess.TimeoutExpired:
            log_message("ERROR: Stop script timed out")
            return jsonify({'success': False, 'error': 'Stop script timed out'})
        except Exception as e:
            log_message(f"ERROR executing stop.sh: {str(e)}")
            return jsonify({'success': False, 'error': str(e)})
        
        time.sleep(3)
        still_running = is_ollama_running()
        
        return jsonify({
            'success': not still_running,
            'running': still_running,
            'message': 'Ollama service stopped' if not still_running else 'Service still running'
        })
    
    elif action == 'list':
        if not is_ollama_running():
            return jsonify({'success': False, 'error': 'Ollama service not running'})
        
        try:
            response = requests.get('http://localhost:11434/api/tags', timeout=10)
            if response.status_code == 200:
                data = response.json()
                models = [{'name': m['name'], 'size': m['size'], 'modified': m.get('modified_at', '')} 
                         for m in data.get('models', [])]
                return jsonify({'success': True, 'models': models})
        except Exception as e:
            log_message(f"Error listing models: {e}")
        
        return jsonify({'success': False, 'error': 'Failed to fetch models'})
    
    else:
        return jsonify({'success': False, 'error': f'Invalid action: {action}'})

@app.route('/assets/php/save_config.php', methods=['POST', 'OPTIONS'])
def save_config():
    if request.method == 'OPTIONS':
        return '', 200
    
    data = request.get_json()
    config_file = PROJECT_ROOT / 'assets/data/config.json'
    config_file.parent.mkdir(parents=True, exist_ok=True)
    with open(config_file, 'w') as f:
        json.dump(data, f)
    return jsonify({'success': True})

@app.route('/assets/php/force_reload_model.php', methods=['GET', 'OPTIONS'])
def force_reload_model():
    if request.method == 'OPTIONS':
        return '', 200
    
    config_file = PROJECT_ROOT / 'assets/data/config.json'
    profile = 'ragcode'
    
    if config_file.exists():
        with open(config_file) as f:
            config = json.load(f)
            profile = config.get('filesetconfig', 'ragcode')
    
    yaml_file = PROJECT_ROOT / f'assets/py/{profile}.yaml'
    model = 'deepseek-coder:6.7b'
    
    if yaml_file.exists():
        with open(yaml_file) as f:
            content = f.read()
            import re
            match = re.search(r'ollama_model:\s*["\']?([^"\'\n]+)["\']?', content)
            if match:
                model = match.group(1).strip()
    
    if not is_ollama_running():
        return jsonify({'success': False, 'message': 'Stack not running', 'profile': profile, 'new_model': model})
    
    try:
        response = requests.get('http://localhost:11434/api/ps', timeout=5)
        current_model = None
        if response.status_code == 200:
            data = response.json()
            if data.get('models'):
                current_model = data['models'][0]['name']
        
        if current_model == model:
            return jsonify({'success': True, 'profile': profile, 'old_model': current_model, 'new_model': model, 'status': 'already_running'})
        
        if current_model:
            requests.post('http://localhost:11434/api/generate', json={'model': current_model, 'keep_alive': 0}, timeout=5)
            time.sleep(0.5)
        
        response = requests.get('http://localhost:11434/api/tags', timeout=5)
        model_exists = False
        if response.status_code == 200:
            data = response.json()
            for m in data.get('models', []):
                if m['name'] == model:
                    model_exists = True
                    break
        
        if not model_exists:
            requests.post('http://localhost:11434/api/pull', json={'model': model}, timeout=300)
            time.sleep(2)
        
        requests.post('http://localhost:11434/api/generate', json={'model': model, 'prompt': '', 'keep_alive': 3600}, timeout=5)
        
        loaded = False
        for i in range(60):
            time.sleep(0.5)
            ps_response = requests.get('http://localhost:11434/api/ps', timeout=5)
            if ps_response.status_code == 200:
                ps_data = ps_response.json()
                if ps_data.get('models') and ps_data['models'][0]['name'] == model:
                    loaded = True
                    break
        
        return jsonify({'success': loaded, 'profile': profile, 'old_model': current_model, 'new_model': model, 'status': 'loaded' if loaded else 'loading'})
    except Exception as e:
        log_message(f"Force reload error: {e}")
        return jsonify({'success': False, 'message': str(e), 'profile': profile, 'new_model': model})

@app.route('/assets/php/rag.php', methods=['POST', 'OPTIONS'])
def rag_query():
    if request.method == 'OPTIONS':
        return '', 200
    
    data = request.get_json()
    action = data.get('action', '')
    
    if action == 'chat':
        message = data.get('message', '')
        if not message:
            return jsonify({'error': 'No message provided'})
        
        return jsonify({
            'response': f"Processing: {message}",
            'model': 'deepseek-coder:6.7b',
            'timestamp': time.time()
        })
    elif action == 'save_transcript':
        transcript = data.get('transcript', '')
        if not transcript:
            return jsonify({'success': False, 'error': 'No transcript content provided'})
        
        transcript_dir = PROJECT_ROOT / 'assets/data/transcripts'
        transcript_dir.mkdir(parents=True, exist_ok=True)
        file_path = transcript_dir / 'rawtranscript.txt'
        with open(file_path, 'w') as f:
            f.write(transcript)
        
        return jsonify({'success': True, 'path': str(file_path), 'size': len(transcript)})
    
    return jsonify({'error': 'Invalid action'})

@app.route('/assets/php/fullbuilder.php', methods=['POST', 'OPTIONS'])
def fullbuilder():
    if request.method == 'OPTIONS':
        return '', 200
    
    if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return jsonify({'error': 'AJAX requests only'}), 403
    
    config_file = PROJECT_ROOT / 'assets/data/config.json'
    profile = 'ragcode'
    
    if config_file.exists():
        with open(config_file) as f:
            config = json.load(f)
            profile = config.get('filesetconfig', 'ragcode')
    
    python_binary = PROJECT_ROOT / 'venv_rag/bin/python3'
    if not python_binary.exists():
        python_binary = Path('/usr/bin/python3')
    python_script = PROJECT_ROOT / 'assets/py/faiss_builder.py'
    
    if not python_script.exists():
        return jsonify({'error': 'FAISS builder script not found'}), 500
    
    cmd = [str(python_binary), str(python_script), '--profile', profile]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    faiss_dir = PROJECT_ROOT / f'assets/data/{profile}/faiss_index'
    success = (faiss_dir / 'index.faiss').exists() and (faiss_dir / 'index.pkl').exists()
    
    return jsonify({
        'success': success,
        'exitCode': result.returncode,
        'profile': profile,
        'output': result.stdout + result.stderr
    })

@app.route('/assets/php/show_log.php', methods=['GET'])
def show_log():
    profile = request.args.get('profile', 'ragcode')
    log_file = PROJECT_ROOT / f'assets/logs/faiss_build_{profile}.log'
    
    if not log_file.exists():
        return jsonify({'line': 'Waiting for build to start...'})
    
    with open(log_file) as f:
        lines = f.readlines()
        last_line = lines[-1].strip() if lines else 'Build starting...'
    
    return jsonify({'line': last_line})

@app.route('/assets/php/process_transcript.php', methods=['POST', 'OPTIONS'])
def process_transcript():
    if request.method == 'OPTIONS':
        return '', 200
    
    data = request.get_json()
    transcript = data.get('transcript', '')
    
    if not transcript:
        return jsonify({'success': False, 'error': 'No transcript content provided'})
    
    return jsonify({
        'success': True,
        'message': 'Transcript received',
        'length': len(transcript)
    })

@app.route('/assets/php/auto_load_model.php', methods=['GET', 'OPTIONS'])
def auto_load_model():
    if request.method == 'OPTIONS':
        return '', 200
    
    config_file = PROJECT_ROOT / 'assets/data/config.json'
    profile = 'ragcode'
    
    if config_file.exists():
        with open(config_file) as f:
            config = json.load(f)
            profile = config.get('filesetconfig', 'ragcode')
    
    yaml_file = PROJECT_ROOT / f'assets/py/{profile}.yaml'
    model = 'deepseek-coder:6.7b'
    
    if yaml_file.exists():
        with open(yaml_file) as f:
            content = f.read()
            import re
            match = re.search(r'ollama_model:\s*["\']?([^"\'\n]+)["\']?', content)
            if match:
                model = match.group(1).strip()
    
    if not is_ollama_running():
        return jsonify({'success': False, 'model': model, 'status': 'ollama_not_running', 'profile': profile})
    
    try:
        response = requests.get('http://localhost:11434/api/ps', timeout=5)
        is_running = False
        if response.status_code == 200:
            data = response.json()
            if data.get('models') and data['models'][0]['name'] == model:
                is_running = True
        
        if not is_running:
            requests.post('http://localhost:11434/api/generate', json={'model': model, 'prompt': '', 'keep_alive': 3600}, timeout=5)
            
            loaded = False
            for i in range(30):
                time.sleep(1)
                ps_response = requests.get('http://localhost:11434/api/ps', timeout=5)
                if ps_response.status_code == 200:
                    ps_data = ps_response.json()
                    if ps_data.get('models') and ps_data['models'][0]['name'] == model:
                        loaded = True
                        break
            
            if not loaded:
                return jsonify({'success': False, 'model': model, 'status': 'timeout', 'profile': profile})
        
        return jsonify({'success': True, 'model': model, 'status': 'loaded', 'profile': profile})
    except Exception as e:
        log_message(f"Auto load error: {e}")
        return jsonify({'success': False, 'model': model, 'status': 'error', 'profile': profile})

@app.route('/assets/php/update_model.php', methods=['POST', 'OPTIONS'])
def update_model():
    if request.method == 'OPTIONS':
        return '', 200
    
    data = request.get_json()
    profile = data.get('profile', 'ragcode')
    model = data.get('model', '')
    
    if not model:
        return jsonify({'success': False, 'error': 'No model specified'})
    
    yaml_file = PROJECT_ROOT / f'assets/py/{profile}.yaml'
    
    if not yaml_file.exists():
        return jsonify({'success': False, 'error': f'Config file not found: {yaml_file}'})
    
    with open(yaml_file) as f:
        content = f.read()
    
    import re
    if re.search(r'ollama_model:\s*["\']?[^"\'\n]+["\']?', content):
        new_content = re.sub(r'ollama_model:\s*["\']?[^"\'\n]+["\']?', f'ollama_model: "{model}"', content)
    else:
        new_content = content + f'\n  ollama_model: "{model}"\n'
    
    with open(yaml_file, 'w') as f:
        f.write(new_content)
    
    return jsonify({'success': True, 'model': model, 'profile': profile})

if __name__ == '__main__':
    log_message("Starting API Server on port 5000")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)