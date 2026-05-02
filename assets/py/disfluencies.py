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

def eliminate_line_breaks(text):
    """
    Eliminate all line breaks from the input text to create a single 
    continuous string for proper chunk processing.
    
    Args:
        text: Input text with line breaks
    
    Returns:
        Single continuous string without line breaks
    """
    # Replace all newlines and carriage returns with spaces
    text = text.replace('\r\n', ' ').replace('\n', ' ').replace('\r', ' ')
    # Collapse multiple spaces into single space
    text = re.sub(r'\s+', ' ', text)
    # Remove space before punctuation
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)
    return text.strip()

def split_into_overlapping_chunks(text, chunk_size=2000, overlap=500):
    """
    Split text into overlapping chunks for accurate disfluency removal.
    Preserves sentence boundaries when possible.
    
    Args:
        text: Input transcript text (line breaks already eliminated)
        chunk_size: Maximum characters per chunk
        overlap: Number of characters to overlap between chunks
    
    Returns:
        List of overlapping chunk strings with overlap metadata
    """
    chunks = []
    chunk_boundaries = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = min(start + chunk_size, text_length)
        
        # Try to find a sentence boundary near the end of the chunk
        if end < text_length:
            # Look for sentence endings within the overlap region
            search_end = end
            search_start = max(end - overlap, start)
            boundary_pos = -1
            
            # Find the last sentence boundary in the overlap region
            for i in range(search_end - 1, search_start - 1, -1):
                if text[i] in '.!?' and i + 1 < text_length and text[i + 1] in ' ':
                    boundary_pos = i + 2  # Include the sentence ending and space
                    break
            
            if boundary_pos > start and boundary_pos <= end:
                end = boundary_pos
        
        chunk = text[start:end]
        chunks.append(chunk)
        chunk_boundaries.append((start, end))
        
        # Next chunk starts with overlap from the previous chunk end
        if end < text_length:
            # Start new chunk at overlap distance back from current end
            new_start = max(end - overlap, start + 1)
            if new_start <= start:
                new_start = start + 1  # Ensure forward progress
            start = new_start
        else:
            start = end
    
    return chunks, chunk_boundaries

def create_overlap_reference(chunk, overlap_size=500):
    """
    Extract reference text from the end of a chunk for overlap matching.
    Returns the last `overlap_size` characters as reference.
    
    Args:
        chunk: Processed chunk text
        overlap_size: Number of characters to use as overlap reference
    
    Returns:
        Reference text string
    """
    if len(chunk) <= overlap_size:
        return chunk
    return chunk[-overlap_size:]

def find_overlap_position(reference, next_chunk, min_match=20):
    """
    Find the position in next_chunk where the reference text matches.
    Uses longest common substring approach to find the best match.
    
    Args:
        reference: Reference text from end of previous chunk
        next_chunk: Next chunk text to search for overlap
        min_match: Minimum number of matching characters required
    
    Returns:
        Position in next_chunk where overlap ends, or -1 if not found
    """
    # Try progressively shorter reference strings to find match
    for ref_len in range(len(reference), min_match - 1, -1):
        ref_substring = reference[-ref_len:]
        pos = next_chunk.find(ref_substring)
        if pos != -1:
            return pos + len(ref_substring)
    
    # If no match found, try word-level matching
    ref_words = reference.split()
    next_words = next_chunk.split()
    
    # Try to find a sequence of matching words at the start of next_chunk
    for word_count in range(min(len(ref_words), 20), 2, -1):
        ref_phrase = ' '.join(ref_words[-word_count:])
        pos = next_chunk.find(ref_phrase)
        if pos != -1:
            return pos + len(ref_phrase)
    
    return -1

def combine_overlapping_chunks(chunks, overlap_size=500):
    """
    Combine overlapping chunks by finding and removing duplicate content.
    Uses reference text matching to find overlap boundaries.
    
    Args:
        chunks: List of processed overlapping chunks
        overlap_size: Overlap size used during splitting
    
    Returns:
        Combined text without overlaps
    """
    if not chunks:
        return ""
    
    combined = chunks[0]
    
    for i in range(1, len(chunks)):
        current = chunks[i]
        
        # Skip empty chunks
        if not current.strip():
            continue
        
        # Get reference from the end of combined text
        reference = create_overlap_reference(combined, overlap_size)
        
        # Find where the overlap ends in the current chunk
        overlap_end = find_overlap_position(reference, current)
        
        if overlap_end > 0:
            # Append only the new part after the overlap
            new_content = current[overlap_end:].lstrip()
            if new_content:
                # Add space between if needed
                if combined and not combined[-1].isspace() and new_content and not new_content[0].isspace():
                    combined += " "
                combined += new_content
        else:
            # No overlap found, append entire chunk with a space separator
            if combined and not combined[-1].isspace():
                combined += " "
            combined += current
    
    return combined

