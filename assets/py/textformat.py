# assets/py/textformat.py
"""
Text formatting module for transcript processing.
Converts raw transcript text into complete sentences and paragraphs using Ollama.
"""

import re
import sys
import os
import requests
import time
import json
import subprocess

#SELECTED_MODEL = 'qwen2.5:7b'
SELECTED_MODEL = 'deepseek-r1:7b'
MAX_CHUNK_SIZE = 2000

def pull_model_if_needed():
    """Pull the selected model if not already present."""
    print(f"Checking if model {SELECTED_MODEL} is available...", file=sys.stderr)
    
    try:
        resp = requests.get('http://localhost:11434/api/tags', timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            models = data.get('models', [])
            for model in models:
                if model.get('name', '') == SELECTED_MODEL:
                    print(f"Model {SELECTED_MODEL} is already available", file=sys.stderr)
                    return True
    except Exception as e:
        print(f"Could not check models: {e}", file=sys.stderr)
    
    print(f"Pulling model {SELECTED_MODEL}...", file=sys.stderr)
    print("This may take several minutes...", file=sys.stderr)
    
    try:
        result = subprocess.run(
            ['ollama', 'pull', SELECTED_MODEL],
            capture_output=True,
            text=True,
            timeout=600
        )
        
        if result.returncode != 0:
            print(f"Failed to pull model: {result.stderr}", file=sys.stderr)
            return False
        
        print(f"Successfully pulled model {SELECTED_MODEL}", file=sys.stderr)
        return True
        
    except subprocess.TimeoutExpired:
        print("Model pull timed out after 10 minutes", file=sys.stderr)
        return False
    except FileNotFoundError:
        print("Ollama command not found. Is Ollama installed?", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error pulling model: {e}", file=sys.stderr)
        return False

def ensure_ollama_running():
    """Ensure Ollama service is running."""
    try:
        resp = requests.get('http://localhost:11434/api/tags', timeout=3)
        if resp.status_code == 200:
            return True
    except:
        pass
    
    print("Ollama service is not running. Attempting to start it...", file=sys.stderr)
    
    try:
        subprocess.Popen(['ollama', 'serve'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(3)
        
        for attempt in range(5):
            try:
                resp = requests.get('http://localhost:11434/api/tags', timeout=3)
                if resp.status_code == 200:
                    print("Ollama service started successfully", file=sys.stderr)
                    return True
            except:
                pass
            time.sleep(2)
    except Exception as e:
        print(f"Failed to start Ollama: {e}", file=sys.stderr)
    
    return False

def call_ollama(system_prompt, user_prompt, temperature=0.1, max_tokens=4096):
    """Call Ollama API for text formatting."""
    ollama_url = 'http://localhost:11434/api/chat'
    
    payload = {
        'model': SELECTED_MODEL,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt}
        ],
        'stream': False,
        'options': {
            'temperature': temperature,
            'num_predict': max_tokens
        }
    }
    
    try:
        response = requests.post(ollama_url, json=payload, timeout=300)
    except requests.exceptions.RequestException as e:
        raise Exception(f"Request failed: {e}")
    
    if response.status_code != 200:
        raise Exception(f"Ollama returned status {response.status_code}: {response.text[:200]}")
    
    try:
        data = response.json()
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse JSON: {e}. Response: {response.text[:200]}")
    
    if not data.get('message'):
        raise Exception(f"No 'message' field in response: {data.keys()}")
    
    if not data['message'].get('content'):
        raise Exception(f"No 'content' in message. Full response: {json.dumps(data)[:200]}")
    
    result = data['message']['content'].strip()
    if not result:
        raise Exception("Empty content from Ollama")
    
    return result

def format_transcript(transcript_text):
    """Format transcript text into complete sentences and paragraphs using Ollama."""
    if not transcript_text or not transcript_text.strip():
        raise ValueError("Input text is empty")
    
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"STARTING FORMATTING WITH OLLAMA", file=sys.stderr)
    print(f"Model: {SELECTED_MODEL}", file=sys.stderr)
    print(f"Input size: {len(transcript_text)} characters", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)
    
    if not ensure_ollama_running():
        raise Exception("Cannot start Ollama service")
    
    if not pull_model_if_needed():
        raise Exception(f"Failed to pull model {SELECTED_MODEL}")
    
    text = ' '.join(transcript_text.splitlines())
    text = re.sub(r'\s+', ' ', text)
    
    print(f"After normalization: {len(text)} characters", file=sys.stderr)
    
    chunks = []
    for i in range(0, len(text), MAX_CHUNK_SIZE):
        chunk = text[i:i + MAX_CHUNK_SIZE]
        chunks.append(chunk)
    
    print(f"Split into {len(chunks)} chunks of max {MAX_CHUNK_SIZE} chars", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)
    
    system_prompt = """You are a text formatting assistant. Your ONLY job is to add proper punctuation and capitalization to the text.
Rules:
- Add periods at the end of sentences that lack them
- Capitalize the first letter of each sentence
- Do not change any words, only add punctuation and fix capitalization
- Do not add any explanations, commentary, or extra text
- Output ONLY the formatted text"""

    formatted_chunks = []
    total_start = time.time()
    
    for i, chunk in enumerate(chunks):
        print(f"[CHUNK {i+1}/{len(chunks)}] Processing {len(chunk)} chars...", file=sys.stderr)
        
        user_prompt = f"Add proper punctuation and capitalization to this text. Output ONLY the formatted text:\n\n{chunk}"
        
        start_time = time.time()
        
        result = None
        for attempt in range(3):
            try:
                result = call_ollama(system_prompt, user_prompt)
                if result:
                    break
            except Exception as e:
                print(f"[CHUNK {i+1}/{len(chunks)}] Attempt {attempt + 1} failed: {e}", file=sys.stderr)
                if attempt < 2:
                    time.sleep(3)
        
        if not result:
            raise Exception(f"Chunk {i+1} failed after 3 retries")
        
        elapsed = time.time() - start_time
        print(f"[CHUNK {i+1}/{len(chunks)}] Completed in {elapsed:.1f}s", file=sys.stderr)
        formatted_chunks.append(result)
    
    total_elapsed = time.time() - total_start
    
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"Merging {len(formatted_chunks)} chunks...", file=sys.stderr)
    
    result = ' '.join(formatted_chunks)
    
    result = re.sub(r'\s+', ' ', result)
    result = re.sub(r'\.\s+\.', '.', result)
    result = re.sub(r'\s+([.,!?;:])', r'\1', result)
    
    if result and result[0].isalpha():
        result = result[0].upper() + result[1:]
    
    print(f"Total formatting time: {total_elapsed:.1f} seconds", file=sys.stderr)
    print(f"Output size: {len(result)} characters", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)
    
    return result

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input_file> <output_file>", file=sys.stderr)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"Input file not found: {input_file}", file=sys.stderr)
        sys.exit(1)
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            input_text = f.read()
        
        if not input_text or not input_text.strip():
            print("Input file is empty", file=sys.stderr)
            sys.exit(1)
        
        result = format_transcript(input_text)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result)
        
        print(f"Successfully formatted transcript. Output length: {len(result)}", file=sys.stderr)
        sys.exit(0)
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)