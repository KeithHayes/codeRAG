// assets/js/toolbar.js
(function () {
  const statusDiv = document.createElement('div')
  
  let currentProfile = 'ragcode'
  let stackRunning = false
  let stackCheckInterval = null
  let isUpdatingStack = false
  let lastStatusCheck = 0
  let cachedStatus = false
  let modelLoadStatus = null
  
  // ========== STATUS MANAGEMENT WITH QUEUE AND TIMEOUT LOCK ==========
  
  let statusTimeout = null
  let statusQueue = []
  let statusLockExpiry = 0
  let currentStatusMessage = ''
  let pendingStatusMessage = null
  
  function clearStatusTimeout() {
    if (statusTimeout) {
      clearTimeout(statusTimeout)
      statusTimeout = null
    }
  }
  
  function processStatusQueue() {
    if (statusQueue.length === 0) {
      // No queued messages, clear the status bar if no lock active
      if (Date.now() >= statusLockExpiry) {
        if (statusDiv) {
          if (stackRunning) {
            statusDiv.textContent = ''
          } else {
            statusDiv.textContent = 'Waiting for service...'
          }
          currentStatusMessage = statusDiv.textContent
        }
        statusLockExpiry = 0
      }
      return
    }
    
    // Check if lock has expired
    if (Date.now() >= statusLockExpiry) {
      const nextMessage = statusQueue.shift()
      if (statusDiv) {
        statusDiv.textContent = nextMessage.text
        currentStatusMessage = nextMessage.text
      }
      // Set lock for this message
      statusLockExpiry = Date.now() + 300
      // Clear any existing timeout
      clearStatusTimeout()
      // Set timeout to process queue after lock expires
      statusTimeout = setTimeout(() => {
        processStatusQueue()
      }, 300)
    }
  }
  
  function setStatusMessage(text, isTemporary = true, duration = 500) {
    // Add message to queue
    statusQueue.push({
      text: text,
      isTemporary: isTemporary,
      duration: duration,
      timestamp: Date.now()
    })
    
    // Try to process queue immediately
    processStatusQueue()
    
    // For temporary messages, schedule removal from queue after duration
    if (isTemporary) {
      setTimeout(() => {
        // Remove this specific message from queue if it's still there
        const index = statusQueue.findIndex(msg => msg.text === text && msg.timestamp === timestamp)
        if (index !== -1) {
          statusQueue.splice(index, 1)
        }
        // If this message is currently displayed, mark it for clearing
        if (currentStatusMessage === text) {
          // Queue a clear operation
          statusQueue.push({
            text: null,
            isTemporary: false,
            duration: 0,
            timestamp: Date.now(),
            isClear: true
          })
          processStatusQueue()
        }
      }, duration)
    }
  }
  
  function clearStatus(delay) {
    // Queue a clear operation after delay
    setTimeout(() => {
      statusQueue.push({
        text: null,
        isTemporary: false,
        duration: 0,
        timestamp: Date.now(),
        isClear: true
      })
      processStatusQueue()
    }, delay)
  }
  
  // ========== TOOLBAR BUTTON HANDLERS ==========
  
  // File Set Dropdown Handlers
  function ragcode() {
    setStatusMessage('Switched to RAGcode profile. Click Run button to load model.', true, 8000)
    switchProfile('RAGcode', 'ragcode', 'Retrieval Argumentation Generation for Code', 'Switched to RAGcode profile. Click Run button to load model.')
  }

  function doomsteadcode() {
    setStatusMessage('Switched to Doomstead profile. Click Run button to load model.', true, 8000)
    switchProfile('Doomstead', 'doomstead', 'Retrieval Argumentation Generation for Code', 'Switched to Doomstead profile. Click Run button to load model.')
  }

  function mainpagecode() {
    setStatusMessage('Switched to Mainpage profile. Click Run button to load model.', true, 8000)
    switchProfile('Mainpage', 'mainpage', 'Retrieval Argumentation Generation for Code', 'Switched to Mainpage profile. Click Run button to load model.')
  }

  function ragdocs() {
    setStatusMessage('Switched to RAGdocs profile. Click Run button to load model.', true, 8000)
    switchProfile('RAGdocs', 'ragdocs', 'Retrieval Argumentation Generation for Code', 'Switched to RAGdocs profile. Click Run button to load model.')
  }

  function transcripts() {
    setStatusMessage('Switched to Transcript profile. Click Run button to load model.', true, 8000)
    switchProfile('Transcripts', 'transcript', 'Transcript Processor', 'Switched to Transcript profile. Click Run button to load model.')
  }

  function plantdiseases() {
    setStatusMessage('Switched to PlantDiseases profile. Click Run button to load model.', true, 8000)
    switchProfile('PlantDiseases', 'plantdiseases', 'Plant Diseases RAG - Based on 11pests1disease.pdf', 'Switched to PlantDiseases profile. Click Run button to load model.')
  }
  
  // Homeserver Button Handler
  function handleStackButtonClick() {
    const homeserverBtn = document.getElementById('homeserver')
    const isShifted = homeserverBtn && homeserverBtn.classList.contains('homeservershift')
    
    if (isUpdatingStack) {
      setStatusMessage('Operation already in progress...', true, 3000)
      return
    }
    
    if (isShifted) {
      isUpdatingStack = true
      modelLoadStatus = null
      setStatusMessage('Starting stack...', true, 8000)
      if (homeserverBtn) homeserverBtn.style.pointerEvents = 'none'
      
      fetch(`assets/php/ollama_api.php?action=start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(response => response.json())
      .then(data => {
        setStatusMessage(data.message || (data.success ? 'Stack started' : 'Start initiated'), true, 5000)
        setTimeout(() => {
          checkStackStatus()
          isUpdatingStack = false
          if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
          clearStatus(500)
        }, 3000)
      })
      .catch(error => {
        console.error('Start error:', error)
        setStatusMessage('Error starting stack', true, 5000)
        isUpdatingStack = false
        if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
        setTimeout(() => clearStatus(500), 5000)
      })
    } else {
      isUpdatingStack = true
      modelLoadStatus = null
      setStatusMessage('Stopping stack...', true, 8000)
      if (homeserverBtn) homeserverBtn.style.pointerEvents = 'none'
      
      fetch(`assets/php/ollama_api.php?action=stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(response => response.json())
      .then(data => {
        setStatusMessage('Stack stopped', true, 5000)
        setTimeout(() => {
          checkStackStatus()
          isUpdatingStack = false
          if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
          clearStatus(500)
        }, 2000)
      })
      .catch(error => {
        console.error('Stop error:', error)
        setStatusMessage('Error stopping stack', true, 5000)
        isUpdatingStack = false
        if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
        setTimeout(() => clearStatus(500), 5000)
      })
    }
  }
  
  // Full Build Button Handler
  function rebuild_vectorstore() {
    setStatusMessage('Building FAISS vector store...', true, 30000)
    
    if (typeof BuildModal !== 'undefined') {
      const modal = new BuildModal()
      modal.startPolling()
      
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
          setStatusMessage('Build failed - check logs', true, 8000)
        } else {
          setStatusMessage('Build started...', true, 5000)
        }
        setTimeout(() => clearStatus(500), 8000)
      })
      .catch((error) => {
        console.error('Build error:', error)
        setStatusMessage('Build failed - check logs', true, 8000)
        setTimeout(() => clearStatus(500), 8000)
      })
    } else {
      console.error('BuildModal not loaded')
      setStatusMessage('BuildModal not loaded - refresh page', true, 8000)
      setTimeout(() => clearStatus(500), 8000)
    }
  }
  
  // Paste Transcript Button Handler
  function handlePasteTranscriptClick() {
    setStatusMessage('Opening paste dialog...', true, 3000)
    
    if (typeof ClipboardModal === 'undefined') {
      console.error('ClipboardModal not loaded')
      setStatusMessage('ClipboardModal not loaded - refresh page', true, 8000)
      setTimeout(() => clearStatus(500), 8000)
      return
    }
    
    const modal = new ClipboardModal(
      function(transcript) {
        setStatusMessage('Saving transcript...', true, 10000)
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
            setStatusMessage('Transcript saved', true, 5000)
          } else {
            setStatusMessage('Failed to save transcript', true, 5000)
            alert('Failed to save transcript: ' + (data.error || 'Unknown error'))
          }
          setTimeout(() => clearStatus(500), 5000)
        })
        .catch(error => {
          console.error('Error:', error)
          setStatusMessage('Error saving transcript', true, 5000)
          alert('Error saving transcript: ' + error.message)
          setTimeout(() => clearStatus(500), 5000)
        })
      },
      function() {
        setStatusMessage('Paste cancelled', true, 3000)
        setTimeout(() => clearStatus(500), 3000)
      }
    )
  }
  
  // Load Model Button Handler
  function loadModel() {
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    
    setStatusMessage('Loading model...', true, 60000)
    
    if (modelPollingInterval) {
      clearInterval(modelPollingInterval)
      modelPollingInterval = null
    }
    
    modelLoadStatus = null
    
    fetch(`assets/php/force_reload_model.php?_=${Date.now()}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const successMsg = `Model ready: ${data.new_model}`
          modelLoadStatus = successMsg
          setStatusMessage(successMsg, true, 10000)
          if (promptInput) promptInput.disabled = false
          if (sendBtn) sendBtn.disabled = false
          setTimeout(() => {
            modelLoadStatus = null
            clearStatus(500)
          }, 10000)
        } else if (data.status === 'loading') {
          setStatusMessage(`Loading model: ${data.new_model}...`, false)
          pollModelStatus(data.new_model, data.profile)
        } else {
          modelLoadStatus = null
          setStatusMessage(data.message || 'Failed to load', true, 8000)
          if (data.message && data.message.includes('not running')) {
            alert('Stack not running. Click homeserver button to start.')
          }
          if (promptInput) promptInput.disabled = true
          if (sendBtn) sendBtn.disabled = true
          setTimeout(() => clearStatus(500), 8000)
        }
      })
      .catch(error => {
        console.error('Load model error:', error)
        modelLoadStatus = null
        setStatusMessage('Error loading', true, 8000)
        alert('Error: ' + error.message)
        if (promptInput) promptInput.disabled = true
        if (sendBtn) sendBtn.disabled = true
        setTimeout(() => clearStatus(500), 8000)
      })
  }
  
  // Check Models Button Handler
  function handleruntasksClick() {
    setStatusMessage('Checking available models...', true, 10000)
    
    fetch(`assets/php/ollama_api.php?action=list`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.models) {
          if (data.models.length === 0) {
            alert('No models found.\n\nPull a model: ollama pull deepseek-coder:6.7b')
            setStatusMessage('No models available', true, 5000)
          } else {
            const modelList = data.models.map(m => `${m.name} (${(parseInt(m.size) / 1024 / 1024 / 1024).toFixed(1)} GB)`).join('\n')
            alert(`Available models:\n\n${modelList}`)
            setStatusMessage(`${data.models.length} model(s) available`, true, 5000)
          }
        } else {
          setStatusMessage('Cannot connect to Ollama', true, 5000)
          alert('Cannot connect to Ollama. Is the stack running?')
        }
        setTimeout(() => clearStatus(500), 5000)
      })
      .catch(error => {
        console.error('Check model error:', error)
        setStatusMessage('Connection error', true, 5000)
        alert('Could not connect to Ollama. Is the stack running?')
        setTimeout(() => clearStatus(500), 5000)
      })
  }
  
  // Choose Model Click Handler
  function handlechoosemodelClick() {
    setStatusMessage('Model selection ready - hover over Models button', true, 3000)
    setTimeout(() => clearStatus(500), 3000)
  }
  
  // Function Stub Button Handler
  function function_stub() {
    setStatusMessage('Refresh not implemented - use Full Build', true, 5000)
    setTimeout(() => clearStatus(500), 5000)
  }
  
  // Homepage Button Handler
  function handleHomepageClick() {
    setStatusMessage('Opening homepage in new tab...', true, 3000)
    window.open('https://chasingthesquirrel.com/doomstead/index.php', '_blank', 'noopener,noreferrer')
    setTimeout(() => clearStatus(500), 3000)
  }
  
  // Documentation Button Handler
  function handleBookClick() {
    const message = 'Example queries:\n\n"What are different kinds of plant diseases"\n\n"What is Stewart\'s wilt disease"'
    alert(message)
    setStatusMessage('Example queries displayed - copy them to the chat', true, 5000)
    setTimeout(() => clearStatus(500), 5000)
  }
  
  // ========== PROFILE MANAGEMENT ==========
  
  function switchProfile(profileName, configValue, toolTitle, statusMessage) {
    cleanupProfile()
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
      
      const chatbox = document.getElementById('chatbox')
      if (chatbox) chatbox.innerHTML = ''
      setTimeout(() => clearStatus(500), 8000)
    }).catch(error => {
      console.error('Profile switch error:', error)
      setStatusMessage('Error switching profile', true, 5000)
      setTimeout(() => clearStatus(500), 5000)
    })
  }
  
  function cleanupProfile() {
    const chatbox = document.getElementById('chatbox')
    if (chatbox) chatbox.innerHTML = ''
    
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    if (promptInput) {
      promptInput.disabled = true
      promptInput.value = ''
    }
    if (sendBtn) sendBtn.disabled = true
    
    if (modelPollingInterval) {
      clearInterval(modelPollingInterval)
      modelPollingInterval = null
    }
    modelLoadStatus = null
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
      .catch(error => {
        console.error('Failed to load toolbar config:', error)
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
    
    console.log('Toolbar visibility updated for profile:', currentProfile, 'Visible buttons:', visibleButtons)
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
      if (!modelLoadStatus) {
        clearStatus(0)
      }
    } else {
      if (!homeserverBtn.classList.contains('homeservershift')) {
        homeserverBtn.classList.add('homeservershift')
      }
      stackRunning = false
      cachedStatus = false
      if (!modelLoadStatus) {
        setStatusMessage('Waiting for service...', false)
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
    
    setStatusMessage('Checking Ollama...', false)
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
  
  let modelPollingInterval = null
  
  function pollModelStatus(expectedModel, profile) {
    if (modelPollingInterval) {
      clearInterval(modelPollingInterval)
    }
    
    modelPollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`assets/php/ollama_api.php?action=running_model`)
        const data = await response.json()
        
        if (data.success && data.model === expectedModel) {
          clearInterval(modelPollingInterval)
          modelPollingInterval = null
          modelLoadStatus = null
          setStatusMessage(`Model ready: ${expectedModel}`, true, 10000)
          
          const promptInput = document.getElementById('userInput')
          const sendBtn = document.getElementById('sendButton')
          if (promptInput) promptInput.disabled = false
          if (sendBtn) sendBtn.disabled = false
          
          setTimeout(() => {
            modelLoadStatus = null
            clearStatus(500)
          }, 10000)
        } else {
          setStatusMessage(`Loading model: ${expectedModel}...`, false)
        }
      } catch (error) {
        setStatusMessage(`Loading model: ${expectedModel}...`, false)
      }
    }, 1000)
  }
  
  // ========== UI HELPER FUNCTIONS ==========
  
  function updatestatus(text) {
    setStatusMessage(text, false)
  }
  
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
      homeserver: 'Start/Stop Stack',
      loadmodel: 'Load Model',
      runtask: 'Check Models',
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
      PlantDiseases: plantdiseases
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

    buttonlist.appendChild(addbuttondropdown('fileload', 'fileloadBTN', 'left', ['RAGcode', 'Doomstead', 'Mainpage', 'RAGdocs', 'Transcripts', 'PlantDiseases']))
    buttonlist.appendChild(addbutton('line1', 'dividerBTN', 'left', true))
    buttonlist.appendChild(addbutton('homeserver', 'homeserverBTN', 'left', false))
    buttonlist.appendChild(addbutton('fullbuild', 'dbuploadBTN', 'left', false))
    buttonlist.appendChild(addbutton('pastetranscript', 'pasteBTN', 'left', false))
    buttonlist.appendChild(addbutton('loadmodel', 'dogrunBTN', 'left', false))
    buttonlist.appendChild(addbutton('runtask', 'sailboatBTN', 'left', false))
    buttonlist.appendChild(addbutton('choosemodel', 'horuseyeBTN', 'left', false))
    buttonlist.appendChild(addbutton('stub', 'dbrefreshBTN', 'left', false))
    buttonlist.appendChild(addbutton('homepage', 'targetBTN', 'right', false))
    buttonlist.appendChild(addbutton('line5', 'dividerBTN', 'right', true))
    buttonlist.appendChild(addbutton('book', 'bookBTN', 'right', false))

    const statusLi = document.createElement('li')
    statusLi.style.float = 'right'

    statusDiv.id = 'status'
    statusDiv.className = 'status'
    statusDiv.textContent = 'Checking Ollama...'
    currentStatusMessage = 'Checking Ollama...'

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
        handleStackButtonClick()
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
    if (modelPollingInterval) {
      clearInterval(modelPollingInterval)
    }
    if (statusTimeout) {
      clearTimeout(statusTimeout)
    }
  })
  
  // ========== EXPOSE PUBLIC API ==========
  
  window.loadtoolbar = loadtoolbar
  window.updatestatus = updatestatus
  window.rebuild_vectorstore = rebuild_vectorstore
  window.loadModel = loadModel
  window.clearStatus = clearStatus
  window.setStatusMessage = setStatusMessage
  
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