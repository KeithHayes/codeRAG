// assets/js/processtranscript.js
// Browser‑based transcript processor – calls Ollama directly

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

  async function formatText() {
    console.log('[Pipeline] Formatting text via textformat.py')
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
    
    console.log(`[Pipeline] Text formatting complete. Length: ${data.formatted_length}`)
    return data
  }

  async function readFormattedText() {
    console.log('[Pipeline] Reading formatted text...')
    const response = await fetch('assets/php/read_formatted_text.php')
    
    if (!response.ok) {
      throw new Error(`Failed to read formatted text: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.success || !data.content || data.content.trim().length === 0) {
      throw new Error('Formatted text file is empty or missing')
    }
    
    console.log(`[Pipeline] Loaded formatted text, length: ${data.length}`)
    return data.content
  }

  function applyRegexStage(stage, input) {
    const flags = stage.flags || 'g'
    const regex = new RegExp(stage.pattern, flags)
    return input.replace(regex, stage.replacement || '')
  }

  async function executeStage(stage, input) {
    const stageName = stage.name
    console.log(`[${new Date().toISOString()}] Stage: ${stageName} (${stage.type})`)
    const start = Date.now()
    try {
      let output
      if (stage.type === 'regex') {
        output = applyRegexStage(stage, input)
      } else if (stage.type === 'llm') {
        const userPrompt = stage.user_prompt_template.replace(/\{input\}/g, input)
        output = await callOllama(
          stage.model,
          stage.system_prompt,
          userPrompt,
          stage.temperature ?? 0.0,
          stage.max_tokens ?? 8192
        )
      } else {
        throw new Error(`Unknown stage type: ${stage.type}`)
      }
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`[${new Date().toISOString()}] Stage ${stageName} done in ${elapsed}s`)

      await saveStageOutput(stageName, output)

      return output
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Stage ${stageName} FAILED:`, err)
      if (stage.type === 'llm' && stage.fallback_regex) {
        console.log(`[${new Date().toISOString()}] Falling back to regex for ${stageName}`)
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
      throw err
    }
  }

  async function loadPipelineConfig() {
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
    
    if (config.stages.length === 0) throw new Error('No stages found in YAML')
    return config.stages
  }

  async function processtranscript(cleanedTranscript) {
    console.log('[Pipeline] Starting text formatting step...')
    
    await formatText()
    
    const transcriptToProcess = await readFormattedText()
    
    if (!transcriptToProcess || transcriptToProcess.trim().length === 0) {
      throw new Error('Formatted text is empty - formatting failed')
    }
    
    console.log(`[Pipeline] Processing transcript, input length: ${transcriptToProcess.length}`)
    
    const stages = await loadPipelineConfig()
    let current = transcriptToProcess
    for (const stage of stages) {
      if (stage.enabled === false) continue
      current = await executeStage(stage, current)
    }
    console.log(`[Pipeline] Completed, output length: ${current.length}`)
    return current
  }

  return { processtranscript }
})()