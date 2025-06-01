#!/usr/bin/env python3
import os
import sys
import time
import logging
import hashlib
import sqlite3
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List
import yaml
import chromadb
from chromadb.config import Settings
from langchain.schema import Document
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Fix numpy compatibility before any imports
import numpy as np
np.float_ = np.float64  # Fix for NumPy 2.0

SCRIPT_DIR = Path(__file__).parent.resolve()
LOG_DIR = Path("/var/www/html/doomsteadRAG/assets/logs")
LOG_FILE = LOG_DIR / "vector_build.log"
DB_FILE = Path("/var/www/html/doomsteadRAG/assets/data/file_metadata.db")
FALLBACK_VECTOR_DB = Path("/var/www/html/doomsteadRAG/assets/data/vector_db")

def setup_logging():
    """Configure logging with proper file permissions"""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        os.chmod(LOG_DIR, 0o777)
        if LOG_FILE.exists():
            LOG_FILE.unlink()
        LOG_FILE.touch()
        os.chmod(LOG_FILE, 0o666)
        
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

class DoomsteadRAG:
    def __init__(self, config: Dict):
        self.config = config
        self.gpu_available = self._verify_gpu()
        self.embeddings = self._init_embeddings()
        self.splitter = self._init_splitter()
        self.vector_db = None
        self._verify_directories()
        self._initialize_database()
        logger.info(f"Using {'GPU' if self.gpu_available else 'CPU'} for embeddings")

    def _verify_gpu(self) -> bool:
        try:
            import torch
            if torch.cuda.is_available():
                logger.info("=== Begin Build ===")
                logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
                logger.info(f"CUDA: {torch.version.cuda}")
                logger.info(f"Memory: {torch.cuda.get_device_properties(0).total_memory/1e9:.2f}GB")
                return True
        except ImportError:
            logger.warning("PyTorch not installed, falling back to CPU")
        except Exception as e:
            logger.warning(f"GPU verification failed: {str(e)}. Falling back to CPU")
        return False

    def _verify_directories(self):
        logger.info("Verifying directories...")
        vector_db_path = Path(self.config['vector_db_path'])
        if not vector_db_path.is_absolute():
            vector_db_path = SCRIPT_DIR / vector_db_path
        
        try:
            vector_db_path.mkdir(parents=True, exist_ok=True)
            test_file = vector_db_path / ".permission_test"
            test_file.touch()
            test_file.unlink()
            os.chmod(vector_db_path, 0o777)
            os.system(f"chown -R www-data:www-data {vector_db_path}")
            os.system(f"chmod -R 777 {vector_db_path}")
        except Exception as e:
            logger.warning(f"Primary vector store path not accessible: {e}")
            self.config['vector_db_path'] = str(FALLBACK_VECTOR_DB)
            vector_db_path = FALLBACK_VECTOR_DB
            vector_db_path.mkdir(parents=True, exist_ok=True)
            os.chmod(vector_db_path, 0o777)
            os.system(f"chown -R www-data:www-data {vector_db_path}")
            os.system(f"chmod -R 777 {vector_db_path}")
            logger.info(f"Using fallback vector store path: {vector_db_path}")
        
        required_dirs = [LOG_DIR, DB_FILE.parent, vector_db_path]
        for dir_path in required_dirs:
            try:
                dir_path.mkdir(parents=True, exist_ok=True)
                os.chmod(dir_path, 0o777)
                test_file = dir_path / ".permission_test"
                with open(test_file, 'w') as f:
                    f.write("test")
                os.unlink(test_file)
                os.system(f"chown -R www-data:www-data {dir_path}")
                os.system(f"chmod -R 777 {dir_path}")
            except Exception as e:
                logger.error(f"Directory verification failed for {dir_path}: {str(e)}")
                raise PermissionError(f"Insufficient permissions for {dir_path}")

    def _ensure_vectorstore_permissions(self, path: Path):
        """Ensure proper permissions for vector store directory"""
        try:
            if path.exists():
                for root, dirs, files in os.walk(path):
                    for d in dirs:
                        os.chmod(os.path.join(root, d), 0o777)
                    for f in files:
                        try:
                            os.chmod(os.path.join(root, f), 0o666)
                        except Exception as e:
                            logger.warning(f"Could not change permissions for {f}: {str(e)}")
            path.mkdir(parents=True, exist_ok=True)
            os.chmod(path, 0o777)
            os.system(f"chown -R www-data:www-data {path}")
            os.system(f"chmod -R 777 {path}")
            return True
        except Exception as e:
            logger.error(f"Permission setting failed: {str(e)}")
            return False

    def _init_embeddings(self):
        device = "cuda" if self.gpu_available else "cpu"
        model_name = self.config['embedding_model']
        logger.info(f"Loading embeddings on {device.upper()}")
        return HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={'device': device, 'trust_remote_code': True},
            encode_kwargs={'batch_size': 32 if device == 'cuda' else 8, 'normalize_embeddings': True}
        )

    def _init_splitter(self):
        return RecursiveCharacterTextSplitter(
            chunk_size=self.config['chunk_size'],
            chunk_overlap=self.config['chunk_overlap'],
            separators=['\n\nfunction ', '\n\nclass ', '\n\n', '\n', ' ', '']
        )

    def _get_extensions(self, file_type: str) -> List[str]:
        extension_map = {
            'php': ['.php', '.php3', '.php4', '.php5', '.phtml'],
            'js': ['.js', '.jsx', '.mjs', '.cjs'],
            'css': ['.css', '.scss', '.less'],
            'html': ['.html', '.htm', '.xhtml']
        }
        return extension_map.get(file_type.lower(), [])

    def _should_skip_file(self, file_path: str) -> bool:
        filename = os.path.basename(file_path)
        return (filename.startswith('minified_') and 
               (filename.endswith('.css') or filename.endswith('.js')))

    def _initialize_database(self):
        try:
            self.db_conn = sqlite3.connect(DB_FILE)
            self.db_conn.execute("PRAGMA journal_mode=WAL")
            self.db_conn.execute("PRAGMA synchronous=NORMAL")
            cursor = self.db_conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS file_metadata (
                    file_path TEXT PRIMARY KEY,
                    last_modified REAL,
                    content_hash TEXT
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS files_embeddings (
                    chunk_id TEXT PRIMARY KEY,
                    file_path TEXT
                )
            ''')
            self.db_conn.commit()
            logger.info(f"Database initialized at {DB_FILE}")
            os.chmod(DB_FILE, 0o777)
            os.system(f"chown www-data:www-data {DB_FILE}")
        except sqlite3.OperationalError as e:
            logger.error(f"Cannot access database file at {DB_FILE}: {str(e)}")
            raise

    def _update_file_metadata(self, file_path: str):
        last_modified = os.path.getmtime(file_path)
        with open(file_path, 'r', encoding='utf-8') as f:
            content_hash = hashlib.md5(f.read().encode()).hexdigest()
        cursor = self.db_conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO file_metadata 
            (file_path, last_modified, content_hash)
            VALUES (?, ?, ?)
        ''', (file_path, last_modified, content_hash))
        self.db_conn.commit()

    def _load_documents(self) -> List[Document]:
        documents = []
        logger.info("Loading documents:")
        for file_type, dirs in self.config['code_dirs'].items():
            logger.info(f"Processing {file_type.upper()} files...")
            for path in dirs:
                abs_path = Path(path) if Path(path).is_absolute() else SCRIPT_DIR / path
                for ext in self._get_extensions(file_type):
                    for file in abs_path.rglob(f"*{ext}"):
                        file_path = str(file)
                        if self._should_skip_file(file_path):
                            logger.info(f"Skipping minified file: {file_path}")
                            continue
                            
                        try:
                            with open(file, 'r', encoding='utf-8') as f:
                                text = f.read()
                            self._update_file_metadata(file_path)
                            documents.append(Document(
                                page_content=text,
                                metadata={'source': file_path}
                            ))
                        except Exception as e:
                            logger.error(f"Error reading {file}: {str(e)}")
        return documents

    def _split_documents(self, docs: List[Document]) -> List[Document]:
        chunks = []
        for doc in docs:
            split_chunks = self.splitter.split_documents([doc])
            for chunk in split_chunks:
                chunk.metadata['source'] = doc.metadata['source']
                chunks.append(chunk)
        logger.info(f"Created {len(chunks)} chunks")
        return chunks

    def _clear_vectorstore(self, path: Path):
        if path.exists():
            try:
                logger.info("Cleaning up existing vector store...")
                for item in path.iterdir():
                    try:
                        if item.is_dir():
                            shutil.rmtree(item, ignore_errors=True)
                        else:
                            os.chmod(item, 0o777)
                            item.unlink()
                    except Exception as e:
                        logger.warning(f"Could not remove {item}: {str(e)}")
                logger.info("Vector store cleanup completed")
            except Exception as e:
                logger.error(f"Vector store cleanup failed: {str(e)}")
                raise

    def initialize_vectorstore(self):
        vector_db_path = Path(self.config['vector_db_path'])
        if not vector_db_path.is_absolute():
            vector_db_path = SCRIPT_DIR / vector_db_path
            
        if not self._ensure_vectorstore_permissions(vector_db_path):
            raise RuntimeError("Failed to set vector store permissions")

        self._clear_vectorstore(vector_db_path)
        logger.info("Building vector store...")
        docs = self._load_documents()
        chunks = self._split_documents(docs)

        try:
            # Initialize Chroma with persistent storage
            client = chromadb.PersistentClient(
                path=str(vector_db_path),
                settings=Settings(allow_reset=True)
            )
            
            # Create collection with proper configuration
            collection = client.create_collection(
                name="doomstead_rag",
                metadata={"hnsw:space": "cosine"})

            # Process documents in batches
            batch_size = 512
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i:i + batch_size]
                embeddings = self.embeddings.embed_documents(
                    [chunk.page_content for chunk in batch])
                
                collection.add(
                    embeddings=embeddings,
                    documents=[chunk.page_content for chunk in batch],
                    metadatas=[chunk.metadata for chunk in batch],
                    ids=[f"chunk_{i+j}" for j in range(len(batch))])
                logger.info(f"Processed batch {(i//batch_size)+1}/{(len(chunks)-1)//batch_size + 1}")

            logger.info(f"Vector store successfully created at {vector_db_path}")
            
        except Exception as e:
            logger.error(f"Error creating vector store: {str(e)}")
            raise RuntimeError(f"Failed to create Chroma vector store: {str(e)}")

    def __del__(self):
        if hasattr(self, 'db_conn'):
            self.db_conn.close()

def load_config(config_file: str = "config.yaml") -> Dict:
    config_path = SCRIPT_DIR / config_file
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
        if not config or 'rag_doomstead' not in config:
            raise ValueError("Invalid or empty config file")
        return config['rag_doomstead']

def main():
    try:
        logger.info("=== Starting vector store build ===")
        config = load_config()
        rag = DoomsteadRAG(config)
        rag.initialize_vectorstore()
        logger.info("Build completed successfully")
        return 0
    except Exception as e:
        logger.critical(f"Build failed: {str(e)}", exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(main())