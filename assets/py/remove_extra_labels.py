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

def clean_labels(text, labels):
    # Pattern to match label at start of line (case-insensitive)
    label_pattern = re.compile(rf"^({'|'.join(map(re.escape, labels))})\s*", re.IGNORECASE)
    lines = text.splitlines()
    result = []
    
    # Track the last speaker seen
    last_speaker = None
    
    for line in lines:
        match = label_pattern.match(line)
        
        if match:
            current_speaker = match.group(1).lower()  # Normalize case
            label_text = match.group(0)  # Get the full matched label text
            
            if current_speaker == last_speaker:
                # Same speaker as last time → remove label and indent
                content = line[match.end():].lstrip()
                indent = ' ' * len(label_text)
                line = indent + content
            else:
                # Different speaker → keep label, update state
                last_speaker = current_speaker
                # Keep the line as is (with label)
        else:
            # No label on this line - it's a continuation of the current speaker
            # Indent it to match the label length (if we have a current speaker)
            if last_speaker is not None:
                # Calculate indentation based on the label for current speaker
                # We need to know how long the label would be
                for label in labels:
                    if last_speaker == label.lower().rstrip(':'):
                        # Add a space after the colon for consistency
                        indent = ' ' * (len(label) + 1)  # +1 for the space
                        line = indent + line
                        break
            # If no current speaker, leave the line as is
            
        result.append(line)
    
    return "\n".join(result)

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Input file not found: {INPUT_FILE}", file=sys.stderr)
        sys.exit(1)
    
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        input_text = f.read()
    
    if not input_text.strip():
        print("Input file is empty", file=sys.stderr)
        sys.exit(1)

    words = ['speaker:', 'interviewer:']
    output_text = clean_labels(input_text, words)
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(output_text)
    
    print(f"Saved to {OUTPUT_FILE}", file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()