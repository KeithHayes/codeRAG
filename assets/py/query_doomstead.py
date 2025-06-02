#!/usr/bin/env python3
import os
import sys
import json
import argparse
import yaml
from pathlib import Path
from warnings import filterwarnings
from typing import List, Dict, Any
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# Suppress warnings
filterwarnings("ignore")

# Path configuration - matching full_builder.py
PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
SCRIPT_DIR = Path(__file__).parent.resolve()
DATA_DIR = PROJECT_ROOT / "assets/data"

def load_config() -> Dict:
    """Load configuration based on config.json if present, otherwise use config.yaml"""
    config_json_path = DATA_DIR / "config.json"
    config_yaml_file = "ragcode.yaml"  # Default YAML config file
    
    if config_json_path.exists():
        try:
            with open(config_json_path, 'r') as f:
                json_config = json.load(f)
                if isinstance(json_config, dict) and 'filesetconfig' in json_config:
                    config_yaml_file = f"{json_config['filesetconfig']}.yaml"
        except Exception as e:
            print(f"Could not read config.json: {str(e)}. Falling back to default ragcode.yaml", file=sys.stderr)
    
    config_path = PROJECT_ROOT / "assets" / "py" / config_yaml_file
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
        if not config or 'rag_doomstead' not in config:
            raise ValueError(f"Invalid or empty config file: {config_yaml_file}")
        return config['rag_doomstead']

class VectorSearch:
    def __init__(self):
        self.config = load_config()
        self.embeddings = self._init_embeddings()
        self.vectordb = self._init_vector_db()

    def _init_embeddings(self) -> HuggingFaceEmbeddings:
        """Initialize HuggingFace embeddings model"""
        return HuggingFaceEmbeddings(
            model_name=self.config['embedding_model'],
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )

    def _init_vector_db(self) -> Chroma:
        """Initialize Chroma vector database"""
        vector_db_path = Path(self.config['vector_db_path'])
        if not vector_db_path.is_absolute():
            vector_db_path = PROJECT_ROOT / vector_db_path

        return Chroma(
            collection_name="doomstead_rag",
            persist_directory=str(vector_db_path),
            embedding_function=self.embeddings
        )

    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Perform similarity search with relevance scores"""
        try:
            docs = self.vectordb.similarity_search_with_relevance_scores(query, k=k)
            return [{
                'content': doc.page_content,
                'metadata': doc.metadata,
                'score': float(score)
            } for doc, score in docs if score > self.config.get('min_score', 0.25)]
        except Exception as e:
            raise RuntimeError(f"Search failed: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Doomstead RAG Vector Search')
    parser.add_argument('--query', required=True, help='Search query')
    parser.add_argument('--k', type=int, default=5, help='Number of results to return')
    
    try:
        args = parser.parse_args()
        searcher = VectorSearch()
        results = searcher.search(args.query, args.k)
        print(json.dumps(results[:args.k]))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()