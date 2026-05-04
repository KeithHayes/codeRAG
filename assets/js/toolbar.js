// assets/js/toolbar.js
(function () {
  const statusDiv = document.createElement('div')
  
  let currentProfile = 'ragcode'
  let stackRunning = false
  let stackCheckInterval = null
  let isUpdatingStack = false
  let lastStatusCheck = 0
  let cachedStatus = false
  let statusTimeout = null
  
  // ========== SIMPLIFIED STATUS MANAGEMENT ==========
  
  function setStatusMessage(message, duration = null) {
    if (!statusDiv) return
    
    // Handle empty/IDLE states
    if (!message) {
      if (stackRunning) {
        statusDiv.textContent = ''
      } else {
        statusDiv.textContent = 'Waiting for service...'
      }
    } else {
      statusDiv.textContent = message
    }
    
    // Clear any existing timeout
    if (statusTimeout) {
      clearTimeout(statusTimeout)
      statusTimeout = null
    }
    
    // Auto-clear after duration if specified
    if (duration) {
      statusTimeout = setTimeout(() => {
        setStatusMessage('')
        statusTimeout = null
      }, duration)
    }
  }
  
  function enableChatInputs() {
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    if (promptInput) promptInput.disabled = false
    if (sendBtn) sendBtn.disabled = false
    if (promptInput) promptInput.focus()
  }
  
  function disableChatInputs() {
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    if (promptInput) promptInput.disabled = true
    if (sendBtn) sendBtn.disabled = true
  }
  
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
    let profileName = currentProfile.charAt(0).toUpperCase() + currentProfile.slice(1)
    setStatusMessage(`Building ${profileName} vector store...`, null)
    
    if (typeof BuildModal !== 'undefined') {
      const modal = new BuildModal()
      modal.startPolling()
      
      const originalUpdateProgress = modal.updateProgress
      modal.updateProgress = function(percent, status) {
        if (originalUpdateProgress) originalUpdateProgress.call(modal, percent, status)
        if (percent !== undefined) {
          setStatusMessage(`Building ${profileName} vector store... ${percent}%`)
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
          setStatusMessage(`${profileName} vector store build failed`, 5000)
        } else {
          setStatusMessage(`${profileName} vector store build completed`, 3000)
        }
      })
      .catch(() => {
        setStatusMessage(`${profileName} vector store build failed`, 5000)
      })
    } else {
      console.error('BuildModal not loaded')
      setStatusMessage('BuildModal not loaded', 5000)
    }
  }
  
  function handlePasteTranscriptClick() {
    if (typeof ClipboardModal === 'undefined') {
      console.error('ClipboardModal not loaded')
      setStatusMessage('ClipboardModal not loaded', 5000)
      return
    }
    
    const modal = new ClipboardModal(
      function(transcript) {
        setStatusMessage('Saving transcript...', null)
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
            setStatusMessage('Transcript saved successfully', 2000)
          } else {
            setStatusMessage('Transcript save failed', 5000)
            alert('Failed to save transcript: ' + (data.error || 'Unknown error'))
          }
        })
        .catch(() => {
          setStatusMessage('Transcript save failed', 5000)
          alert('Error saving transcript')
        })
      },
      function() {
        setStatusMessage('')
      }
    )
  }
  
  function loadModel() {
    const promptInput = document.getElementById('userInput')
    const sendBtn = document.getElementById('sendButton')
    let profileName = currentProfile.charAt(0).toUpperCase() + currentProfile.slice(1)
    
    fetch(`assets/php/rag.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_model_name' })
    })
      .then(response => response.json())
      .then(nameData => {
        const modelName = nameData.model_name || 'unknown'
        
        setStatusMessage(`Loading model: ${modelName}...`, null)
        disableChatInputs()
        
        fetch(`assets/php/force_reload_model.php?_=${Date.now()}`)
          .then(response => response.json())
          .then(loadData => {
            if (loadData.success && (loadData.status === 'loaded' || loadData.status === 'already_running')) {
              setStatusMessage(`Model ready: ${modelName}`, 4000)
              enableChatInputs()
            } else if (loadData.status === 'loading') {
              setStatusMessage(`Loading model: ${modelName}...`, null)
              disableChatInputs()
            } else {
              setStatusMessage(`Model load failed: ${modelName} - ${loadData.message || 'Failed to load model'}`, 5000)
              if (loadData.message && loadData.message.includes('not running')) {
                alert('Stack not running.')
              }
              disableChatInputs()
            }
          })
          .catch(error => {
            console.error('Load model error:', error)
            setStatusMessage(`Model load failed: ${modelName} - ${error.message}`, 5000)
            alert('Error: ' + error.message)
            disableChatInputs()
          })
      })
      .catch(error => {
        console.error('Get model name error:', error)
        setStatusMessage(`Model load failed: unknown - ${error.message}`, 5000)
        alert('Error getting model name: ' + error.message)
        disableChatInputs()
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
    setStatusMessage('Running transcript pipeline...', 3000)
    
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
        setStatusMessage('')
        return
      }
      
      setStatusMessage('Processing transcript...', null)
      
      const result = await transcriptmodule.processtranscript()
      
      const chatbox = document.getElementById('chatbox')
      if (chatbox) {
        chatbox.innerHTML = ''
        const messageDiv = document.createElement('div')
        messageDiv.className = 'message bot'
        messageDiv.innerHTML = '<strong>Assistant:</strong> <p>' + result.replace(/\n/g, '<br>') + '</p>'
        chatbox.appendChild(messageDiv)
      }
      
      setStatusMessage('')
      
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
      
      setStatusMessage(`Error: ${errorMessage}`, 5000)
      alert(errorMessage)
    }
  }
  
  function handlechoosemodelClick() {
    if (stackRunning) {
      setStatusMessage('', 3000)
    } else {
      setStatusMessage('Waiting for service...', 3000)
    }
    
    if (typeof ModelModal !== 'undefined') {
      new ModelModal()
    }
  }
  
  function function_stub() {
    setStatusMessage('Refresh not implemented - use Full Build', 5000)
  }
  
  function handleHomepageClick() {
    window.open('https://chasingthesquirrel.com/doomstead/index.php', '_blank', 'noopener,noreferrer')
    if (stackRunning) {
      setStatusMessage('')
    } else {
      setStatusMessage('Waiting for service...')
    }
  }
  
  function handleBookClick() {
    const message = 'Example queries:\n\nWhat is the current implementation of the FAISS vector store builder, and how does the specification document describe the expected behavior of the state machine for model loading states?\n\nWhat are different kinds of plant diseases\n\nWhat is Stewart\'s wilt disease'
    alert(message)
    if (stackRunning) {
      setStatusMessage('')
    } else {
      setStatusMessage('Waiting for service...')
    }
  }
  
  // ========== PROFILE MANAGEMENT ==========
  
  function switchProfile(profileName, configValue, toolTitle) {
    setStatusMessage(`Switching to ${profileName} profile...`, 3000)
    
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
      setStatusMessage('')
    }).catch(() => {
      setStatusMessage('Error switching profile', 5000)
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
      setStatusMessage('')
    } else {
      if (!homeserverBtn.classList.contains('homeservershift')) {
        homeserverBtn.classList.add('homeservershift')
      }
      stackRunning = false
      cachedStatus = false
      setStatusMessage('Waiting for service...')
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
    
    setStatusMessage('Checking Ollama service...')
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
          setStatusMessage('')
        } else {
          setStatusMessage('Waiting for service...')
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
    if (statusTimeout) {
      clearTimeout(statusTimeout)
    }
  })
  
  // ========== EXPOSE PUBLIC API ==========
  
  window.loadtoolbar = loadtoolbar
  window.updatestatus = function() {}
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