# assets/py/segment_transcript.py
"""
Speaker segmentation module for transcript processing.
Uses Ollama with mistral model to label each sentence as Interviewer: or Speaker:
Chunking respects sentence boundaries with overlap to maintain speaker identity.
"""

import re
import sys
import os
import requests
import json
import time
import signal

SELECTED_MODEL = 'mistral:7b-instruct-v0.3-q4_0'
MAX_CHUNK_SIZE = 2000
OVERLAP_SENTENCES = 3

def timeout_handler(signum, frame):
    raise Exception("Function timed out")

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

def call_ollama_for_segmentation(system_prompt, user_prompt, temperature=0.0, max_tokens=4096, timeout=90):
    """Call Ollama API for speaker segmentation with timeout."""
    ollama_url = 'http://localhost:11434/api/chat'
    
    payload = {
        'model': SELECTED_MODEL,
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
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(timeout)
        
        response = requests.post(ollama_url, json=payload, timeout=timeout)
        
        signal.alarm(0)
        
    except requests.exceptions.Timeout:
        raise Exception(f"Request timed out after {timeout} seconds")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Request failed: {e}")
    
    if response.status_code != 200:
        raise Exception(f"Ollama returned status {response.status_code}")
    
    try:
        data = response.json()
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse JSON: {e}")
    
    if not data.get('message') or not data['message'].get('content'):
        raise Exception("Empty response from Ollama")
    
    return data['message']['content'].strip()

def extract_sentences(text):
    """Extract sentences from text using punctuation boundaries."""
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    return sentences

def chunk_with_overlap(text, max_chunk_size=MAX_CHUNK_SIZE, overlap_sentences=OVERLAP_SENTENCES):
    """Split text into chunks that respect sentence boundaries with overlap."""
    sentences = extract_sentences(text)
    
    if not sentences:
        return []
    
    chunks = []
    chunk_sentences = []
    chunk_size = 0
    overlap_buffer = []
    
    for i, sentence in enumerate(sentences):
        sentence_len = len(sentence)
        estimated_chunk_size = chunk_size + sentence_len + 2
        
        if estimated_chunk_size > max_chunk_size and chunk_sentences:
            chunks.append({
                'sentences': chunk_sentences.copy(),
                'text': ' '.join(chunk_sentences),
                'has_overlap': len(overlap_buffer) > 0,
                'overlap_count': len(overlap_buffer)
            })
            
            overlap_buffer = chunk_sentences[-overlap_sentences:] if len(chunk_sentences) >= overlap_sentences else chunk_sentences.copy()
            
            chunk_sentences = overlap_buffer.copy()
            chunk_size = sum(len(s) for s in chunk_sentences) + (len(chunk_sentences) - 1) * 2 if chunk_sentences else 0
            
            chunk_sentences.append(sentence)
            chunk_size += sentence_len + 2 if len(chunk_sentences) > 1 else sentence_len
        else:
            chunk_sentences.append(sentence)
            chunk_size += sentence_len + 2 if len(chunk_sentences) > 1 else sentence_len
    
    if chunk_sentences:
        chunks.append({
            'sentences': chunk_sentences.copy(),
            'text': ' '.join(chunk_sentences),
            'has_overlap': len(chunks) > 0 and len(chunks[-1]['sentences']) > 0,
            'overlap_count': len(overlap_buffer) if len(chunks) > 0 else 0
        })
    
    return chunks

def strip_overlap_from_output(output_text, chunk_info):
    """Remove overlap sentences from the beginning of the output."""
    if not chunk_info.get('has_overlap', False):
        return output_text
    
    lines = output_text.strip().split('\n')
    
    if len(lines) <= chunk_info.get('overlap_count', OVERLAP_SENTENCES):
        return output_text
    
    overlap_removed = lines[chunk_info.get('overlap_count', OVERLAP_SENTENCES):]
    
    if not overlap_removed:
        return output_text
    
    return '\n'.join(overlap_removed)

def clean_segmentation_output(output_text):
    """Clean and normalize segmentation output."""
    lines = output_text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if not (line.startswith('Interviewer:') or line.startswith('Speaker:')):
            if '?' in line or any(word in line.lower() for word in ['what', 'how', 'why', 'when', 'where', 'could', 'would', 'can', 'please tell']):
                line = 'Interviewer: ' + line
            else:
                line = 'Speaker: ' + line
        
        cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines)

