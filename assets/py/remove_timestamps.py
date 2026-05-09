#!/usr/bin/env python3
"""
remove_timestamps.py - Remove timestamps from transcript text.
Reads input from file (argv[1]), writes cleaned output to file (argv[2]).
No file I/O in this script - pure transformation.
"""

import sys
import re
import os
import yaml

CONFIG_FILE = '/var/www/html/doomsteadRAG/assets/yaml/transcript.yaml'

def load_config():
    """Load configuration from YAML file."""
    if not os.path.exists(CONFIG_FILE):
        raise FileNotFoundError(f"Config file not found: {CONFIG_FILE}")
    
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    if 'remove_timestamps' not in config:
        raise KeyError("'remove_timestamps' section not found in config file")
    
    return config['remove_timestamps']

def remove_timestamps(text, patterns):
    """
    Remove timestamp patterns from transcript text.
    
    Removes:
    - Lines that contain only a timestamp (e.g., "0:13")
    - Lines that contain only duration (e.g., "13 seconds", "1 minute, 1 second")
    - Timestamp prefixes from beginning of lines (e.g., "0:13 5 seconds ")
    """
    lines = text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # Apply each regex pattern
        skip = False
        for pattern in patterns:
            if re.match(pattern, stripped):
                skip = True
                break
        
        if skip:
            continue
        
        # Remove timestamp prefix from beginning of line
        for pattern in patterns:
            line = re.sub(r'^' + pattern + r'\s*', '', line)
        
        # Remove any remaining standalone timestamps within the line
        line = re.sub(r'\b\d+:\d+\b', '', line)
        
        cleaned_lines.append(line)
    
    # Join back
    result = '\n'.join(cleaned_lines)
    
    # Clean up multiple blank lines
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    return result.strip()

def main():
    config = load_config()
    patterns = config.get('regex_patterns', [])
    
    if not patterns:
        raise ValueError("No regex_patterns found in remove_timestamps config")
    
    if len(sys.argv) < 3:
        print("Error: Missing input or output file arguments", file=sys.stderr)
        print(f"Usage: {sys.argv[0]} <input_file> <output_file>", file=sys.stderr)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    # Check input exists
    if not os.path.exists(input_file):
        print(f"Error: Input file not found: {input_file}", file=sys.stderr)
        sys.exit(1)
    
    # Read input
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            input_text = f.read()
    except Exception as e:
        print(f"Error reading input file: {str(e)}", file=sys.stderr)
        sys.exit(1)
    
    if not input_text or not input_text.strip():
        print("Error: Input file is empty", file=sys.stderr)
        sys.exit(1)
    
    # Process
    try:
        output_text = remove_timestamps(input_text, patterns)
    except Exception as e:
        print(f"Error processing text: {str(e)}", file=sys.stderr)
        sys.exit(1)
    
    if not output_text or not output_text.strip():
        print("Error: Output is empty", file=sys.stderr)
        sys.exit(1)
    
    # Write output
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(output_text)
    except Exception as e:
        print(f"Error writing output file: {str(e)}", file=sys.stderr)
        sys.exit(1)
    
    # Success message to stderr
    print(f"Success: {len(output_text)} characters", file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()