#!/usr/bin/env python3
"""Wrapper for faiss_query.py that ensures clean JSON output"""
import sys
import json
import subprocess
import os

# Add the parent directory to path
sys.path.insert(0, '/var/www/html/doomsteadRAG/assets/py')

# Run the actual query
cmd = [sys.executable, '/var/www/html/doomsteadRAG/assets/py/faiss_query.py'] + sys.argv[1:]

try:
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    
    # Find the JSON line in stdout
    output = result.stdout.strip()
    lines = output.split('\n')
    
    json_output = None
    for line in lines:
        line = line.strip()
        if line and (line[0] == '[' or line[0] == '{'):
            json_output = line
            break
    
    if json_output:
        # Validate it's valid JSON
        json.loads(json_output)
        print(json_output)
    else:
        print(json.dumps({'error': 'No JSON output from query'}))
        
except subprocess.TimeoutExpired:
    print(json.dumps({'error': 'Query timed out'}))
except Exception as e:
    print(json.dumps({'error': str(e)}))
