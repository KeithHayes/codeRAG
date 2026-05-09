#!/usr/bin/env python3
"""
disfluencies.py - Remove disfluencies from transcript text.
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
    
    if 'clean_disfluencies' not in config:
        raise KeyError("'clean_disfluencies' section not found in config file")
    
    return config['clean_disfluencies']

def remove_filler_words(text, filler_words):
    """
    Remove common filler words and phrases from text.
    Handles words surrounded by spaces, punctuation, or at boundaries.
    """
    cleaned = text
    for filler in filler_words:
        # Create pattern that matches the filler as a whole word/phrase
        # Match case-insensitive, with optional surrounding punctuation
        pattern = r'\b' + re.escape(filler) + r'\b'
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    # Clean up any double punctuation that might result (e.g., ", ," -> ",")
    cleaned = re.sub(r'([,!?;:])\s*\1', r'\1', cleaned)
    # Clean up multiple spaces
    cleaned = re.sub(r'\s+', ' ', cleaned)
    # Clean up spaces before punctuation
    cleaned = re.sub(r'\s+([.,!?;:])', r'\1', cleaned)
    # Clean up leading/trailing spaces
    cleaned = cleaned.strip()
    return cleaned

def fix_partial_word_corrections(text):
    """
    Fix partial word self-corrections like 'comm commede' -> 'comrade'.
    Looks for word pairs where the first is a prefix of the second.
    """
    words = text.split()
    if len(words) < 2:
        return text
    
    fixed_words = []
    i = 0
    while i < len(words):
        word = words[i]
        
        # Look at next word if available
        if i + 1 < len(words):
            next_word = words[i + 1]
            
            # Skip empty strings
            if not word or not next_word:
                fixed_words.append(word)
                i += 1
                continue
            
            # Check if current word is a prefix of next word (self-correction)
            # e.g., "comm" -> "commede", "reas" -> "reason", "tra" -> "trajectory"
            word_lower = word.lower().rstrip('.,!?;:')
            next_lower = next_word.lower().rstrip('.,!?;:')
            
            if (len(word_lower) >= 2 and 
                len(next_lower) > len(word_lower) and 
                next_lower.startswith(word_lower) and
                len(word_lower) / len(next_lower) < 0.9):  # word is significantly shorter
                # This looks like a partial word correction
                # Keep the longer (corrected) version
                fixed_words.append(next_word)
                i += 2
                continue
            
            # Check for cases where first word is "broken off" mid-word
            # e.g., "comm-" "commede" (hyphenated), or "ove" "overall"
            if (word_lower.endswith('-') and 
                next_lower.startswith(word_lower.rstrip('-'))):
                fixed_words.append(next_word)
                i += 2
                continue
        
        fixed_words.append(word)
        i += 1
    
    return ' '.join(fixed_words)

def remove_word_stutters(text):
    """
    Remove word stutters like 'the the', 'I I', 'and and', etc.
    Also handles multi-word stutters like 'in the in the'.
    """
    # Single word repetitions
    cleaned = re.sub(r'\b(\w+)\s+\1\b', r'\1', text, flags=re.IGNORECASE)
    # Run multiple times to catch chains like "the the the"
    for _ in range(3):
        cleaned = re.sub(r'\b(\w+)\s+\1\b', r'\1', cleaned, flags=re.IGNORECASE)
    return cleaned

def remove_short_fragments(text):
    """
    Remove isolated 1-2 character fragments that often remain from
    UI elements, garbled text, or processing artifacts, but preserve
    legitimate short words like 'I', 'a'.
    """
    # List of legitimate single-letter words to keep
    keep_single = {'i', 'a'}
    
    words = text.split()
    cleaned_words = []
    for word in words:
        stripped = word.strip('.,!?;:\'"()[]')
        if len(stripped) <= 1 and stripped.lower() not in keep_single:
            # This is likely an artifact, skip it
            continue
        cleaned_words.append(word)
    
    return ' '.join(cleaned_words)

def clean_line(line, filler_words):
    """
    Apply all cleaning steps to a single line of text.
    """
    if not line or not line.strip():
        return ''
    
    # Step 1: Remove filler words
    cleaned = remove_filler_words(line, filler_words)
    
    # Step 2: Fix partial word corrections
    cleaned = fix_partial_word_corrections(cleaned)
    
    # Step 3: Remove word stutters
    cleaned = remove_word_stutters(cleaned)
    
    # Step 4: Remove short fragment artifacts
    cleaned = remove_short_fragments(cleaned)
    
    # Step 5: Final cleanup
    # Remove multiple spaces
    cleaned = re.sub(r'\s+', ' ', cleaned)
    # Fix spacing around punctuation
    cleaned = re.sub(r'\s+([.,!?;:])', r'\1', cleaned)
    cleaned = re.sub(r'([.,!?;:])(?!\s)', r'\1 ', cleaned)
    # Remove space at start/end
    cleaned = cleaned.strip()
    
    return cleaned

def remove_disfluencies(transcript_text, filler_words):
    """
    Process transcript text line by line to remove disfluencies.
    
    Args:
        transcript_text: Raw transcript text (sanstimestamps.txt content)
        filler_words: List of filler words to remove
    
    Returns:
        Cleaned transcript with disfluencies removed
    """
    if not transcript_text or not transcript_text.strip():
        return ""
    
    lines = transcript_text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            # Preserve blank lines for paragraph separation
            cleaned_lines.append('')
            continue
        
        cleaned = clean_line(stripped, filler_words)
        if cleaned:
            cleaned_lines.append(cleaned)
    
    # Join lines back, preserving paragraph breaks
    result = '\n'.join(cleaned_lines)
    
    # Final pass: eliminate empty lines at start/end
    result = result.strip()
    
    # Normalize line breaks: maximum one blank line between paragraphs
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    return result

def main():
    config = load_config()
    filler_words = config.get('filler_words', [])
    
    if not filler_words:
        raise ValueError("No filler_words found in clean_disfluencies config")
    
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
        output_text = remove_disfluencies(input_text, filler_words)
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
    print(f"Success: {len(output_text)} characters, {len(output_text.splitlines())} lines", file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()