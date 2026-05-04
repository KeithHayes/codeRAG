#!/usr/bin/env python3
"""
remove_timestamps.py - Remove timestamps from transcript text.
Reads input from file (argv[1]), writes cleaned output to file (argv[2]).
No file I/O in this script - pure transformation.
"""

import sys
import re
import os

def remove_timestamps(text):
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
        
        # Skip lines that contain only a timestamp (e.g., "0:13")
        if re.match(r'^\d+:\d+$', stripped):
            continue
        
        # Skip lines that contain only duration (e.g., "13 seconds", "1 minute, 1 second")
        if re.match(r'^\d+\s+seconds?$', stripped, re.IGNORECASE):
            continue
        if re.match(r'^\d+\s+minutes?,\s+\d+\s+seconds?$', stripped, re.IGNORECASE):
            continue
        
        # Remove timestamp prefix from beginning of line
        # Pattern: "0:13 5 seconds " or "0:13 " or "0:13"
        line = re.sub(r'^\d+:\d+\s+\d+\s+seconds?\s*', '', line)
        line = re.sub(r'^\d+:\d+\s+', '', line)
        line = re.sub(r'^\[\d+:\d+\]\s*', '', line)
        
        # Remove any remaining standalone timestamps within the line
        line = re.sub(r'\b\d+:\d+\b', '', line)
        
        cleaned_lines.append(line)
    
    # Join back
    result = '\n'.join(cleaned_lines)
    
    # Clean up multiple blank lines
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    return result.strip()

def main():
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
        output_text = remove_timestamps(input_text)
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