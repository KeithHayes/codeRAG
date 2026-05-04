// assets/js/processtranscript.js - Complete pipeline processor with debugging

window.transcriptmodule = (function() {
  async function callOllama(model, systemPrompt, userPrompt, temperature = 0.0, maxTokens = 8192) {
    const ollamaUrl = 'http://localhost:11434/api/chat'
    const response = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.replace(/^ollama\//, ''),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        options: {
          temperature: temperature,
          num_predict: maxTokens
        }
      })
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama error (${response.status}): ${errorText}`)
    }
    const data = await response.json()
    if (!data.message || !data.message.content) {
      throw new Error('Empty response from Ollama')
    }
    return data.message.content.trim()
  }

  async function saveStageOutput(stageName, output) {
    try {
      await fetch('assets/php/save_stage_output.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: stageName,
          output: output,
          timestamp: new Date().toISOString()
        })
      })
    } catch (err) {
      console.error(`Failed to save stage output for ${stageName}:`, err)
    }
  }

  async function fetchJSON(url, options = {}) {
    console.log(`[DEBUG] Fetching: ${url}`);
    const response = await fetch(url, options);
    const text = await response.text();
    console.log(`[DEBUG] Response from ${url} (first 300 chars):`, text.substring(0, 300));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}: ${text.substring(0, 200)}`);
    }
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(`[ERROR] Failed to parse JSON from ${url}`);
      console.error(`[ERROR] Full response:`, text);
      throw new Error(`Invalid JSON from ${url}: ${e.message}\nFirst 500 chars: ${text.substring(0, 500)}`);
    }
  }

  async function readRawTranscript() {
    console.log('[Pipeline] Reading raw transcript from rawtranscript.txt...')
    const rawTranscriptPath = 'assets/data/transcripts/rawtranscript.txt'
    
    let rawTranscript = null
    let retries = 5
    while (retries > 0 && !rawTranscript) {
      const response = await fetch(rawTranscriptPath + '?_=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      })
      
      if (response.ok) {
        rawTranscript = await response.text()
        break
      }
      
      retries--
      if (retries > 0) {
        console.log(`Raw transcript file not found, retrying... (${retries} attempts left)`)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    if (!rawTranscript) {
      throw new Error('Raw transcript file not found at: ' + rawTranscriptPath + '. Please paste a transcript first using the Paste Transcript button.')
    }
    
    if (!rawTranscript || rawTranscript.trim().length === 0) {
      throw new Error('Raw transcript file is empty')
    }
    
    console.log(`[Pipeline] Raw transcript loaded, length: ${rawTranscript.length}`)
    return rawTranscript
  }

  async function removeTimestamps() {
    console.log('[Pipeline] Step 1: Removing timestamps from raw transcript...')
    const data = await fetchJSON('assets/php/remove_timestamps.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error during timestamp removal')
    }
    
    console.log(`[Pipeline] Step 1 complete: sanstimestamps.txt saved, length: ${data.cleaned_length}`)
    return data
  }

  async function readSanstimestamps() {
    console.log('[Pipeline] Verifying sanstimestamps.txt exists with disfluencies...')
    const data = await fetchJSON('assets/php/read_sanstimestamps.php')
    
    if (!data.success || !data.content || data.content.trim().length === 0) {
      throw new Error('sanstimestamps.txt file is empty or missing - timestamp removal failed')
    }
    
    console.log(`[Pipeline] sanstimestamps.txt verified, length: ${data.length} (still has disfluencies)`)
    return data.content
  }

  async function cleanDisfluencies() {
    console.log('[Pipeline] Step 2: Cleaning disfluencies via disfluencies.py...')
    const data = await fetchJSON('assets/php/clean_disfluencies.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error during disfluency cleaning')
    }
    
    console.log(`[Pipeline] Step 2 complete: sansdisfluencies.txt saved, length: ${data.cleaned_length}`)
    return data
  }

  async function readSansdisfluencies() {
    console.log('[Pipeline] Verifying sansdisfluencies.txt exists...')
    const path = 'assets/data/transcripts/sansdisfluencies.txt'
    
    let content = null
    let retries = 5
    while (retries > 0 && !content) {
      const response = await fetch(path + '?_=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      })
      
      if (response.ok) {
        content = await response.text()
        break
      }
      
      retries--
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    if (!content) {
      throw new Error('sansdisfluencies.txt not found')
    }
    
    console.log(`[Pipeline] sansdisfluencies.txt verified, length: ${content.length} (disfluencies removed)`)
    return content
  }

  async function formatText() {
    console.log('[Pipeline] Step 3: Formatting text via textformat.py...')
    const data = await fetchJSON('assets/php/format_text.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error during text formatting')
    }
    
    console.log(`[Pipeline] Step 3 complete: formattedtext.txt saved, length: ${data.formatted_length}`)
    return data
  }

  async function readFormattedText() {
    console.log('[Pipeline] Verifying formattedtext.txt exists...')
    const data = await fetchJSON('assets/php/read_formatted_text.php')
    
    if (!data.success || !data.content || data.content.trim().length === 0) {
      throw new Error('formattedtext.txt file is empty or missing')
    }
    
    console.log(`[Pipeline] formattedtext.txt verified, length: ${data.length}`)
    return data.content
  }

  async function performSegmentationWithPolling() {
    console.log('[Pipeline] Step 4: Starting speaker segmentation (background)...')
    
    const startData = await fetchJSON('assets/php/segment_transcript.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!startData.success) {
      throw new Error(startData.error || 'Failed to start segmentation')
    }
    
    if (startData.already_running) {
      console.log('[Pipeline] Segmentation already running, waiting for completion...')
    } else {
      console.log(`[Pipeline] Segmentation started in background (PID: ${startData.pid})`)
    }
    
    let attempts = 0
    const maxAttempts = 180
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      try {
        const statusData = await fetchJSON('assets/php/check_segmentation_status.php')
        
        if (statusData.completed) {
          console.log(`[Pipeline] Step 4 complete: segmentedtext.txt saved, size: ${statusData.output_size}`)
          return statusData.output_content
        }
        
        if (statusData.error) {
          throw new Error(`Segmentation error: ${statusData.error}\nLog: ${statusData.log_tail || 'No log available'}`)
        }
        
        if (!statusData.running && !statusData.completed) {
          throw new Error('Segmentation process stopped unexpectedly')
        }
      } catch (e) {
        console.error('[Pipeline] Error checking segmentation status:', e);
        throw e;
      }
      
      attempts++
      if (attempts % 6 === 0) {
        console.log(`[Pipeline] Still waiting for segmentation... (${Math.round(attempts * 10 / 60)} minutes)`)
      }
    }
    
    throw new Error('Segmentation timed out after 30 minutes')
  }

  async function readSegmentedText() {
    console.log('[Pipeline] Verifying segmentedtext.txt exists...')
    const data = await fetchJSON('assets/php/read_segmented_text.php')
    
    if (!data.success || !data.content || data.content.trim().length === 0) {
      throw new Error('Segmented text file is empty or missing - run segmentation first')
    }
    
    console.log(`[Pipeline] segmentedtext.txt verified, length: ${data.length}`)
    return data.content
  }

  async function saveSegmentedText(segmentText) {
    console.log('[Pipeline] Saving segmented text backup...')
    const data = await fetchJSON('assets/php/save_segmented_text.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: segmentText })
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error saving segmented text')
    }
    
    console.log(`[Pipeline] Segmented text backup saved. Size: ${data.size}`)
    return data
  }

  // NEW: Python stage 1 - remove extra whitespace
  async function removeExtraWhitespace() {
    console.log('[Pipeline] Stage 5: Removing extra whitespace via remove_extra_labels.py...')
    const data = await fetchJSON('assets/php/run_remove_extra_labels.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to remove extra whitespace')
    }
    
    console.log(`[Pipeline] Stage 5 complete: sansextrasegments.txt saved`)
    return data
  }

  // NEW: Python stage 2 - format paragraphs with LLM
  async function formatParagraphs() {
    console.log('[Pipeline] Stage 6: Formatting paragraphs via format_paragraphs.py...')
    const data = await fetchJSON('assets/php/run_format_paragraphs.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to format paragraphs')
    }
    
    console.log(`[Pipeline] Stage 6 complete: formattedparagraphs.txt saved`)
    return data
  }

  // NEW: Python stage 3 - clean LLM artifacts
  async function cleanLLMArtifacts() {
    console.log('[Pipeline] Stage 7: Cleaning LLM artifacts via clean_artifacts.py...')
    const data = await fetchJSON('assets/php/run_clean_artifacts.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to clean LLM artifacts')
    }
    
    console.log(`[Pipeline] Stage 7 complete: cleaned_output.txt saved`)
    return data
  }

  async function readFinalOutput() {
    console.log('[Pipeline] Reading final cleaned output...')
    const path = 'assets/data/transcripts/cleaned_output.txt'
    
    let content = null
    let retries = 5
    while (retries > 0 && !content) {
      const response = await fetch(path + '?_=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      })
      
      if (response.ok) {
        content = await response.text()
        break
      }
      
      retries--
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    if (!content) {
      throw new Error('cleaned_output.txt not found')
    }
    
    console.log(`[Pipeline] Final output length: ${content.length}`)
    return content
  }

  async function processtranscript() {
    console.log('[Pipeline] ==========================================')
    console.log('[Pipeline] Starting FULL transcript processing pipeline')
    console.log('[Pipeline] ==========================================')
    
    try {
      // Step 1: Verify raw transcript exists
      await readRawTranscript()
      
      // Step 2: Remove timestamps -> sanstimestamps.txt
      await removeTimestamps()
      
      // Step 3: Verify sanstimestamps.txt
      await readSanstimestamps()
      
      // Step 4: Clean disfluencies -> sansdisfluencies.txt
      await cleanDisfluencies()
      
      // Step 5: Verify sansdisfluencies.txt
      await readSansdisfluencies()
      
      // Step 6: Format text -> formattedtext.txt
      await formatText()
      
      // Step 7: Verify formattedtext.txt
      await readFormattedText()
      
      // Step 8: Run speaker segmentation -> segmentedtext.txt
      await performSegmentationWithPolling()
      
      // Step 9: Verify segmentedtext.txt
      await readSegmentedText()
      
      // Step 10: Remove extra whitespace (regex) -> sansextrasegments.txt
      await removeExtraWhitespace()
      
      // Step 11: Format paragraphs (LLM) -> formattedparagraphs.txt
      await formatParagraphs()
      
      // Step 12: Clean LLM artifacts (regex) -> cleaned_output.txt
      await cleanLLMArtifacts()
      
      // Step 13: Read final output
      const finalOutput = await readFinalOutput()
      
      console.log(`[Pipeline] ==========================================`)
      console.log(`[Pipeline] All pipeline stages completed, final output length: ${finalOutput.length}`)
      console.log(`[Pipeline] ==========================================`)
      return finalOutput
      
    } catch (error) {
      console.error('[Pipeline] ERROR:', error)
      throw error
    }
  }

  return { processtranscript }
})()