// assets/js/processtranscript.js
const transcriptmodule = (function () {
  let internalstate = {}
  let currentStage = ''
  let stageStartTime = 0
  let completedOutputs = {}
  let stageMetadata = {}

  class StageError extends Error {
    constructor(stage, reason, details = {}) {
      super(`Stage ${stage} failed: ${reason}`)
      this.name = 'StageError'
      this.stage = stage
      this.reason = reason
      this.details = details
    }
  }

  // No timestamp removal – keep all lines including spoken timestamps
  function keepAllLines(rawText) {
    return rawText
  }

  async function callOllama(model, systemPrompt, userPrompt, temperature = 0.1, maxTokens = 4096) {
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

  async function executeStage(stageName, stageConfig, input, metadata = {}) {
    currentStage = stageName
    stageStartTime = Date.now()
    const statusDiv = document.getElementById('status')
    if (statusDiv) {
      statusDiv.textContent = `Stage: ${stageName.toUpperCase()} → using ${stageConfig.model} (${input.length} chars)`
    }
    console.log(`[${new Date().toISOString()}] Stage: ${stageName.toUpperCase()} → ${stageConfig.model}`)
    console.log(`[${new Date().toISOString()}] Input preview: ${input.substring(0, 300)}`)
    
    const temperature = stageConfig.temperature ?? 0.1
    const maxTokens = stageConfig.max_tokens ?? 4096
    
    try {
      let systemPrompt = stageConfig.system_prompt
      let userPrompt = stageConfig.user_prompt_template.replace('{input}', input)
      if (metadata.type) {
        systemPrompt = systemPrompt.replace('{type}', metadata.type)
        userPrompt = userPrompt.replace('{type}', metadata.type)
      }
      if (metadata.speaker_info) {
        userPrompt = userPrompt.replace('{speaker_info}', metadata.speaker_info)
      }
      const output = await callOllama(stageConfig.model, systemPrompt, userPrompt, temperature, maxTokens)
      const elapsed = ((Date.now() - stageStartTime) / 1000).toFixed(1)
      console.log(`[${new Date().toISOString()}] Stage ${stageName.toUpperCase()} completed in ${elapsed}s`)
      if (!output || output.trim().length === 0) throw new Error('Empty response')
      return output
    } catch (error) {
      const elapsed = ((Date.now() - stageStartTime) / 1000).toFixed(1)
      let reason = error.message
      if (error.message.includes('Empty response')) reason = `empty after ${elapsed}s`
      else if (error.message.includes('not found')) reason = `model not found: ${stageConfig.model}`
      else if (error.message.includes('timeout')) reason = `timeout after ${elapsed}s`
      else if (error.message.includes('memory')) reason = 'out of memory'
      console.log(`[${new Date().toISOString()}] Stage ${stageName.toUpperCase()} → FAILED: ${reason}`)
      if (statusDiv) statusDiv.textContent = `Stage ${stageName.toUpperCase()} failed: ${reason}`
      throw new StageError(stageName, reason, { elapsed, inputLength: input.length })
    }
  }

  async function saveDebugOutput(stageName, output) {
    try {
      const response = await fetch('assets/php/save_debug.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: stageName,
          output: output,
          timestamp: new Date().toISOString()
        })
      })
      const data = await response.json()
      if (data.success) console.log(`Stage ${stageName} saved to: ${data.path}`)
    } catch (error) {
      console.error(`Failed to save debug output:`, error)
    }
  }

  async function saveTranscriptOutput(output) {
    try {
      const response = await fetch('assets/php/save_transcript_output.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output: output })
      })
      const data = await response.json()
      if (data.success) {
        console.log(`Transcript output saved to: ${data.path}`)
        const statusDiv = document.getElementById('status')
        if (statusDiv) statusDiv.textContent = `Output saved to: ${data.path}`
        return true
      }
      return false
    } catch (error) {
      console.error(`Failed to save transcript output:`, error)
      return false
    }
  }

  async function loadPipelineConfig() {
    const response = await fetch('assets/yaml/transcript.yaml?_=' + Date.now())
    const yamlText = await response.text()
    function parseYamlToConfig(yaml) {
      const lines = yaml.split('\n')
      const config = { stages: {}, global: {} }
      let currentSection = null
      let currentStage = null
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.match(/^pipeline:/)) { currentSection = 'pipeline'; continue }
        if (line.match(/^global:/)) { currentSection = 'global'; continue }
        if (currentSection === 'pipeline' && line.match(/^\s{2}stages:/)) continue
        if (currentSection === 'pipeline' && line.match(/^\s{4}(\w+):/)) {
          const match = line.match(/^\s{4}(\w+):/)
          if (match) {
            currentStage = match[1]
            config.stages[currentStage] = {}
          }
          continue
        }
        if (currentStage && line.match(/^\s{6}(\w+):\s*(.*)/)) {
          const match = line.match(/^\s{6}(\w+):\s*(.*)/)
          if (match) {
            let value = match[2].trim()
            if (value === 'true') value = true
            else if (value === 'false') value = false
            else if (value.match(/^".*"$/)) value = value.slice(1, -1)
            else if (value.match(/^\d+$/)) value = parseInt(value, 10)
            else if (value.match(/^\d+\.\d+$/)) value = parseFloat(value)
            config.stages[currentStage][match[1]] = value
          }
        }
        if (currentSection === 'global' && line.match(/^\s{2}(\w+):\s*(.*)/)) {
          const match = line.match(/^\s{2}(\w+):\s*(.*)/)
          if (match) {
            let value = match[2].trim()
            if (value === 'true') value = true
            else if (value === 'false') value = false
            else if (value.match(/^".*"$/)) value = value.slice(1, -1)
            else if (value.match(/^\d+$/)) value = parseInt(value, 10)
            else if (value.match(/^\d+\.\d+$/)) value = parseFloat(value)
            config.global[match[1]] = value
          }
        }
      }
      for (const stageName in config.stages) {
        const stage = config.stages[stageName]
        if (stage.temperature === undefined && config.global.default_temperature !== undefined)
          stage.temperature = config.global.default_temperature
        if (stage.max_tokens === undefined && config.global.default_max_tokens !== undefined)
          stage.max_tokens = config.global.default_max_tokens
        if (stage.model === undefined && config.global.default_model !== undefined)
          stage.model = config.global.default_model
      }
      return config
    }
    return parseYamlToConfig(yamlText)
  }

  async function processtranscript(input) {
    if (!input || input.trim().length === 0) {
      throw new StageError('input', 'Empty transcript provided')
    }
    console.log(`[${new Date().toISOString()}] Pipeline started, raw length: ${input.length}`)
    await saveDebugOutput('input_raw', input)

    // Keep all lines – timestamps are spoken content
    const keptInput = keepAllLines(input)
    console.log(`[${new Date().toISOString()}] Keeping all lines (no timestamp removal), length: ${keptInput.length}`)
    await saveDebugOutput('step1_keep_all_lines', keptInput)

    if (keptInput.length === 0) {
      throw new StageError('cleaning', 'No content after keeping all lines')
    }

    const config = await loadPipelineConfig()
    const enabledStages = Object.entries(config.stages)
      .filter(([_, stageConfig]) => stageConfig.enabled === true)
      .map(([name, stageConfig]) => ({ name, config: stageConfig }))

    if (enabledStages.length === 0) throw new StageError('pipeline', 'No enabled stages')

    let currentOutput = keptInput
    let metadataForNextStage = {}

    for (let i = 0; i < enabledStages.length; i++) {
      const stage = enabledStages[i]
      console.log(`[${new Date().toISOString()}] Running stage: ${stage.name}`)
      try {
        currentOutput = await executeStage(stage.name, stage.config, currentOutput, metadataForNextStage)
        await saveDebugOutput(stage.name, currentOutput)
      } catch (error) {
        if (error instanceof StageError) throw error
        throw error
      }
    }

    console.log(`[${new Date().toISOString()}] Pipeline completed`)
    internalstate.last = currentOutput
    internalstate.completedStages = enabledStages.map(s => s.name)
    
    // Save final output to regular transcript file
    await saveTranscriptOutput(currentOutput)
    
    // ADDITIONAL: Save final output to a diagnostic debug file
    await saveDebugOutput('final_output', currentOutput)
    
    return currentOutput
  }

  return { processtranscript }
})()