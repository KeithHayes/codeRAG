// assets/js/processinterview.js
(function() {
  'use strict';

  console.log('[processinterview.js] Loading module...');

  async function fetchJSON(url, options = {}) {
    console.log(`[Pipeline DEBUG] Fetching: ${url}`);
    const response = await fetch(url, options);
    const text = await response.text();
    console.log(`[Pipeline DEBUG] Response from ${url} (first 300 chars):`, text.substring(0, 300));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}: ${text.substring(0, 200)}`);
    }
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(`[Pipeline ERROR] Failed to parse JSON from ${url}`);
      console.error(`[Pipeline ERROR] Full response:`, text);
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

  async function stage1RemoveTimestamps() {
    console.log('[Pipeline] Stage 1: Removing timestamps via run_remove_timestamps.php...')
    const data = await fetchJSON('assets/php/run_remove_timestamps.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to remove timestamps')
    }
    
    console.log(`[Pipeline] Stage 1 complete: sanstimestamps.txt saved, length: ${data.cleaned_length}`)
    return data
  }

  async function stage2CleanDisfluencies() {
    console.log('[Pipeline] Stage 2: Cleaning disfluencies via run_clean_disfluencies.php...')
    const data = await fetchJSON('assets/php/run_clean_disfluencies.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to clean disfluencies')
    }
    
    console.log(`[Pipeline] Stage 2 complete: sansdisfluencies.txt saved, length: ${data.cleaned_length}`)
    return data
  }

  async function stage3FormatText() {
    console.log('[Pipeline] Stage 3: Formatting text via run_format_text.php...')
    const data = await fetchJSON('assets/php/run_format_text.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to format text')
    }
    
    console.log(`[Pipeline] Stage 3 complete: formattedtext.txt saved, length: ${data.formatted_length}`)
    return data
  }

  async function stage4SegmentTranscript() {
    console.log('[Pipeline] Stage 4: Starting speaker segmentation (background)...')
    
    const startData = await fetchJSON('assets/php/run_segment_transcript.php', {
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
          console.log(`[Pipeline] Stage 4 complete: segmentedtext.txt saved, size: ${statusData.output_size}`)
          return statusData
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

  async function stage5RemoveExtraLabels() {
    console.log('[Pipeline] Stage 5: Removing extra labels via run_remove_extra_labels.php...')
    const data = await fetchJSON('assets/php/run_remove_extra_labels.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to remove extra labels')
    }
    
    console.log(`[Pipeline] Stage 5 complete: sansextrasegments.txt saved`)
    return data
  }

  async function stage6IdentifySpeakers() {
    console.log('[Pipeline] Stage 6: Identifying speakers via run_identify_speakers.php...')
    const data = await fetchJSON('assets/php/run_identify_speakers.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to identify speakers')
    }
    
    console.log(`[Pipeline] Stage 6 complete: identified_speakers.txt saved, length: ${data.output_length}`)
    return data
  }

  async function stage7FormatParagraphs() {
    console.log('[Pipeline] Stage 7: Formatting paragraphs via run_format_paragraphs.php...')
    const data = await fetchJSON('assets/php/run_format_paragraphs.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to format paragraphs')
    }
    
    console.log(`[Pipeline] Stage 7 complete: formattedparagraphs.txt saved`)
    return data
  }

  async function stage8CleanArtifacts() {
    console.log('[Pipeline] Stage 8: Cleaning LLM artifacts via run_clean_artifacts.php...')
    const data = await fetchJSON('assets/php/run_clean_artifacts.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to clean LLM artifacts')
    }
    
    console.log(`[Pipeline] Stage 8 complete: cleanedoutput.txt saved`)
    return data
  }

  async function readFinalOutput() {
    console.log('[Pipeline] Reading final cleaned output...')
    const path = 'assets/data/transcripts/cleanedoutput.txt'
    
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
      throw new Error('cleanedoutput.txt not found')
    }
    
    console.log(`[Pipeline] Final output length: ${content.length}`)
    return content
  }

  async function processinterview() {
    console.log('[Pipeline] ==========================================')
    console.log('[Pipeline] Starting FULL transcript processing pipeline')
    console.log('[Pipeline] ==========================================')
    
    try {
      await stage1RemoveTimestamps()
      
      await stage2CleanDisfluencies()
      
      await stage3FormatText()
      
      await stage4SegmentTranscript()
      
      await stage5RemoveExtraLabels()

      await stage6IdentifySpeakers()
      
      await stage7FormatParagraphs()
      
      await stage8CleanArtifacts()
      
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

  window.interviewmodule = { 
    processinterview: processinterview
  }
  
  console.log('[processinterview.js] Module loaded successfully, window.interviewmodule is now defined')
})();