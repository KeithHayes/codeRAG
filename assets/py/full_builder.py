#!/usr/bin/env python3
import os
import sys
import logging
import hashlib
import sqlite3
import shutil
import json
from pathlib import Path
from typing import Dict, List
import yaml
import chromadb
from chromadb.config import Settings
from langchain.schema import Document
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
import numpy as np # Fix numpy compatibility before any imports
np.float_ = np.float64  # Fix for NumPy 2.0

# Path configuration
PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
SCRIPT_DIR = Path(__file__).parent.resolve()
LOG_DIR = PROJECT_ROOT / "assets/logs"
DATA_DIR = PROJECT_ROOT / "assets/data"
VECTOR_DB_DIR = DATA_DIR / "vector_db"  # Explicit subdirectory for vector db

def setup_logging():
    """Configure logging with proper file permissions"""
    LOG_FILE = LOG_DIR / "vector_build.log"
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
        
        # Set database paths
        self.vector_db_path = VECTOR_DB_DIR
        self.db_file = DATA_DIR / "file_metadata.db"
        
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
        """Verify and create all required directories with correct permissions"""
        logger.info("Verifying directories...")
        required_dirs = [LOG_DIR, DATA_DIR, VECTOR_DB_DIR]
        
        for dir_path in required_dirs:
            try:
                dir_path.mkdir(parents=True, exist_ok=True)
                os.chmod(dir_path, 0o775)
                
                # Test write permissions
                test_file = dir_path / ".permission_test"
                with open(test_file, 'w') as f:
                    f.write("test")
                os.unlink(test_file)
                
                # Set ownership and permissions
                os.system(f"chown -R www-data:www-data {dir_path}")
                logger.info(f"Verified directory: {dir_path}")
            except Exception as e:
                logger.error(f"Directory verification failed for {dir_path}: {str(e)}")
                raise PermissionError(f"Insufficient permissions for {dir_path}")

    def _ensure_vectorstore_permissions(self, path: Path):
        """Ensure proper permissions for vector store directory"""
        try:
            if not path.exists():
                path.mkdir(parents=True, exist_ok=True)
            
            # Set directory permissions
            os.chmod(path, 0o775)
            
            # Set permissions for all files in the directory
            for root, dirs, files in os.walk(path):
                for d in dirs:
                    os.chmod(os.path.join(root, d), 0o775)
                for f in files:
                    try:
                        os.chmod(os.path.join(root, f), 0o664)
                    except Exception:
                        continue
            
            # Set ownership
            os.system(f"chown -R www-data:www-data {path}")
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
            'py': ['.py'],
            'php': ['.php', '.php3', '.php4', '.php5', '.phtml'],
            'js': ['.js', '.jsx', '.mjs', '.cjs'],
            'css': ['.css', '.scss', '.less'],
            'html': ['.html', '.htm', '.xhtml'],
        }
        return extension_map.get(file_type.lower(), [])

    def _should_skip_file(self, file_path: str) -> bool:
        filename = os.path.basename(file_path)
        return (filename.startswith('minified_') and 
               (filename.endswith('.css') or filename.endswith('.js')))

    def _initialize_database(self):
        """Initialize the metadata database with proper permissions"""
        try:
            # Create parent directory if it doesn't exist
            self.db_file.parent.mkdir(parents=True, exist_ok=True)
            
            self.db_conn = sqlite3.connect(self.db_file)
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
            
            # Set database file permissions
            os.chmod(self.db_file, 0o664)
            os.system(f"chown www-data:www-data {self.db_file}")
            
            logger.info(f"Database initialized at {self.db_file}")
        except Exception as e:
            logger.error(f"Cannot access database file at {self.db_file}: {str(e)}")
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
        skip_dirs = {"venv", "__pycache__", ".venv"}
        for file_type, dirs in self.config['code_dirs'].items():
            logger.info(f"Processing {file_type.upper()} files...")
            for path in dirs:
                abs_path = Path(path) if Path(path).is_absolute() else PROJECT_ROOT / path
                for ext in self._get_extensions(file_type):
                    for file in abs_path.rglob(f"*{ext}"):
                        if any(skip_dir in file.parts for skip_dir in skip_dirs):
                            logger.debug(f"Skipping directory: {file}")
                            continue
                        if self._should_skip_file(str(file)):
                            logger.debug(f"Skipping minified file: {file}")
                            continue
                        
                        try:
                            file_path_str = str(file)
                            with open(file, 'r', encoding='utf-8') as f:
                                text = f.read()
                            self._update_file_metadata(file_path_str)
                            documents.append(Document(
                                page_content=text,
                                metadata={'source': file_path_str}
                            ))
                        except UnicodeDecodeError:
                            try:
                                with open(file, 'r', encoding='latin-1') as f:
                                    text = f.read()
                                self._update_file_metadata(file_path_str)
                                documents.append(Document(
                                    page_content=text,
                                    metadata={'source': file_path_str}
                                ))
                            except Exception as e:
                                logger.error(f"Failed to read {file} with fallback encoding: {e}")
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
                            item.unlink()
                    except Exception as e:
                        logger.warning(f"Could not remove {item}: {str(e)}")
                logger.info("Vector store cleanup completed")
            except Exception as e:
                logger.error(f"Vector store cleanup failed: {str(e)}")
                raise

    def initialize_vectorstore(self):
        """Initialize the vector store with proper directory structure and permissions"""
        try:
            # Ensure vector db directory exists with correct permissions
            if not self._ensure_vectorstore_permissions(self.vector_db_path):
                raise RuntimeError("Failed to set vector store permissions")

            self._clear_vectorstore(self.vector_db_path)
            logger.info("Building vector store...")
            
            docs = self._load_documents()
            chunks = self._split_documents(docs)

            client = chromadb.PersistentClient(
                path=str(self.vector_db_path),
                settings=Settings(
                    allow_reset=True,
                    anonymized_telemetry=False
                )
            )
            
            collection = client.create_collection(
                name="doomstead_rag",
                metadata={"hnsw:space": "cosine"}
            )

            # Process in batches
            batch_size = 512
            for i in range(0, len(chunks), batch_size):
                batch = chunks[i:i + batch_size]
                embeddings = self.embeddings.embed_documents(
                    [chunk.page_content for chunk in batch])
                
                collection.add(
                    embeddings=embeddings,
                    documents=[chunk.page_content for chunk in batch],
                    metadatas=[chunk.metadata for chunk in batch],
                    ids=[f"chunk_{i+j}" for j in range(len(batch))]
                )
                logger.info(f"Processed batch {(i//batch_size)+1}/{(len(chunks)-1)//batch_size + 1}")

            logger.info(f"Vector store successfully created at {self.vector_db_path}")
            
            # Final permission check
            self._ensure_vectorstore_permissions(self.vector_db_path)
            
        except Exception as e:
            logger.error(f"Error creating vector store: {str(e)}")
            raise RuntimeError(f"Failed to create Chroma vector store: {str(e)}")

    def __del__(self):
        if hasattr(self, 'db_conn'):
            self.db_conn.close()

def load_config() -> Dict:
    config_json_path = DATA_DIR / "config.json"
    logger.info(f"config_json_path: {config_json_path}")
    config_yaml_file = "ragcode.yaml"  # Default YAML config file
    
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
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
        if not config or 'rag_doomstead' not in config:
            raise ValueError(f"Invalid or empty config file: {config_yaml_file}")
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