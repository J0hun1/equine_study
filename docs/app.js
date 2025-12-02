const topicListEl = document.getElementById("topic-list");
const quizTitleEl = document.getElementById("quiz-title");
const quizProgressEl = document.getElementById("quiz-progress");
const quizBodyEl = document.getElementById("quiz-body");
const questionContainerEl = document.getElementById("question-container");
const feedbackEl = document.getElementById("feedback");
const globalScoreEl = document.getElementById("global-score");
const globalUnansweredEl = document.getElementById("global-unanswered");
const resetTopicBtn = document.getElementById("reset-topic-btn");
const resetModalBackdropEl = document.getElementById("reset-modal-backdrop");
const resetModalConfirmEl = document.getElementById("reset-modal-confirm");
const resetModalCancelEl = document.getElementById("reset-modal-cancel");
const sidebarEl = document.getElementById("sidebar");
const sidebarToggleEl = document.getElementById("sidebar-toggle");
const sidebarOpenEl = document.getElementById("sidebar-open");

const STORAGE_KEY = "equine_mcq_state_v1";

let topicsIndex = null;
let currentTopic = null;
let currentTopicSlug = null;
let globalTotalQuestions = 0;
// Per-topic state: selected answers and whether the topic has been fully checked at least once
const topicState = {};

async function loadTopics() {
  try {
    const res = await fetch("quiz-data/index.json");
    topicsIndex = await res.json();

    // Load any saved state from this device
    loadLocalState();

    renderTopicList();

    // Compute total number of questions across all topics
    globalTotalQuestions = topicsIndex.topics.reduce(
      (sum, t) => sum + (t.numQuestions || 0),
      0
    );
    updateGlobalStats();
  } catch (err) {
    console.error("Failed to load topics index:", err);
    topicListEl.innerHTML =
      "<li>Could not load topics. Make sure quiz-data/index.json exists.</li>";
  }
}

function renderTopicList() {
  if (!topicsIndex || !topicsIndex.topics) return;

  topicListEl.innerHTML = "";

  // Sort topics by leading number if present, otherwise alphabetically
  const sorted = [...topicsIndex.topics].sort((a, b) => {
    const ma = a.topic.match(/^(\d+)/);
    const mb = b.topic.match(/^(\d+)/);
    if (ma && mb) {
      return parseInt(ma[1], 10) - parseInt(mb[1], 10);
    }
    return a.topic.localeCompare(b.topic);
  });

  sorted.forEach((t) => {
    const li = document.createElement("li");
    li.className = "topic-item";

    const btn = document.createElement("button");
    btn.className = "topic-button";
    btn.type = "button";
    btn.dataset.slug = t.slug;

    const label = document.createElement("span");
    label.className = "topic-label";
    label.textContent = t.topic;
    btn.appendChild(label);

    const meta = document.createElement("span");
    meta.className = "topic-meta";
    const state = topicState[t.slug];
    const total = (state && state.total) || t.numQuestions || 0;
    const correct = (state && state.correct) || 0;
    meta.textContent = `${correct}/${total}`;
    btn.appendChild(meta);

    btn.addEventListener("click", () => onSelectTopic(t));

    li.appendChild(btn);
    topicListEl.appendChild(li);
  });

  updateTopicButtonsCompletion();
}

function setActiveTopicButton(slug) {
  document
    .querySelectorAll(".topic-button")
    .forEach((btn) => btn.classList.remove("active"));
  const active = document.querySelector(`.topic-button[data-slug="${slug}"]`);
  if (active) active.classList.add("active");
}

async function onSelectTopic(topicMeta) {
  currentTopicSlug = topicMeta.slug;
  setActiveTopicButton(topicMeta.slug);
  quizTitleEl.textContent = topicMeta.topic;
  quizProgressEl.textContent = "Loading questions...";
  quizBodyEl.classList.add("hidden");
  feedbackEl.classList.add("hidden");

  try {
    const res = await fetch(`quiz-data/${topicMeta.file}`);
    const data = await res.json();
    currentTopic = data;

    // Ensure state exists for this topic
    if (!topicState[currentTopicSlug]) {
      topicState[currentTopicSlug] = { answers: {}, completed: false };
    }

    renderAllQuestions();
    resetTopicBtn.classList.remove("hidden");
  } catch (err) {
    console.error("Failed to load topic file:", err);
    quizProgressEl.textContent =
      "Could not load this topic. Check the console for details.";
  }
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.topicState && typeof parsed.topicState === "object") {
      Object.assign(topicState, parsed.topicState);
    }
  } catch (err) {
    console.warn("Failed to load local state:", err);
  }
}