def update_status(completed=False, error=None):
    """Update the segmentation status file."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    transcript_dir = os.path.dirname(script_dir) + '/data/transcripts'
    status_file = transcript_dir + '/segmentation_status.json'
    
    status = {
        'running': not completed,
        'completed': completed,
        'end_time': time.time() if completed else None,
        'error': error
    }
    
    try:
        with open(status_file, 'w') as f:
            json.dump(status, f)
    except:
        pass
    
    if completed and not error:
        pid_file = transcript_dir + '/segmentation.pid'
        if os.path.exists(pid_file):
            try:
                os.unlink(pid_file)
            except:
                pass

def segment_transcript(transcript_text):
    """Perform speaker segmentation on transcript text using Ollama."""
    if not transcript_text or not transcript_text.strip():
        raise ValueError("Input text is empty")
    
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"STARTING SPEAKER DIARIZATION", file=sys.stderr)
    print(f"Model: {SELECTED_MODEL}", file=sys.stderr)
    print(f"Input size: {len(transcript_text)} characters", file=sys.stderr)
    print(f"Overlap: {OVERLAP_SENTENCES} sentences", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)
    
    if not ensure_ollama_running():
        raise Exception("Ollama service is not running")
    
    chunks = chunk_with_overlap(transcript_text)
    print(f"Split into {len(chunks)} chunks with {OVERLAP_SENTENCES}-sentence overlap", file=sys.stderr)
    
    system_prompt = """You are an expert conversation analyst. Perform speaker segmentation on the transcript. The conversation is between exactly two people: "Interviewer" (asks questions) and "Speaker" (provides answers).

RULES:
- Label each sentence with either "Interviewer:" or "Speaker:"
- Interviewer typically asks questions
- Speaker provides answers and explanations
- Maintain consistent speaker identity across the entire transcript
- Output ONLY the labeled text, no extra words
- Preserve all original text exactly as given
- Put each labeled sentence on a new line"""
    
    labeled_chunks = []
    total_start = time.time()
    
    for i, chunk_info in enumerate(chunks):
        chunk_text = chunk_info['text']
        is_first_chunk = (i == 0)
        
        print(f"[{i+1}/{len(chunks)}] Processing {len(chunk_text)} chars...", file=sys.stderr)
        if chunk_info['has_overlap'] and not is_first_chunk:
            print(f"  Includes {OVERLAP_SENTENCES} overlap sentences for context", file=sys.stderr)
        
        context_note = ""
        if chunk_info['has_overlap'] and not is_first_chunk:
            context_note = "\n\nNOTE: The first few sentences in this chunk repeat from the previous chunk for context. Maintain consistent speaker labeling with the previous labeling."
        
        user_prompt = f"Label each sentence with Interviewer: or Speaker:. Output only the labeled text:{context_note}\n\n{chunk_text}"
        
        start_time = time.time()
        
        result = None
        for attempt in range(2):
            try:
                result = call_ollama_for_segmentation(system_prompt, user_prompt, timeout=90)
                if result and len(result) > 10:
                    break
            except Exception as e:
                print(f"  Attempt {attempt + 1} failed: {str(e)[:100]}", file=sys.stderr)
                if attempt < 1:
                    time.sleep(2)
        
        if not result:
            print(f"  WARNING: Chunk {i+1} failed, using fallback heuristic", file=sys.stderr)
            sentences = extract_sentences(chunk_text)
            fallback_lines = []
            for sentence in sentences:
                if '?' in sentence or any(word in sentence.lower() for word in ['what', 'how', 'why', 'when', 'where', 'could', 'would', 'can', 'please tell']):
                    fallback_lines.append('Interviewer: ' + sentence)
                else:
                    fallback_lines.append('Speaker: ' + sentence)
            result = '\n'.join(fallback_lines)
        
        if not is_first_chunk and chunk_info['has_overlap']:
            try:
                result = strip_overlap_from_output(result, chunk_info)
            except Exception as e:
                print(f"  WARNING: Could not strip overlap: {e}", file=sys.stderr)
        
        elapsed = time.time() - start_time
        print(f"  Completed in {elapsed:.1f}s", file=sys.stderr)
        labeled_chunks.append(result)
    
    total_elapsed = time.time() - total_start
    
    print(f"\nMerging {len(labeled_chunks)} chunks...", file=sys.stderr)
    result = '\n\n'.join(labeled_chunks)
    result = clean_segmentation_output(result)
    
    print(f"Total time: {total_elapsed:.1f}s", file=sys.stderr)
    print(f"Output size: {len(result)} characters", file=sys.stderr)
    print(f"{'='*60}\n", file=sys.stderr)
    
    return result

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input_file> <output_file>", file=sys.stderr)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"Input file not found: {input_file}", file=sys.stderr)
        sys.exit(1)
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            input_text = f.read()
        
        if not input_text or not input_text.strip():
            print("Input file is empty", file=sys.stderr)
            update_status(completed=True, error="Input file is empty")
            sys.exit(1)
        
        result = segment_transcript(input_text)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result)
        
        print(f"Success! Output length: {len(result)}", file=sys.stderr)
        update_status(completed=True, error=None)
        sys.exit(0)
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error: {error_msg}", file=sys.stderr)
        update_status(completed=True, error=error_msg)
        sys.exit(1)