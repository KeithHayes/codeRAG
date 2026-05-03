// assets/js/processtranscript.js - Complete pipeline processor with better error handling

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
    const response = await fetch('assets/php/remove_timestamps.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!response.ok) {
      throw new Error(`Timestamp removal failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error during timestamp removal')
    }
    
    console.log(`[Pipeline] Step 1 complete: sanstimestamps.txt saved, length: ${data.cleaned_length}`)
    return data
  }

  async function readSanstimestamps() {
    console.log('[Pipeline] Verifying sanstimestamps.txt exists with disfluencies...')
    const response = await fetch('assets/php/read_sanstimestamps.php')
    
    if (!response.ok) {
      throw new Error(`Failed to read sanstimestamps: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.success || !data.content || data.content.trim().length === 0) {
      throw new Error('sanstimestamps.txt file is empty or missing - timestamp removal failed')
    }
    
    console.log(`[Pipeline] sanstimestamps.txt verified, length: ${data.length} (still has disfluencies)`)
    return data.content
  }

  async function cleanDisfluencies() {
    console.log('[Pipeline] Step 2: Cleaning disfluencies via disfluencies.py...')
    const response = await fetch('assets/php/clean_disfluencies.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(600000)
    })
    
    if (!response.ok) {
      throw new Error(`Clean disfluencies failed with status: ${response.status}`)
    }
    
    const data = await response.json()
    
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
    const response = await fetch('assets/php/format_text.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(600000)
    })
    
    if (!response.ok) {
      throw new Error(`Format text failed with status: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error during text formatting')
    }
    
    console.log(`[Pipeline] Step 3 complete: formattedtext.txt saved, length: ${data.formatted_length}`)
    return data
  }

  async function readFormattedText() {
    console.log('[Pipeline] Verifying formattedtext.txt exists...')
    const response = await fetch('assets/php/read_formatted_text.php')
    
    if (!response.ok) {
      throw new Error(`Failed to read formatted text: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.success || !data.content || data.content.trim().length === 0) {
      throw new Error('formattedtext.txt file is empty or missing')
    }
    
    console.log(`[Pipeline] formattedtext.txt verified, length: ${data.length}`)
    return data.content
  }

  async function performDiarizationWithPolling() {
    console.log('[Pipeline] Step 4: Starting speaker diarization (background)...')
    
    const startResponse = await fetch('assets/php/diarize_transcript.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!startResponse.ok) {
      throw new Error(`Failed to start diarization: ${startResponse.status}`)
    }
    
    const startData = await startResponse.json()
    
    if (!startData.success) {
      throw new Error(startData.error || 'Failed to start diarization')
    }
    
    if (startData.already_running) {
      console.log('[Pipeline] Diarization already running, waiting for completion...')
    } else {
      console.log(`[Pipeline] Diarization started in background (PID: ${startData.pid})`)
    }
    
    let attempts = 0
    const maxAttempts = 180
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      const statusResponse = await fetch('assets/php/check_diarization_status.php')
      const statusData = await statusResponse.json()
      
      if (statusData.completed) {
        console.log(`[Pipeline] Step 4 complete: diarizatedtext.txt saved, size: ${statusData.output_size}`)
        return statusData.output_content
      }
      
      if (statusData.error) {
        throw new Error(`Diarization error: ${statusData.error}\nLog: ${statusData.log_tail || 'No log available'}`)
      }
      
      if (!statusData.running && !statusData.completed) {
        throw new Error('Diarization process stopped unexpectedly')
      }
      
      attempts++
      if (attempts % 6 === 0) {
        console.log(`[Pipeline] Still waiting for diarization... (${Math.round(attempts * 10 / 60)} minutes)`)
      }
    }
    
    throw new Error('Diarization timed out after 30 minutes')
  }

  async function readDiarizedText() {
    console.log('[Pipeline] Verifying diarizatedtext.txt exists...')
    const response = await fetch('assets/php/read_diarized_text.php')
    
    if (!response.ok) {
      throw new Error(`Failed to read diarized text: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.success || !data.content || data.content.trim().length === 0) {
      throw new Error('Diarized text file is empty or missing - run diarization first')
    }
    
    console.log(`[Pipeline] diarizatedtext.txt verified, length: ${data.length}`)
    return data.content
  }

  async function saveDiarizatedText(diarizedText) {
    console.log('[Pipeline] Saving diarized text backup...')
    const response = await fetch('assets/php/save_diarizatedtext.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: diarizedText })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to save diarized text: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error saving diarized text')
    }
    
    console.log(`[Pipeline] Diarized text backup saved. Size: ${data.size}`)
    return data
  }

  function applyRegexStage(stage, input) {
    const flags = stage.flags || 'g'
    const regex = new RegExp(stage.pattern, flags)
    return input.replace(regex, stage.replacement || '')
  }

  async function executeStage(stage, input, stageIndex) {
    const stageName = stage.name
    console.log(`[${new Date().toISOString()}] Stage ${stageIndex + 1}: ${stageName} (${stage.type})`)
    const start = Date.now()
    try {
      let output
      if (stage.type === 'regex') {
        output = applyRegexStage(stage, input)
        console.log(`[Stage ${stageName}] Regex applied, output length: ${output.length}`)
      } else if (stage.type === 'llm') {
        const userPrompt = stage.user_prompt_template.replace(/\{input\}/g, input)
        console.log(`[Stage ${stageName}] Calling Ollama with model: ${stage.model}`)
        output = await callOllama(
          stage.model,
          stage.system_prompt,
          userPrompt,
          stage.temperature ?? 0.0,
          stage.max_tokens ?? 8192
        )
        console.log(`[Stage ${stageName}] LLM response length: ${output.length}`)
      } else {
        throw new Error(`Unknown stage type: ${stage.type}`)
      }
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`[Stage ${stageName}] Completed in ${elapsed}s`)

      await saveStageOutput(stageName, output)

      return output
    } catch (err) {
      console.error(`[Stage ${stageName}] FAILED:`, err.message)
      if (stage.type === 'llm' && stage.fallback_regex) {
        console.log(`[Stage ${stageName}] Falling back to regex`)
        const fallbackStage = {
          type: 'regex',
          pattern: stage.fallback_regex,
          replacement: stage.fallback_replacement || '',
          flags: stage.flags || 'g'
        }
        const fallbackOutput = applyRegexStage(fallbackStage, input)
        await saveStageOutput(stageName + '_fallback', fallbackOutput)
        return fallbackOutput
      }
      throw new Error(`Stage ${stageName} failed: ${err.message}`)
    }
  }

  async function loadPipelineConfig() {
    console.log('[Pipeline] Loading transcript.yaml configuration...')
    const response = await fetch('assets/yaml/transcript.yaml?_=' + Date.now())
    if (!response.ok) throw new Error(`Failed to load YAML: ${response.status}`)
    const yamlText = await response.text()
    
    const config = { stages: [] }
    const lines = yamlText.split('\n')
    let inStages = false
    let currentStage = null
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      const trimmed = line.trim()
      
      if (trimmed === 'stages:') {
        inStages = true
        continue
      }
      if (!inStages) continue
      
      const dashMatch = line.match(/^\s{2}-\s+name:\s*['"]([^'"]+)['"]/)
      if (dashMatch) {
        if (currentStage) config.stages.push(currentStage)
        currentStage = { name: dashMatch[1] }
        continue
      }
      
      if (currentStage && trimmed !== '' && !trimmed.startsWith('-')) {
        const kvMatch = line.match(/^\s{4}(\w+):\s*(.*)/)
        if (kvMatch) {
          let key = kvMatch[1]
          let value = kvMatch[2].trim()
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1).replace(/\\n/g, '\n')
          } else if (value === 'true') value = true
          else if (value === 'false') value = false
          else if (!isNaN(parseFloat(value)) && isFinite(value)) value = parseFloat(value)
          currentStage[key] = value
        }
      }
      
      if (line.length > 0 && line[0] !== ' ' && line[0] !== '-' && trimmed !== 'stages:' && trimmed !== '') {
        inStages = false
        if (currentStage) {
          config.stages.push(currentStage)
          currentStage = null
        }
      }
    }
    if (currentStage) config.stages.push(currentStage)
    
    console.log(`[Pipeline] Loaded ${config.stages.length} stages from YAML`)
    config.stages.forEach((stage, i) => {
      console.log(`  Stage ${i + 1}: ${stage.name} (${stage.type}) - enabled: ${stage.enabled !== false}`)
    })
    
    if (config.stages.length === 0) throw new Error('No stages found in YAML')
    return config.stages
  }

  async function processtranscript() {
    console.log('[Pipeline] ==========================================')
    console.log('[Pipeline] Starting FULL transcript processing pipeline')
    console.log('[Pipeline] ==========================================')
    
    try {
      // Step 1: Verify raw transcript exists (saved by Paste Transcript button)
      await readRawTranscript()
      
      // Step 2: Remove timestamps -> saves to sanstimestamps.txt
      await removeTimestamps()
      
      // Step 3: Verify sanstimestamps.txt (should have disfluencies)
      await readSanstimestamps()
      
      // Step 4: Clean disfluencies -> saves to sansdisfluencies.txt
      await cleanDisfluencies()
      
      // Step 5: Verify sansdisfluencies.txt (should have no disfluencies)
      await readSansdisfluencies()
      
      // Step 6: Format text -> saves to formattedtext.txt
      await formatText()
      
      // Step 7: Verify formattedtext.txt
      await readFormattedText()
      
      // Step 8: Run speaker diarization -> saves to diarizatedtext.txt
      await performDiarizationWithPolling()
      
      // Step 9: Verify diarizatedtext.txt
      const diarizedText = await readDiarizedText()
      await saveDiarizatedText(diarizedText)
      
      // Step 10: Load and run YAML pipeline stages
      console.log(`[Pipeline] Step 5: Loading pipeline stages from transcript.yaml`)
      const stages = await loadPipelineConfig()
      
      let current = diarizedText
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i]
        if (stage.enabled === false) {
          console.log(`[Pipeline] Skipping disabled stage: ${stage.name}`)
          continue
        }
        current = await executeStage(stage, current, i)
      }
      
      console.log(`[Pipeline] ==========================================`)
      console.log(`[Pipeline] All pipeline stages completed, final output length: ${current.length}`)
      console.log(`[Pipeline] ==========================================`)
      return current
      
    } catch (error) {
      console.error('[Pipeline] ERROR:', error)
      throw error
    }
  }

  return { processtranscript }
})()