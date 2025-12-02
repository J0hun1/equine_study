const topicListEl = document.getElementById("topic-list");
const quizTitleEl = document.getElementById("quiz-title");
const quizProgressEl = document.getElementById("quiz-progress");
const quizBodyEl = document.getElementById("quiz-body");
const questionContainerEl = document.getElementById("question-container");
const feedbackEl = document.getElementById("feedback");
const submitBtn = document.getElementById("submit-btn");

let topicsIndex = null;
let currentTopic = null;

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
    renderAllQuestions();
  } catch (err) {
    console.error("Failed to load topic file:", err);
    quizProgressEl.textContent =
      "Could not load this topic. Check the console for details.";
  }
}

function renderAllQuestions() {
  if (!currentTopic) return;
  const total = currentTopic.questions.length;

  quizProgressEl.textContent = `${total} question(s) in this topic. Answer all, then click "Check all answers".`;
  quizBodyEl.classList.remove("hidden");
  feedbackEl.classList.add("hidden");
  feedbackEl.textContent = "";
  submitBtn.disabled = false;

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

      const label = document.createElement("label");
      label.className = "option-label";
      label.htmlFor = input.id;
      label.textContent = `${opt.label}. ${opt.text}`;

      row.appendChild(input);
      row.appendChild(label);
      block.appendChild(row);
    });

    const qFeedback = document.createElement("div");
    qFeedback.className = "feedback q-feedback hidden";
    qFeedback.dataset.qid = q.id;
    block.appendChild(qFeedback);

    questionContainerEl.appendChild(block);
  });
}

function onSubmitAnswer() {
  if (!currentTopic) return;

  const total = currentTopic.questions.length;
  let correctCount = 0;
  let unansweredCount = 0;

  currentTopic.questions.forEach((q) => {
    const selected = document.querySelector(
      `input[name="q-${q.id}"]:checked`
    );
    const qFeedback = document.querySelector(
      `.q-feedback[data-qid="${q.id}"]`
    );

    if (!qFeedback) return;

    qFeedback.classList.remove("hidden", "correct", "incorrect");

    if (!selected) {
      unansweredCount += 1;
      qFeedback.classList.add("incorrect");
      qFeedback.textContent = "No option selected.";
      return;
    }

    const chosen = selected.value;
    const isCorrect = chosen === q.correct;
    if (isCorrect) correctCount += 1;

    qFeedback.classList.add(isCorrect ? "correct" : "incorrect");
    const answerText = isCorrect
      ? "Correct!"
      : `Incorrect. Correct answer: ${q.correct}.`;
    const explanation = q.explanation ? ` ${q.explanation}` : "";
    qFeedback.textContent = `${answerText}${explanation}`;
  });

  feedbackEl.classList.remove("hidden");
  feedbackEl.classList.remove("correct", "incorrect");
  feedbackEl.textContent = `Score: ${correctCount} / ${total}${
    unansweredCount ? ` (Unanswered: ${unansweredCount})` : ""
  }`;
}

submitBtn.addEventListener("click", onSubmitAnswer);

loadTopics();

