#!/usr/bin/env python3
import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Any
import yaml
import argparse
import logging
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_chroma import Chroma
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
SCRIPT_DIR = Path(__file__).parent.resolve()
LOG_DIR = PROJECT_ROOT / "assets/logs"
DATA_DIR = PROJECT_ROOT / "assets/data"

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )
    return logging.getLogger("DoomsteadRAG")

logger = setup_logging()

class VectorSearch:
    def __init__(self, config: Dict):
        self.config = config
        self.embeddings = self._init_embeddings()
        
        config_json_path = DATA_DIR / "config.json"
        if config_json_path.exists():
            with open(config_json_path, 'r') as f:
                json_config = json.load(f)
                self.filesetconfig = json_config.get('filesetconfig', 'doomstead')
        else:
            self.filesetconfig = 'doomstead'
            
        self.db_subdir = DATA_DIR / self.filesetconfig
        self.vector_db_path = self.db_subdir / "vector_db"
        self.vectordb = self._init_vector_db()

    def _init_embeddings(self) -> HuggingFaceEmbeddings:
        return HuggingFaceEmbeddings(
            model_name=self.config['embedding_model'],
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )

    def _init_vector_db(self) -> Chroma:
        return Chroma(
            collection_name=f"{self.filesetconfig}_rag",
            persist_directory=str(self.vector_db_path),
            embedding_function=self.embeddings
        )

    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        try:
            # First try exact function name match
            if '()' in query:
                func_name = query.split('(')[0]
                exact_query = f"function {func_name}("
                docs = self.vectordb.similarity_search_with_relevance_scores(exact_query, k=k)
            else:
                docs = self.vectordb.similarity_search_with_relevance_scores(query, k=k*2)  # Get more results
            
            min_score = 0.2  # Lower threshold for code searches
            
            results = []
            seen_sources = set()
            
            for doc, score in docs:
                try:
                    score_float = float(score)
                    if score_float > min_score:
                        source = doc.metadata.get('source', '')
                        
                        # Skip duplicate sources
                        if source in seen_sources:
                            continue
                        seen_sources.add(source)
                        
                        # Boost scores for exact function matches
                        if '()' in query and f"function {func_name}(" in doc.page_content:
                            score_float = 1.0  # Max score for exact match
                            
                        results.append({
                            'content': doc.page_content,
                            'metadata': doc.metadata,
                            'score': score_float
                        })
                except (TypeError, ValueError) as e:
                    logger.warning(f"Invalid score value {score}: {str(e)}")
                    continue
            
            # Sort results by score and return top k
            results.sort(key=lambda x: x['score'], reverse=True)
            return results[:k]
            
        except Exception as e:
            logger.error(f"Search failed: {str(e)}")
            raise RuntimeError(f"Search failed: {str(e)}")

def load_config() -> Dict:
    config_json_path = DATA_DIR / "config.json"
    config_yaml_file = "ragcode.yaml"
    
    if config_json_path.exists():
        with open(config_json_path, 'r') as f:
            json_config = json.load(f)
            if isinstance(json_config, dict) and 'filesetconfig' in json_config:
                config_yaml_file = f"{json_config['filesetconfig']}.yaml"
    
    config_path = PROJECT_ROOT / "assets" / "py" / config_yaml_file
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
        if not config or 'doomsteadRAG' not in config:
            raise ValueError("Invalid or empty config file")
        return config['doomsteadRAG']

def main():
    try:
        config = load_config()
        parser = argparse.ArgumentParser(description='Doomstead RAG Vector Search')
        parser.add_argument('--query', required=True, help='Search query')
        parser.add_argument('--k', type=int, default=5, help='Number of results to return')
        
        args = parser.parse_args()
        searcher = VectorSearch(config)
        results = searcher.search(args.query, args.k)
        print(json.dumps(results[:args.k]))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()