// Get a reference to the database service
const root = firebase.database().ref();
const resultsRef = root.child("results");
const counterRef = root.child("counter");
const counterKey = "count";

var experimentApp = angular.module(
  'experimentApp', ['ngSanitize', 'preloader'],
  function($locationProvider) {
    $locationProvider.html5Mode({enabled: true, requireBase: false});
  }
);
var start_time;

experimentApp.controller('ExperimentController',
  function ExperimentController($scope, $timeout, $location, preloader) {
    $scope.user_id = Date.now();

    $scope.section = "instructions";
    $scope.inst_id = 0;
    $scope.stim_id = 0;
    $scope.part_id = -1;

    $scope.valid_comprehension = false;
    $scope.comprehension_response = "";

    $scope.response = {
      "beliefs": [NaN, NaN],
      "belief_ids": [1, 2]
    };

    $scope.valid_belief = false;

    $scope.valid_exam = false;
    $scope.exam_score = 0;
    $scope.exam_results = [];
    $scope.exam_done = false;
    $scope.last_exam_correct = false;
    $scope.last_exam_response = "";

    $scope.show_rhs = true;
    $scope.anim_complete = true;

    $scope.belief_statements = [];
    $scope.belief_statement_ids = [];
    $scope.belief_statement_counts = [];
    $scope.n_displayed_statements = 4;

    $scope.ratings = [];

    $scope.replaying = false;
    $scope.replay_id = 0;

    $scope.user_count = 0;

    $scope.assignments = {}; // Track which flasks are assigned to which squares
    $scope.assignedCount = 0;

    $scope.blah = true;


    $scope.log = function (...args) {
      if ($location.search().debug == "true") {
        console.log(...args);
      }
    }

    $scope.store_to_db = function (key, val) {
      $scope.log("Storing " + key + " with " + JSON.stringify(val));
      if ($location.search().local != "true") {
        resultsRef.child(key).set(val);
      }
    }

    $scope.get_counter = async function () {
      if ($location.search().local == "true") {
        let max = $scope.stimuli_sets.length
        return Math.floor(Math.random() * max);
      } else {
        return counterRef.child(counterKey).once("value", function (snapshot) {
          $scope.user_count = snapshot.val();
        }).then(() => { return $scope.user_count; });
      }
    }
    
    $scope.increment_counter = function () {
      if ($location.search().local == "true") {
        return;
      } else {
        counterRef.child(counterKey).set($scope.user_count + 1);
      }
    }

    $scope.validate_answer = function (ans) {
      $scope.comprehension_response = ans;
      let index = $scope.instructions[$scope.inst_id].answer;
      $scope.valid_comprehension = ans == $scope.instructions[$scope.inst_id].options[index];
    }

    $scope.validate_belief = function () {
      $scope.valid_belief = $scope.response.beliefs.every(rating => !isNaN(rating));
    }

    $scope.validate_exam = function (ans) {
      $scope.exam_response = ans;
      $scope.valid_exam = true;
    }

    $scope.advance = async function () {
      if ($scope.section == "instructions") {
        await $scope.advance_instructions()
      } else if ($scope.section == "stimuli") {
        await $scope.advance_stimuli()
      } else if ($scope.section == "endscreen") {
        // Do nothing
      }
    };
    
    $scope.advance_instructions = async function () {
      if ($scope.inst_id == $scope.instructions.length - 1) {
        // Initialize stimuli section
        $scope.section = "stimuli";
        $scope.stim_id = 0;
        $scope.part_id = 0;
        $scope.ratings = [];
        $scope.anim_complete = true;
        await $scope.set_belief_statements($scope.stim_id);
        // Get time of first stimulus
        if (start_time == undefined) {
          start_time = (new Date()).getTime();
        }
      } else if ($scope.instructions[$scope.inst_id].exam_end) {
        // Store exam results for initial attempt
        if (!$scope.exam_done) {
          let exam_data = {
            "results": $scope.exam_results,
            "score": $scope.exam_score
          }
          $scope.log("Exam Results: " + exam_data.results);
          $scope.log("Exam Score: " + exam_data.score);
          $scope.store_to_db($scope.user_id + "/exam", exam_data);
          $scope.exam_done = true;
        }
        // Loop back to start of exam if not all questions are correct
        if ($scope.exam_score < $scope.exam_results.length) {
          $scope.inst_id = $scope.instructions[$scope.inst_id].exam_start_id;
        } else {
          $scope.inst_id = $scope.inst_id + 1;
        }
        $scope.exam_results = [];
        $scope.exam_score = 0;
      } else {
        // Score exam question
        if ($scope.instructions[$scope.inst_id].exam) {
          let ans = $scope.instructions[$scope.inst_id].options[$scope.instructions[$scope.inst_id].answer];
          let correct = ans === $scope.exam_response;
          $scope.exam_results.push(correct);
          $scope.exam_score = $scope.exam_results.filter(correct => correct == true).length
          $scope.last_exam_correct = correct;
          $scope.last_exam_response = $scope.exam_response;
        }
        // Increment instruction counter
        $scope.inst_id = $scope.inst_id + 1;
        // Delay RHS display
        if ($scope.instructions[$scope.inst_id].delay > 0) {
          $scope.show_rhs = false;
          $timeout(function () { $scope.show_rhs = true; },
            $scope.instructions[$scope.inst_id].delay);
        }
        // Set new belief statements
        if ($scope.has_belief_question()) {
          $scope.belief_statements = $scope.instructions[$scope.inst_id].statements;
          let n = $scope.belief_statements.length;
          $scope.belief_statement_ids = Array.from(Array(n).keys());
        }
      }
      $scope.reset_response();
      $scope.valid_belief = false;
      $scope.comprehension_response = "";
      $scope.valid_comprehension = false;
      $scope.exam_response = "";
      $scope.valid_exam = false;
    };

    $scope.advance_stimuli = async function () {
      if ($scope.stim_id == $scope.stimuli_set.length) {
        // Advance to endscreen
        $scope.section = "endscreen"
      } else if ($scope.part_id < 0) {
        // Advance to first part
        $scope.part_id = $scope.part_id + 1;
        $scope.ratings = [];
        
        await $scope.set_belief_statements($scope.stim_id);
        $scope.anim_complete = true;
        start_time = (new Date()).getTime();
      } else if ($scope.part_id < $scope.stimuli_set[$scope.stim_id].length) {
        // Advance to next part
        if ($scope.part_id > 0) {
          var step_ratings = $scope.compute_ratings($scope.response);
          $scope.ratings.push(step_ratings);
          $scope.log(step_ratings);
        }
        $scope.part_id = $scope.part_id + 1;
        if ($scope.part_id == $scope.stimuli_set[$scope.stim_id].length) {
          // Store ratings
          $scope.store_to_db($scope.user_id + "/" + $scope.stimuli_set[$scope.stim_id].name, $scope.ratings);
          // Advance to next problem.
          $scope.part_id = -1;
          $scope.stim_id = $scope.stim_id + 1;
          $scope.anim_complete = true;
          if ($scope.stim_id < $scope.stimuli_set.length) {
            preloader.preloadImages($scope.stimuli_set[$scope.stim_id].images).then(
              function handleResolve(imglocs) { console.info("Preloaded next stimulus."); });
          }
        } else {
          // Begin timer to set animation completion flag
          $scope.anim_complete = false;
          anim_duration = $scope.cur_stim_anim_duration() * 333;
          $timeout(function () { $scope.anim_complete = true; }, anim_duration);
        }
      }
      $scope.reset_response();
      $scope.valid_belief = false;
    };

    $scope.compute_ratings = function (response) {
      let cur_stim = $scope.stimuli_set[$scope.stim_id];
      // Create array of belief ratings for every statement
      let n_ratings = cur_stim.statements.length;
      let statement_ratings = Array(n_ratings).fill(-1);
      response.beliefs.forEach((rating, index) => {
        statement_ratings[$scope.belief_statement_ids[index]] = rating;
      });

      // Normalize belief ratings
      let min_rating = 1;
      let max_rating = 7;
      let statement_probs = statement_ratings.map(
        (x) => x > 0 ? (x - min_rating) / (max_rating - min_rating) : x
      );

      rating = {
        "timestep": cur_stim.times[$scope.part_id],
        "time_spent": ((new Date()).getTime() - start_time) / 1000.,
        "statement_ratings": statement_ratings,
        "statement_probs": statement_probs,
        "statement_ids": response.belief_ids.map(v => v + 1),
      }
      return rating;
    };

    $scope.instruction_has_text = function () {
      return $scope.instructions[$scope.inst_id].text != null
    };
    $scope.instruction_has_image = function () {
      return $scope.instructions[$scope.inst_id].image != null
    };
    $scope.instruction_has_question = function () {
      return $scope.instructions[$scope.inst_id].question != null
    };
    $scope.is_exam = function () {
      return $scope.instructions[$scope.inst_id].exam == true
    };
    $scope.is_feedback = function () {
      return $scope.instructions[$scope.inst_id].feedback == true
    };
    $scope.is_exam_end = function () {
      return $scope.instructions[$scope.inst_id].exam_end == true
    };
    $scope.is_tutorial = function () {
      return $scope.instructions[$scope.inst_id].tutorial == true
    };
    $scope.hide_questions = function () {
      if ($scope.section == "stimuli") {
        return $scope.part_id < 0
      } else if ($scope.section == "instructions") {
        return $scope.instructions[$scope.inst_id].show_questions == false
      }
      return true
    };

    $scope.cur_stim_image = function () {
      if ($scope.section != "stimuli" || $scope.stim_id < 0) {
        return "images/poison.png"
      } else if ($scope.part_id < 0) {
        return $scope.stimuli_set[$scope.stim_id - 1].images.slice(-1)[0]
      } else if ($scope.replaying) {
        let stim = $scope.stimuli_set[$scope.stim_id];
        return stim.images[$scope.replay_id];
      } else {
        let stim = $scope.stimuli_set[$scope.stim_id];
        return stim.images[$scope.part_id];
      }
    };

    $scope.cur_stim_anim_duration = function () {
      let stimulus = $scope.stimuli_set[$scope.stim_id];
      return $scope.stim_anim_duration(stimulus, $scope.part_id);
    }

    $scope.stim_anim_duration = function (stimulus, part_id) {
      if (part_id <= 0 || part_id == stimulus.length) {
        return 0
      } else {
        t_start = stimulus.times[part_id - 1];
        t_stop = stimulus.times[part_id];
        return t_stop - t_start
      }
    }

    $scope.array_equals = function (a, b) {
      return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
    }

    $scope.array_shuffle = function (arr) {
      return arr.map(a => [a, Math.random()])
        .sort((a, b) => { return a[1] < b[1] ? -1 : 1; }).map(a => a[0]);
    }

    $scope.array_sample = function (arr, n) {
      return $scope.arr.slice(0, n);
    }

    $scope.stimuli_set = [];
    $scope.set_stimuli = async function () {
      // Uncomment for testing stimuli
      let stim_idx = [];
      if ($location.search().test_all == "true") {
        stim_idx = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
          11, 12, 13, 14, 15, 16, 17, 18];
      } else {
        let count = await $scope.get_counter();
        stim_idx = $scope.stimuli_sets[count % $scope.stimuli_sets.length];
      }

      $scope.log("stimuli idx = ", stim_idx);
      for (i = 0; i < stim_idx.length; i++) {
        $scope.stimuli_set.push($scope.stimuli[stim_idx[i] - 1]);
      }
      $scope.log("stimuli ", $scope.stimuli_set);

      // Store stimuli set and user ID
      $scope.store_to_db($scope.user_id + "/stimuli_set", stim_idx);
      $scope.store_to_db($scope.user_id + "/user_id", $scope.user_id);

      // Increment participant counter
      if ($location.search().test_all != "true") {
        $scope.increment_counter();
      }

      // Preload first stimulus
      preloader.preloadImages($scope.stimuli_set[0].images).then(
        function handleResolve(imglocs) {
          console.info("Preloaded first stimulus.");
        }
      );
    };

    $scope.stimuli_sets = [
      [1, 4, 7, 10, 13, 16, 19, 22, 25, 28],
      [2, 5, 8, 11, 14, 17, 20, 23, 26, 29],
      [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]
    ]

    $scope.stimuli_set_length = $scope.stimuli_sets[0].length;
    $scope.instructions = [
      {
        text: `Welcome to our flask placement game!
              <br><br>
              Before you begin your task, you'll complete a brief guided tutorial (~ 2 minutes) to understand the game.
              <br><br>
              Press <strong>Next</strong> to continue.`,
      },
      {
        text: `You're currently looking at an empty map that you, the designer, must set up.
              <br><br>
              The player controls a character <img class="caption-image" src="images/human.png">,
              and their goal is to defeat the a monster <img class="caption-image" src="images/monster.png"> by collecting potions
              <img class="caption-image" src="images/potion.png"> and avoiding posions <img class="caption-image" src="images/poison.png">.
              To the player, <strong>all flasks look the same</strong> <img class="caption-image" src="images/potion.png">.
              Your task is to place the potions and poisons in a logical place so that the player can correctly
              pickup the potions <strong>but not</strong> the poisons.
              
              <br><br>
              The rules of the game are as follows:
              <br>
              <ul>
              <li> Flasks must be placed in one of the yellow squares on the map.</li>
              <li> <strong>All</strong> available flasks must be placed.</li>
              <li> All squares <strong>do not</strong> need to be filled.</li>
              <li> You may reset the active map at any time using the <strongreset</strong> button.</li>
              <li> Once you have finished designing a map, press the <strong>submit</strong> button.</li>
              <li> The player <strong>does not</strong> know what's in each flask.</li>
              </ul>
              Your task is to place the potions in a location that you think will be <strong>helpful and logical</strong> to the player while placing the poisons in locations that the player would know to <strong>avoid</strong> them
              based on the player being rational.<br>
              <br>
              Press the <strong>Next</strong> button to continue.
              `,
        image: "images/poison.png"
      },
      {
        text: `Please look at the following map and place the flasks appropriatly<br>
              <br>
              press the <strong>submit</strong> button when you have finished`,
        tutorial: true,
        show_questions: true,
        question_types: ["beliefs"],
        statements: ["Flask <strong>A</strong> is: ",
          "Flask <strong>B</strong> is:"],
        image: "images/poison.png",
      },
      {
        text: `You've now finished the practice round and the player can fight the monster using the potions and poisons you've collected!`
      },
      {
        text: `<strong>Comprehension Questions</strong> <br>
               <br>
               For the last part of the tutorial, we will ask 5 quick questions to check your understanding of the task.<br>
               <br>
               Answer <strong>all questions correctly</strong> in order to proceed to the main experiment.
               You can retake the quiz as many times as necessary.
              `
      },
      {
        text: `<strong>Question 1/5:</strong> What is the player investigating?`,
        options: ["The map",
          "The flasks",
          "The monster"],
        answer: 1,
        exam: true
      },
      {
        text: `<strong>Question 1/5:</strong>  What is the player investigating?`,
        options: ["The map",
          "The flasks",
          "The monster"],
        answer: 1,
        feedback: true
      },
      {
        text: `<strong>Question 2/5:</strong> What is your task in this game?`,
        options: ["Run away from the monster",
          "Explore the map",
          "Guess the identity of the liquid in each flask"],
        answer: 2,
        exam: true
      },
      {
        text: `<strong>Question 2/5:</strong> What is your task in this game?`,
        options: ["Run away from the monster",
          "Explore the map",
          "Guess the identity of the liquid in each flask"],
        answer: 2,
        feedback: true
      },
      {
        text: `<strong>Question 3/5:</strong> Which of the following is true?`,
        options: ["The player has <strong> no definite knowledge </strong> about the contents of each flask.",
          "The player <strong> knows perfectly </strong> what's inside each flask.",
          "The player <strong> might know exactly </strong> what's in each flask, but <strong> might also be unsure. </strong>"],
        answer: 0,
        exam: true
      },
      {
        text: `<strong>Question 3/5:</strong> Which of the following is true?`,
        options: ["The player has <strong> no definite knowledge </strong> about the contents of each flask.",
          "The player <strong> knows perfectly </strong> what's inside each flask.",
          "The player <strong> might know exactly </strong> what's in each flask, but <strong> might also be unsure. </strong>"],
        answer: 0,
        feedback: true
      },
      {
        text: `<strong>Question 4/5:</strong> Which of the following is true?`,
        options: ["The map designer placed the flasks logically and helpfully.",
          "The map designer placed the flasks randomly.",
          "The flasks are all potions."],
        answer: 0,
        exam: true
      },
      {
        text: `<strong>Question 4/5:</strong> Which of the following is true?`,
        options: ["The map designer placed the flasks logically and helpfully.",
          "The map designer placed the flasks randomly.",
          "The flasks are all potions."],
        answer: 0,
        feedback: true
      },
      {
        text: `<strong>Question 5/5:</strong> How can you tell what liquid is in the flask?`,
        options: ["Guess <strong>either potion or poison</strong> and hope for the best",
          "The liquid type is explicitly stated somewhere on the map",
          "Try your best to infer the liquid type knwoing the designer placed them logically"],
        answer: 2,
        exam: true
      },
      {
        text: `<strong>Question 5/5:</strong> How can you tell what liquid is in the flask?`,
        options: ["Guess <strong>either potion or poison</strong> and hope for the best",
          "The liquid type is explicitly stated somewhere on the map",
          "Try your best to infer the liquid type knwoing the designer placed them logically"],
        answer: 2,
        feedback: true
      },
      {
        exam_end: true,
        exam_start_id: 11
      },
      {
        text: `Congratulations! You've finished the tutorial.
               <br><br>
               You will now play the game for 10 different rounds.
               <br><br>
               Ready to start? Press <strong>Next</strong> to continue!`
      }
    ];

    instruction_images =
      $scope.instructions.filter(i => i.image !== undefined).map(i => i.image);
    preloader.preloadImages(instruction_images).then(
      function handleResolve(imglocs) { console.info("Preloaded instructions."); }
    );

    if ($location.search().skip_tutorial == "true") {
      $scope.inst_id = $scope.instructions.length - 1;
    }

    $scope.stimuli = [ //TODO: just hits the default
      {
        "name": "1_1",
        // Grid setup - 8x8 grid with 4 yellow target squares
        "gridSize": 8,
        "targetSquares": [
            { row: 1, col: 1 }, // Top-left corner area
            { row: 1, col: 6 }, // Top-right corner area
            { row: 6, col: 1 }, // Bottom-left corner area
            { row: 6, col: 6 }  // Bottom-right corner area
        ],
        "wallSquares":[
          {row: 1, col: 3}
        ],
        "images": [
          "stimuli/segments/M1L1P1.png"
        ],
        "times": [
          1,
          1
        ],
        "statements": [
          "Flask <strong>A</strong> is: ",
          "Flask <strong>B</strong> is: ",
          "Flask <strong>C</strong> is: ",
          "Flask <strong>D</strong> is: "
        ],
        "length": 2
      }
    ]

    // Initialize grid
    $scope.initializeGrid = async function initializeGrid() {
      $scope.grid = document.getElementById('grid');
      $scope.grid.innerHTML = '';
      
      for (let row = 0; row < $scope.stimuli[$scope.stim_id].gridSize; row++) {
        for (let col = 0; col < $scope.stimuli[$scope.stim_id].gridSize; col++) {
          $scope.cell = document.createElement('div');
          $scope.cell.className = 'grid-cell';
          $scope.cell.dataset.row = row;
          $scope.cell.dataset.col = col;
              
          // Check if this cell is a target square
          $scope.isTarget = $scope.stimuli[$scope.stim_id].targetSquares.some(target => target.row === row && target.col === col);
          if ($scope.isTarget) {
            $scope.cell.classList.add('target');
          }

          // Check if this cell is a wall square
          $scope.isWall = $scope.stimuli[$scope.stim_id].wallSquares.some(wall => wall.row === row && wall.col === col);
          if ($scope.isWall) {
            $scope.cell.classList.add('wall');
          }
              
          // Add drop event listeners
          $scope.cell.addEventListener('dragover', $scope.handleDragOver);
          $scope.cell.addEventListener('drop', $scope.handleDrop);
          $scope.cell.addEventListener('dragenter', $scope.handleDragEnter);
          $scope.cell.addEventListener('dragleave', $scope.handleDragLeave);
          $scope.cell.addEventListener('click', $scope.handleCellClick);
              
          $scope.grid.appendChild($scope.cell);
        }
      }
      $scope.updateGridSize();
    }

    // Function to update grid CSS size
    $scope.updateGridSize = function() {
      $scope.gridContainer = document.getElementById('grid');
      if (gridContainer) {
        $scopegridContainer.style.gridTemplateColumns = `repeat(${$scope.stimuli[$scope.stim_id].gridSize}, 1fr)`;
        $scopegridContainer.style.gridTemplateRows = `repeat(${$scope.stimuli[$scope.stim_id].gridSize}, 1fr)`;
      }
    };

    // Initialize flasks
    $scope.initializeFlasks = async function initializeFlasks() {
      $scope.flasks = document.querySelectorAll('.flask');
      $scope.flasks.forEach(flask => {
        flask.addEventListener('dragstart', $scope.handleDragStart);
        flask.addEventListener('dragend', $scope.handleDragEnd);
      });
    }

    // Drag and drop handlers
    $scope.handleDragStart = function handleDragStart(e) {
      if (e.target.classList.contains('assigned')) {
        e.preventDefault();
        return;
      }
      
      e.dataTransfer.setData('text/plain', e.target.dataset.flask);
      e.target.classList.add('dragging');
    }

    $scope.handleDragEnd = function handleDragEnd(e) {
      e.target.classList.remove('dragging');
    }

    $scope.handleDragOver = function handleDragOver(e) {
      if (e.currentTarget.classList.contains('target') && !e.currentTarget.classList.contains('occupied')) {
        e.preventDefault();
      }
    }

    $scope.handleDragEnter = function handleDragEnter(e) {
      if (e.currentTarget.classList.contains('target') && !e.currentTarget.classList.contains('occupied')) {
        e.currentTarget.classList.add('drop-target');
      }
    }

    $scope.handleDragLeave = function handleDragLeave(e) {
      e.currentTarget.classList.remove('drop-target');
    }

    $scope.handleDrop = function handleDrop(e) {
      e.preventDefault();
      e.currentTarget.classList.remove('drop-target');
      
      if (!e.currentTarget.classList.contains('target') || e.currentTarget.classList.contains('occupied')) {
        return;
      }
      
      $scope.flaskType = e.dataTransfer.getData('text/plain');
      $scope.row = parseInt(e.currentTarget.dataset.row);
      $scope.col = parseInt(e.currentTarget.dataset.col);
      
      $scope.assignFlask($scope.flaskType, $scope.row, $scope.col);
    }

    $scope.assignFlask = function assignFlask(flaskType, row, col) {
      $scope.cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      $scope.flask = document.querySelector(`[data-flask="${flaskType}"]`);
      
      if (!$scope.cell || !$scope.flask || $scope.flask.classList.contains('assigned')) return;
      
      // Create flask in grid
      $scope.flaskInGrid = document.createElement('div');
      $scope.flaskInGrid.className = `flask-in-grid ${flaskType}`;
      $scope.flaskInGrid.textContent = $scope.flask.textContent;
      $scope.flaskInGrid.dataset.flask = flaskType;
      
      $scope.cell.appendChild(flaskInGrid);
      $scope.cell.classList.add('occupied');
      
      // Mark original flask as assigned
      $scope.flask.classList.add('assigned');
      
      // Track assignment
      $scope.assignments[`${row}-${col}`] = flaskType;
      $scope.assignedCount++;
      
      $scope.updateStatus();
    }

    $scope.removeFlask = function removeFlask(row, col) {
      $scope.cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      $scope.flaskInGrid = cell.querySelector('.flask-in-grid');
      
      if (!$scope.flaskInGrid) return;
      
      $scope.flaskType = $scope.flaskInGrid.dataset.flask;
      $scope.originalFlask = document.querySelector(`.flask[data-flask="${$scope.flaskType}"]`);
      
      // Remove from grid
      $scope.flaskInGrid.remove();
      $scope.cell.classList.remove('occupied');
      
      // Restore original flask
      if ($scope.originalFlask) {
        $scope.originalFlask.classList.remove('assigned');
      }
      
      // Remove from assignments
      delete $scope.assignments[`${row}-${col}`];
      $scope.assignedCount--;
      
      $scope.updateStatus();
    }

    $scope.updateStatus = async function updateStatus() {
      $scope.status = document.getElementById('status');
      $scope.status.textContent = `${$scope.assignedCount}/4 squares assigned`;
    }

    $scope.resetAssignments = function resetAssignments() {
      // Clear all assignments
      Object.keys($scope.assignments).forEach(key => {
        const [row, col] = key.split('-').map(Number);
        $scope.removeFlask(row, col);
      });
    }

    $scope.submitAssignment = function submitAssignment() {
      if ($scope.assignedCount < 4) {
        alert("Please assign all 4 flasks before submitting.");
        return;
      }
      //else store_db for each flask
    }
    
    $scope.initGridContainer = async function initGridContainer() {
      // Initialize the app
      $scope.initializeGrid();
      $scope.initializeFlasks();
      $scope.updateStatus();
    }

    // Helper function to check if a cell is a wall
    $scope.isWallCell = function(row, col) {
      return $scope.wallSquares.some(wall => wall.row === row && wall.col === col);
    }

    // Helper function to dynamically add/remove walls
    $scope.toggleWall = function (row, col) {
      const wallIndex = $scope.wallSquares.findIndex(wall => wall.row === row && wall.col === col);
  
      if (wallIndex !== -1) {
        // Remove wall
        $scope.wallSquares.splice(wallIndex, 1);
      } else {
        // Add wall
        $scope.wallSquares.push({ row: row, col: col });
      }
    }
  }
)