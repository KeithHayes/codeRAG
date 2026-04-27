import sys
import json
import yaml
import argparse
from pathlib import Path
from typing import List, Dict, Any
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
DATA_DIR = PROJECT_ROOT / "assets/data"

class FAISSearcher:
    def __init__(self, profile: str):
        self.profile = profile
        self.profile_dir = DATA_DIR / profile
        self.code_index_dir = self.profile_dir / "faiss_code_index"
        self.text_index_dir = self.profile_dir / "faiss_text_index"
        
        # Load config to get embedding models
        config_path = PROJECT_ROOT / "assets" / "yaml" / f"{self.profile}.yaml"
        self.code_model_name = "sentence-transformers/all-mpnet-base-v2"
        self.text_model_name = "sentence-transformers/all-MiniLM-L6-v2"
        
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                doomstead_rag = config.get('doomsteadRAG', {})
                self.code_model_name = doomstead_rag.get('embedding_model', self.code_model_name)
                self.text_model_name = doomstead_rag.get('text_embedding_model', self.text_model_name)
        
        # Initialize embeddings
        self.code_embeddings = HuggingFaceEmbeddings(
            model_name=self.code_model_name,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        self.text_embeddings = HuggingFaceEmbeddings(
            model_name=self.text_model_name,
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        # Load vectorstores if they exist
        self.code_vectorstore = None
        self.text_vectorstore = None
        
        if self.code_index_dir.exists() and (self.code_index_dir / "index.faiss").exists():
            try:
                self.code_vectorstore = FAISS.load_local(
                    str(self.code_index_dir), 
                    self.code_embeddings, 
                    allow_dangerous_deserialization=True
                )
                print(f"Loaded code index with {self.code_embeddings.model_name}", file=sys.stderr)
            except Exception as e:
                print(f"Failed to load code index: {e}", file=sys.stderr)
        
        if self.text_index_dir.exists() and (self.text_index_dir / "index.faiss").exists():
            try:
                self.text_vectorstore = FAISS.load_local(
                    str(self.text_index_dir), 
                    self.text_embeddings, 
                    allow_dangerous_deserialization=True
                )
                print(f"Loaded text index with {self.text_embeddings.model_name}", file=sys.stderr)
            except Exception as e:
                print(f"Failed to load text index: {e}", file=sys.stderr)
    
    def search(self, query: str, k: int = 15) -> List[Dict[str, Any]]:
        results = []
        
        # Search code index
        if self.code_vectorstore:
            try:
                code_results = self.code_vectorstore.similarity_search_with_relevance_scores(query, k=k)
                for doc, score in code_results:
                    results.append({
                        'content': doc.page_content,
                        'metadata': doc.metadata,
                        'score': float(1 - abs(score)),
                        'index_type': 'code'
                    })
                print(f"Found {len(code_results)} results from code index", file=sys.stderr)
            except Exception as e:
                print(f"Error searching code index: {e}", file=sys.stderr)
        
        # Search text index
        if self.text_vectorstore:
            try:
                text_results = self.text_vectorstore.similarity_search_with_relevance_scores(query, k=k)
                for doc, score in text_results:
                    results.append({
                        'content': doc.page_content,
                        'metadata': doc.metadata,
                        'score': float(1 - abs(score)),
                        'index_type': 'text'
                    })
                print(f"Found {len(text_results)} results from text index", file=sys.stderr)
            except Exception as e:
                print(f"Error searching text index: {e}", file=sys.stderr)
        
        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)
        
        # Return top k results
        return results[:k]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', required=True)
    parser.add_argument('--query', required=True)
    parser.add_argument('--k', type=int, default=15)
    args = parser.parse_args()
    
    try:
        searcher = FAISSearcher(args.profile)
        results = searcher.search(args.query, args.k)
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == "__main__":
    main()