function saveLocalState() {
  try {
    const payload = {
      topicState,
      globalTotalQuestions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to save local state:", err);
  }
}

function renderAllQuestions() {
  if (!currentTopic) return;
  const total = currentTopic.questions.length;
  const state = topicState[currentTopicSlug] || {
    answers: {},
    completed: false,
    correct: 0,
    total: 0,
    unanswered: 0,
  };

  quizProgressEl.textContent = `${total} question(s) in this topic. Answer all, then click "Check all answers".`;
  quizBodyEl.classList.remove("hidden");
  feedbackEl.classList.add("hidden");
  feedbackEl.textContent = "";

  questionContainerEl.innerHTML = "";

  currentTopic.questions.forEach((q) => {
    const block = document.createElement("div");
    block.className = "question-container";
    block.dataset.qid = q.id;

    const title = document.createElement("h3");
    title.className = "question-title";
    title.textContent = `Q${q.id}. ${q.stem}`;
    block.appendChild(title);

    q.options.forEach((opt) => {
      const row = document.createElement("div");
      row.className = "option-row";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `q-${q.id}`;
      input.value = opt.label;
      input.id = `opt-${q.id}-${opt.label}`;
      input.className = "option-radio";
      input.tabIndex = -1; // Prevent focus to avoid scroll jumps
      
      // Prevent focus-related scrolling
      input.addEventListener("focus", (e) => {
        e.preventDefault();
        e.stopPropagation();
        input.blur();
      });

      // Restore previously selected answer if present
      if (state.answers[q.id] === opt.label) {
        input.checked = true;
      }

      const label = document.createElement("label");
      label.className = "option-label";
      label.htmlFor = input.id;
      label.innerHTML = `
        <span class="option-badge">${opt.label}</span>
        <span class="option-text">${opt.text}</span>
      `;
      
      // Prevent label interactions from causing scroll
      const handleLabelInteraction = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Save scroll position before any changes
        const quizPanel = document.querySelector(".quiz-panel");
        const savedScroll = quizPanel ? quizPanel.scrollTop : 0;
        
        // Manually check the radio and trigger change
        if (!input.checked) {
          input.checked = true;
          const changeEvent = new Event("change", { bubbles: true, cancelable: true });
          input.dispatchEvent(changeEvent);
        }
        
        // Restore scroll immediately
        if (quizPanel) {
          quizPanel.scrollTop = savedScroll;
        }
      };
      
      label.addEventListener("mousedown", handleLabelInteraction);
      label.addEventListener("touchstart", handleLabelInteraction);
      label.addEventListener("click", handleLabelInteraction);

      row.appendChild(input);
      row.appendChild(label);
      block.appendChild(row);
    });

    const qFeedback = document.createElement("div");
    qFeedback.className = "feedback q-feedback hidden";
    qFeedback.dataset.qid = q.id;
    block.appendChild(qFeedback);

    questionContainerEl.appendChild(block);

    // If this question already has an answer in state, show its feedback immediately
    if (state.answers[q.id]) {
      evaluateSingleQuestion(q, state, false);
    }
  });

  // After rendering, recompute topic score in case some questions were already answered
  recomputeTopicScore();
}

function onSubmitAnswer() {
  if (!currentTopic) return;

  const total = currentTopic.questions.length;
  let correctCount = 0;
  let unansweredCount = 0;
  const state =
    topicState[currentTopicSlug] ||
    (topicState[currentTopicSlug] = {
      answers: {},
      completed: false,
      correct: 0,
      total: 0,
      unanswered: 0,
    });

  currentTopic.questions.forEach((q) => {
    const { isCorrect, isUnanswered } = evaluateSingleQuestion(q, state, false);
    if (isUnanswered) {
      unansweredCount += 1;
    } else if (isCorrect) {
      correctCount += 1;
    }
  });

  // Update topic-level progress at top
  quizProgressEl.textContent = `Topic score: ${correctCount} / ${total}${
    unansweredCount ? ` (Unanswered: ${unansweredCount})` : ""
  }`;

  feedbackEl.classList.remove("hidden");
  feedbackEl.classList.remove("correct", "incorrect");
  feedbackEl.textContent = "Answers checked. See per-question feedback above.";

  state.correct = correctCount;
  state.total = total;
  state.unanswered = unansweredCount;
  state.completed = true;
  updateTopicButtonsCompletion();
  updateGlobalStats();
  saveLocalState();
}

