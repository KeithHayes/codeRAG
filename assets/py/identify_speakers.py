#!/usr/bin/env python3
"""
identify_speakers.py - Use LLM to identify interviewer and speaker names, then replace placeholders.
Reads from sansextrasegments.txt, writes to identified_speakers.txt
Handles chunking for arbitrarily long transcripts.
"""

import sys
import os
import re
import json
import requests
import time

INPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/sansextrasegments.txt'
OUTPUT_FILE = '/var/www/html/doomsteadRAG/assets/data/transcripts/identified_speakers.txt'

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "deepseek-r1:7b"
SYSTEM_PROMPT = """You are a transcript analysis assistant. Analyze the conversation and identify:
1. Who is the INTERVIEWER (the person asking questions)
2. Who is the SPEAKER (the person answering questions, providing information)

Look for patterns like:
- Questions come from interviewer
- Answers and explanations come from speaker
- Formal introductions like "I'm [name]" or "My name is [name]"
- References like "as I mentioned earlier" or "like I said"

Output ONLY valid JSON in this exact format:
{
    "interviewer_name": "Actual name found or 'Interviewer' if unknown",
    "speaker_name": "Actual name found or 'Speaker' if unknown"
}

No markdown, no code blocks, no explanation, only the JSON object."""

TEMPERATURE = 0.1
MAX_TOKENS = 500
CHUNK_SIZE = 8000

def chunk_text(text, chunk_size=CHUNK_SIZE):
    """Split text into chunks for sampling."""
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
    """Ensure Ollama service is running."""
    for attempt in range(3):
        try:
            resp = requests.get('http://localhost:11434/api/tags', timeout=3)
            if resp.status_code == 200:
                return True
        except:
            pass
        time.sleep(2)
    
    print("Ollama service is not running", file=sys.stderr)
    return False

def call_ollama_for_identification(text, attempt=1):
    """Call Ollama API to identify speakers."""
    payload = {
        'model': MODEL_NAME,
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': f"Analyze this transcript excerpt and identify the interviewer and speaker:\n\n{text[:6000]}"}
        ],
        'stream': False,
        'options': {
            'temperature': TEMPERATURE,
            'num_predict': MAX_TOKENS
        }
    }
    
    try:
        # Use longer timeout for first attempt to allow model loading
        timeout = 120 if attempt == 1 else 60
        response = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        
        if response.status_code != 200:
            print(f"Ollama returned {response.status_code}", file=sys.stderr)
            return None
        
        data = response.json()
        if data.get('message') and data['message'].get('content'):
            content = data['message']['content'].strip()
            
            # Extract JSON from response (in case model adds markdown)
            json_match = re.search(r'\{[^{}]*"interviewer_name"[^{}]*"speaker_name"[^{}]*\}', content, re.DOTALL)
            if json_match:
                content = json_match.group(0)
            
            return content
        return None
    except requests.exceptions.Timeout:
        if attempt == 1:
            print("First request timed out - model may be loading. Will retry...", file=sys.stderr)
        else:
            print(f"Ollama timeout (attempt {attempt})", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Ollama error (attempt {attempt}): {e}", file=sys.stderr)
        return None

def parse_llm_response(response_text):
    """Parse LLM response to extract interviewer and speaker names."""
    try:
        data = json.loads(response_text)
        interviewer = data.get('interviewer_name', 'Interviewer')
        speaker = data.get('speaker_name', 'Speaker')
        
        # Clean up names - remove extra quotes, whitespace
        interviewer = interviewer.strip().strip('"').strip("'")
        speaker = speaker.strip().strip('"').strip("'")
        
        # Use defaults if empty
        if not interviewer:
            interviewer = 'Interviewer'
        if not speaker:
            speaker = 'Speaker'
        
        return interviewer, speaker
    except json.JSONDecodeError:
        print(f"Failed to parse JSON: {response_text[:200]}", file=sys.stderr)
        return 'Interviewer', 'Speaker'

def replace_speaker_labels(text, interviewer_name, speaker_name):
    """
    Replace 'Interviewer:' and 'Speaker:' placeholders with actual names.
    Also handles variations in capitalization and spacing.
    """
    # Replace interviewer label (case insensitive, with optional colon)
    text = re.sub(r'(?i)^interviewer\s*:\s*', f'{interviewer_name}: ', text, flags=re.MULTILINE)
    text = re.sub(r'(?i)\ninterviewer\s*:\s*', f'\n{interviewer_name}: ', text, flags=re.MULTILINE)
    
    # Replace speaker label (case insensitive, with optional colon)
    text = re.sub(r'(?i)^speaker\s*:\s*', f'{speaker_name}: ', text, flags=re.MULTILINE)
    text = re.sub(r'(?i)\nspeaker\s*:\s*', f'\n{speaker_name}: ', text, flags=re.MULTILINE)
    
    # Also handle the case where there's no space before colon
    text = re.sub(r'(?i)^interviewer\s*:', f'{interviewer_name}:', text, flags=re.MULTILINE)
    text = re.sub(r'(?i)\ninterviewer\s*:', f'\n{interviewer_name}:', text, flags=re.MULTILINE)
    text = re.sub(r'(?i)^speaker\s*:', f'{speaker_name}:', text, flags=re.MULTILINE)
    text = re.sub(r'(?i)\nspeaker\s*:', f'\n{speaker_name}:', text, flags=re.MULTILINE)
    
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
    
    if not ensure_ollama_running():
        sys.exit(1)
    
    print(f"Analyzing transcript to identify speakers...", file=sys.stderr)
    print(f"Input size: {len(input_text)} characters", file=sys.stderr)
    
    # Get first chunk and last chunk for context (beginning and end of conversation)
    chunks = chunk_text(input_text)
    sample_text = chunks[0] if chunks else input_text
    if len(chunks) > 1:
        sample_text = sample_text + "\n\n... (middle omitted) ...\n\n" + chunks[-1]
    
    # Call LLM to identify speakers
    llm_response = None
    for attempt in range(3):
        llm_response = call_ollama_for_identification(sample_text, attempt + 1)
        if llm_response:
            break
        time.sleep(3)
    
    if not llm_response:
        print("Failed to get response from Ollama after 3 attempts, using defaults", file=sys.stderr)
        interviewer_name = 'Interviewer'
        speaker_name = 'Speaker'
    else:
        interviewer_name, speaker_name = parse_llm_response(llm_response)
        print(f"Identified - Interviewer: {interviewer_name}, Speaker: {speaker_name}", file=sys.stderr)
    
    # Replace placeholders in the full text
    output_text = replace_speaker_labels(input_text, interviewer_name, speaker_name)
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(output_text)
    
    print(f"Saved to {OUTPUT_FILE}, length: {len(output_text)}", file=sys.stderr)
    sys.exit(0)

if __name__ == "__main__":
    main()