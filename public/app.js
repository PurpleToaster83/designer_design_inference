  // Grid setup - 8x8 grid with 4 yellow target squares
  const gridSize = 8;
  const targetSquares = [
  { row: 1, col: 1 }, // Top-left corner area
  { row: 1, col: 6 }, // Top-right corner area
  { row: 6, col: 1 }, // Bottom-left corner area
  { row: 6, col: 6 }  // Bottom-right corner area
  ];

  let assignments = {}; // Track which flasks are assigned to which squares
  let assignedCount = 0;

  // Initialize grid
  function initializeGrid() {
      const grid = document.getElementById('grid');
      grid.innerHTML = '';
      
      for (let row = 0; row < gridSize; row++) {
          for (let col = 0; col < gridSize; col++) {
          const cell = document.createElement('div');
          cell.className = 'grid-cell';
          cell.dataset.row = row;
          cell.dataset.col = col;
              
          // Check if this cell is a target square
          const isTarget = targetSquares.some(target => target.row === row && target.col === col);
          if (isTarget) {
              cell.classList.add('target');
          }
              
          // Add drop event listeners
          cell.addEventListener('dragover', handleDragOver);
          cell.addEventListener('drop', handleDrop);
          cell.addEventListener('dragenter', handleDragEnter);
          cell.addEventListener('dragleave', handleDragLeave);
          cell.addEventListener('click', handleCellClick);
              
          grid.appendChild(cell);
          }
      }
  }

  // Initialize flasks
  function initializeFlasks() {
      const flasks = document.querySelectorAll('.flask');
      flasks.forEach(flask => {
          flask.addEventListener('dragstart', handleDragStart);
          flask.addEventListener('dragend', handleDragEnd);
      });
  }

  // Drag and drop handlers
  function handleDragStart(e) {
      if (e.target.classList.contains('assigned')) {
          e.preventDefault();
          return;
      }
      
      e.dataTransfer.setData('text/plain', e.target.dataset.flask);
      e.target.classList.add('dragging');
      }

  function handleDragEnd(e) {
      e.target.classList.remove('dragging');
  }

  function handleDragOver(e) {
      if (e.currentTarget.classList.contains('target') && !e.currentTarget.classList.contains('occupied')) {
          e.preventDefault();
      }
  }

  function handleDragEnter(e) {
      if (e.currentTarget.classList.contains('target') && !e.currentTarget.classList.contains('occupied')) {
          e.currentTarget.classList.add('drop-target');
      }
      }

  function handleDragLeave(e) {
      e.currentTarget.classList.remove('drop-target');
  }

  function handleDrop(e) {
      e.preventDefault();
      e.currentTarget.classList.remove('drop-target');
      
      if (!e.currentTarget.classList.contains('target') || e.currentTarget.classList.contains('occupied')) {
          return;
      }
      
      const flaskType = e.dataTransfer.getData('text/plain');
      const row = parseInt(e.currentTarget.dataset.row);
      const col = parseInt(e.currentTarget.dataset.col);
      
      assignFlask(flaskType, row, col);
  }

  function handleCellClick(e) {
      if (e.currentTarget.classList.contains('occupied')) {
          const row = parseInt(e.currentTarget.dataset.row);
          const col = parseInt(e.currentTarget.dataset.col);
          removeFlask(row, col);
      }
  }

  function assignFlask(flaskType, row, col) {
      const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      const flask = document.querySelector(`[data-flask="${flaskType}"]`);
      
      if (!cell || !flask || flask.classList.contains('assigned')) return;
      
      // Create flask in grid
      const flaskInGrid = document.createElement('div');
      flaskInGrid.className = `flask-in-grid ${flaskType}`;
      flaskInGrid.textContent = flask.textContent;
      flaskInGrid.dataset.flask = flaskType;
      
      cell.appendChild(flaskInGrid);
      cell.classList.add('occupied');
      
      // Mark original flask as assigned
      flask.classList.add('assigned');
      
      // Track assignment
      assignments[`${row}-${col}`] = flaskType;
      assignedCount++;
      
      updateStatus();
  }

  function removeFlask(row, col) {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    const flaskInGrid = cell.querySelector('.flask-in-grid');
    
    if (!flaskInGrid) return;
    
    const flaskType = flaskInGrid.dataset.flask;
    const originalFlask = document.querySelector(`.flask[data-flask="${flaskType}"]`);
    
    // Remove from grid
    flaskInGrid.remove();
    cell.classList.remove('occupied');
    
    // Restore original flask
    if (originalFlask) {
        originalFlask.classList.remove('assigned');
    }
    
    // Remove from assignments
    delete assignments[`${row}-${col}`];
    assignedCount--;
    
    updateStatus();
  }

  function updateStatus() {
      const status = document.getElementById('status');
      status.textContent = `${assignedCount}/4 squares assigned`;
  }

  function resetAssignments() {
    // Clear all assignments
    Object.keys(assignments).forEach(key => {
        const [row, col] = key.split('-').map(Number);
        removeFlask(row, col);
    });
  }

  function submitAssignment() {
      pass
      //TODO: save and initGrid for the next
  }

  // Initialize the app
  initializeGrid();
  initializeFlasks();
  updateStatus();

  // $scope.stimuli_sets = [[1]]

  // $scope.stimuli_set_length = $scope.stimuli_sets[0].length;
  // instructions = [
  // {
  //     text: `Welcome to our guessing game!
  //         <br><br>
  //         Before you begin your task, you'll complete a brief guided tutorial (~ 2 minutes) to understand the game.
  //         <br><br>
  //         Press <strong>Next</strong> to continue.`,
  // }
  // ];

  // stimuli = [
  // {
  //     "name": "1_1",
  //     "potions": 2,
  //     "poisons": 2,
  //     "target_squaress": [
  //     { row: 0, col: 1 },
  //     { row: 6, col: 2 },
  //     { row: 2, col: 3 },
  //     { row: 1, col: 6 },
  //     ],
  //     "map_layout": [
  //     [0, 0, 0, 0, 0, 0, 0],
  //     [0, 0, 0, 0, 0, 0, 0],
  //     [0, 0, 0, 0, 0, 0, 0],
  //     [0, 0, 0, 1, 0, 0, 0],
  //     [0, 0, 0, 1, 0, 0, 0],
  //     [0, 0, 0, 1, 0, 0, 0],
  //     [0, 0, 0, 1, 0, 0, 0]
  //     ],
  //     "monster_pos": [6, 5],
  //     "player_pos": [1, 3]
  // },
  // //TODO: fill out the rest
  // ]