def process_chunk(chunk):
    """
    Process a single chunk with Qwen2.5:0.5b to remove disfluencies.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are a transcript cleaner. Remove disfluencies from the transcript text. "
                "Remove filler words like 'uh', 'um', 'like', 'you know', 'i mean', 'so', 'well', "
                "'actually', 'basically', 'literally', 'kind of', 'sort of', 'you see', "
                "'the thing is', 'start over', 'go ahead', 'wait', 'let me see'. "
                "Also remove repeated words (e.g., 'the the', 'and and'). "
                "Preserve the original meaning, punctuation, and sentence structure. "
                "Return only the cleaned text without any explanations."
            )
        },
        {"role": "user", "content": chunk}
    ]
    result = call_qwen_api(messages, max_tokens=2000, temperature=0.0)
    return result["choices"][0]["message"]["content"].strip()

def post_process_cleaned_text(text):
    """
    Apply additional regex cleaning to catch disfluencies the LLM might have missed.
    """
    # Remove standalone filler words
    fillers = [
        r'\buh\b', r'\bum\b', r'\ber\b', r'\bah\b', r'\boh\b',
        r'\blike\b', r'\byou know\b', r'\bi mean\b', r'\bso\b',
        r'\bwell\b', r'\bactually\b', r'\bbasically\b', r'\bliterally\b',
        r'\bkind of\b', r'\bsort of\b', r'\byou see\b', r'\bthe thing is\b'
    ]
    
    for filler in fillers:
        text = re.sub(filler, '', text, flags=re.IGNORECASE)
    
    # Remove repeated words
    text = re.sub(r'\b(\w+)\s+\1\b', r'\1', text, flags=re.IGNORECASE)
    
    # Clean up extra spaces
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)
    
    # Restore proper spacing after punctuation
    text = re.sub(r'([.!?])\s*', r'\1 ', text)
    text = re.sub(r'\s+$', '', text)
    
    return text.strip()

def remove_disfluencies(transcript_text):
    """
    Eliminate line breaks, split into overlapping chunks, process each with Ollama,
    then combine the cleaned chunks by removing overlaps correctly.
    
    Args:
        transcript_text: Raw transcript text (sanstimestamps.txt content)
    
    Returns:
        Cleaned transcript with disfluencies removed
    """
    if not transcript_text or len(transcript_text.strip()) == 0:
        return ""
    
    print(f"Original text length: {len(transcript_text)}", file=sys.stderr)
    
    # Step 1: Eliminate all line breaks to create one continuous string
    flat_text = eliminate_line_breaks(transcript_text)
    print(f"Flattened text length: {len(flat_text)}", file=sys.stderr)
    
    # Step 2: Split into overlapping chunks
    chunks, boundaries = split_into_overlapping_chunks(flat_text)
    print(f"Split into {len(chunks)} overlapping chunks", file=sys.stderr)
    
    # Step 3: Process each chunk
    cleaned_chunks = []
    for i, chunk in enumerate(chunks):
        print(f"Processing chunk {i+1}/{len(chunks)} (length: {len(chunk)})...", file=sys.stderr)
        try:
            cleaned = process_chunk(chunk)
            cleaned_chunks.append(cleaned)
        except Exception as e:
            print(f"Error processing chunk {i+1}: {e}, using original chunk", file=sys.stderr)
            cleaned_chunks.append(chunk)
    
    # Step 4: Combine chunks by accurately removing overlaps
    combined_result = combine_overlapping_chunks(cleaned_chunks)
    print(f"Combined result length: {len(combined_result)}", file=sys.stderr)
    
    # Step 5: Apply post-processing regex cleaning
    final_result = post_process_cleaned_text(combined_result)
    print(f"Final cleaned length: {len(final_result)}", file=sys.stderr)
    
    # Step 6: Restore line breaks at sentence boundaries for readability
    final_result = re.sub(r'([.!?])\s+', r'\1\n\n', final_result)
    final_result = re.sub(r'\n{3,}', '\n\n', final_result)
    
    return final_result

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