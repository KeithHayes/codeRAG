#!/usr/bin/env python3
import sys
import json
import yaml
import argparse
from pathlib import Path
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
DATA_DIR = PROJECT_ROOT / "assets/data"

class FAISSearcher:
    def __init__(self, profile: str):
        self.profile = profile
        self.faiss_dir = DATA_DIR / profile / "faiss_index"
        
        # Load config to get the embedding model that was used
        config_path = PROJECT_ROOT / "assets" / "py" / f"{self.profile}.yaml"
        model_name = "sentence-transformers/all-mpnet-base-v2"  # default
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                model_name = config.get('doomsteadRAG', {}).get('embedding_model', model_name)
        
        self.embeddings = HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        self.vectorstore = FAISS.load_local(str(self.faiss_dir), self.embeddings, allow_dangerous_deserialization=True)
    
    def search(self, query: str, k: int = 5):
        docs_with_scores = self.vectorstore.similarity_search_with_relevance_scores(query, k=k)
        results = []
        for doc, score in docs_with_scores:
            results.append({
                'content': doc.page_content,
                'metadata': doc.metadata,
                'score': float(1 - abs(score))
            })
        return results

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', required=True)
    parser.add_argument('--query', required=True)
    parser.add_argument('--k', type=int, default=5)
    args = parser.parse_args()
    try:
        searcher = FAISSearcher(args.profile)
        results = searcher.search(args.query, args.k)
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == "__main__":
    main()