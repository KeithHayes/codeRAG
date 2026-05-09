#!/usr/bin/env python3
"""
identify_speakers.py - Use Ollama LLM to identify speakers in transcript.
Reads from sansextrasegments.txt, writes to identified_speakers.txt
"""

import sys
import os
import requests
import time
import yaml

CONFIG_FILE = '/var/www/html/doomsteadRAG/assets/yaml/transcript.yaml'
INPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/sansextrasegments.txt'
OUTPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/identifiedspeakers.txt'

def load_config():
    """Load configuration from YAML file."""
    if not os.path.exists(CONFIG_FILE):
        raise FileNotFoundError(f"Config file not found: {CONFIG_FILE}")
    
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    if 'identify_speakers' not in config:
        raise KeyError("'identify_speakers' section not found in config file")
    
    return config['identify_speakers']

def chunk_text(text, chunk_size):
    """Split text into chunks that respect line boundaries."""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    lines = text.split('\n')
    current_chunk = []
    current_size = 0
    
    for line in lines:
        line_size = len(line) + 1
        if current_size + line_size > chunk_size and current_chunk:
            chunks.append('\n'.join(current_chunk))
            current_chunk = [line]
            current_size = line_size
        else:
            current_chunk.append(line)
            current_size += line_size
    
    if current_chunk:
        chunks.append('\n'.join(current_chunk))
    
    return chunks

def ensure_ollama_running():
    """Check if Ollama is running."""
    try:
        resp = requests.get('http://localhost:11434/api/tags', timeout=3)
        return resp.status_code == 200
    except:
        return False

def call_ollama(text, config, attempt=1):
    """Call Ollama API to identify speakers."""
    model = config.get('model')
    system_prompt = config.get('system_prompt')
    user_prompt_template = config.get('user_prompt_template')
    temperature = config.get('temperature', 0.1)
    max_tokens = config.get('max_tokens', 4096)
    
    ollama_url = "http://localhost:11434/api/chat"
    
    user_prompt = user_prompt_template.replace('{input}', text)
    
    payload = {
        'model': model,
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
        response = requests.post(ollama_url, json=payload, timeout=180)
        if response.status_code != 200:
            print(f"Ollama returned {response.status_code}", file=sys.stderr)
            return None
        
        data = response.json()
        if data.get('message') and data['message'].get('content'):
            return data['message']['content'].strip()
        return None
    except Exception as e:
        print(f"Ollama error (attempt {attempt}): {e}", file=sys.stderr)
        return None

def post_process(text):
    """Clean up any remaining artifacts."""
    lines = text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        line = line.strip()
        if line:
            cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines)

def main():
    config = load_config()
    
    model = config.get('model')
    chunk_size = config.get('max_chunk_size', 15000)
    
    if not model:
        raise ValueError("No model specified in identify_speakers config")
    
    if not os.path.exists(INPUT_FILE):
        print(f"Input file not found: {INPUT_FILE}", file=sys.stderr)
        sys.exit(1)
    
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        input_text = f.read()
    
    if not input_text.strip():
        print("Input file is empty", file=sys.stderr)
        sys.exit(1)
    
    if not ensure_ollama_running():
        print("Ollama service is not running", file=sys.stderr)
        sys.exit(1)
    
    chunks = chunk_text(input_text, chunk_size)
    print(f"Split into {len(chunks)} chunks", file=sys.stderr)
    
    processed_chunks = []
    for i, chunk in enumerate(chunks):
        print(f"Processing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)...", file=sys.stderr)
        
        result = None
        for attempt in range(3):
            result = call_ollama(chunk, config, attempt+1)
            if result:
                break
            time.sleep(3)
        
        if not result:
            print(f"Failed to process chunk {i+1} after 3 attempts", file=sys.stderr)
            sys.exit(1)
        
        processed_chunks.append(result)
        print(f"  Completed, output length: {len(result)}", file=sys.stderr)
    
    output_text = '\n'.join(processed_chunks)
    output_text = post_process(output_text)
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(output_text)
    
    print(f"Saved to {OUTPUT_FILE}, length: {len(output_text)}", file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()