const topicListEl = document.getElementById("topic-list");
const quizTitleEl = document.getElementById("quiz-title");
const quizProgressEl = document.getElementById("quiz-progress");
const quizBodyEl = document.getElementById("quiz-body");
const questionContainerEl = document.getElementById("question-container");
const optionsFormEl = document.getElementById("options-form");
const feedbackEl = document.getElementById("feedback");
const submitBtn = document.getElementById("submit-btn");
const nextBtn = document.getElementById("next-btn");

let topicsIndex = null;
let currentTopic = null;
let currentQuestionIndex = 0;
let answeredCurrent = false;

async function loadTopics() {
  try {
    const res = await fetch("quiz-data/index.json");
    topicsIndex = await res.json();
    renderTopicList();
  } catch (err) {
    console.error("Failed to load topics index:", err);
    topicListEl.innerHTML =
      "<li>Could not load topics. Make sure quiz-data/index.json exists.</li>";
  }
}

function renderTopicList() {
  if (!topicsIndex || !topicsIndex.topics) return;

  topicListEl.innerHTML = "";
  topicsIndex.topics.forEach((t) => {
    const li = document.createElement("li");
    li.className = "topic-item";

    const btn = document.createElement("button");
    btn.className = "topic-button";
    btn.type = "button";
    btn.dataset.slug = t.slug;
    btn.textContent = t.topic;

    const meta = document.createElement("span");
    meta.className = "topic-meta";
    meta.textContent = `${t.numQuestions} q`;
    btn.appendChild(meta);

    btn.addEventListener("click", () => onSelectTopic(t));

    li.appendChild(btn);
    topicListEl.appendChild(li);
  });
}

function setActiveTopicButton(slug) {
  document
    .querySelectorAll(".topic-button")
    .forEach((btn) => btn.classList.remove("active"));
  const active = document.querySelector(`.topic-button[data-slug="${slug}"]`);
  if (active) active.classList.add("active");
}

async function onSelectTopic(topicMeta) {
  setActiveTopicButton(topicMeta.slug);
  quizTitleEl.textContent = topicMeta.topic;
  quizProgressEl.textContent = "Loading questions...";
  quizBodyEl.classList.add("hidden");
  feedbackEl.classList.add("hidden");

  try {
    const res = await fetch(`quiz-data/${topicMeta.file}`);
    const data = await res.json();
    currentTopic = data;
    currentQuestionIndex = 0;
    answeredCurrent = false;
    showCurrentQuestion();
  } catch (err) {
    console.error("Failed to load topic file:", err);
    quizProgressEl.textContent =
      "Could not load this topic. Check the console for details.";
  }
}

function showCurrentQuestion() {
  if (!currentTopic) return;
  const total = currentTopic.questions.length;

  if (currentQuestionIndex < 0) currentQuestionIndex = 0;
  if (currentQuestionIndex >= total) currentQuestionIndex = total - 1;

  const q = currentTopic.questions[currentQuestionIndex];

  quizProgressEl.textContent = `Question ${currentQuestionIndex + 1} of ${total}`;
  quizBodyEl.classList.remove("hidden");
  feedbackEl.classList.add("hidden");
  feedbackEl.textContent = "";
  answeredCurrent = false;
  submitBtn.disabled = false;
  nextBtn.disabled = true;

  questionContainerEl.innerHTML = "";
  const title = document.createElement("h3");
  title.className = "question-title";
  title.textContent = `Q${q.id}. ${q.stem}`;
  questionContainerEl.appendChild(title);

  optionsFormEl.innerHTML = "";
  q.options.forEach((opt) => {
    const row = document.createElement("div");
    row.className = "option-row";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "option";
    input.value = opt.label;
    input.id = `opt-${q.id}-${opt.label}`;

    const label = document.createElement("label");
    label.className = "option-label";
    label.htmlFor = input.id;
    label.textContent = `${opt.label}. ${opt.text}`;

    row.appendChild(input);
    row.appendChild(label);
    optionsFormEl.appendChild(row);
  });
}

function getSelectedOption() {
  const checked = optionsFormEl.querySelector('input[name="option"]:checked');
  return checked ? checked.value : null;
}

function onSubmitAnswer() {
  if (!currentTopic) return;
  if (answeredCurrent) return;

  const selected = getSelectedOption();
  if (!selected) {
    feedbackEl.classList.remove("hidden");
    feedbackEl.classList.remove("correct", "incorrect");
    feedbackEl.textContent = "Please select an option first.";
    return;
  }

  const q = currentTopic.questions[currentQuestionIndex];
  const isCorrect = selected === q.correct;
  answeredCurrent = true;

  feedbackEl.classList.remove("hidden");
  feedbackEl.classList.toggle("correct", isCorrect);
  feedbackEl.classList.toggle("incorrect", !isCorrect);

  const answerText = isCorrect
    ? "Correct!"
    : `Incorrect. Correct answer: ${q.correct}.`;

  const explanation = q.explanation ? ` ${q.explanation}` : "";
  feedbackEl.textContent = `${answerText}${explanation ? " " + explanation : ""}`;

  submitBtn.disabled = true;
  nextBtn.disabled = false;
}

function onNextQuestion() {
  if (!currentTopic) return;
  if (!answeredCurrent) return;

  const total = currentTopic.questions.length;
  if (currentQuestionIndex < total - 1) {
    currentQuestionIndex += 1;
    showCurrentQuestion();
  } else {
    quizProgressEl.textContent = `Finished ${currentTopic.topic} – ${total} question(s).`;
    quizBodyEl.classList.add("hidden");
  }
}

submitBtn.addEventListener("click", onSubmitAnswer);
nextBtn.addEventListener("click", onNextQuestion);

loadTopics();


