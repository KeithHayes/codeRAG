#!/usr/bin/env python3
"""
ragdocs.py - Python backend for RAM compatibility RAG system
Handles vector search, document chunking, and Ollama integration
"""

import sys
import os
import json
import re
import yaml
import requests
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
RAGDOCS_DIR = PROJECT_ROOT / "assets/data/ragdocs"
INDEX_DIR = RAGDOCS_DIR / "vector_index"
CHUNKS_FILE = INDEX_DIR / "chunks.json"
METADATA_FILE = INDEX_DIR / "metadata.json"

def load_config(profile: str = "ragdocs") -> Dict:
    """Load configuration from YAML file."""
    yaml_file = PROJECT_ROOT / f"assets/yaml/{profile}.yaml"
    if not yaml_file.exists():
        raise FileNotFoundError(f"Config file not found: {yaml_file}")
    
    with open(yaml_file, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    return config.get('ramRAG', {})

def ensure_ollama_running() -> bool:
    """Check if Ollama service is running."""
    try:
        resp = requests.get('http://localhost:11434/api/tags', timeout=3)
        return resp.status_code == 200
    except:
        return False

def query_ollama(system_prompt: str, user_prompt: str, model: str) -> str:
    """Call Ollama API for response generation."""
    if not ensure_ollama_running():
        raise Exception("Ollama service is not running")
    
    url = "http://localhost:11434/api/chat"
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt}
        ],
        'stream': False,
        'options': {
            'temperature': 0.3,
            'num_predict': 4096
        }
    }
    
    try:
        response = requests.post(url, json=payload, timeout=180)
        if response.status_code != 200:
            raise Exception(f"Ollama returned status {response.status_code}")
        
        data = response.json()
        if not data.get('message') or not data['message'].get('content'):
            raise Exception("Empty response from Ollama")
        
        return data['message']['content'].strip()
    except requests.exceptions.RequestException as e:
        raise Exception(f"Request failed: {e}")

def simple_text_search(query: str, chunks: List[Dict]) -> List[Dict]:
    """Simple keyword-based search for RAM modules."""
    results = []
    query_lower = query.lower()
    query_terms = [t for t in re.findall(r'\b\w+\b', query_lower) if len(t) > 2]
    
    for idx, chunk in enumerate(chunks):
        chunk_lower = chunk['text'].lower()
        score = 0
        
        for term in query_terms:
            score += chunk_lower.count(term)
        
        if 'metadata' in chunk:
            speeds = chunk['metadata'].get('speeds', [])
            for speed in speeds:
                if str(speed) in query:
                    score += 10
            
            suppliers = chunk['metadata'].get('suppliers', [])
            for supplier in suppliers:
                if supplier.lower() in query_lower:
                    score += 8
        
        if score > 0:
            results.append({
                'index': idx,
                'score': score,
                'text': chunk['text'],
                'metadata': chunk.get('metadata', {})
            })
    
    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:5]

def build_context(results: List[Dict]) -> str:
    """Build context string from search results."""
    if not results:
        return "No relevant RAM modules found for your query.\n\n"
    
    context = "=== RAM COMPATIBILITY DATABASE ===\n\n"
    context += "Here are the most relevant RAM modules based on your query:\n\n"
    
    for i, result in enumerate(results, 1):
        context += f"[Match {i} - Score: {result['score']}]\n"
        context += result['text'] + "\n\n---\n\n"
    
    return context

