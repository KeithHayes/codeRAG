// assets/js/toolbar.js
(function () {
  const statusDiv = document.createElement('div')
  
  let currentProfile = 'ragcode'
  let stackRunning = false
  let stackCheckInterval = null
  let isUpdatingStack = false
  let lastStatusCheck = 0
  let cachedStatus = false
  
  // ========== STATE MACHINE ==========
  
  const StatusState = {
    STACK_UNKNOWN: 'stack_unknown',
    STACK_CHECKING: 'stack_checking',
    STACK_RUNNING: 'stack_running',
    STACK_NOT_RUNNING: 'stack_not_running',
    STACK_STARTING: 'stack_starting',
    STACK_STOPPING: 'stack_stopping',
    MODEL_AUTO_LOADING: 'model_auto_loading',
    MODEL_READY: 'model_ready',
    MODEL_FAILED: 'model_failed',
    RAGCODE_MODEL_LOADING: 'ragcode_model_loading',
    RAGCODE_MODEL_READY: 'ragcode_model_ready',
    RAGCODE_MODEL_FAILED: 'ragcode_model_failed',
    RAGCODE_VECTORDB_BUILDING: 'ragcode_vectordb_building',
    RAGCODE_VECTORDB_BUILT: 'ragcode_vectordb_built',
    RAGCODE_VECTORDB_FAILED: 'ragcode_vectordb_failed',
    DOOMSTEAD_MODEL_LOADING: 'doomstead_model_loading',
    DOOMSTEAD_MODEL_READY: 'doomstead_model_ready',
    DOOMSTEAD_MODEL_FAILED: 'doomstead_model_failed',
    DOOMSTEAD_VECTORDB_BUILDING: 'doomstead_vectordb_building',
    DOOMSTEAD_VECTORDB_BUILT: 'doomstead_vectordb_built',
    DOOMSTEAD_VECTORDB_FAILED: 'doomstead_vectordb_failed',
    MAINPAGE_MODEL_LOADING: 'mainpage_model_loading',
    MAINPAGE_MODEL_READY: 'mainpage_model_ready',
    MAINPAGE_MODEL_FAILED: 'mainpage_model_failed',
    MAINPAGE_VECTORDB_BUILDING: 'mainpage_vectordb_building',
    MAINPAGE_VECTORDB_BUILT: 'mainpage_vectordb_built',
    MAINPAGE_VECTORDB_FAILED: 'mainpage_vectordb_failed',
    RAGDOCS_MODEL_LOADING: 'ragdocs_model_loading',
    RAGDOCS_MODEL_READY: 'ragdocs_model_ready',
    RAGDOCS_MODEL_FAILED: 'ragdocs_model_failed',
    RAGDOCS_VECTORDB_BUILDING: 'ragdocs_vectordb_building',
    RAGDOCS_VECTORDB_BUILT: 'ragdocs_vectordb_built',
    RAGDOCS_VECTORDB_FAILED: 'ragdocs_vectordb_failed',
    TRANSCRIPT_MODEL_LOADING: 'transcript_model_loading',
    TRANSCRIPT_MODEL_READY: 'transcript_model_ready',
    TRANSCRIPT_MODEL_FAILED: 'transcript_model_failed',
    TRANSCRIPT_SAVING: 'transcript_saving',
    TRANSCRIPT_SAVED: 'transcript_saved',
    TRANSCRIPT_FAILED: 'transcript_failed',
    PLANTDISEASES_MODEL_LOADING: 'plantdiseases_model_loading',
    PLANTDISEASES_MODEL_READY: 'plantdiseases_model_ready',
    PLANTDISEASES_MODEL_FAILED: 'plantdiseases_model_failed',
    PLANTDISEASES_VECTORDB_BUILDING: 'plantdiseases_vectordb_building',
    PLANTDISEASES_VECTORDB_BUILT: 'plantdiseases_vectordb_built',
    PLANTDISEASES_VECTORDB_FAILED: 'plantdiseases_vectordb_failed',
    SOCIALISM_MODEL_LOADING: 'socialism_model_loading',
    SOCIALISM_MODEL_READY: 'socialism_model_ready',
    SOCIALISM_MODEL_FAILED: 'socialism_model_failed',
    SOCIALISM_VECTORDB_BUILDING: 'socialism_vectordb_building',
    SOCIALISM_VECTORDB_BUILT: 'socialism_vectordb_built',
    SOCIALISM_VECTORDB_FAILED: 'socialism_vectordb_failed',
    PROFILE_SWITCHING: 'profile_switching',
    RUNNING_PIPELINE: 'running_pipeline',
    IDLE: 'idle',
    ERROR: 'error'
  }
  
  const StateMessages = {
    [StatusState.STACK_CHECKING]: 'Checking Ollama service...',
    [StatusState.STACK_RUNNING]: '',
    [StatusState.STACK_NOT_RUNNING]: 'Waiting for service...',
    [StatusState.MODEL_AUTO_LOADING]: 'Loading model from config...',
    [StatusState.MODEL_READY]: 'Model ready: {modelName}',
    [StatusState.MODEL_FAILED]: 'Model load failed: {modelName} - {error}',
    [StatusState.RAGCODE_MODEL_LOADING]: 'Loading model: {modelName}...',
    [StatusState.RAGCODE_MODEL_READY]: 'Model ready: {modelName}',
    [StatusState.RAGCODE_MODEL_FAILED]: 'Model load failed: {modelName} - {error}',
    [StatusState.RAGCODE_VECTORDB_BUILDING]: 'Building RAGcode vector store...',
    [StatusState.RAGCODE_VECTORDB_BUILT]: 'RAGcode vector store build completed',
    [StatusState.RAGCODE_VECTORDB_FAILED]: 'RAGcode vector store build failed',
    [StatusState.DOOMSTEAD_MODEL_LOADING]: 'Loading model: {modelName}...',
    [StatusState.DOOMSTEAD_MODEL_READY]: 'Model ready: {modelName}',
    [StatusState.DOOMSTEAD_MODEL_FAILED]: 'Model load failed: {modelName} - {error}',
    [StatusState.DOOMSTEAD_VECTORDB_BUILDING]: 'Building Doomstead vector store...',
    [StatusState.DOOMSTEAD_VECTORDB_BUILT]: 'Doomstead vector store build completed',
    [StatusState.DOOMSTEAD_VECTORDB_FAILED]: 'Doomstead vector store build failed',
    [StatusState.MAINPAGE_MODEL_LOADING]: 'Loading model: {modelName}...',
    [StatusState.MAINPAGE_MODEL_READY]: 'Model ready: {modelName}',
    [StatusState.MAINPAGE_MODEL_FAILED]: 'Model load failed: {modelName} - {error}',
    [StatusState.MAINPAGE_VECTORDB_BUILDING]: 'Building Mainpage vector store...',
    [StatusState.MAINPAGE_VECTORDB_BUILT]: 'Mainpage vector store build completed',
    [StatusState.MAINPAGE_VECTORDB_FAILED]: 'Mainpage vector store build failed',
    [StatusState.RAGDOCS_MODEL_LOADING]: 'Loading model: {modelName}...',
    [StatusState.RAGDOCS_MODEL_READY]: 'Model ready: {modelName}',
    [StatusState.RAGDOCS_MODEL_FAILED]: 'Model load failed: {modelName} - {error}',
    [StatusState.RAGDOCS_VECTORDB_BUILDING]: 'Building RAGdocs vector store...',
    [StatusState.RAGDOCS_VECTORDB_BUILT]: 'RAGdocs vector store build completed',
    [StatusState.RAGDOCS_VECTORDB_FAILED]: 'RAGdocs vector store build failed',
    [StatusState.TRANSCRIPT_MODEL_LOADING]: 'Loading model: {modelName}...',
    [StatusState.TRANSCRIPT_MODEL_READY]: 'Model ready: {modelName}',
    [StatusState.TRANSCRIPT_MODEL_FAILED]: 'Model load failed: {modelName} - {error}',
    [StatusState.TRANSCRIPT_SAVING]: 'Saving transcript...',
    [StatusState.TRANSCRIPT_SAVED]: 'Transcript saved successfully',
    [StatusState.TRANSCRIPT_FAILED]: 'Transcript save failed',
    [StatusState.PLANTDISEASES_MODEL_LOADING]: 'Loading model: {modelName}...',
    [StatusState.PLANTDISEASES_MODEL_READY]: 'Model ready: {modelName}',
    [StatusState.PLANTDISEASES_MODEL_FAILED]: 'Model load failed: {modelName} - {error}',
    [StatusState.PLANTDISEASES_VECTORDB_BUILDING]: 'Building Plant Diseases vector store...',
    [StatusState.PLANTDISEASES_VECTORDB_BUILT]: 'Plant Diseases vector store build completed',
    [StatusState.PLANTDISEASES_VECTORDB_FAILED]: 'Plant Diseases vector store build failed',
    [StatusState.SOCIALISM_MODEL_LOADING]: 'Loading model: {modelName}...',
    [StatusState.SOCIALISM_MODEL_READY]: 'Model ready: {modelName}',
    [StatusState.SOCIALISM_MODEL_FAILED]: 'Model load failed: {modelName} - {error}',
    [StatusState.SOCIALISM_VECTORDB_BUILDING]: 'Building Socialism vector store...',
    [StatusState.SOCIALISM_VECTORDB_BUILT]: 'Socialism vector store build completed',
    [StatusState.SOCIALISM_VECTORDB_FAILED]: 'Socialism vector store build failed',
    [StatusState.PROFILE_SWITCHING]: 'Switching to {profileName} profile...',
    [StatusState.RUNNING_PIPELINE]: 'Running transcript pipeline...',
    [StatusState.IDLE]: '',
    [StatusState.ERROR]: 'Error: {errorMsg}'
  }
  
  let currentState = StatusState.STACK_CHECKING
  let autoTransitionTimeout = null
  let currentStateData = {}
  
  function clearAutoTransition() {
    if (autoTransitionTimeout) {
      clearTimeout(autoTransitionTimeout)
      autoTransitionTimeout = null
    }
  }
  
  function updateStatusDisplay() {
    if (!statusDiv) return
    
    let message = StateMessages[currentState] || ''
    
    if (message.includes('{modelName}') && currentStateData.modelName) {
      message = message.replace(/\{modelName\}/g, currentStateData.modelName)
    }
    if (message.includes('{error}') && currentStateData.error) {
      message = message.replace(/\{error\}/g, currentStateData.error)
    }
    if (message.includes('{errorMsg}') && currentStateData.errorMsg) {
      message = message.replace('{errorMsg}', currentStateData.errorMsg)
    }
    if (message.includes('{profileName}') && currentStateData.profileName) {
      message = message.replace('{profileName}', currentStateData.profileName)
    }
    if (message.includes('{progress}') && currentStateData.progress !== undefined) {
      message = message.replace('{progress}', currentStateData.progress)
    }
    
    if (currentState === StatusState.IDLE) {
      if (stackRunning) {
        message = ''
      } else {
        message = 'Waiting for service...'
      }
    }
    
    statusDiv.textContent = message
  }
  
  function enableChatInputs() {
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    if (promptInput) promptInput.disabled = false
    if (sendBtn) sendBtn.disabled = false
    if (promptInput) promptInput.focus()
  }
  
  function transitionTo(newState, data = {}) {
    clearAutoTransition()
    currentState = newState
    currentStateData = data
    updateStatusDisplay()
    
    switch (newState) {
      case StatusState.MODEL_READY:
      case StatusState.RAGCODE_MODEL_READY:
      case StatusState.DOOMSTEAD_MODEL_READY:
      case StatusState.MAINPAGE_MODEL_READY:
      case StatusState.RAGDOCS_MODEL_READY:
      case StatusState.TRANSCRIPT_MODEL_READY:
      case StatusState.PLANTDISEASES_MODEL_READY:
      case StatusState.SOCIALISM_MODEL_READY:
        enableChatInputs()
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 4000)
        break
        
      case StatusState.MODEL_FAILED:
      case StatusState.RAGCODE_MODEL_FAILED:
      case StatusState.DOOMSTEAD_MODEL_FAILED:
      case StatusState.MAINPAGE_MODEL_FAILED:
      case StatusState.RAGDOCS_MODEL_FAILED:
      case StatusState.TRANSCRIPT_MODEL_FAILED:
      case StatusState.PLANTDISEASES_MODEL_FAILED:
      case StatusState.SOCIALISM_MODEL_FAILED:
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 5000)
        break
        
      case StatusState.RAGCODE_VECTORDB_BUILT:
      case StatusState.DOOMSTEAD_VECTORDB_BUILT:
      case StatusState.MAINPAGE_VECTORDB_BUILT:
      case StatusState.RAGDOCS_VECTORDB_BUILT:
      case StatusState.PLANTDISEASES_VECTORDB_BUILT:
      case StatusState.SOCIALISM_VECTORDB_BUILT:
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 3000)
        break
        
      case StatusState.RAGCODE_VECTORDB_FAILED:
      case StatusState.DOOMSTEAD_VECTORDB_FAILED:
      case StatusState.MAINPAGE_VECTORDB_FAILED:
      case StatusState.RAGDOCS_VECTORDB_FAILED:
      case StatusState.PLANTDISEASES_VECTORDB_FAILED:
      case StatusState.SOCIALISM_VECTORDB_FAILED:
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 5000)
        break
        
      case StatusState.TRANSCRIPT_SAVED:
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 2000)
        break
        
      case StatusState.TRANSCRIPT_FAILED:
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 5000)
        break
        
      case StatusState.RUNNING_PIPELINE:
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 3000)
        break
        
      case StatusState.ERROR:
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 5000)
        break
        
      case StatusState.STACK_RUNNING:
      case StatusState.STACK_NOT_RUNNING:
      case StatusState.PROFILE_SWITCHING:
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 3000)
        break
        
      case StatusState.MODEL_AUTO_LOADING:
        autoTransitionTimeout = setTimeout(() => {
          transitionTo(StatusState.IDLE)
        }, 3000)
        break
    }
  }
  
  window.transitionTo = transitionTo
  
  // ========== TOOLBAR BUTTON HANDLERS ==========
  
  function ragcode() {
    switchProfile('RAGcode', 'ragcode', 'Retrieval Argumentation Generation for Code')
  }

  function doomsteadcode() {
    switchProfile('Doomstead', 'doomstead', 'Retrieval Argumentation Generation for Code')
  }

  function mainpagecode() {
    switchProfile('Mainpage', 'mainpage', 'Retrieval Argumentation Generation for Code')
  }

  function ragdocs() {
    switchProfile('RAGdocs', 'ragdocs', 'Retrieval Argumentation Generation for Code')
  }

  function transcripts() {
    switchProfile('Transcripts', 'transcript', 'Transcript Processor')
  }

  function plantdiseases() {
    switchProfile('PlantDiseases', 'plantdiseases', 'Plant Diseases RAG')
  }

  function socialism() {
    switchProfile('Socialism', 'socialism', 'Socialism RAG')
  }
  
  function rebuild_vectorstore() {
    let buildingState = null
    let builtState = null
    let failedState = null
    
    switch (currentProfile) {
      case 'ragcode':
        buildingState = StatusState.RAGCODE_VECTORDB_BUILDING
        builtState = StatusState.RAGCODE_VECTORDB_BUILT
        failedState = StatusState.RAGCODE_VECTORDB_FAILED
        break
      case 'doomstead':
        buildingState = StatusState.DOOMSTEAD_VECTORDB_BUILDING
        builtState = StatusState.DOOMSTEAD_VECTORDB_BUILT
        failedState = StatusState.DOOMSTEAD_VECTORDB_FAILED
        break
      case 'mainpage':
        buildingState = StatusState.MAINPAGE_VECTORDB_BUILDING
        builtState = StatusState.MAINPAGE_VECTORDB_BUILT
        failedState = StatusState.MAINPAGE_VECTORDB_FAILED
        break
      case 'ragdocs':
        buildingState = StatusState.RAGDOCS_VECTORDB_BUILDING
        builtState = StatusState.RAGDOCS_VECTORDB_BUILT
        failedState = StatusState.RAGDOCS_VECTORDB_FAILED
        break
      case 'plantdiseases':
        buildingState = StatusState.PLANTDISEASES_VECTORDB_BUILDING
        builtState = StatusState.PLANTDISEASES_VECTORDB_BUILT
        failedState = StatusState.PLANTDISEASES_VECTORDB_FAILED
        break
      case 'socialism':
        buildingState = StatusState.SOCIALISM_VECTORDB_BUILDING
        builtState = StatusState.SOCIALISM_VECTORDB_BUILT
        failedState = StatusState.SOCIALISM_VECTORDB_FAILED
        break
      default:
        buildingState = StatusState.RAGCODE_VECTORDB_BUILDING
        builtState = StatusState.RAGCODE_VECTORDB_BUILT
        failedState = StatusState.RAGCODE_VECTORDB_FAILED
    }
    
    transitionTo(buildingState)
    
    if (typeof BuildModal !== 'undefined') {
      const modal = new BuildModal()
      modal.startPolling()
      
      const originalUpdateProgress = modal.updateProgress
      modal.updateProgress = function(percent, status) {
        if (originalUpdateProgress) originalUpdateProgress.call(modal, percent, status)
        if (percent !== undefined) {
          currentStateData = { progress: percent }
          updateStatusDisplay()
        }
      }
      
      fetch('assets/php/fullbuilder.php', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          transitionTo(failedState)
        } else {
          transitionTo(builtState)
        }
      })
      .catch(() => {
        transitionTo(failedState)
      })
    } else {
      console.error('BuildModal not loaded')
      transitionTo(failedState)
    }
  }
  
  function handlePasteTranscriptClick() {
    if (typeof ClipboardModal === 'undefined') {
      console.error('ClipboardModal not loaded')
      transitionTo(StatusState.ERROR, { errorMsg: 'ClipboardModal not loaded' })
      return
    }
    
    const modal = new ClipboardModal(
      function(transcript) {
        transitionTo(StatusState.TRANSCRIPT_SAVING)
        fetch(`assets/php/rag.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'save_transcript',
            transcript: transcript 
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            transitionTo(StatusState.TRANSCRIPT_SAVED)
          } else {
            transitionTo(StatusState.TRANSCRIPT_FAILED)
            alert('Failed to save transcript: ' + (data.error || 'Unknown error'))
          }
        })
        .catch(() => {
          transitionTo(StatusState.TRANSCRIPT_FAILED)
          alert('Error saving transcript')
        })
      },
      function() {
        transitionTo(StatusState.IDLE)
      }
    )
  }
  
  function loadModel() {
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    
    let loadingState = null
    let readyState = null
    let failedState = null
    
    switch (currentProfile) {
      case 'ragcode':
        loadingState = StatusState.RAGCODE_MODEL_LOADING
        readyState = StatusState.RAGCODE_MODEL_READY
        failedState = StatusState.RAGCODE_MODEL_FAILED
        break
      case 'doomstead':
        loadingState = StatusState.DOOMSTEAD_MODEL_LOADING
        readyState = StatusState.DOOMSTEAD_MODEL_READY
        failedState = StatusState.DOOMSTEAD_MODEL_FAILED
        break
      case 'mainpage':
        loadingState = StatusState.MAINPAGE_MODEL_LOADING
        readyState = StatusState.MAINPAGE_MODEL_READY
        failedState = StatusState.MAINPAGE_MODEL_FAILED
        break
      case 'ragdocs':
        loadingState = StatusState.RAGDOCS_MODEL_LOADING
        readyState = StatusState.RAGDOCS_MODEL_READY
        failedState = StatusState.RAGDOCS_MODEL_FAILED
        break
      case 'transcript':
        loadingState = StatusState.TRANSCRIPT_MODEL_LOADING
        readyState = StatusState.TRANSCRIPT_MODEL_READY
        failedState = StatusState.TRANSCRIPT_MODEL_FAILED
        break
      case 'plantdiseases':
        loadingState = StatusState.PLANTDISEASES_MODEL_LOADING
        readyState = StatusState.PLANTDISEASES_MODEL_READY
        failedState = StatusState.PLANTDISEASES_MODEL_FAILED
        break
      case 'socialism':
        loadingState = StatusState.SOCIALISM_MODEL_LOADING
        readyState = StatusState.SOCIALISM_MODEL_READY
        failedState = StatusState.SOCIALISM_MODEL_FAILED
        break
      default:
        loadingState = StatusState.RAGCODE_MODEL_LOADING
        readyState = StatusState.RAGCODE_MODEL_READY
        failedState = StatusState.RAGCODE_MODEL_FAILED
    }
    
    fetch(`assets/php/rag.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_model_name' })
    })
      .then(response => response.json())
      .then(nameData => {
        const modelName = nameData.model_name || 'unknown'
        
        transitionTo(loadingState, { modelName: modelName })
        
        setTimeout(() => {
          fetch(`assets/php/force_reload_model.php?_=${Date.now()}`)
            .then(response => response.json())
            .then(loadData => {
              if (loadData.success && (loadData.status === 'loaded' || loadData.status === 'already_running')) {
                transitionTo(readyState, { modelName: modelName })
                if (promptInput) promptInput.disabled = false
                if (sendBtn) sendBtn.disabled = false
                if (promptInput) promptInput.focus()
              } else if (loadData.status === 'loading') {
                transitionTo(loadingState, { modelName: modelName })
                if (promptInput) promptInput.disabled = true
                if (sendBtn) sendBtn.disabled = true
              } else {
                transitionTo(failedState, { modelName: modelName, error: loadData.message || 'Failed to load model' })
                if (loadData.message && loadData.message.includes('not running')) {
                  alert('Stack not running.')
                }
                if (promptInput) promptInput.disabled = true
                if (sendBtn) sendBtn.disabled = true
              }
            })
            .catch(error => {
              console.error('Load model error:', error)
              transitionTo(failedState, { modelName: modelName, error: error.message })
              alert('Error: ' + error.message)
              if (promptInput) promptInput.disabled = true
              if (sendBtn) sendBtn.disabled = true
            })
        }, 50)
      })
      .catch(error => {
        console.error('Get model name error:', error)
        transitionTo(failedState, { modelName: 'unknown', error: error.message })
        alert('Error getting model name: ' + error.message)
        if (promptInput) promptInput.disabled = true
        if (sendBtn) sendBtn.disabled = true
      })
  }
  
  async function getCurrentProfile() {
    try {
      const response = await fetch('assets/data/config.json?_=' + Date.now())
      const config = await response.json()
      return config.filesetconfig || 'ragcode'
    } catch (error) {
      console.error('Failed to get current profile:', error)
      return 'ragcode'
    }
  }
  
  async function handleruntasksClick() {
    transitionTo(StatusState.RUNNING_PIPELINE)
    
    try {
      const currentProfileName = await getCurrentProfile()
      
      if (currentProfileName !== 'transcript') {
        const response = await fetch('assets/php/ollama_api.php?action=list&_=' + Date.now())
        const data = await response.json()
        
        if (data.success && data.models && data.models.length > 0) {
          let modelList = 'Available models:\n\n'
          data.models.forEach(model => {
            const sizeGB = (parseInt(model.size) / 1024 / 1024 / 1024).toFixed(1)
            modelList += `${model.name} (${sizeGB} GB)\n`
          })
          alert(modelList)
        } else if (data.success && (!data.models || data.models.length === 0)) {
          alert('No models found.\n\nPull a model: ollama pull deepseek-coder:6.7b')
        } else {
          throw new Error('Failed to fetch models')
        }
        transitionTo(StatusState.IDLE)
        return
      }
      
      // Only call the pipeline - no preprocessing here
      transitionTo(StatusState.PROFILE_SWITCHING, { profileName: 'Processing transcript...' })
      
      const result = await transcriptmodule.processtranscript()
      
      const chatbox = document.getElementById('chatbox')
      if (chatbox) {
        chatbox.innerHTML = ''
        const messageDiv = document.createElement('div')
        messageDiv.className = 'message bot'
        messageDiv.innerHTML = '<strong>Assistant:</strong> <p>' + result.replace(/\n/g, '<br>') + '</p>'
        chatbox.appendChild(messageDiv)
      }
      
      transitionTo(StatusState.IDLE)
      
    } catch (error) {
      console.error('handleruntasksClick error:', error)
      
      let errorMessage = error.message
      if (error.name === 'StageError') {
        errorMessage = `Pipeline failed at stage ${error.stage}: ${error.reason}`
      } else if (error.message.includes('transcript file not found')) {
        errorMessage = error.message
      } else if (error.message.includes('Empty')) {
        errorMessage = 'Transcript is empty. Please paste a valid transcript.'
      } else {
        errorMessage = 'Failed to process transcript: ' + error.message
      }
      
      transitionTo(StatusState.ERROR, { errorMsg: errorMessage })
      alert(errorMessage)
    }
  }
  
  function handlechoosemodelClick() {
    if (stackRunning) {
      transitionTo(StatusState.STACK_RUNNING)
    } else {
      transitionTo(StatusState.STACK_NOT_RUNNING)
    }
    
    if (typeof ModelModal !== 'undefined') {
      new ModelModal()
    }
  }
  
  function function_stub() {
    transitionTo(StatusState.ERROR, { errorMsg: 'Refresh not implemented - use Full Build' })
  }
  
  function handleHomepageClick() {
    window.open('https://chasingthesquirrel.com/doomstead/index.php', '_blank', 'noopener,noreferrer')
    if (stackRunning) {
      transitionTo(StatusState.STACK_RUNNING)
    } else {
      transitionTo(StatusState.STACK_NOT_RUNNING)
    }
  }
  
  function handleBookClick() {
    const message = 'Example queries:\n\nWhat is the current implementation of the FAISS vector store builder, and how does the specification document describe the expected behavior of the state machine for model loading states?\n\nWhat are different kinds of plant diseases\n\nWhat is Stewart\'s wilt disease'
    alert(message)
    if (stackRunning) {
      transitionTo(StatusState.STACK_RUNNING)
    } else {
      transitionTo(StatusState.STACK_NOT_RUNNING)
    }
  }
  
  // ========== PROFILE MANAGEMENT ==========
  
  function switchProfile(profileName, configValue, toolTitle) {
    transitionTo(StatusState.PROFILE_SWITCHING, { profileName: profileName })
    
    const chatbox = document.getElementById('chatbox')
    if (chatbox) chatbox.innerHTML = ''
    
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    if (promptInput) {
      promptInput.disabled = true
      promptInput.value = ''
    }
    if (sendBtn) sendBtn.disabled = true
    
    const content = { 'filesetconfig': configValue }
    
    fetch(`assets/php/save_config.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).then(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext(profileName)
      currentProfile = configValue
      
      const fullBuildBtn = document.getElementById('button_fullbuild')
      const pasteBtn = document.getElementById('button_pastetranscript')
      
      if (configValue === 'transcript') {
        if (fullBuildBtn) fullBuildBtn.style.display = 'none'
        if (pasteBtn) pasteBtn.style.display = ''
      } else {
        if (fullBuildBtn) fullBuildBtn.style.display = ''
        if (pasteBtn) pasteBtn.style.display = 'none'
      }
      
      updateButtonVisibilityFromYaml()
      updatetooltitle(toolTitle)
      
      if (chatbox) chatbox.innerHTML = ''
      transitionTo(StatusState.IDLE)
    }).catch(() => {
      transitionTo(StatusState.ERROR, { errorMsg: 'Error switching profile' })
    })
  }
  
  // ========== TOOLBAR VISIBILITY FROM YAML ==========
  
  function updateButtonVisibilityFromYaml() {
    const configFile = 'assets/data/config.json'
    
    fetch(configFile + '?_=' + Date.now())
      .then(res => res.json())
      .then(config => {
        const profile = config.filesetconfig || 'ragcode'
        currentProfile = profile
        
        const yamlFile = `assets/yaml/${profile}.yaml`
        
        return fetch(yamlFile + '?_=' + Date.now())
          .then(res => res.text())
          .then(yamlText => {
            const toolbarItems = parseToolbarFromYaml(yamlText)
            applyToolbarVisibility(toolbarItems)
          })
      })
      .catch(() => {
        const defaultItems = ['fileload', 'homeserver', 'fullbuild', 'loadmodel', 'choosemodel', 'book', 'target']
        applyToolbarVisibility(defaultItems)
      })
  }
  
  function parseToolbarFromYaml(yamlText) {
    const lines = yamlText.split('\n')
    let inToolbar = false
    const items = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.trim() === 'toolbar:') {
        inToolbar = true
        continue
      }
      
      if (inToolbar) {
        if (line.match(/^\s*-\s+/)) {
          const match = line.match(/^\s*-\s+['"]?([^"'\n]+)['"]?/)
          if (match) {
            items.push(match[1].trim())
          }
        } else if (line.trim() !== '' && !line.match(/^\s/)) {
          break
        }
      }
    }
    
    return items
  }
  
  function applyToolbarVisibility(visibleButtons) {
    const buttonMappings = {
      'fileload': 'button_fileload',
      'homeserver': 'button_homeserver',
      'fullbuild': 'button_fullbuild',
      'pastetranscript': 'button_pastetranscript',
      'loadmodel': 'button_loadmodel',
      'runtask': 'button_runtask',
      'choosemodel': 'button_choosemodel',
      'stub': 'button_stub',
      'homepage': 'button_homepage',
      'target': 'button_homepage',
      'book': 'button_book'
    }
    
    for (const [buttonClass, elementId] of Object.entries(buttonMappings)) {
      const buttonElement = document.getElementById(elementId)
      if (buttonElement) {
        if (visibleButtons.includes(buttonClass)) {
          buttonElement.style.display = ''
          buttonElement.style.visibility = 'visible'
        } else {
          buttonElement.style.display = 'none'
          buttonElement.style.visibility = 'hidden'
        }
      }
    }
  }
  
  // ========== STACK STATUS MANAGEMENT ==========
  
  function updateStackButtonShift(isRunning) {
    const homeserverBtn = document.getElementById('homeserver')
    if (!homeserverBtn) return
    
    if (isRunning) {
      if (homeserverBtn.classList.contains('homeservershift')) {
        homeserverBtn.classList.remove('homeservershift')
      }
      stackRunning = true
      cachedStatus = true
      if (currentState === StatusState.IDLE || currentState === StatusState.STACK_NOT_RUNNING || currentState === StatusState.STACK_CHECKING) {
        transitionTo(StatusState.STACK_RUNNING)
      }
    } else {
      if (!homeserverBtn.classList.contains('homeservershift')) {
        homeserverBtn.classList.add('homeservershift')
      }
      stackRunning = false
      cachedStatus = false
      if (currentState === StatusState.IDLE || currentState === StatusState.STACK_RUNNING || currentState === StatusState.STACK_CHECKING) {
        transitionTo(StatusState.STACK_NOT_RUNNING)
      }
    }
  }
  
  function checkStackStatus() {
    if (isUpdatingStack) return
    
    const now = Date.now()
    if (now - lastStatusCheck < 2000) {
      updateStackButtonShift(cachedStatus)
      return
    }
    
    lastStatusCheck = now
    
    fetch(`assets/php/ollama_api.php?action=status&_=${now}`, {
      method: 'GET',
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(response => response.json())
      .then(data => {
        const isRunning = !!(data.success && data.running)
        cachedStatus = isRunning
        updateStackButtonShift(isRunning)
      })
      .catch(() => {
        updateStackButtonShift(false)
        cachedStatus = false
      })
  }
  
  function startStackChecker() {
    if (stackCheckInterval) {
      clearInterval(stackCheckInterval)
    }
    
    transitionTo(StatusState.STACK_CHECKING)
    checkStackStatus()
    
    stackCheckInterval = setInterval(() => {
      checkStackStatus()
    }, 3000)
  }
  
  function stopStackChecker() {
    if (stackCheckInterval) {
      clearInterval(stackCheckInterval)
      stackCheckInterval = null
    }
  }
  
  // ========== UI HELPER FUNCTIONS ==========
  
  function updatetooltitle(text) {
    let banner = document.getElementById('tooltitle')
    if (banner) banner.textContent = text
  }
  
  function colordropdowntext(content) {
    const dropdown = document.getElementById('dropdown_fileload')
    if (dropdown) {
      const ul = dropdown.querySelector('ul')
      if (ul) {
        const items = ul.querySelectorAll('li a')
        items.forEach(item => {
          item.style.color = item.textContent.trim() === content ? '#006400' : '#964b00'
        })
      }
    }
  }
  
  function loadtooltips() {
    const tooltips = {
      fileload: 'File Set',
      fullbuild: 'Build Vector Store',
      stub: 'Refresh Vector Store',
      homeserver: 'Stack Status',
      loadmodel: 'Load Model',
      runtask: 'Run Pipeline',
      pastetranscript: 'Paste Transcript',
      choosemodel: 'Models',
      homepage: 'Homepage',
      book: 'Example Queries'
    }
    for (const id in tooltips) {
      const el = document.getElementById(id)
      if (el) el.setAttribute('title', tooltips[id])
    }
  }
  
  // ========== BUTTON CREATION FUNCTIONS ==========
  
  function addbutton(id, className, side, isIndicator) {
    const a = document.createElement('a')
    a.id = id
    a.className = className
    a.textContent = className
    if (isIndicator) {
      a.style = 'background-position: 0 0px; margin-top: 0px; margin-left: 0px;'
    } else {
      a.href = '#'
    }

    const li = document.createElement('li')
    li.style.float = side
    li.id = `button_${id}`
    li.appendChild(a)
    return li
  }

  function addbuttondropdown(id, className, side, items) {
    const dropdownfunctions = {
      RAGcode: ragcode,
      Doomstead: doomsteadcode,
      Mainpage: mainpagecode,
      RAGdocs: ragdocs,
      Transcripts: transcripts,
      PlantDiseases: plantdiseases,
      Socialism: socialism
    }
    const li = document.createElement('li')
    li.style.float = side
    li.id = `button_${id}`

    const a = document.createElement('a')
    a.id = id
    a.className = className
    a.textContent = className
    a.href = '#'
    li.appendChild(a)

    const content = document.createElement('div')
    content.id = `dropdown_${id}`
    content.classList.add('dropdown')
    content.style.display = 'none'
    content.style.position = 'absolute'

    const ul = document.createElement('ul')
    ul.id = `ul_${id}`

    items.forEach(item => {
      const itemLink = document.createElement('a')
      itemLink.href = '#'
      itemLink.textContent = item
      itemLink.style.color = '#964b00'
      const liItem = document.createElement('li')
      liItem.appendChild(itemLink)
      ul.appendChild(liItem)
    })

    ul.addEventListener('click', (e) => {
      e.preventDefault()
      const target = e.target
      if (target.tagName === 'A') {
        const func = dropdownfunctions[target.textContent.trim()]
        if (func) func()
      }
    })

    content.appendChild(ul)
    document.body.appendChild(content)
    
    a.addEventListener('mouseenter', () => {
      const rect = a.getBoundingClientRect()
      content.style.left = `${rect.left}px`
      content.style.top = `${rect.bottom}px`
      content.style.display = 'block'
    })

    a.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!content.matches(':hover')) {
          content.style.display = 'none'
        }
      }, 100)
    })

    content.addEventListener('mouseleave', () => {
      content.style.display = 'none'
    })

    content.addEventListener('mouseenter', () => {
      content.style.display = 'block'
    })
    return li
  }
  
  // ========== MAIN TOOLBAR BUILD FUNCTION ==========
  
  function loadtoolbar() {
    const bar = document.getElementById('coderagtoolbar')
    if (!bar) {
      console.error('coderagtoolbar element not found')
      return
    }
    
    const buttonlist = document.createElement('ul')
    buttonlist.id = 'coderag_menu_buttons'
    buttonlist.classList.add('coderag-menu')

    buttonlist.appendChild(addbuttondropdown('fileload', 'fileloadBTN', 'left', ['RAGcode', 'Doomstead', 'Mainpage', 'RAGdocs', 'Transcripts', 'PlantDiseases', 'Socialism']))
    buttonlist.appendChild(addbutton('line1', 'dividerBTN', 'left', true))
    buttonlist.appendChild(addbutton('homeserver', 'homeserverBTN', 'left', false))
    buttonlist.appendChild(addbutton('fullbuild', 'dbuploadBTN', 'left', false))
    buttonlist.appendChild(addbutton('pastetranscript', 'pasteBTN', 'left', false))
    buttonlist.appendChild(addbutton('loadmodel', 'dogrunBTN', 'left', false))
    buttonlist.appendChild(addbutton('runtask', 'sailboatBTN', 'left', false))
    buttonlist.appendChild(addbutton('choosemodel', 'horuseyeBTN', 'left', false))
    buttonlist.appendChild(addbutton('stub', 'dbrefreshBTN', 'left', false))
    buttonlist.appendChild(addbutton('homepage', 'targetBTN', 'right', false))
    buttonlist.appendChild(addbutton('line2', 'dividerBTN', 'right', true))
    buttonlist.appendChild(addbutton('book', 'bookBTN', 'right', false))

    const statusLi = document.createElement('li')
    statusLi.style.float = 'right'

    statusDiv.id = 'status'
    statusDiv.className = 'status'
    statusDiv.textContent = 'Checking Ollama service...'
    currentState = StatusState.STACK_CHECKING

    statusLi.appendChild(statusDiv)

    const bookButton = buttonlist.querySelector('#button_book')
    if (bookButton && bookButton.parentNode && bookButton.parentNode.nextSibling) {
      buttonlist.insertBefore(statusLi, bookButton.parentNode.nextSibling)
    } else {
      buttonlist.appendChild(statusLi)
    }

    bar.appendChild(buttonlist)
    loadtooltips()
    
    startStackChecker()
    
    setTimeout(() => {
      updateButtonVisibilityFromYaml()
    }, 100)

    const pasteBtn = document.getElementById('button_pastetranscript')
    if (pasteBtn) pasteBtn.style.display = 'none'
    
    const fullBuildBtn = document.getElementById('button_fullbuild')
    if (fullBuildBtn) fullBuildBtn.style.display = ''

    const dropdownButton = document.querySelector('#button_fileload a')
    if (dropdownButton) {
      dropdownButton.onclick = function(e) {
        e.preventDefault()
        return false
      }
    }

    const stackButton = document.querySelector('#button_homeserver a')
    if (stackButton) {
      stackButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        if (stackRunning) {
          transitionTo(StatusState.STACK_RUNNING)
        } else {
          transitionTo(StatusState.STACK_NOT_RUNNING)
        }
        return false
      }
    }
    
    const fullBuildButton = document.querySelector('#button_fullbuild a')
    if (fullBuildButton) {
      fullBuildButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        rebuild_vectorstore()
        return false
      }
    }
    
    const pasteTranscriptButton = document.querySelector('#button_pastetranscript a')
    if (pasteTranscriptButton) {
      pasteTranscriptButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        handlePasteTranscriptClick()
        return false
      }
    }
    
    const runButton = document.querySelector('#button_loadmodel a')
    if (runButton) {
      runButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        loadModel()
        return false
      }
    }
    
    const sailboatButton = document.querySelector('#button_runtask a')
    if (sailboatButton) {
      sailboatButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        handleruntasksClick()
        return false
      }
    }
    
    const horuseyeButton = document.querySelector('#button_choosemodel a')
    if (horuseyeButton) {
      horuseyeButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        handlechoosemodelClick()
        return false
      }
    }
    
    const refreshButton = document.querySelector('#button_stub a')
    if (refreshButton) {
      refreshButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        function_stub()
        return false
      }
    }
    
    const homepageButton = document.querySelector('#button_homepage a')
    if (homepageButton) {
      homepageButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        handleHomepageClick()
        return false
      }
    }
    
    const bookButtonElem = document.querySelector('#button_book a')
    if (bookButtonElem) {
      bookButtonElem.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        handleBookClick()
        return false
      }
    }
    
    if (typeof ModelModal !== 'undefined') {
      new ModelModal()
    }
  }
  
  // ========== CLEANUP ON PAGE UNLOAD ==========
  
  window.addEventListener('beforeunload', function() {
    stopStackChecker()
    if (autoTransitionTimeout) {
      clearTimeout(autoTransitionTimeout)
    }
  })
  
  // ========== EXPOSE PUBLIC API ==========
  
  window.loadtoolbar = loadtoolbar
  window.updatestatus = function() {}
  window.rebuild_vectorstore = rebuild_vectorstore
  window.loadModel = loadModel
  window.transitionTo = transitionTo
  
  // ========== AUTO-INITIALIZE ==========
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof window.loadtoolbar === 'function') {
        window.loadtoolbar()
      }
    })
  } else {
    if (typeof window.loadtoolbar === 'function') {
      window.loadtoolbar()
    }
  }
})()