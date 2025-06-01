# TODO

## Codebase Separation

### data/doomstead data/coderag
- **doomstead**: `/var/www/html/doomsteadRAG/assets/data/doomstead`  
- **coderag**: `/var/www/html/doomsteadRAG/assets/data/coderag`  

Each directory will have a vector store db and a sqlite db for file tracking.  Begin 
by enhancing the metadata in config.yaml to mark which project files belongs to.

On startup the default configuration is loaded, the dropdown will change the selection such as 
to textgenerationwebui.



Following is code which moves dropdown outside of toolbar.

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dropdown Outside Toolbar</title>
  <style>
    body {
      margin: 0;
      padding: 0;
    }

    .toolbar {
      position: relative;
      overflow: hidden;
      background: #333;
      color: white;
      padding: 10px;
      height: 50px;
    }

    #menu-button {
      position: relative;
      padding: 8px 12px;
      background: #555;
      border: none;
      color: white;
      cursor: pointer;
    }

    .dropdown-menu {
      position: absolute;
      display: none;
      background: white;
      color: black;
      border: 1px solid #ccc;
      padding: 10px;
      min-width: 150px;
      z-index: 9999;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
  </style>
</head>
<body>

  <div class="toolbar">
    <button id="menu-button">Menu</button>
  </div>

  <div class="dropdown-menu" id="menu-dropdown">
    <p>Item 1</p>
    <p>Item 2</p>
    <p>Item 3</p>
  </div>

  <script>
    const button = document.getElementById('menu-button')
    const dropdown = document.getElementById('menu-dropdown')

    button.addEventListener('mouseenter', () => {
      const rect = button.getBoundingClientRect()
      dropdown.style.left = rect.left + 'px'
      dropdown.style.top = rect.bottom + 'px'
      dropdown.style.display = 'block'
    })

    button.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (!dropdown.matches(':hover')) {
          dropdown.style.display = 'none'
        }
      }, 100)
    })

    dropdown.addEventListener('mouseleave', () => {
      dropdown.style.display = 'none'
    })

    dropdown.addEventListener('mouseenter', () => {
      dropdown.style.display = 'block'
    })
  </script>

</body>
</html>

Rendered html follows.

<body>
  <div class="toolbar">
    <button id="menu-button">Menu</button>
  </div>

  <div class="dropdown-menu" id="menu-dropdown" style="left: [X]px; top: [Y]px; display: block;">
    <p>Item 1</p>
    <p>Item 2</p>
    <p>Item 3</p>
  </div>
</body>


Monitoring last line should not skip lines.  Initialize a counter, and process lines from the last line processed to 
the end on every poll.