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

    $scope.assignments = {};
    $scope.assignedCount = 0;
    $scope.img_url = [
      "images/potionA.png",
      "images/potionB.png",
      "images/potionC.png",
      "images/potionD.png",
    ];
    $scope.gt = document.getElementById('gt');
    $scope.active_stim = NaN;
    $scope.data = {
      "user_id": NaN,
      "demographic_survey": NaN,
      "assignments": {},
      "exam": NaN
    }

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

    $scope.set_belief_statements = async function(stim_id) {
      if (stim_id < $scope.stimuli_set.length) {
        let cur_stim = $scope.stimuli_set[stim_id];
        if (cur_stim.statements) {
          $scope.belief_statements = cur_stim.statements;
          let n = $scope.belief_statements.length;
          $scope.belief_statement_ids = Array.from(Array(n).keys());
        }
      }
    };

    $scope.reset_response = function() {
      $scope.response = {
        "beliefs": [NaN, NaN],
        "belief_ids": [1, 2]
      };
    };

    $scope.advance = async function () {
      if ($scope.section == "instructions") {
        await $scope.advance_instructions()
      } else if ($scope.section == "stimuli") {
        $scope.stim_id += 1;
        await $scope.advance_stimuli()
      } else if ($scope.section == "endscreen") {
        $scope.end_id += 1;
        if ($scope.end_id == 2) {
          $scope.age_q = document.getElementById("age");
          $scope.gender_q = document.getElementById("gender");
          $scope.ethnicity_q = document.getElementById("ethnicity");
          $scope.id_q = document.getElementById("mturkID");
          $scope.feedback_q = document.getElementById("feedback");

          $scope.survey = {
            age: $scope.age_q.value,
            gender: $scope.gender_q.value,
            ethnicity: $scope.ethnicity_q.value,
            mturk_id: $scope.id_q.value,
            feedback: $scope.feedback_q.value
          }
          $scope.data.demographic_survey = $scope.survey;
          $scope.store_to_db($scope.user_id, $scope.data);
        }
      }
    };
    
    $scope.advance_instructions = async function () {      
      if ($scope.inst_id == $scope.instructions.length - 1) {
        // Initialize stimuli section
        $scope.section = "stimuli";
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
          $scope.data.exam = exam_data;
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
        $scope.end_id = 0; 
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
          // Advance to next problem.
          $scope.part_id = -1;
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
        "statement_ratings": statement_ratings,
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

    $scope.has_belief_question = function () {
      if ($scope.section == "stimuli") {
        return $scope.part_id > 0
      } else if ($scope.section == "instructions") {
        return ($scope.instructions[$scope.inst_id].question_types != null &&
          $scope.instructions[$scope.inst_id].question_types.includes("beliefs"))
      }
      return false
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
      // Production behavior: use stimuli_sets for indexing
      let stim_idx = [];
      let count = await $scope.get_counter();
      stim_idx = $scope.stimuli_sets[count % $scope.stimuli_sets.length];

      $scope.log("stimuli idx = ", stim_idx);
      for (i = 0; i < stim_idx.length; i++) {
        $scope.stimuli_set.push($scope.stimuli[stim_idx[i]]);
      }
      // $scope.stimuli_set = $scope.array_shuffle($scope.stimuli_set);
      $scope.log("stimuli ", $scope.stimuli_set);
    };

    $scope.stimuli_sets = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
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
              <strong>All flasks look the same</strong> <img class="caption-image" src="images/potion.png"> and the player <strong>does not</strong> know if a flask contians a potion or a poison.
              Your task is to place the potions and poisons in a logical place so that the player can correctly
              pickup the potions <strong>but not</strong> the poisons.
              
              <br><br>
              The rules of the game are as follows:
              <br>
              <ul>
              <li> Flasks must be placed in one of the orange squares on the map.</li>
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
        text: `Please look at this similar map that is missing one of the yelow squares and place the flasks appropriatly<br>
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
        text: `<strong>Question 1/5:</strong> To the <strong>player</strong>, how do the flasks look?`,
        options: ["The potions are purple and the poisons are green",
                  "They all look the same",
                  "The flasks are labeled based on their liquid content"],
        answer: 1,
        exam: true
      },
      {
        text: `<strong>Question 1/5:</strong> To the <strong>player</strong>, how do the flasks look?`,
        options: ["The potions are purple and the poisons are green",
                  "They all look the same",
                  "The flasks are labeled based on their liquid content"],
        answer: 1,
        feedback: true
      },
      {
        text: `<strong>Question 2/5:</strong> What is your task in this game?`,
        options: ["Place the flasks in a logical and helpful manner",
                  "Explore the map",
                  "Guess the identity of the liquid in each flask"],
        answer: 0,
        exam: true
      },
      {
        text: `<strong>Question 2/5:</strong> What is your task in this game?`,
        options: ["Place the flasks in a logical and helpful manner",
                  "Explore the map",
                  "Guess the identity of the liquid in each flask"],
        answer: 0,
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
        options: ["You should place the flasks randomly and haphazardly.",
                  "You should place the flasks so that the player can distinguish between potions and poisons",
                  "The flasks are all potions."],
        answer: 1,
        exam: true
      },
      {
        text: `<strong>Question 4/5:</strong> Which of the following is true?`,
        options: ["You should place the flasks randomly and haphazardly.",
                  "You should place the flasks so that the player can distinguish between potions and poisons",
                  "The flasks are all potions."],
        answer: 1,
        feedback: true
      },
      {
        text: `<strong>Question 5/5:</strong> How can you tell what liquid is in the flask?`,
        options: ["You can not tell the type of liquid in the flask",
                  "The liquid type is explicitly stated on the flask itself",
                  "There is an answer key next to the potion sidebar"],
        answer: 2,
        exam: true
      },
      {
        text: `<strong>Question 5/5:</strong> How can you tell what liquid is in the flask?`,
        options: ["You can not tell the type of liquid in the flask",
                  "The liquid type is explicitly stated on the flask itself",
                  "There is an answer key next to the potion sidebar"],
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

    $scope.tutorial_stimuli = [
      {
        "name": "tutorial1",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 0, col: 1 },
          { row: 5, col: 0 },
          { row: 2, col: 3 },
        ],
        "wallSquares": [
          { row: 4, col: 2 },
          { row: 4, col: 3 },
          { row: 4, col: 4 },
          { row: 4, col: 5 },
          { row: 4, col: 6 }
        ],
        "monster": {row: 1, col: 6},
        "player": { row: 6, col: 6 },
        "flasks": 2,
        "ground_truth": [
          "A is a Potion",
          "B is a Poison"
        ]
      },
      {
        "name": "tutorial2",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 0, col: 1 },
          { row: 5, col: 0 }
        ],
        "wallSquares": [
          { row: 4, col: 2 },
          { row: 4, col: 3 },
          { row: 4, col: 4 },
          { row: 4, col: 5 },
          { row: 4, col: 6 }
        ],
        "monster": {row: 1, col: 6},
        "player": { row: 6, col: 6 },
        "flasks": 2,
        "ground_truth": [
          "A is a Potion",
          "B is a Potion"
        ]
      },  
    ]

    $scope.stimuli = [
      {
        "name": "1_1",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 0, col: 6},
          { row: 2, col: 3}
        ],
        "wallSquares": [
          { row: 3, col: 3 },
          { row: 4, col: 3 },
          { row: 5, col: 3 },
          { row: 6, col: 3 }
        ],
        "monster": {row: 5, col: 6},
        "player": { row: 3, col: 1 },
        "flasks": 1,
        "ground_truth": [
          "A is a Poison",
        ]
      },
      {
        "name": "1_2",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 0, col: 6},
          { row: 2, col: 3}
        ],
        "wallSquares": [
          { row: 3, col: 3 },
          { row: 4, col: 3 },
          { row: 5, col: 3 },
          { row: 6, col: 3 }
        ],
        "monster": {row: 5, col: 6},
        "player": { row: 3, col: 0},
        "flasks": 1,
        "ground_truth": [
          "A is a Potion",
        ]
      },
      {
        "name": "1_3",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 2, col: 3}
        ],
        "wallSquares": [
          { row: 3, col: 3 },
          { row: 4, col: 3 },
          { row: 5, col: 3 },
          { row: 6, col: 3 }
        ],
        "monster": {row: 5, col: 6},
        "player": { row: 3, col: 0},
        "flasks": 1,
        "ground_truth": [
          "A is a Poison",
        ]
      },
      {
        "name": "1_4",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 0, col: 6}
        ],
        "wallSquares": [
          { row: 3, col: 3 },
          { row: 4, col: 3 },
          { row: 5, col: 3 },
          { row: 6, col: 3 }
        ],
        "monster": {row: 5, col: 6},
        "player": { row: 3, col: 0},
        "flasks": 1,
        "ground_truth": [
          "A is a Potion",
        ]
      },
      {
        "name": "2_1",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 0, col: 1},
          { row: 2, col: 0},
          { row: 4, col: 3},
          { row: 4, col: 6}
        ],
        "wallSquares": [],
        "monster": {row: 6, col: 3},
        "player": { row: 2, col: 3},
        "flasks": 2,
        "ground_truth": [
          "A is a Potion",
          "B is a Poison"
        ]
      },
      {
        "name": "2_2",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 0, col: 1},
          { row: 2, col: 0},
          { row: 4, col: 3},
          { row: 4, col: 6}
        ],
        "wallSquares": [],
        "monster": {row: 6, col: 3},
        "player": { row: 2, col: 3},
        "flasks": 2,
        "ground_truth": [
          "A is a Poison",
          "B is a Poison"
        ]
      },
      {
        "name": "2_3",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 4, col: 3},
          { row: 4, col: 6}
        ],
        "wallSquares": [],
        "monster": {row: 6, col: 3},
        "player": { row: 2, col: 3},
        "flasks": 2,
        "ground_truth": [
          "A is a Potion",
          "B is a Poison"
        ]
      },
      {
        "name": "2_4",
        "gridSize": [7, 7],
        "targetSquares": [
          { row: 0, col: 1},
          { row: 4, col: 3},
          { row: 4, col: 6}
        ],
        "wallSquares": [],
        "monster": {row: 6, col: 3},
        "player": { row: 2, col: 3},
        "flasks": 2,
        "ground_truth": [
          "A is a Potion",
          "B is a Potion"
        ]
      },
      {
        "name": "3_1",
        "gridSize": [6, 8],
        "targetSquares": [
          {row: 3, col: 7},
          {row: 5, col: 2},
        ],
        "wallSquares": [
          {row: 1, col: 2},
          {row: 1, col: 3},
          {row: 1, col: 4},
          {row: 1, col: 5},
          {row: 1, col: 6},
          {row: 1, col: 7},
          {row: 4, col: 2},
          {row: 4, col: 3},
          {row: 4, col: 4},
          {row: 4, col: 5},
          {row: 4, col: 6},
          {row: 4, col: 7},
        ],
        "monster": {row: 6, col: 7},
        "player": {row: 0, col: 1},
        "flasks": 2,
        "ground_truth": [
          "A is a Poison",
          "B is a Poison"
        ]
      },
      {
        "name": "3_2",
        "gridSize": [6, 8],
        "targetSquares": [
          {row: 3, col: 7},
          {row: 5, col: 2},
          {row: 2, col: 0}
        ],
        "wallSquares": [
          {row: 1, col: 2},
          {row: 1, col: 3},
          {row: 1, col: 4},
          {row: 1, col: 5},
          {row: 1, col: 6},
          {row: 1, col: 7},
          {row: 4, col: 2},
          {row: 4, col: 3},
          {row: 4, col: 4},
          {row: 4, col: 5},
          {row: 4, col: 6},
          {row: 4, col: 7},
        ],
        "monster": {row: 6, col: 7},
        "player": {row: 0, col: 1},
        "flasks": 2,
        "ground_truth": [
          "A is a Poison",
          "B is a Poison"
        ]
      },
      {
        "name": "3_3",
        "gridSize": [6, 8],
        "targetSquares": [
          {row: 3, col: 7},
          {row: 5, col: 2},
          {row: 2, col: 0}
        ],
        "wallSquares": [
          {row: 1, col: 2},
          {row: 1, col: 3},
          {row: 1, col: 4},
          {row: 1, col: 5},
          {row: 1, col: 6},
          {row: 1, col: 7},
          {row: 4, col: 2},
          {row: 4, col: 3},
          {row: 4, col: 4},
          {row: 4, col: 5},
          {row: 4, col: 6},
          {row: 4, col: 7},
        ],
        "monster": {row: 6, col: 7},
        "player": {row: 0, col: 1},
        "flasks": 3,
        "ground_truth": [
          "A is a Potion",
          "B is a Potion",
          "C is a Potion"
        ]
      },
      {
        "name": "3_4",
        "gridSize": [6, 8],
        "targetSquares": [
          {row: 3, col: 7},
          {row: 5, col: 2},
          { row: 2, col: 0 },
          {row : 4, col: 0}
        ],
        "wallSquares": [
          {row: 1, col: 2},
          {row: 1, col: 3},
          {row: 1, col: 4},
          {row: 1, col: 5},
          {row: 1, col: 6},
          {row: 1, col: 7},
          {row: 4, col: 2},
          {row: 4, col: 3},
          {row: 4, col: 4},
          {row: 4, col: 5},
          {row: 4, col: 6},
          {row: 4, col: 7},
        ],
        "monster": {row: 6, col: 7},
        "player": {row: 0, col: 1},
        "flasks": 3,
        "ground_truth": [
          "A is a Potion",
          "B is a Poison",
          "C is a Potion"
        ]
      }
    ]

    // Initialize grid
    $scope.initializeGrid = async function () {
      $scope.grid = document.getElementById('grid');
      $scope.grid.innerHTML = '';
      
      for (let row = 0; row < $scope.active_stim.gridSize[0]; row++) {
        for (let col = 0; col < $scope.active_stim.gridSize[1]; col++) {
          $scope.cell = document.createElement('div');
          $scope.cell.className = 'grid-cell';
          $scope.cell.dataset.row = row;
          $scope.cell.dataset.col = col;
              
          // Check if this cell is a target square
          $scope.isTarget = $scope.active_stim.targetSquares.some(target => target.row === row && target.col === col);
          if ($scope.isTarget) {
            $scope.cell.classList.add('target');
          }

          // Check if this cell is a wall square
          $scope.isWall = $scope.active_stim.wallSquares.some(wall => wall.row === row && wall.col === col);
          if ($scope.isWall) {
            $scope.cell.classList.add('wall');
          }

          // Check if this cell is a monster
          $scope.isMonster = $scope.active_stim.monster.row === row && $scope.active_stim.monster.col === col;
          if ($scope.isMonster) {
            $scope.cell.classList.add('monster');
          }

          // Check if this cell is a player
          $scope.isPlayer = $scope.active_stim.player.row === row && $scope.active_stim.player.col === col;
          if ($scope.isPlayer) {
            $scope.cell.classList.add('player');
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
    $scope.updateGridSize = function () {
      $scope.gridContainer = document.getElementById('grid');
      if ($scope.gridContainer) {
        $scope.gridContainer.style.gridTemplateColumns = `repeat(${$scope.active_stim.gridSize[1]}, 1fr)`;
        $scope.gridContainer.style.gridTemplateRows = `repeat(${$scope.active_stim.gridSize[0]}, 1fr)`;
      }
    };

    // Initialize flasks
    $scope.initializeFlasks = async function () {
      $scope.flasks = document.querySelectorAll('.flask');
      $scope.flasks.forEach(flask => {
        flask.addEventListener('dragstart', $scope.handleDragStart);
        flask.addEventListener('dragend', $scope.handleDragEnd);
      });
    }

    // Drag and drop handlers
    $scope.handleDragStart = function (e) {
      if (e.target.classList.contains('assigned')) {
        e.preventDefault();
        return;
      }
      
      e.dataTransfer.setData('text/plain', e.target.dataset.flask);
      e.target.classList.add('dragging');
    }

    $scope.handleDragEnd = function (e) {
      e.target.classList.remove('dragging');
    }

    $scope.handleDragOver = function (e) {
      if (e.currentTarget.classList.contains('target') && !e.currentTarget.classList.contains('occupied')) {
        e.preventDefault();
      }
    }

    $scope.handleCellClick = function(e) {
      if (e.currentTarget.classList.contains('occupied')) {
        $scope.row = parseInt(e.currentTarget.dataset.row);
        $scope.col = parseInt(e.currentTarget.dataset.col);
        $scope.removeFlask($scope.row, $scope.col);
        $scope.$apply(); // Trigger Angular digest cycle since this is a DOM event
      }
    };

    $scope.handleDragEnter = function (e) {
      if (e.currentTarget.classList.contains('target') && !e.currentTarget.classList.contains('occupied')) {
        e.currentTarget.classList.add('drop-target');
      }
    }

    $scope.handleDragLeave = function (e) {
      e.currentTarget.classList.remove('drop-target');
    }

    $scope.handleDrop = function (e) {
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

    $scope.assignFlask = function (flaskType, row, col) {
      $scope.cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      $scope.flask = document.querySelector(`[data-flask="${flaskType}"]`);
      
      if (!$scope.cell || !$scope.flask || $scope.flask.classList.contains('assigned')) return;
      
      // Create flask in grid
      $scope.flaskInGrid = document.createElement('div');
      $scope.flaskInGrid.className = `flask-in-grid ${flaskType.split('-')[0]}`;
      $scope.index = (Array.from(document.getElementById('flasks-container').children)).indexOf($scope.flask);
      $scope.flaskInGrid.style.backgroundImage = `url('${$scope.img_url[$scope.index]}')`;
      $scope.flaskInGrid.dataset.flask = flaskType;
      $scope.flaskInGrid.textContent = $scope.flask.textContent;
      
      $scope.cell.appendChild($scope.flaskInGrid);
      $scope.cell.classList.add('occupied');
      
      // Mark original flask as assigned
      $scope.flask.classList.add('assigned');
      
      // Track assignment
      $scope.assignments[`${row}-${col}`] = flaskType;
      $scope.assignedCount++;
      
      $scope.updateStatus();
    }

    $scope.removeFlask = function (row, col) {
      $scope.cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      $scope.flaskInGrid = $scope.cell.querySelector('.flask-in-grid');
      
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
      $scope.updateStatus()
    }

    $scope.updateStatus = async function () {
      $scope.status = document.getElementById('status');
      $scope.status.textContent = `${$scope.assignedCount}/${$scope.active_stim.flasks} squares assigned`;
    }

    $scope.resetAssignments = function () {
      // Clear all assignments
      Object.keys($scope.assignments).forEach(key => {
        const [row, col] = key.split('-').map(Number);
        $scope.removeFlask(row, col);
      });
    }

$scope.submitAssignment = function () {
  if ($scope.assignedCount < $scope.active_stim.flasks) {
    alert("Please assign all flasks before submitting.");
    return;
  }
  
  // Store current assignment
  $scope.data.assignments[$scope.active_stim.name] = $scope.assignments;
  
  // Move to next stimulus
  $scope.advance()
  
  // Check if we've completed all stimuli
  if ($scope.stim_id >= $scope.stimuli_set.length) {
    $scope.section = "endscreen";
    return;
  }
  
  // Reset assignments for new stimulus
  $scope.assignments = {};
  $scope.assignedCount = 0;
  
  // Reinitialize grid with new stimulus data
  $scope.initGridContainer();
}
    
    $scope.initGridContainer = async function () {
      if ($scope.inst_id <= 2) {
        $scope.active_stim = $scope.tutorial_stimuli[0];
      }
      else if ($scope.inst_id == 3) {
        $scope.active_stim = $scope.tutorial_stimuli[1];
      }
      else {
        $scope.active_stim = $scope.stimuli_set[$scope.stim_id];
      }

      $scope.initializeGrid();
      $scope.generateFlasks();
      $scope.initializeFlasks();
      $scope.updateStatus();
    }

    $scope.generateFlasks = function() {
      $scope.flasksContainer = document.getElementById('flasks-container');
      if (!$scope.flasksContainer) return;
      
      // Clear existing flasks
      $scope.flasksContainer.innerHTML = '';
      
      const letters = ["A", "B", "C", "D"];

      // Generate flasks based on the array
      $scope.gt.innerHTML = "";
      for (index = 0; index < $scope.active_stim.flasks; index++) {
        $scope.flask = document.createElement('div');

        $scope.flask.className = `flask`;
        $scope.flask.style.backgroundImage = `url('${$scope.img_url[index]}')`;
        $scope.flask.draggable = true;
        $scope.flask.dataset.flask = `${index}`;
        
        $scope.flasksContainer.appendChild($scope.flask);

        $scope.gt.innerHTML += `${$scope.active_stim.ground_truth[index]}<br><br>`;
      }
      // Reinitialize flask event listeners
      $scope.initializeFlasks();
    };
  }
)