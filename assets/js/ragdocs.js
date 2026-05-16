// JS assets/js/ragdocs.js
(function() {
  'use strict';

  console.log('[ragdocs.js] Loading module...');

  async function fetchJSON(url, options = {}) {
    console.log(`[RAGDocs DEBUG] Fetching: ${url}`);
    const response = await fetch(url, options);
    const text = await response.text();
    console.log(`[RAGDocs DEBUG] Response from ${url} (first 300 chars):`, text.substring(0, 300));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}: ${text.substring(0, 200)}`);
    }
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(`[RAGDocs ERROR] Failed to parse JSON from ${url}`);
      console.error(`[RAGDocs ERROR] Full response:`, text);
      throw new Error(`Invalid JSON from ${url}: ${e.message}\nFirst 500 chars: ${text.substring(0, 500)}`);
    }
  }

  async function loadRAMData() {
    console.log('[RAGDocs] Loading RAM data from ramlist.json...');
    const ramDataPath = 'assets/data/ragdocs/ramlist.json';
    
    let ramData = null;
    let retries = 5;
    while (retries > 0 && !ramData) {
      const response = await fetch(ramDataPath + '?_=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      });
      
      if (response.ok) {
        ramData = await response.json();
        break;
      }
      
      retries--;
      if (retries > 0) {
        console.log(`RAM data file not found, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!ramData) {
      throw new Error('RAM data file not found at: ' + ramDataPath);
    }
    
    if (!ramData || ramData.length === 0) {
      throw new Error('RAM data file is empty');
    }
    
    console.log(`[RAGDocs] RAM data loaded, ${ramData.length} modules found`);
    return ramData;
  }

  function createRAMDescription(module) {
    let description = `${module.supplier} ${module.capacity} DDR5 RAM at ${module.speed_mhz}MHz. `;
    description += `${module.rank} rank using ${module.chip_brand} chips. `;
    description += `Timings ${module.timing} at ${module.voltage_v}V. `;
    description += `Supports XMP: ${module.xmp ? 'Yes' : 'No'}, EXPO: ${module.expo ? 'Yes' : 'No'}. `;
    description += `Native speed: ${module.native_speed_mhz || 'N/A'}MHz. `;
    description += `Part number: ${module.module_pn}`;
    return description;
  }

  function chunkRAMData(ramData, chunkSize, overlap) {
    console.log(`[RAGDocs] Chunking ${ramData.length} modules with size ${chunkSize}, overlap ${overlap}`);
    
    const chunks = [];
    let i = 0;
    
    while (i < ramData.length) {
      const chunkModules = ramData.slice(i, i + chunkSize);
      const chunkText = chunkModules.map((module, idx) => {
        return `[Module ${i + idx + 1}]\n${createRAMDescription(module)}`;
      }).join('\n\n---\n\n');
      
      chunks.push({
        text: chunkText,
        metadata: {
          start_index: i,
          end_index: Math.min(i + chunkSize, ramData.length),
          module_count: chunkModules.length,
          speeds: chunkModules.map(m => m.speed_mhz),
          suppliers: [...new Set(chunkModules.map(m => m.supplier))]
        }
      });
      
      i += chunkSize - overlap;
      if (i >= ramData.length) break;
    }
    
    console.log(`[RAGDocs] Created ${chunks.length} chunks`);
    return chunks;
  }

  async function saveChunksToVectorStore(chunks, profile) {
    console.log('[RAGDocs] Saving chunks to vector store...');
    
    const response = await fetch('assets/php/run_ragdocs.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'build_index',
        profile: profile,
        chunks: chunks
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  }

  async function queryRAMDatabase(question, profile) {
    console.log('[RAGDocs] Querying RAM database...');
    
    const response = await fetch('assets/php/run_ragdocs.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'query',
        profile: profile,
        question: question
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  }

  async function getIndexStatus(profile) {
    console.log('[RAGDocs] Checking index status...');
    
    const response = await fetch('assets/php/run_ragdocs.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        profile: profile
      })
    });
    
    if (!response.ok) {
      return { exists: false, error: response.statusText };
    }
    
    const data = await response.json();
    return data;
  }

  async function rebuildIndex(profile) {
    console.log('[RAGDocs] Rebuilding index...');
    
    const ramData = await loadRAMData();
    
    const configResponse = await fetch('assets/yaml/ragdocs.yaml');
    const configText = await configResponse.text();
    
    let chunkSize = 10;
    let chunkOverlap = 2;
    
    const sizeMatch = configText.match(/chunk_size:\s*(\d+)/);
    if (sizeMatch) chunkSize = parseInt(sizeMatch[1]);
    
    const overlapMatch = configText.match(/chunk_overlap:\s*(\d+)/);
    if (overlapMatch) chunkOverlap = parseInt(overlapMatch[1]);
    
    const chunks = chunkRAMData(ramData, chunkSize, chunkOverlap);
    
    const result = await saveChunksToVectorStore(chunks, profile);
    return result;
  }

  window.ragdocsmodule = { 
    loadRAMData: loadRAMData,
    createRAMDescription: createRAMDescription,
    chunkRAMData: chunkRAMData,
    queryRAMDatabase: queryRAMDatabase,
    getIndexStatus: getIndexStatus,
    rebuildIndex: rebuildIndex
  };
  
  console.log('[ragdocs.js] Module loaded successfully, window.ragdocsmodule is now defined');
})();