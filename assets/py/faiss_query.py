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
        
        # Load config to get the embedding models that were used
        config_path = PROJECT_ROOT / "assets" / "yaml" / f"{self.profile}.yaml"
        code_model_name = "sentence-transformers/all-mpnet-base-v2"
        text_model_name = "sentence-transformers/all-MiniLM-L6-v2"
        
        if config_path.exists():
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
                doomstead_rag = config.get('doomsteadRAG', {})
                code_model_name = doomstead_rag.get('embedding_model', code_model_name)
                text_model_name = doomstead_rag.get('text_embedding_model', text_model_name)
        
        # Try to load build info to get exact models used
        build_info_path = self.faiss_dir / 'build_info.json'
        if build_info_path.exists():
            with open(build_info_path, 'r') as f:
                build_info = json.load(f)
                code_model_name = build_info.get('code_embedding_model', code_model_name)
                text_model_name = build_info.get('text_embedding_model', text_model_name)
        
        # We need to use the code embedding model for the main similarity search
        # since FAISS indexes are compatible within the same embedding space
        self.embeddings = HuggingFaceEmbeddings(
            model_name=code_model_name,
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