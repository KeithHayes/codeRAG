#!/usr/bin/env python3
"""
clean_artifacts.py - Remove LLM JSON artifacts from transcript.
Reads from formattedparagraphs.txt, writes to cleaned_output.txt
Handles chunking for arbitrarily long transcripts.
"""

import sys
import os
import re

INPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/formattedparagraphs.txt'
OUTPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/cleaned_output.txt'
CHUNK_SIZE = 32000

def chunk_text(text, chunk_size=CHUNK_SIZE):
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

def clean_text(text):
    """Apply regex pattern: '```[\s\S]*?```|```|`|\n{3,}'"""
    # Remove code blocks
    text = re.sub(r'```[\s\S]*?```', '', text, flags=re.DOTALL)
    # Remove standalone backticks
    text = re.sub(r'```', '', text)
    text = re.sub(r'`', '', text)
    # Collapse multiple newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
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
        processed = clean_text(chunk)
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