def rebuild_index(profile: str, json_path: str) -> Dict:
    """Rebuild the FAISS index from RAM data."""
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"RAM data file not found: {json_path}")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        ram_data = json.load(f)
    
    config = load_config(profile)
    chunk_size = config.get('chunk_size', 10)
    chunk_overlap = config.get('chunk_overlap', 2)
    
    chunks = []
    i = 0
    
    while i < len(ram_data):
        chunk_modules = ram_data[i:i + chunk_size]
        chunk_text_parts = []
        
        for idx, module in enumerate(chunk_modules):
            desc = f"[Module {i + idx + 1}]\n"
            desc += f"{module.get('supplier', 'Unknown')} {module.get('capacity', '?')} DDR5 RAM at {module.get('speed_mhz', '?')}MHz. "
            desc += f"{module.get('rank', '?')} rank using {module.get('chip_brand', 'Unknown')} chips. "
            desc += f"Timings {module.get('timing', '?')} at {module.get('voltage_v', '?')}V. "
            desc += f"Supports XMP: {module.get('xmp', False)}, EXPO: {module.get('expo', False)}. "
            desc += f"Native speed: {module.get('native_speed_mhz', 'N/A')}MHz. "
            desc += f"Part number: {module.get('module_pn', 'Unknown')}"
            chunk_text_parts.append(desc)
        
        chunk_text = '\n\n---\n\n'.join(chunk_text_parts)
        
        chunks.append({
            'text': chunk_text,
            'metadata': {
                'start_index': i,
                'end_index': min(i + chunk_size, len(ram_data)),
                'module_count': len(chunk_modules),
                'speeds': [m.get('speed_mhz') for m in chunk_modules],
                'suppliers': list(set(m.get('supplier') for m in chunk_modules))
            }
        })
        
        i += chunk_size - chunk_overlap
        if i >= len(ram_data):
            break
    
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(CHUNKS_FILE, 'w', encoding='utf-8') as f:
        json.dump(chunks, f, indent=2)
    
    metadata = {
        'created': int(os.path.getmtime(CHUNKS_FILE)) if CHUNKS_FILE.exists() else None,
        'chunk_count': len(chunks),
        'profile': profile,
        'total_modules': len(ram_data),
        'chunk_size': chunk_size,
        'chunk_overlap': chunk_overlap
    }
    
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    
    return {'success': True, 'chunk_count': len(chunks), 'total_modules': len(ram_data)}

def query_index(profile: str, question: str) -> Dict:
    """Query the RAM index and generate response."""
    if not CHUNKS_FILE.exists():
        return {'success': False, 'error': 'No index found. Please rebuild the index first.', 'requires_rebuild': True}
    
    with open(CHUNKS_FILE, 'r', encoding='utf-8') as f:
        chunks = json.load(f)
    
    config = load_config(profile)
    search_results = simple_text_search(question, chunks)
    context = build_context(search_results)
    
    system_prompt = config.get('system_prompt', "You are a hardware compatibility specialist focusing on DDR5 RAM modules. Answer based on the provided compatibility database.")
    user_prompt_template = config.get('user_prompt_template', "Context:\n{context}\n\nQuestion:\n{question}\n\nAnswer:")
    model = config.get('ollama_model', 'qwen2.5:7b')
    
    user_prompt = user_prompt_template.replace('{context}', context).replace('{question}', question)
    
    try:
        response = query_ollama(system_prompt, user_prompt, model)
        return {
            'success': True,
            'response': response,
            'context_used': len(search_results),
            'model': model
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def main():
    parser = argparse.ArgumentParser(description='RAG Docs Backend')
    parser.add_argument('--action', required=True, choices=['build', 'query', 'status'])
    parser.add_argument('--profile', default='ragdocs')
    parser.add_argument('--json', help='Path to RAM JSON file for building')
    parser.add_argument('--question', help='Question for query')
    
    args = parser.parse_args()
    
    if args.action == 'build':
        if not args.json:
            print(json.dumps({'success': False, 'error': '--json parameter required for build'}))
            sys.exit(1)
        result = rebuild_index(args.profile, args.json)
        print(json.dumps(result))
    
    elif args.action == 'query':
        if not args.question:
            print(json.dumps({'success': False, 'error': '--question parameter required for query'}))
            sys.exit(1)
        result = query_index(args.profile, args.question)
        print(json.dumps(result))
    
    elif args.action == 'status':
        exists = CHUNKS_FILE.exists()
        metadata = {}
        if exists:
            with open(METADATA_FILE, 'r') as f:
                metadata = json.load(f)
        print(json.dumps({'success': True, 'exists': exists, 'metadata': metadata}))

if __name__ == "__main__":
    main()