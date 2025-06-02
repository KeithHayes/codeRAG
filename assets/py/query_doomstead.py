#!/usr/bin/env python3
import os
import sys
import json
import logging
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
LOG_DIR = PROJECT_ROOT / "assets/logs"

def setup_logging():
    """Configure logging to query_doomstead.log"""
    LOG_FILE = LOG_DIR / "query_doomstead.log"
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        os.chmod(LOG_DIR, 0o777)
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(LOG_FILE),
                logging.StreamHandler()
            ]
        )
        return logging.getLogger("DoomsteadRAG")
    except Exception as e:
        print(f"Failed to configure logging: {str(e)}", file=sys.stderr)
        raise

logger = setup_logging()

def load_config() -> Dict:
    """Load configuration based on config.json if present, otherwise use config.yaml"""
    config_json_path = DATA_DIR / "config.json"
    config_yaml_file = "ragcode.yaml"  # Default YAML config file
    
    logger.info(f"Loading config from: {config_json_path}")
    
    if config_json_path.exists():
        try:
            with open(config_json_path, 'r') as f:
                json_config = json.load(f)
                if isinstance(json_config, dict) and 'filesetconfig' in json_config:
                    config_yaml_file = f"{json_config['filesetconfig']}.yaml"
                    logger.info(f"Using config file from config.json: {config_yaml_file}")
        except Exception as e:
            logger.warning(f"Could not read config.json: {str(e)}. Falling back to default ragcode.yaml")
    
    config_path = PROJECT_ROOT / "assets" / "py" / config_yaml_file
    logger.info(f"Loading YAML config from: {config_path}")
    
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
        if not config or 'rag_doomstead' not in config:
            raise ValueError(f"Invalid or empty config file: {config_yaml_file}")
        return config['rag_doomstead']

class VectorSearch:
    def __init__(self):
        self.config = load_config()
        self.vector_db_path = Path(self.config['vector_db_path'])
        if not self.vector_db_path.is_absolute():
            self.vector_db_path = PROJECT_ROOT / self.vector_db_path
        
        logger.info(f"Initializing vector store at: {self.vector_db_path}")
        self.embeddings = self._init_embeddings()
        self.vectordb = self._init_vector_db()
        self.verify_vector_store()

    def _init_embeddings(self) -> HuggingFaceEmbeddings:
        """Initialize HuggingFace embeddings model"""
        logger.info(f"Initializing embeddings model: {self.config['embedding_model']}")
        return HuggingFaceEmbeddings(
            model_name=self.config['embedding_model'],
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )

    def _init_vector_db(self) -> Chroma:
        """Initialize Chroma vector database"""
        return Chroma(
            collection_name="doomstead_rag",
            persist_directory=str(self.vector_db_path),
            embedding_function=self.embeddings
        )

    def verify_vector_store(self):
        """Verify the vector store is accessible and log the status"""
        try:
            collection = self.vectordb._collection
            count = collection.count()
            logger.info(f"Vector store verified. Collection: {collection.name}, Items: {count}")
            return True
        except Exception as e:
            logger.error(f"Vector store verification failed: {str(e)}")
            return False

    def search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Perform similarity search with relevance scores"""
        try:
            logger.info(f"Performing search for query: {query}")
            docs = self.vectordb.similarity_search_with_relevance_scores(query, k=k)
            results = [{
                'content': doc.page_content,
                'metadata': doc.metadata,
                'score': float(score)
            } for doc, score in docs if score > self.config.get('min_score', 0.25)]
            
            logger.info(f"Search completed. Found {len(results)} results")
            return results
        except Exception as e:
            logger.error(f"Search failed: {str(e)}")
            raise RuntimeError(f"Search failed: {str(e)}")

def main():
    try:
        # Initialize and verify vector store automatically
        searcher = VectorSearch()
        
        # Example search - can be called from other code
        # results = searcher.search("example query")
        # print(json.dumps(results))
        
        return 0
    except Exception as e:
        logger.critical(f"Initialization failed: {str(e)}", exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(main())