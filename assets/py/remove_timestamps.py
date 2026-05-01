# assets/py/removetimestamps.py
import re
import sys
import os

def remove_timestamps(input_text):
    """
    Remove timestamp lines from transcript.
    Matches patterns like:
      - 0:13
      - 13 seconds
      - 1 minute, 1 second
      - 2 minutes, 2 seconds
      - 5 minutes, 35 seconds
      - etc.
    """
    lines = input_text.splitlines()
    cleaned_lines = []
    
    patterns = [
        r'^\d+:\d+$',                     # mm:ss
        r'^\d+\s+seconds$',               # N seconds
        r'^\d+\s+minute,\s+\d+\s+second$', # 1 minute, 1 second
        r'^\d+\s+minutes,\s+\d+\s+seconds$', # 2 minutes, 2 seconds
        r'^\d+\s+minute,\s+\d+\s+seconds$',  # 1 minute, 2 seconds
        r'^\d+\s+minutes,\s+\d+\s+second$',  # 2 minutes, 1 second
        r'^\d+\s+minute\s+\d+\s+second$',    # without comma
        r'^\d+\s+minutes\s+\d+\s+seconds$',
    ]
    
    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            cleaned_lines.append(line)
            continue
        
        is_timestamp = False
        for pat in patterns:
            if re.match(pat, line_stripped):
                is_timestamp = True
                break
        
        if not is_timestamp:
            cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines)

def main():
    # Resolve paths relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)  # go up from py/ to assets/
    # Now go to data/transcripts/
    data_dir = os.path.join(base_dir, 'data', 'transcripts')
    
    input_path = os.path.join(data_dir, 'rawtranscript.txt')
    output_path = os.path.join(data_dir, 'sanstimestamps.txt')
    
    if not os.path.exists(input_path):
        print("ERROR: rawtranscript.txt not found at " + input_path, file=sys.stderr)
        sys.exit(1)
    
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            raw = f.read()
    except Exception as e:
        print(f"ERROR reading input file: {e}", file=sys.stderr)
        sys.exit(1)
    
    cleaned = remove_timestamps(raw)
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(cleaned)
    except Exception as e:
        print(f"ERROR writing output file: {e}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Successfully wrote {len(cleaned)} characters to {output_path}")

if __name__ == '__main__':
    main()