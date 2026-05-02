# assets/py/disfluencies.py
"""
Disfluency cleaning module for transcript processing.
Uses Ollama with Qwen2.5:0.5b specifically for disfluency removal.
Implements overlapping chunks for accurate removal and proper reassembly.
"""

import os
import re
import subprocess
import sys

OLLAMA_PATH = '/usr/local/bin/ollama'

def call_qwen_api(messages, max_tokens=1000, temperature=0.0):
    """
    Convert a list of messages into a prompt and call Ollama with Qwen2.5:0.5b.
    """
    prompt = ""
    for message in messages:
        role = message.get("role", "").lower()
        content = message.get("content", "")
        if role == "system":
            prompt += "System: " + content + "\n\n"
        elif role == "user":
            prompt += "User: " + content + "\n\n"
        elif role == "assistant":
            prompt += "Assistant: " + content + "\n\n"
        else:
            prompt += content + "\n\n"
    
    result = subprocess.run(
        [OLLAMA_PATH, "run", "qwen2.5:0.5b"],
        input=prompt,
        text=True,
        capture_output=True,
        timeout=180
    )
    if result.returncode != 0:
        raise Exception("Ollama run failed: " + result.stderr)
    output_text = result.stdout.strip()
    return {"choices": [{"message": {"content": output_text}}]}

def split_into_overlapping_chunks(text, chunk_size=1500, overlap=300):
    """
    Split text into overlapping chunks for accurate disfluency removal.
    Line breaks are removed first, then chunks are created with overlap.
    After processing, chunks are reassembled by removing overlap and stitching.
    
    Args:
        text: Input transcript text
        chunk_size: Maximum characters per chunk
        overlap: Number of characters to overlap between chunks
    
    Returns:
        List of overlapping chunk strings
    """
    # Remove all line breaks and collapse spaces
    continuous_text = ' '.join(text.splitlines())
    continuous_text = re.sub(r'\s+', ' ', continuous_text)
    
    chunks = []
    start = 0
    text_length = len(continuous_text)
    
    while start < text_length:
        end = min(start + chunk_size, text_length)
        
        # Try to find a good breaking point (sentence boundary)
        if end < text_length:
            # Look for sentence boundary within last 200 chars
            search_start = max(start + chunk_size - 200, start)
            search_text = continuous_text[search_start:end + 100]
            
            # Find sentence boundaries
            sentence_end = -1
            for boundary in ['. ', '! ', '? ', '.\n', '!\n', '?\n']:
                pos = search_text.rfind(boundary, 0, chunk_size - (search_start - start))
                if pos > sentence_end:
                    sentence_end = pos
            
            if sentence_end > 0:
                end = search_start + sentence_end + len(boundary) - 1
        
        chunks.append(continuous_text[start:end])
        start = end - overlap if (end - overlap > start and end < text_length) else end
    
    return chunks

def combine_overlapping_chunks(chunks, overlap=300):
    """
    Combine overlapping chunks by removing duplicate overlapping portions.
    
    Args:
        chunks: List of processed overlapping chunks
        overlap: Overlap size used during splitting
    
    Returns:
        Combined text without overlaps
    """
    if not chunks:
        return ""
    
    combined = chunks[0]
    
    for i in range(1, len(chunks)):
        current = chunks[i]
        
        # Find best overlap point to stitch
        if len(combined) > overlap:
            # Look at the end of combined and beginning of current
            overlap_region_end = combined[-overlap:] if len(combined) >= overlap else combined
            overlap_region_start = current[:overlap] if len(current) >= overlap else current
            
            # Find the longest common suffix/prefix match
            best_match_len = 0
            min_len = min(len(overlap_region_end), len(overlap_region_start))
            
            for match_len in range(min_len, int(min_len * 0.7), -1):
                if overlap_region_end[-match_len:] == overlap_region_start[:match_len]:
                    best_match_len = match_len
                    break
            
            if best_match_len > 0:
                combined = combined + current[best_match_len:]
            else:
                combined += " " + current
        else:
            combined += " " + current
    
    return combined

def process_chunk(chunk):
    """
    Process a single chunk with Qwen2.5:0.5b to remove disfluencies.
    Preserves sentence structure and meaning.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "Remove disfluencies from the transcript text. Remove filler words like 'uh', 'um', 'like', 'you know', "
                "'i mean', 'so', 'well', 'actually', 'basically', 'literally', 'kind of', 'sort of', 'you see', "
                "'the thing is', 'start over', 'go ahead'. Preserve the original meaning and sentence structure. "
                "Do not add extra spaces or punctuation. Return only the cleaned text."
            )
        },
        {"role": "user", "content": chunk}
    ]
    result = call_qwen_api(messages, max_tokens=2000, temperature=0.0)
    return result["choices"][0]["message"]["content"].strip()

def remove_disfluencies(transcript_text):
    """
    Split transcript text into overlapping chunks, process each with Ollama,
    then combine the cleaned chunks by removing overlap.
    
    Args:
        transcript_text: Raw transcript text with line breaks
    
    Returns:
        Cleaned transcript with natural line breaks restored
    """
    # First pass: split into overlapping chunks
    chunks = split_into_overlapping_chunks(transcript_text)
    print(f"Split transcript into {len(chunks)} overlapping chunks...", file=sys.stderr)
    
    # Process each chunk
    cleaned_chunks = []
    for i, chunk in enumerate(chunks):
        print(f"Processing chunk {i+1}/{len(chunks)}...", file=sys.stderr)
        try:
            cleaned = process_chunk(chunk)
            cleaned_chunks.append(cleaned)
        except Exception as e:
            print(f"Error processing chunk {i+1}: {e}, using original chunk", file=sys.stderr)
            cleaned_chunks.append(chunk)
    
    # Combine chunks by removing overlap
    combined_result = combine_overlapping_chunks(cleaned_chunks)
    
    # Restore natural line breaks at sentence boundaries
    combined_result = re.sub(r'([.!?])\s+', r'\1\n\n', combined_result)
    
    # Clean up any excessive whitespace
    combined_result = re.sub(r'\n{3,}', '\n\n', combined_result)
    combined_result = re.sub(r' +', ' ', combined_result)
    
    return combined_result.strip()

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
        
        if not input_text or len(input_text.strip()) == 0:
            print("Input file is empty", file=sys.stderr)
            sys.exit(1)
        
        result = remove_disfluencies(input_text)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result)
        
        print(f"Successfully cleaned transcript, output length: {len(result)}", file=sys.stderr)
        sys.exit(0)
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)