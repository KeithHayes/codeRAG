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
  let statusLock = false
  let modelPollingInterval = null
  
  // ========== TOOLBAR BUTTON HANDLERS ==========
  
  // File Set Dropdown Handlers
  function ragcode() {
    switchProfile('RAGcode', 'ragcode', 'Retrieval Argumentation Generation for Code', 'Switched to RAGcode profile. Click Load Model button to load model.')
  }

  function doomsteadcode() {
    switchProfile('Doomstead', 'doomstead', 'Retrieval Argumentation Generation for Code', 'Switched to Doomstead profile. Click Load Model button to load model.')
  }

  function mainpagecode() {
    switchProfile('Mainpage', 'mainpage', 'Retrieval Argumentation Generation for Code', 'Switched to Mainpage profile. Click Load Model button to load model.')
  }

  function ragdocs() {
    switchProfile('RAGdocs', 'ragdocs', 'Retrieval Argumentation Generation for Code', 'Switched to RAGdocs profile. Click Load Model button to load model.')
  }

  function transcripts() {
    switchProfile('Transcripts', 'transcript', 'Transcript Processor', 'Switched to Transcript profile. Click Load Model button to load model.')
  }

  function plantdiseases() {
    switchProfile('PlantDiseases', 'plantdiseases', 'Plant Diseases RAG - Based on 11pests1disease.pdf', 'Switched to PlantDiseases profile. Click Load Model button to load model.')
  }
  
  // Homeserver Button Handler
  function handleStackButtonClick() {
    const homeserverBtn = document.getElementById('homeserver')
    const isShifted = homeserverBtn && homeserverBtn.classList.contains('homeservershift')
    
    if (isUpdatingStack) {
      updatestatus('Operation already in progress...')
      return
    }
    
    if (isShifted) {
      isUpdatingStack = true
      modelLoadStatus = null
      updatestatus('Starting stack...')
      if (homeserverBtn) homeserverBtn.style.pointerEvents = 'none'
      
      fetch(`assets/php/ollama_api.php?action=start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(response => response.json())
      .then(data => {
        updatestatus(data.message || (data.success ? 'Stack started' : 'Start initiated'))
        setTimeout(() => {
          checkStackStatus()
          isUpdatingStack = false
          if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
        }, 3000)
      })
      .catch(error => {
        console.error('Start error:', error)
        updatestatus('Error starting stack')
        isUpdatingStack = false
        if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
      })
    } else {
      isUpdatingStack = true
      modelLoadStatus = null
      updatestatus('Stopping stack...')
      if (homeserverBtn) homeserverBtn.style.pointerEvents = 'none'
      
      fetch(`assets/php/ollama_api.php?action=stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(response => response.json())
      .then(data => {
        updatestatus('Stack stopped')
        setTimeout(() => {
          checkStackStatus()
          isUpdatingStack = false
          if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
        }, 2000)
      })
      .catch(error => {
        console.error('Stop error:', error)
        updatestatus('Error stopping stack')
        isUpdatingStack = false
        if (homeserverBtn) homeserverBtn.style.pointerEvents = ''
      })
    }
  }
  
  // Full Build Button Handler
  function rebuild_vectorstore() {
    updatestatus('Building FAISS vector store...')
    
    if (typeof BuildModal !== 'undefined') {
      const modal = new BuildModal()
      modal.startPolling()
      
      fetch('assets/php/full_builder.php', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (!data.success) {
          updatestatus('Build failed: ' + (data.error || 'Unknown error'))
        } else {
          updatestatus('Build started...')
        }
      })
      .catch((error) => {
        console.error('Build error:', error)
        updatestatus('Build failed - check logs')
      })
    } else {
      console.error('BuildModal not loaded')
      updatestatus('BuildModal not loaded - refresh page')
    }
  }
  
  // Paste Transcript Button Handler
  function handlePasteTranscriptClick() {
    if (typeof ClipboardModal === 'undefined') {
      console.error('ClipboardModal not loaded')
      updatestatus('ClipboardModal not loaded - refresh page')
      return
    }
    
    const modal = new ClipboardModal(
      function(transcript) {
        updatestatus('Sending transcript...')
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
            updatestatus('Transcript saved')
          } else {
            updatestatus('Failed to save transcript')
            alert('Failed to save transcript: ' + (data.error || 'Unknown error'))
          }
        })
        .catch(error => {
          console.error('Error:', error)
          updatestatus('Error saving transcript')
          alert('Error saving transcript: ' + error.message)
        })
      },
      function() {
        updatestatus('Paste cancelled')
      }
    )
  }
  
  // Load Model Button Handler
  function loadModel() {
    const statusDivElem = document.getElementById('status')
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    
    if (modelPollingInterval) {
      clearInterval(modelPollingInterval)
      modelPollingInterval = null
    }
    
    modelLoadStatus = null
    
    if (statusDivElem) statusDivElem.textContent = "Loading model..."
    
    fetch(`assets/php/force_reload_model.php?_=${Date.now()}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const successMsg = `Model ready: ${data.new_model}`
          modelLoadStatus = successMsg
          if (statusDivElem) statusDivElem.textContent = successMsg
          if (promptInput) promptInput.disabled = false
          if (sendBtn) sendBtn.disabled = false
          lockStatus(10000)
        } else if (data.status === 'loading') {
          if (statusDivElem) statusDivElem.textContent = `Loading model: ${data.new_model}...`
          pollModelStatus(data.new_model, data.profile)
        } else {
          modelLoadStatus = null
          if (statusDivElem) statusDivElem.textContent = data.message || "Failed to load"
          if (data.message && data.message.includes('not running')) {
            alert('Stack not running. Click homeserver button to start.')
          }
          if (promptInput) promptInput.disabled = true
          if (sendBtn) sendBtn.disabled = true
        }
      })
      .catch(error => {
        console.error("Load model error:", error)
        modelLoadStatus = null
        if (statusDivElem) statusDivElem.textContent = "Error loading"
        alert("Error: " + error.message)
        if (promptInput) promptInput.disabled = true
        if (sendBtn) sendBtn.disabled = true
      })
  }
  
  // Check Models Button Handler
  function handleCheckModelsClick() {
    updatestatus('Checking models...')
    
    fetch(`assets/php/ollama_api.php?action=list`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.models) {
          if (data.models.length === 0) {
            alert('No models found.\n\nPull a model: ollama pull deepseek-coder:6.7b')
            updatestatus('No models available')
          } else {
            const modelList = data.models.map(m => `${m.name} (${(parseInt(m.size) / 1024 / 1024 / 1024).toFixed(1)} GB)`).join('\n')
            alert(`Available models:\n\n${modelList}`)
            updatestatus(`${data.models.length} model(s) available`)
          }
        } else {
          updatestatus('Cannot connect to Ollama')
          alert('Cannot connect to Ollama. Is the stack running?')
        }
      })
      .catch(error => {
        console.error('Check model error:', error)
        updatestatus('Connection error')
        alert('Could not connect to Ollama. Is the stack running?')
      })
  }
  
  // Ollama API Docs Button Handler
  function handleFastapiClick() {
    window.open('https://github.com/ollama/ollama/blob/main/docs/api.md', '_blank', 'noopener,noreferrer')
  }
  
  // Refresh Vector Store Button Handler
  function refresh_vectorstore() {
    updatestatus('Refresh not implemented - use Full Build')
  }
  
  // Homepage Button Handler
  function handleHomepageClick() {
    window.open('https://chasingthesquirrel.com/doomstead/index.php', '_blank', 'noopener,noreferrer')
  }
  
  // Documentation Button Handler
  function handleBookClick() {
    updatestatus('Documentation coming soon')
  }
  
  // ========== PROFILE MANAGEMENT ==========
  
  function switchProfile(profileName, configValue, toolTitle, statusMessage) {
    cleanupProfile()
    const content = { "filesetconfig": configValue }
    fetch(`assets/php/save_config.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content)
    }).then(() => {
      const dropdown = document.getElementById('dropdown_fileload')
      if (dropdown) dropdown.style.display = 'none'
      colordropdowntext(profileName)
      currentProfile = configValue
      updateButtonVisibilityFromYaml()
      updatestatus(statusMessage)
      updatetooltitle(toolTitle)
    }).catch(error => {
      console.error('Profile switch error:', error)
      updatestatus('Error switching profile')
    })
  }
  
  function cleanupProfile() {
    const chatbox = document.getElementById("chatbox")
    if (chatbox) chatbox.innerHTML = ""
    
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    if (promptInput) {
      promptInput.disabled = true
      promptInput.value = ""
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
        
        const yamlFile = `assets/py/${profile}.yaml`
        
        return fetch(yamlFile + '?_=' + Date.now())
          .then(res => res.text())
          .then(yamlText => {
            const toolbarItems = parseToolbarFromYaml(yamlText)
            applyToolbarVisibility(toolbarItems)
          })
      })
      .catch(error => {
        console.error('Failed to load toolbar config:', error)
        const defaultItems = ['fileloadBTN', 'homeserver', 'full_build', 'loadmodel', 'fastapi', 'book', 'target']
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
          const match = line.match(/^\s*-\s+["']?([^"'\n]+)["']?/)
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
      'fileloadBTN': 'button_fileload',
      'homeserver': 'button_homeserver',
      'full_build': 'button_full_build',
      'pastetranscript': 'button_pastetranscript',
      'loadmodel': 'button_loadmodel',
      'checkmodel': 'button_checkmodel',
      'fastapi': 'button_fastapi',
      'vectordb': 'button_vectordb',
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
      if (!modelLoadStatus && !statusLock) {
        updatestatus('Ollama ready')
      }
    } else {
      if (!homeserverBtn.classList.contains('homeservershift')) {
        homeserverBtn.classList.add('homeservershift')
      }
      stackRunning = false
      cachedStatus = false
      if (!modelLoadStatus && !statusLock) {
        updatestatus('Waiting for service...')
      }
    }
  }
  
  function checkStackStatus() {
    if (isUpdatingStack) return
    if (statusLock) return
    
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
    
    updatestatus('Checking Ollama...')
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
  
  function lockStatus(ms) {
    statusLock = true
    setTimeout(() => {
      statusLock = false
      if (!modelLoadStatus) {
        if (stackRunning) {
          updatestatus('Ollama ready')
        } else {
          updatestatus('Waiting for service...')
        }
      }
    }, ms)
  }
  
  function pollModelStatus(expectedModel, profile) {
    if (modelPollingInterval) {
      clearInterval(modelPollingInterval)
    }
    
    let attempts = 0
    const maxAttempts = 60
    
    modelPollingInterval = setInterval(async () => {
      attempts++
      
      try {
        const response = await fetch(`assets/php/ollama_api.php?action=running_model`)
        const data = await response.json()
        
        if (data.success && data.model === expectedModel) {
          clearInterval(modelPollingInterval)
          modelPollingInterval = null
          modelLoadStatus = null
          updatestatus(`Model ready: ${expectedModel}`)
          lockStatus(10000)
          
          const promptInput = document.getElementById('userInput')
          const sendBtn = document.getElementById('sendButton')
          if (promptInput) promptInput.disabled = false
          if (sendBtn) sendBtn.disabled = false
        } else if (attempts >= maxAttempts) {
          clearInterval(modelPollingInterval)
          modelPollingInterval = null
          modelLoadStatus = null
          updatestatus('Model load timeout - click Load Model again')
        } else {
          updatestatus(`Loading model: ${expectedModel}... (${Math.round(attempts / maxAttempts * 100)}%)`)
        }
      } catch (error) {
        updatestatus(`Loading model: ${expectedModel}...`)
      }
    }, 500)
  }
  
  // ========== UI HELPER FUNCTIONS ==========
  
  function updatestatus(text) {
    if (statusDiv) {
      statusDiv.textContent = text
    }
  }
  
  function updatetooltitle(text) {
    let banner = document.getElementById("tooltitle")
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
      full_build: 'Rebuild Vector Store',
      vectordb: 'Refresh Vector Store',
      homeserver: 'Start/Stop Stack',
      loadmodel: 'Load Model',
      checkmodel: 'Check Models',
      pastetranscript: 'Paste Transcript',
      fastapi: 'Ollama API Docs',
      homepage: 'Homepage',
      book: 'Documentation'
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
    const bar = document.getElementById("coderagtoolbar")
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
    buttonlist.appendChild(addbutton('full_build', 'dbuploadBTN', 'left', false))
    buttonlist.appendChild(addbutton('pastetranscript', 'pasteBTN', 'left', false))
    buttonlist.appendChild(addbutton('loadmodel', 'dogrunBTN', 'left', false))
    buttonlist.appendChild(addbutton('checkmodel', 'sailboatBTN', 'left', false))
    buttonlist.appendChild(addbutton('fastapi', 'horuseyeBTN', 'left', false))
    buttonlist.appendChild(addbutton('vectordb', 'dbrefreshBTN', 'left', false))
    buttonlist.appendChild(addbutton('homepage', 'targetBTN', 'right', false))
    buttonlist.appendChild(addbutton('line5', 'dividerBTN', 'right', true))
    buttonlist.appendChild(addbutton('book', 'bookBTN', 'right', false))

    const statusLi = document.createElement('li')
    statusLi.style.float = 'right'

    statusDiv.id = 'status'
    statusDiv.className = 'status'
    statusDiv.textContent = 'Checking Ollama...'

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

    // Attach button event handlers
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
    
    const fullBuildButton = document.querySelector('#button_full_build a')
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
    
    const sailboatButton = document.querySelector('#button_checkmodel a')
    if (sailboatButton) {
      sailboatButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        handleCheckModelsClick()
        return false
      }
    }
    
    const horuseyeButton = document.querySelector('#button_fastapi a')
    if (horuseyeButton) {
      horuseyeButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        handleFastapiClick()
        return false
      }
    }
    
    const refreshButton = document.querySelector('#button_vectordb a')
    if (refreshButton) {
      refreshButton.onclick = function(e) {
        e.preventDefault()
        e.stopPropagation()
        refresh_vectorstore()
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
  }
  
  // ========== CLEANUP ON PAGE UNLOAD ==========
  
  window.addEventListener('beforeunload', function() {
    stopStackChecker()
    if (modelPollingInterval) {
      clearInterval(modelPollingInterval)
    }
  })
  
  // ========== EXPOSE PUBLIC API ==========
  
  window.loadtoolbar = loadtoolbar
  window.updatestatus = updatestatus
  window.rebuild_vectorstore = rebuild_vectorstore
  window.loadModel = loadModel
  
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