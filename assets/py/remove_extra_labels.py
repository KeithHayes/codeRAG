#!/usr/bin/env python3
"""
remove_extra_labels.py - Apply regex pattern to chunked input and save to sansextrasegments.txt
Reads from segmentedtext.txt, writes to sansextrasegments.txt
"""

import sys
import re
import os

INPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/segmentedtext.txt'
OUTPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/sansextrasegments.txt'

def chunk_text(text, chunk_size=32000):
    """Split text into chunks of approximately chunk_size characters."""
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

def apply_regex(text):
    """Apply regex pattern: '\n\s*\n+' replacement: '\n\n'"""
    pattern = r'\n\s*\n+'
    replacement = '\n\n'
    
    try:
        regex = re.compile(pattern, re.MULTILINE | re.DOTALL)
        return regex.sub(replacement, text)
    except re.error as e:
        print(f"Regex error: {e}", file=sys.stderr)
        return text

def main():
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
        processed = apply_regex(chunk)
        processed_chunks.append(processed)
        print(f"Processed chunk {i+1}/{len(chunks)}", file=sys.stderr)
    
    output_text = '\n'.join(processed_chunks)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(output_text)
    
    print(f"Saved to {OUTPUT_FILE}, length: {len(output_text)}", file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()