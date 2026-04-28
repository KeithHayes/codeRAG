// assets/js/processtranscript.js
const transcriptmodule = (function () {
  let internalstate = {}
  let currentStage = ''
  let stageStartTime = 0
  let completedOutputs = {}
  let stageMetadata = {} // Store outputs for later stages

  class StageError extends Error {
    constructor(stage, reason, details = {}) {
      super(`Stage ${stage} failed: ${reason}`)
      this.name = 'StageError'
      this.stage = stage
      this.reason = reason
      this.details = details
    }
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

    if (!response.ok) {
      throw new Error(`Model not found or API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.message || !data.message.content) {
      throw new Error('Empty response from model')
    }

    return data.message.content
  }

  async function executeStage(stageName, stageConfig, input, metadata = {}) {
    currentStage = stageName
    stageStartTime = Date.now()
    
    const statusDiv = document.getElementById('status')
    if (statusDiv) {
      const inputLength = input ? input.length : 0
      statusDiv.textContent = `Stage: ${stageName.toUpperCase()} → using ${stageConfig.model} (${inputLength} chars input)`
    }
    
    console.log(`[${new Date().toISOString()}] Stage: ${stageName.toUpperCase()} → using ${stageConfig.model} (${input ? input.length : 0} chars input)`)
    
    try {
      let systemPrompt = stageConfig.system_prompt
      let userPrompt = stageConfig.user_prompt_template.replace('{input}', input)
      
      // Replace metadata placeholders in system prompt and user prompt
      if (metadata.type) {
        systemPrompt = systemPrompt.replace('{type}', metadata.type)
        userPrompt = userPrompt.replace('{type}', metadata.type)
      }
      if (metadata.speaker_info) {
        userPrompt = userPrompt.replace('{speaker_info}', metadata.speaker_info)
      } else if (metadata) {
        const speakerInfo = JSON.stringify(metadata)
        userPrompt = userPrompt.replace('{speaker_info}', speakerInfo)
      }
      
      const output = await callOllama(
        stageConfig.model,
        systemPrompt,
        userPrompt,
        0.1,
        4096
      )
      
      const elapsed = ((Date.now() - stageStartTime) / 1000).toFixed(1)
      console.log(`[${new Date().toISOString()}] Stage ${stageName.toUpperCase()} completed in ${elapsed}s`)
      
      if (!output || output.trim().length === 0) {
        throw new Error('Empty response')
      }
      
      return output
    } catch (error) {
      const elapsed = ((Date.now() - stageStartTime) / 1000).toFixed(1)
      
      let reason = error.message
      if (error.message.includes('Empty response')) {
        reason = `empty response after ${elapsed}s`
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        reason = `model not found: ${stageConfig.model}`
      } else if (error.message.includes('timeout')) {
        reason = `timeout after ${elapsed}s`
      } else if (error.message.includes('memory')) {
        reason = `out of memory`
      } else if (error.message.includes('JSON')) {
        reason = `malformed output`
      }
      
      console.log(`[${new Date().toISOString()}] Stage ${stageName.toUpperCase()} → FAILED: ${reason}`)
      
      if (statusDiv) {
        statusDiv.textContent = `Stage ${stageName.toUpperCase()} failed: ${reason}`
      }
      
      throw new StageError(stageName, reason, { elapsed, inputLength: input ? input.length : 0 })
    }
  }

  async function saveDebugOutput(stageName, output) {
    try {
      const debugDir = 'assets/data/debug'
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
      if (data.success) {
        console.log(`Stage ${stageName} output saved to: ${data.path}`)
        const statusDiv = document.getElementById('status')
        if (statusDiv) {
          statusDiv.textContent = `Stage ${stageName} output saved to: ${data.path}`
        }
      }
    } catch (error) {
      console.error(`Failed to save debug output for stage ${stageName}:`, error)
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
        if (statusDiv) {
          statusDiv.textContent = `Transcript output saved to: ${data.path}`
        }
        return true
      } else {
        console.error(`Failed to save transcript output: ${data.error}`)
        return false
      }
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
        
        if (line.match(/^pipeline:/)) {
          currentSection = 'pipeline'
          continue
        }
        
        if (line.match(/^global:/)) {
          currentSection = 'global'
          continue
        }
        
        if (currentSection === 'pipeline' && line.match(/^\s{2}stages:/)) {
          continue
        }
        
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
            const key = match[1]
            let value = match[2].trim()
            
            if (value === 'true') {
              value = true
            } else if (value === 'false') {
              value = false
            } else if (value.match(/^".*"$/)) {
              value = value.slice(1, -1)
            } else if (value.match(/^\d+$/)) {
              value = parseInt(value, 10)
            } else if (value.match(/^\d+\.\d+$/)) {
              value = parseFloat(value)
            }
            
            config.stages[currentStage][key] = value
          }
        }
        
        if (currentSection === 'global' && line.match(/^\s{2}(\w+):\s*(.*)/)) {
          const match = line.match(/^\s{2}(\w+):\s*(.*)/)
          if (match) {
            const key = match[1]
            let value = match[2].trim()
            
            if (value === 'true') {
              value = true
            } else if (value === 'false') {
              value = false
            } else if (value.match(/^".*"$/)) {
              value = value.slice(1, -1)
            } else if (value.match(/^\d+$/)) {
              value = parseInt(value, 10)
            } else if (value.match(/^\d+\.\d+$/)) {
              value = parseFloat(value)
            }
            
            config.global[key] = value
          }
        }
      }
      
      return config
    }
    
    return parseYamlToConfig(yamlText)
  }

  // Helper to parse JSON from LLM output, handling possible extra text
  function parseJsonFromOutput(output) {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return null
    } catch (e) {
      console.error('Failed to parse JSON from detection stage:', e)
      return null
    }
  }

  async function processtranscript(input) {
    if (!input || input.trim().length === 0) {
      throw new StageError('input', 'Empty transcript provided')
    }
    
    console.log(`[${new Date().toISOString()}] Pipeline started`)
    
    const config = await loadPipelineConfig()
    
    const enabledStages = Object.entries(config.stages)
      .filter(([_, stageConfig]) => stageConfig.enabled === true)
      .map(([name, stageConfig]) => ({ name, config: stageConfig }))
    
    if (enabledStages.length === 0) {
      throw new StageError('pipeline', 'No enabled stages in configuration')
    }
    
    let currentOutput = input
    let metadataForNextStage = {}  // Pass data between stages
    
    for (let i = 0; i < enabledStages.length; i++) {
      const stage = enabledStages[i]
      const stageNumber = i + 1
      const totalStages = enabledStages.length
      
      console.log(`[${new Date().toISOString()}] Stage ${stageNumber}/${totalStages}: ${stage.name.toUpperCase()} → using ${stage.config.model}`)
      
      try {
        // For detection stage, we pass empty metadata; for summary stage, we pass previous metadata
        let stageMetadataInput = {}
        if (stage.name === 'detailed_summary' && metadataForNextStage.type) {
          stageMetadataInput = metadataForNextStage
        }
        currentOutput = await executeStage(stage.name, stage.config, currentOutput, stageMetadataInput)
        completedOutputs[stage.name] = currentOutput
        await saveDebugOutput(stage.name, currentOutput)
        
        // If this is the detection stage, parse its output to extract metadata
        if (stage.name === 'detect_transcript_type') {
          const parsed = parseJsonFromOutput(currentOutput)
          if (parsed && parsed.type) {
            metadataForNextStage = {
              type: parsed.type,
              speaker_info: JSON.stringify({
                speakers: parsed.speakers || [],
                interviewer: parsed.interviewer || null,
                interviewee: parsed.interviewee || null,
                estimated_speaker_count: parsed.estimated_speaker_count || 0
              })
            }
            console.log(`[${new Date().toISOString()}] Detection stage output: type=${parsed.type}, metadata=${metadataForNextStage.speaker_info}`)
          } else {
            console.warn(`[${new Date().toISOString()}] Could not parse detection output, using fallback`)
            metadataForNextStage = { type: 'conversation', speaker_info: '{}' }
          }
        }
      } catch (error) {
        if (error instanceof StageError) {
          console.log(`[${new Date().toISOString()}] Pipeline halted at stage ${error.stage.toUpperCase()}.`)
          console.log(`[${new Date().toISOString()}] To retry: change model variable for stage ${error.stage} and rerun.`)
          
          for (const [completedStage, output] of Object.entries(completedOutputs)) {
            console.log(`[${new Date().toISOString()}] Stage ${completedStage} output saved to: debug/${completedStage}_output.txt`)
          }
          
          throw error
        }
        throw error
      }
    }
    
    console.log(`[${new Date().toISOString()}] Pipeline completed successfully`)
    
    internalstate.last = currentOutput
    internalstate.completedStages = enabledStages.map(s => s.name)
    
    await saveTranscriptOutput(currentOutput)
    
    return currentOutput
  }

  return {
    processtranscript: processtranscript
  }
})()