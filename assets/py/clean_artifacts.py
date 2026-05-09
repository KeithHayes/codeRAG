#!/usr/bin/env python3
"""
clean_artifacts.py - Remove LLM JSON artifacts from transcript.
Reads from formattedparagraphs.txt, writes to cleanedoutput.txt
Handles chunking for arbitrarily long transcripts.
"""

import sys
import os
import re
import yaml

CONFIG_FILE = '/var/www/html/doomsteadRAG/assets/yaml/transcript.yaml'
INPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/formattedparagraphs.txt'
OUTPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/cleanedoutput.txt'

def load_config():
    """Load configuration from YAML file."""
    if not os.path.exists(CONFIG_FILE):
        raise FileNotFoundError(f"Config file not found: {CONFIG_FILE}")
    
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    if 'clean_artifacts' not in config:
        raise KeyError("'clean_artifacts' section not found in config file")
    
    return config['clean_artifacts']

def chunk_text(text, chunk_size=32000):
    """Split text into chunks."""
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

def clean_text(text, patterns):
    """Apply regex patterns from config."""
    for pattern_config in patterns:
        pattern = pattern_config['pattern']
        flags_str = pattern_config.get('flags', '')
        
        re_flags = 0
        if 'DOTALL' in flags_str:
            re_flags |= re.DOTALL
        if 'IGNORECASE' in flags_str:
            re_flags |= re.IGNORECASE
        
        if 'replacement' in pattern_config:
            text = re.sub(pattern, pattern_config['replacement'], text, flags=re_flags)
        else:
            text = re.sub(pattern, '', text, flags=re_flags)
    
    return text

def main():
    config = load_config()
    patterns = config.get('regex_patterns', [])
    
    if not patterns:
        raise ValueError("No regex_patterns found in clean_artifacts config")
    
    if not os.path.exists(INPUT_FILE):
        print(f"Input file not found: {INPUT_FILE}", file=sys.stderr)
        sys.exit(1)
    
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        input_text = f.read()
    
    if not input_text.strip():
        print("Input file is empty", file=sys.stderr)
        sys.exit(1)
    
    chunks = chunk_text(input_text)
    print(f"Split into {len(chunks)} chunks", file=sys.stderr)
    
    processed_chunks = []
    for i, chunk in enumerate(chunks):
        processed = clean_text(chunk, patterns)
        processed_chunks.append(processed)
        print(f"Processed chunk {i+1}/{len(chunks)}", file=sys.stderr)
    
    output_text = '\n'.join(processed_chunks)
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(output_text)
    
    print(f"Saved to {OUTPUT_FILE}, length: {len(output_text)}", file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()