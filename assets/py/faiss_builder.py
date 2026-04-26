import os
import sys
import json
import yaml
import logging
import hashlib
import sqlite3
from pathlib import Path
from typing import List, Dict, Any
import argparse

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import TextLoader, PyPDFLoader, DirectoryLoader

PROJECT_ROOT = Path("/var/www/html/doomsteadRAG")
DATA_DIR = PROJECT_ROOT / "assets/data"

def setup_logging(profile: str):
    LOG_DIR = PROJECT_ROOT / "assets/logs"
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE = LOG_DIR / f"faiss_build_{profile}.log"
    if LOG_FILE.exists():
        LOG_FILE.unlink()
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()]
    )
    return logging.getLogger("DoomsteadFAISS")

class FAISSBuilder:
    def __init__(self, profile: str):
        self.profile = profile
        self.logger = setup_logging(profile)
        self.config = self._load_config()
        self.profile_dir = DATA_DIR / profile
        self.faiss_dir = self.profile_dir / "faiss_index"
        
        # Get embedding models from config
        self.code_model_name = self.config.get('embedding_model', 'sentence-transformers/all-mpnet-base-v2')
        self.text_model_name = self.config.get('text_embedding_model', 'sentence-transformers/all-MiniLM-L6-v2')
        
        self.logger.info(f"Using code embedding model: {self.code_model_name}")
        self.logger.info(f"Using text embedding model: {self.text_model_name}")
        
        # Initialize both embedding models
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
        
        chunk_size = self.config.get('chunk_size', 800)
        chunk_overlap = self.config.get('chunk_overlap', 150)
        
        # Use code-specific separators if available in config
        separators = self.config.get('separators', ["\n\n", "\n", ". ", "! ", "? ", " "])
        
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=separators
        )
        
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.faiss_dir.mkdir(parents=True, exist_ok=True)
        self.logger.info(f"=== FAISS Builder for profile: {profile} ===")
    
    def _load_config(self) -> Dict:
        config_path = PROJECT_ROOT / "assets" / "yaml" / f"{self.profile}.yaml"
        if not config_path.exists():
            raise FileNotFoundError(f"Config not found: {config_path}")
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        return config.get('doomsteadRAG', {})
    
    def _get_file_extensions(self, file_type: str) -> List[str]:
        extension_map = {
            'py': ['.py'],
            'php': ['.php', '.php3', '.php4', '.php5', '.phtml'],
            'js': ['.js', '.jsx', '.mjs', '.cjs'],
            'css': ['.css', '.scss', '.less'],
            'html': ['.html', '.htm', '.xhtml'],
            'txt': ['.txt', '.md', '.rst'],
            'pdf': ['.pdf']
        }
        return extension_map.get(file_type.lower(), [])
    
    def _should_skip_file(self, file_path: str) -> bool:
        skip_patterns = ['venv', '__pycache__', '.venv', 'minified_']
        return any(pattern in str(file_path) for pattern in skip_patterns)
    
    def _is_text_document(self, file_path: str) -> bool:
        """Determine if a document is text-based (not code)"""
        text_indicators = ['specification', 'README', 'readme', 'documentation', 'docs', '.txt']
        path_str = str(file_path).lower()
        return any(indicator in path_str for indicator in text_indicators)
    
    def _load_code_documents(self) -> List[Document]:
        documents = []
        code_dirs = self.config.get('code_dirs', {})
        
        if not code_dirs:
            return documents
        
        for file_type, dirs in code_dirs.items():
            extensions = self._get_file_extensions(file_type)
            if not extensions:
                continue
            
            for dir_path in dirs:
                path = Path(dir_path) if Path(dir_path).is_absolute() else PROJECT_ROOT / dir_path
                if not path.exists():
                    self.logger.warning(f"Directory not found: {path}")
                    continue
                
                self.logger.info(f"Loading {file_type.upper()} files from {path}")
                
                for ext in extensions:
                    for file_path in path.rglob(f"*{ext}"):
                        if self._should_skip_file(str(file_path)):
                            continue
                        
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                            
                            # Determine if this is text or code
                            is_text = self._is_text_document(str(file_path))
                            
                            doc = Document(
                                page_content=content,
                                metadata={
                                    'source': str(file_path),
                                    'file_type': file_type,
                                    'document_type': 'text' if is_text else 'code',
                                    'embedding_model': self.text_model_name if is_text else self.code_model_name
                                }
                            )
                            documents.append(doc)
                            self.logger.debug(f"  Loaded: {file_path.name} (type: {'text' if is_text else 'code'})")
                            
                        except Exception as e:
                            self.logger.error(f"Error reading {file_path}: {e}")
        
        return documents
    
    def _load_pdf_documents(self) -> List[Document]:
        documents = []
        pdf_dirs = self.config.get('pdf', [])
        
        if not pdf_dirs:
            return documents
        
        for pdf_dir in pdf_dirs:
            path = Path(pdf_dir) if Path(pdf_dir).is_absolute() else PROJECT_ROOT / pdf_dir
            if not path.exists():
                self.logger.warning(f"PDF directory not found: {path}")
                continue
            
            self.logger.info(f"Loading PDF files from {path}")
            
            try:
                loader = DirectoryLoader(
                    str(path),
                    glob="**/*.pdf",
                    loader_cls=PyPDFLoader,
                    show_progress=True
                )
                pdf_docs = loader.load()
                # Mark PDFs as text documents
                for doc in pdf_docs:
                    doc.metadata['document_type'] = 'text'
                    doc.metadata['embedding_model'] = self.text_model_name
                documents.extend(pdf_docs)
                self.logger.info(f"Loaded {len(pdf_docs)} PDF documents")
                
            except Exception as e:
                self.logger.error(f"Error loading PDFs from {path}: {e}")
        
        return documents
    
    def _load_specification_documents(self) -> List[Document]:
        """Load as-built-specification.txt if it exists"""
        documents = []
        spec_path = PROJECT_ROOT / "assets" / "docs" / "as-built-specification.txt"
        
        if spec_path.exists():
            self.logger.info(f"Loading specification document: {spec_path}")
            try:
                with open(spec_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                doc = Document(
                    page_content=content,
                    metadata={
                        'source': str(spec_path),
                        'file_type': 'specification',
                        'document_type': 'text',
                        'is_specification': True,
                        'embedding_model': self.text_model_name
                    }
                )
                documents.append(doc)
                self.logger.info(f"Loaded specification document")
            except Exception as e:
                self.logger.error(f"Error loading specification: {e}")
        else:
            self.logger.warning(f"Specification document not found: {spec_path}")
        
        return documents
    
    def build_index(self):
        try:
            code_documents = []
            text_documents = []
            
            # Load specification document first (always text)
            spec_docs = self._load_specification_documents()
            text_documents.extend(spec_docs)
            
            # Load code documents if code_dirs is configured
            if self.config.get('code_dirs'):
                all_docs = self._load_code_documents()
                # Separate code from text documents
                for doc in all_docs:
                    if doc.metadata.get('document_type') == 'text':
                        text_documents.append(doc)
                    else:
                        code_documents.append(doc)
                self.logger.info(f"Loaded {len(code_documents)} code documents and {len(text_documents)} text documents from code_dirs")
            
            # Load PDF documents if pdf is configured (always text)
            if self.config.get('pdf'):
                pdf_docs = self._load_pdf_documents()
                text_documents.extend(pdf_docs)
                self.logger.info(f"Loaded {len(pdf_docs)} PDF documents")
            
            total_docs = len(code_documents) + len(text_documents)
            if total_docs == 0:
                self.logger.warning("No documents found to process")
                return False
            
            self.logger.info(f"Total documents: {total_docs} (Code: {len(code_documents)}, Text: {len(text_documents)})")
            
            # Split documents into chunks
            self.logger.info("Splitting documents into chunks...")
            all_chunks = []
            
            # Process code documents with code splitter
            if code_documents:
                code_chunks = self.splitter.split_documents(code_documents)
                for chunk in code_chunks:
                    chunk.metadata['embedding_type'] = 'code'
                all_chunks.extend(code_chunks)
                self.logger.info(f"Created {len(code_chunks)} chunks from code documents")
            
            # Process text documents with text splitter (might use different parameters in future)
            if text_documents:
                text_chunks = self.splitter.split_documents(text_documents)
                for chunk in text_chunks:
                    chunk.metadata['embedding_type'] = 'text'
                all_chunks.extend(text_chunks)
                self.logger.info(f"Created {len(text_chunks)} chunks from text documents")
            
            if not all_chunks:
                self.logger.warning("No chunks created")
                return False
            
            self.logger.info(f"Total chunks created: {len(all_chunks)}")
            
            # Build separate FAISS indices for code and text
            code_chunks_for_index = [chunk for chunk in all_chunks if chunk.metadata.get('embedding_type') == 'code']
            text_chunks_for_index = [chunk for chunk in all_chunks if chunk.metadata.get('embedding_type') == 'text']
            
            # Create combined vectorstore by merging indices
            self.logger.info("Building FAISS index for code documents...")
            if code_chunks_for_index:
                code_vectorstore = FAISS.from_documents(code_chunks_for_index, self.code_embeddings)
                final_vectorstore = code_vectorstore
            else:
                final_vectorstore = None
            
            if text_chunks_for_index:
                self.logger.info("Building FAISS index for text documents...")
                text_vectorstore = FAISS.from_documents(text_chunks_for_index, self.text_embeddings)
                if final_vectorstore:
                    final_vectorstore.merge_from(text_vectorstore)
                else:
                    final_vectorstore = text_vectorstore
            
            if not final_vectorstore:
                self.logger.error("No vectorstore created")
                return False
            
            # Save combined index
            self.logger.info(f"Saving FAISS index to {self.faiss_dir}")
            final_vectorstore.save_local(str(self.faiss_dir))
            
            # Save metadata
            metadata = {
                'profile': self.profile,
                'code_embedding_model': self.code_model_name,
                'text_embedding_model': self.text_model_name,
                'total_chunks': len(all_chunks),
                'code_chunks': len(code_chunks_for_index),
                'text_chunks': len(text_chunks_for_index),
                'total_documents': total_docs,
                'code_documents': len(code_documents),
                'text_documents': len(text_documents),
                'chunk_size': self.config.get('chunk_size', 800),
                'chunk_overlap': self.config.get('chunk_overlap', 150),
                'has_specification': len(spec_docs) > 0
            }
            
            with open(self.faiss_dir / 'build_info.json', 'w') as f:
                json.dump(metadata, f, indent=2)
            
            self.logger.info("Build completed successfully!")
            return True
            
        except Exception as e:
            self.logger.error(f"Build failed: {e}", exc_info=True)
            return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', required=True)
    args = parser.parse_args()
    builder = FAISSBuilder(args.profile)
    success = builder.build_index()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()