function onOptionChange(event) {
  if (!currentTopic || !currentTopicSlug) return;
  
  const quizPanel = document.querySelector(".quiz-panel");
  const scrollTop = quizPanel ? quizPanel.scrollTop : 0;
  
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.type !== "radio") return;

  const name = target.name; // e.g. "q-1"
  const m = name.match(/^q-(\d+)$/);
  if (!m) return;

  const qid = parseInt(m[1], 10);
  const state =
    topicState[currentTopicSlug] ||
    (topicState[currentTopicSlug] = { answers: {}, completed: false });
  state.answers[qid] = target.value;

  const q = currentTopic.questions.find((qq) => qq.id === qid);
  if (!q) return;

  // Immediately evaluate this single question and update topic/global stats
  evaluateSingleQuestion(q, state, true);
  recomputeTopicScore();
  updateGlobalStats();
  saveLocalState();

  // Restore scroll position immediately and after frame
  if (quizPanel) {
    quizPanel.scrollTop = scrollTop;
  }
  
  // Double-check after all updates
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (quizPanel) {
        quizPanel.scrollTop = scrollTop;
      }
    });
  });
}

function evaluateSingleQuestion(q, state, showAsCompleted) {
  const selected = document.querySelector(
    `input[name="q-${q.id}"]:checked`
  );
  const qFeedback = document.querySelector(
    `.q-feedback[data-qid="${q.id}"]`
  );
  const questionBlock = document.querySelector(
    `.question-container[data-qid="${q.id}"]`
  );

  if (!qFeedback) return { isCorrect: false, isUnanswered: true };

  // Clear all answer styling classes from all options for this question
  if (questionBlock) {
    questionBlock.querySelectorAll(".option-label").forEach((label) => {
      label.classList.remove("correct-answer", "incorrect-answer");
    });
  }

  qFeedback.classList.remove("hidden", "correct", "incorrect");

  if (!selected) {
    qFeedback.classList.add("incorrect");
    qFeedback.innerHTML = `
      <div class="q-status">No answer selected</div>
    `;
    return { isCorrect: false, isUnanswered: true };
  }

  const chosen = selected.value;
  state.answers[q.id] = chosen;

  const isCorrect = chosen === q.correct;
  qFeedback.classList.add(isCorrect ? "correct" : "incorrect");

  // Apply visual feedback to the selected option only
  const selectedLabel = selected.nextElementSibling;
  if (selectedLabel && selectedLabel.classList.contains("option-label")) {
    if (isCorrect) {
      selectedLabel.classList.add("correct-answer");
    } else {
      selectedLabel.classList.add("incorrect-answer");
    }
  }

  const statusText = isCorrect ? "Correct" : "Incorrect";
  const answerLine = `Correct answer: ${q.correct}`;
  const explanation = q.explanation || "";

  qFeedback.innerHTML = `
    <div class="q-status">${statusText}</div>
    <div class="q-answer">${answerLine}</div>
    ${
      explanation
        ? `<div class="q-expl">${explanation}</div>`
        : ""
    }
  `;

  if (showAsCompleted) {
    state.completed = true;
    updateTopicButtonsCompletion();
    saveLocalState();
  }

  return { isCorrect, isUnanswered: false };
}

function recomputeTopicScore() {
  if (!currentTopic || !currentTopicSlug) return;
  const state =
    topicState[currentTopicSlug] ||
    (topicState[currentTopicSlug] = {
      answers: {},
      completed: false,
      correct: 0,
      total: 0,
      unanswered: 0,
    });

  const total = currentTopic.questions.length;
  let correctCount = 0;
  let unansweredCount = 0;

  currentTopic.questions.forEach((q) => {
    const ans = state.answers[q.id];
    if (!ans) {
      unansweredCount += 1;
    } else if (ans === q.correct) {
      correctCount += 1;
    }
  });

  state.correct = correctCount;
  state.total = total;
  state.unanswered = unansweredCount;

  quizProgressEl.textContent = `Topic score: ${correctCount} / ${total}${
    unansweredCount ? ` (Unanswered: ${unansweredCount})` : ""
  }`;

  // Update sidebar scores in place instead of re-rendering entire list to prevent scroll jumps
  updateTopicListScores();
  if (currentTopicSlug) {
    setActiveTopicButton(currentTopicSlug);
  }
}

