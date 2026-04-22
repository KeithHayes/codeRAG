#!/usr/bin/env python3
"""FAISS Vector Search for Doomstead RAG"""

import os
import sys
import json
import yaml
import argparse
import warnings
from pathlib import Path
from typing import List, Dict, Any

warnings.filterwarnings("ignore")

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
DATA_DIR = PROJECT_ROOT / "assets/data"

class FAISSearcher:
    def __init__(self, profile: str):
        self.profile = profile
        self.config = self._load_config()
        self.faiss_dir = DATA_DIR / profile / "faiss_index"
        self.embeddings = self._init_embeddings()
        self.vectorstore = self._load_vectorstore()
    
    def _load_config(self) -> Dict:
        config_path = PROJECT_ROOT / "assets" / "py" / f"{self.profile}.yaml"
        if not config_path.exists():
            return {}
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        return config.get('doomsteadRAG', {})
    
    def _init_embeddings(self) -> HuggingFaceEmbeddings:
        model_name = self.config.get('embedding_model', 'sentence-transformers/all-mpnet-base-v2')
        return HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
    
    def _load_vectorstore(self) -> FAISS:
        if not self.faiss_dir.exists():
            raise FileNotFoundError(f"FAISS index not found for profile {self.profile}")
        return FAISS.load_local(str(self.faiss_dir), self.embeddings, allow_dangerous_deserialization=True)
    
    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        try:
            # Get more results initially
            docs_with_scores = self.vectorstore.similarity_search_with_relevance_scores(query, k=k*3)
            
            results = []
            seen_sources = set()
            
            # Lower the threshold to accept negative scores too
            for doc, score in docs_with_scores:
                source = doc.metadata.get('source', 'unknown')
                
                # Skip duplicates
                if source in seen_sources:
                    continue
                seen_sources.add(source)
                
                # Convert score to a positive relevance (FAISS returns cosine distance, lower is better)
                # Convert distance to similarity: similarity = 1 - distance
                similarity = 1 - abs(score)
                
                results.append({
                    'content': doc.page_content,
                    'metadata': {
                        'source': source,
                        'chunk': doc.metadata.get('chunk', 0),
                        'file_type': doc.metadata.get('file_type', 'unknown')
                    },
                    'score': float(similarity)  # Now 0-1 range where higher is better
                })
            
            # Sort by score (higher is better)
            results.sort(key=lambda x: x['score'], reverse=True)
            
            # Return top k
            return results[:k]
            
        except Exception as e:
            return [{'error': str(e)}]

def main():
    parser = argparse.ArgumentParser(description='FAISS Vector Search')
    parser.add_argument('--profile', required=True)
    parser.add_argument('--query', required=True)
    parser.add_argument('--k', type=int, default=5)
    args = parser.parse_args()
    
    try:
        searcher = FAISSearcher(args.profile)
        results = searcher.search(args.query, args.k)
        print(json.dumps(results, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == "__main__":
    main()