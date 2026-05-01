// assets/js/processtranscript.js
const transcriptmodule = (function () {
  let internalstate = {}
  let currentStage = ''
  let stageStartTime = 0

  class StageError extends Error {
    constructor(stage, reason, details = {}) {
      super(`Stage ${stage} failed: ${reason}`)
      this.name = 'StageError'
      this.stage = stage
      this.reason = reason
      this.details = details
    }
  }

  async function callOllama(model, systemPrompt, userPrompt, temperature = 0.0, maxTokens = 8192) {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
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
    if (!response.ok) throw new Error(`Model error: ${response.status}`)
    const data = await response.json()
    if (!data.message || !data.message.content) throw new Error('Empty response')
    return data.message.content
  }

  // Deterministic timestamp removal – removes lines that contain ONLY a timestamp
  function removeTimestampLines(text) {
    const lines = text.split(/\r?\n/)
    const filtered = []
    const timestampPattern = /^\s*(\d+:\d+(?::\d+)?|\d+\s+seconds?|\d+\s+minutes?\s*(?:,?\s*\d+\s+seconds?)?)\s*$/i
    for (let line of lines) {
      if (timestampPattern.test(line.trim())) continue
      filtered.push(line)
    }
    return filtered.join('\n')
  }

  async function executeStage(stage, input) {
    currentStage = stage.name
    stageStartTime = Date.now()
    const statusDiv = document.getElementById('status')
    if (statusDiv) {
      statusDiv.textContent = `Stage: ${stage.name} → using ${stage.model}`
    }
    console.log(`[${new Date().toISOString()}] Stage: ${stage.name}`)
    console.log(`[${new Date().toISOString()}] Input length: ${input.length} chars`)
    
    const temperature = stage.temperature ?? 0.0
    const maxTokens = stage.max_tokens ?? 8192
    
    try {
      const userPrompt = stage.user_prompt_template.replace('{input}', input)
      const output = await callOllama(stage.model, stage.system_prompt, userPrompt, temperature, maxTokens)
      const elapsed = ((Date.now() - stageStartTime) / 1000).toFixed(1)
      console.log(`[${new Date().toISOString()}] Stage ${stage.name} completed in ${elapsed}s, output length: ${output.length}`)
      if (!output || output.trim().length === 0) throw new Error('Empty response')
      return output
    } catch (error) {
      const elapsed = ((Date.now() - stageStartTime) / 1000).toFixed(1)
      console.log(`[${new Date().toISOString()}] Stage ${stage.name} FAILED: ${error.message}`)
      if (statusDiv) statusDiv.textContent = `Stage ${stage.name} failed: ${error.message}`
      throw new StageError(stage.name, error.message, { elapsed })
    }
  }

  async function saveDebugOutput(stageName, output) {
    try {
      await fetch('assets/php/save_debug.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: stageName,
          output: output,
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error(`Failed to save debug output:`, error)
    }
  }

  async function saveTranscriptOutput(output) {
    try {
      await fetch('assets/php/save_transcript_output.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output: output })
      })
    } catch (error) {
      console.error(`Failed to save transcript output:`, error)
    }
  }

  async function loadPipelineConfig() {
    const response = await fetch('assets/yaml/transcript.yaml?_=' + Date.now())
    const yamlText = await response.text()
    
    // Parse YAML list of stages
    const config = { stages: [] }
    const lines = yamlText.split('\n')
    let inStages = false
    let currentStage = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() === 'stages:') {
        inStages = true
        continue
      }
      if (inStages && line.match(/^\s{4}-\s+name:/)) {
        if (currentStage) config.stages.push(currentStage)
        currentStage = {}
        const nameMatch = line.match(/name:\s*"([^"]+)"/)
        if (nameMatch) currentStage.name = nameMatch[1]
        continue
      }
      if (currentStage && line.match(/^\s{6}(\w+):\s*(.*)/)) {
        const match = line.match(/^\s{6}(\w+):\s*(.*)/)
        if (match) {
          let value = match[2].trim()
          if (value === 'true') value = true
          else if (value === 'false') value = false
          else if (value.match(/^".*"$/)) value = value.slice(1, -1).replace(/\\n/g, '\n')
          else if (value.match(/^\d+$/)) value = parseInt(value, 10)
          else if (value.match(/^\d+\.\d+$/)) value = parseFloat(value)
          currentStage[match[1]] = value
        }
      }
      // End of stages when next top-level key appears
      if (inStages && line.length > 0 && line[0] !== ' ' && line[0] !== '-' && line.trim() !== 'stages:' && line.trim() !== '') {
        inStages = false
        if (currentStage) {
          config.stages.push(currentStage)
          currentStage = null
        }
      }
    }
    if (currentStage) config.stages.push(currentStage)
    
    return config
  }

  async function processtranscript(input) {
    if (!input || input.trim().length === 0) {
      throw new StageError('input', 'Empty transcript provided')
    }
    console.log(`[${new Date().toISOString()}] Pipeline started`)
    await saveDebugOutput('input_raw', input)

    // Deterministic timestamp removal
    let currentOutput = removeTimestampLines(input)
    console.log(`[${new Date().toISOString()}] Removed timestamp lines, length: ${currentOutput.length}`)
    await saveDebugOutput('after_timestamp_removal', currentOutput)

    const config = await loadPipelineConfig()
    if (!config.stages || config.stages.length === 0) {
      throw new StageError('pipeline', 'No stages defined')
    }
    
    for (const stage of config.stages) {
      if (!stage.enabled) {
        console.log(`Stage ${stage.name} disabled, skipping`)
        continue
      }
      console.log(`Running stage: ${stage.name}`)
      try {
        currentOutput = await executeStage(stage, currentOutput)
        await saveDebugOutput(stage.name, currentOutput)
      } catch (error) {
        if (error instanceof StageError) throw error
        throw new StageError(stage.name, error.message)
      }
    }

    await saveTranscriptOutput(currentOutput)
    await saveDebugOutput('final_output', currentOutput)
    console.log(`Pipeline completed`)
    return currentOutput
  }

  return { processtranscript }
})()