function updateTopicButtonsCompletion() {
  document.querySelectorAll(".topic-button").forEach((btn) => {
    const slug = btn.dataset.slug;
    const state = slug ? topicState[slug] : null;
    if (state && state.completed) {
      btn.classList.add("completed");
    } else {
      btn.classList.remove("completed");
    }
  });
}

function updateTopicListScores() {
  // Update topic meta scores in place without re-rendering entire list
  document.querySelectorAll(".topic-button").forEach((btn) => {
    const slug = btn.dataset.slug;
    if (!slug) return;
    const state = topicState[slug];
    const topicMeta = topicsIndex?.topics?.find((t) => t.slug === slug);
    if (!topicMeta) return;
    
    const total = (state && state.total) || topicMeta.numQuestions || 0;
    const correct = (state && state.correct) || 0;
    const metaEl = btn.querySelector(".topic-meta");
    if (metaEl) {
      metaEl.textContent = `${correct}/${total}`;
    }
  });
}

function updateGlobalStats() {
  let totalCorrect = 0;
  let totalUnanswered = 0;

  // Count from all topics
  if (topicsIndex && topicsIndex.topics) {
    topicsIndex.topics.forEach((topicMeta) => {
      const state = topicState[topicMeta.slug];
      const topicTotal = topicMeta.numQuestions || 0;
      
      if (state && state.total) {
        // Topic has been visited - use its calculated values
        totalCorrect += state.correct || 0;
        totalUnanswered += state.unanswered || 0;
      } else {
        // Topic hasn't been visited yet - count all questions as unanswered
        totalUnanswered += topicTotal;
      }
    });
  }

  globalScoreEl.textContent = `Total score: ${totalCorrect} / ${globalTotalQuestions}`;
  globalUnansweredEl.textContent = `Unanswered: ${totalUnanswered}`;
}
questionContainerEl.addEventListener("change", onOptionChange);
resetTopicBtn.addEventListener("click", onResetTopicClick);
resetModalConfirmEl.addEventListener("click", onResetTopicConfirm);
resetModalCancelEl.addEventListener("click", onResetTopicCancel);
sidebarToggleEl.addEventListener("click", () => {
  sidebarEl.classList.add("hidden");
});
sidebarOpenEl.addEventListener("click", () => {
  sidebarEl.classList.remove("hidden");
});

loadTopics();

function onResetTopicClick() {
  if (!currentTopic || !currentTopicSlug) return;

  const topicName = currentTopic.topic || "this topic";
  const titleEl = resetModalBackdropEl.querySelector(".modal-title");
  const bodyEl = resetModalBackdropEl.querySelector(".modal-body");
  if (titleEl) {
    titleEl.textContent = "Reset answers for this topic?";
  }
  if (bodyEl) {
    bodyEl.textContent = `You are about to clear all your selections and scores for "${topicName}" on this device. This action cannot be undone.`;
  }
  resetModalBackdropEl.classList.remove("hidden");
}

function onResetTopicConfirm() {
  if (!currentTopic || !currentTopicSlug) {
    resetModalBackdropEl.classList.add("hidden");
    return;
  }

  // Reset state for this topic
  topicState[currentTopicSlug] = {
    answers: {},
    completed: false,
    correct: 0,
    total: currentTopic.questions.length,
    unanswered: currentTopic.questions.length,
  };

  // Re-render questions with no selections or feedback
  renderAllQuestions();

  // Clear bottom feedback and update stats
  feedbackEl.classList.add("hidden");
  feedbackEl.textContent = "";

  updateTopicButtonsCompletion();
  recomputeTopicScore();
  updateGlobalStats();
  saveLocalState();

  resetModalBackdropEl.classList.add("hidden");
}

function onResetTopicCancel() {
  resetModalBackdropEl.classList.add("hidden");
}
