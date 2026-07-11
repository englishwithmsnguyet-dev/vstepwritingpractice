// State Management
let currentScreen = 'dashboard';
let currentCategory = null;
let currentTopic = null;
let currentOutlineLevel = 'B1';
let currentSampleLevel = 'B1';
let currentTransLevel = 'B1'; // active level for translation exercises
let currentStep = 1; // 1: Reading, 2: Translation Practice, 3: Full Essay Editor, 4: Model Essay Reference
let hasSubmitted = false; // Tracks if the essay has been submitted for grading
let currentPage = 1;
const itemsPerPage = 9;

// Timer State
let timerInterval = null;
let timerSeconds = 40 * 60; // 40 minutes VSTEP standard
let isTimerRunning = false;

// Unsaved Progress State
let isDirty = false;

// Mock database check
if (typeof ESSAY_DATA === 'undefined') {
  console.error("ESSAY_DATA is not loaded! Please check if topics_db.js is imported properly.");
}

// Initialize Application on DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
  setTheme(localStorage.getItem("theme") || 'dark');
  renderDashboard();
  updateStats();
  
  // Warn if leaving page with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  
  // Listen for escape key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeComparisonModal();
    }
  });
});

// --- Theme Toggler ---
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem("theme", theme);
  
  // Update UI buttons active state
  const btnLight = document.getElementById('theme-light');
  const btnDark = document.getElementById('theme-dark');
  
  if (theme === 'light') {
    btnLight.classList.add('active');
    btnDark.classList.remove('active');
  } else {
    btnDark.classList.add('active');
    btnLight.classList.remove('active');
  }
}

// --- Router / Screen switcher ---
function switchScreen(screenName) {
  // Hide active workspace editor panels if we leave workspace
  if (currentScreen === 'workspace' && screenName !== 'workspace') {
    if (isDirty) {
      const confirmLeave = confirm("Bạn có tiến độ chưa được sao lưu. Nếu thoát bây giờ, các thay đổi sẽ bị mất. Bạn có chắc chắn muốn thoát?");
      if (!confirmLeave) return; // cancel navigation
    }
    stopTimer();
    isDirty = false;
    // Explicitly wipe the DOM so the browser doesn't cache unsaved data
    document.getElementById('essay-textarea').value = '';
    document.querySelectorAll('.trans-input-area').forEach(input => input.value = '');
  }

  // Remove category view class from header
  const header = document.querySelector('.top-header');
  if (header) {
    header.classList.remove('view-category');
  }

  // Update screen visibility
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const targetScreen = document.getElementById(`screen-${screenName}`);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
  
  // Update sidebar nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Find which sidebar button matches this screen
  const links = document.querySelectorAll('.nav-link');
  if (screenName === 'dashboard') {
    links[0].classList.add('active');
    document.getElementById('page-header-title').innerText = 'HOME PAGE';
    document.getElementById('global-search-container').style.display = 'block';
    renderDashboard();
  } else if (screenName === 'history') {
    links[5].classList.add('active');
    document.getElementById('page-header-title').innerText = 'Lịch sử luyện tập';
    document.getElementById('global-search-container').style.display = 'none';
    renderHistory();
  } else if (screenName === 'drafts') {
    links[6].classList.add('active');
    document.getElementById('page-header-title').innerText = 'Bản nháp đã lưu';
    document.getElementById('global-search-container').style.display = 'none';
    renderDrafts();
  } else if (screenName === 'workspace') {
    document.getElementById('page-header-title').innerText = 'Phòng luyện viết luận';
    document.getElementById('global-search-container').style.display = 'none';
    isDirty = false;
  }
  
  currentScreen = screenName;
  window.scrollTo(0, 0);
}

// Switch to a Category browse screen
function switchCategory(catId) {
  if (currentScreen === 'workspace') {
    if (isDirty) {
      const confirmLeave = confirm("Bạn có tiến độ chưa được sao lưu. Nếu thoát bây giờ, các thay đổi sẽ bị mất. Bạn có chắc chắn muốn thoát?");
      if (!confirmLeave) return;
    }
    stopTimer();
    isDirty = false;
    // Explicitly wipe the DOM so the browser doesn't cache unsaved data
    document.getElementById('essay-textarea').value = '';
    document.querySelectorAll('.trans-input-area').forEach(input => input.value = '');
  }

  // Clear search field
  document.getElementById('search-input-field').value = '';
  
  // Add category view class to header
  const header = document.querySelector('.top-header');
  if (header) {
    header.classList.add('view-category');
  }
  
  currentCategory = ESSAY_DATA.find(cat => cat.id === catId);
  if (!currentCategory) return;
  
  currentPage = 1;
  currentScreen = 'category';
  
  // Update active category sidebar link
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  const links = document.querySelectorAll('.nav-link');
  links[catId].classList.add('active');
  
  document.getElementById('page-header-title').innerText = currentCategory.title_vi;
  if (currentCategory.id === 1) {
    const total = currentCategory.topics.length;
    const onlyAdv = currentCategory.topics.filter(t => t.title_vi.includes('chỉ phân tích')).length;
    const both = total - onlyAdv;
    document.getElementById('category-description').innerText = `Trong dạng luận này, hệ thống bao gồm ${both} đề phân tích thuận lợi & bất lợi và ${onlyAdv} đề chỉ phân tích thuận lợi.`;
  } else if (currentCategory.id === 2) {
    let cs = 0, ce = 0, es = 0, oc = 0, oe = 0, os = 0;
    currentCategory.topics.forEach(t => {
      const rawTag = (t.tags || '').trim();
      let firstTag = '';
      if (rawTag.includes(']')) {
        firstTag = rawTag.split(']')[0].trim() + ']';
      } else {
        firstTag = rawTag;
      }
      firstTag = firstTag.toLowerCase();
      
      if (firstTag === '[causes & solutions]' || firstTag === '[problems & solutions]') {
        cs++;
      } else if (firstTag === '[causes & effects]' || firstTag === '[causes & effects – on youth and society]') {
        ce++;
      } else if (firstTag === '[effects & solutions]' || firstTag === '[impacts & solutions]') {
        es++;
      } else if (firstTag === '[causes]' || firstTag === '[factors]' || firstTag === '[causes / factors]' || firstTag === '[causes / reasons]') {
        oc++;
      } else if (firstTag === '[effects]' || firstTag === '[positive & negative effects]') {
        oe++;
      } else if (firstTag === '[measures]' || firstTag === '[solutions]' || firstTag === '[measures / solutions]') {
        os++;
      }
    });
    document.getElementById('category-description').innerText = `Trong dạng luận này, hệ thống bao gồm ${cs} đề phân tích nguyên nhân & giải pháp, ${ce} đề phân tích nguyên nhân & ảnh hưởng, ${es} đề phân tích ảnh hưởng & giải pháp, ${oc} đề chỉ phân tích nguyên nhân, ${oe} đề chỉ phân tích ảnh hưởng và ${os} đề chỉ phân tích giải pháp.`;
  } else if (currentCategory.id === 3) {
    document.getElementById('category-description').innerText = `Trong dạng luận này, hệ thống bao gồm ${currentCategory.topics.length} đề luyện tập viết luận bày tỏ ý kiến đồng ý hoặc phản đối.`;
  } else if (currentCategory.id === 4) {
    document.getElementById('category-description').innerText = `Trong dạng luận này, hệ thống bao gồm ${currentCategory.topics.length} đề luyện tập bàn luận hai luồng quan điểm trái chiều và đưa ra ý kiến cá nhân.`;
  } else {
    document.getElementById('category-description').innerText = currentCategory.title + " (VSTEP Writing Task 2). Hệ thống cung cấp " + currentCategory.topics.length + " chủ đề mẫu thuộc nhóm này.";
  }
  document.getElementById('global-search-container').style.display = 'block';
  
  renderCategoryTopics();
  
  // Update screen visibility
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-category').classList.add('active');
  window.scrollTo(0, 0);
}

// --- Render Dashboard ---
function renderDashboard() {
  const container = document.getElementById('featured-topics-container');
  container.innerHTML = '';
  
  // Grab all topics that have full details (ideas and sample essays)
  const featuredTopics = [];
  ESSAY_DATA.forEach(cat => {
    cat.topics.forEach(t => {
      if (t.has_full_details) {
        featuredTopics.push({
          catId: cat.id,
          catTitle: cat.title,
          catTitleVi: cat.title_vi,
          topic: t
        });
      }
    });
  });

  featuredTopics.forEach(item => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.onclick = () => startPractice(item.catId, item.topic.id);
    
    let tagClass = 'tag-adv';
    if (item.catId === 2) tagClass = 'tag-cause';
    if (item.catId === 3) tagClass = 'tag-opinion';
    if (item.catId === 4) tagClass = 'tag-discussion';
    
    const badgeText = item.topic.has_full_details ? '<span class="detail-badge">Đã cập nhật</span>' : '<span class="detail-badge" style="background: var(--panel-border); color: var(--text-secondary); border: 1px solid var(--panel-border)">Đang cập nhật</span>';
    
    card.innerHTML = `
      <div class="card-header">
        <span class="category-tag ${tagClass}">${getTopicSubtypeLabel(item.topic, item.catId)}</span>
        ${badgeText}
      </div>
      <div class="card-body">
        <h4>${item.topic.id}. ${item.topic.title_en}</h4>
        <p class="translation">${item.topic.title_vi}</p>
      </div>
      <div class="card-footer">
        <span>Đầy đủ: Dịch ý, Từ vựng, Bài mẫu</span>
        <div class="start-btn">
          Vào luyện tập
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </div>
    `;
    container.innerHTML += card.outerHTML;
  });
  
  renderRecentActivity();
}

// Render Recent Submissions on Dashboard Sidebar
function renderRecentActivity() {
  const list = document.getElementById('recent-activity-list');
  const history = getHistory();
  
  if (history.length === 0) {
    list.innerHTML = '<li class="empty-state">Chưa có bài viết nào được nộp</li>';
    return;
  }
  
  list.innerHTML = '';
  // Show last 3 submissions
  history.slice(0, 3).forEach(item => {
    const li = document.createElement('li');
    li.className = 'panel-list-item';
    li.innerHTML = `
      <span class="item-title" title="${item.topicTitle}">${item.topicTitle}</span>
      <span class="item-meta">${item.wordCount} từ</span>
      <span class="item-stat">${item.score} / 10</span>
    `;
    list.appendChild(li);
  });
}

// --- Render Category View with Pagination ---
function renderCategoryTopics(searchQuery = '') {
  if (!currentCategory) return;
  
  const container = document.getElementById('topics-list-container');
  container.innerHTML = '';

  // Create Banner for updated topics
  const updatedTopics = currentCategory.topics.filter(t => t.has_full_details);
  if (updatedTopics.length > 0 && !searchQuery.trim()) {
    const banner = document.createElement('div');
    banner.className = 'updated-topics-banner';
    
    const bannerHeader = document.createElement('h3');
    bannerHeader.innerHTML = '🔥 NHỮNG ĐỀ ĐÃ CẬP NHẬT (' + updatedTopics.length + ')';
    banner.appendChild(bannerHeader);
    
    const grid = document.createElement('div');
    grid.className = 'updated-topics-grid';
    
    updatedTopics.forEach(topic => {
      const pill = document.createElement('div');
      pill.className = 'updated-topic-pill';
      pill.onclick = () => startPractice(currentCategory.id, topic.id);
      pill.innerHTML = `
        <span class="pill-icon">📚</span>
        <span class="item-text">Đề ${topic.id}: ${topic.title_vi}</span>
      `;
      grid.appendChild(pill);
    });
    
    banner.appendChild(grid);
    container.appendChild(banner);
  }

  
  let topics = currentCategory.topics;
  
  // Filter by search query if present
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    topics = topics.filter(t => 
      t.title_en.toLowerCase().includes(q) || 
      t.title_vi.toLowerCase().includes(q) ||
      (t.context && t.context.toLowerCase().includes(q))
    );
  }
  
  if (topics.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: span 3; padding: 4rem;">Không tìm thấy chủ đề nào khớp với từ khóa "${searchQuery}"</div>`;
    document.getElementById('topics-pagination').innerHTML = '';
    return;
  }
  
  // Paginate
  const totalPages = Math.ceil(topics.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, topics.length);
  const pageItems = topics.slice(startIndex, endIndex);
  
  let tagClass = 'tag-adv';
  if (currentCategory.id === 2) tagClass = 'tag-cause';
  if (currentCategory.id === 3) tagClass = 'tag-opinion';
  if (currentCategory.id === 4) tagClass = 'tag-discussion';
  
  pageItems.forEach(topic => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.onclick = () => startPractice(currentCategory.id, topic.id);
    
    const badgeText = topic.has_full_details ? '<span class="detail-badge">Đã cập nhật</span>' : '<span class="detail-badge" style="background: var(--panel-border); color: var(--text-secondary); border: 1px solid var(--panel-border)">Đang cập nhật</span>';
    
    card.innerHTML = `
      <div class="card-header">
        <span class="category-tag ${tagClass}">${getTopicSubtypeLabel(topic, currentCategory.id)}</span>
        ${badgeText}
      </div>
      <div class="card-body">
        <h4>${topic.id}. ${topic.title_en}</h4>
        <p class="translation">${topic.title_vi}</p>
      </div>
      <div class="card-footer">
        <span>VSTEP Task 2</span>
        <div class="start-btn">
          Luyện tập
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  
  renderPagination(totalPages);
}

// Render Pagination Buttons
function renderPagination(totalPages) {
  const container = document.getElementById('topics-pagination');
  container.innerHTML = '';
  
  if (totalPages <= 1) return;
  
  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerText = '‹ Trước';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    currentPage--;
    renderCategoryTopics(document.getElementById('search-input-field').value);
  };
  container.appendChild(prevBtn);
  
  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
    pageBtn.innerText = i;
    pageBtn.onclick = () => {
      currentPage = i;
      renderCategoryTopics(document.getElementById('search-input-field').value);
    };
    container.appendChild(pageBtn);
  }
  
  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerText = 'Sau ›';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    currentPage++;
    renderCategoryTopics(document.getElementById('search-input-field').value);
  };
  container.appendChild(nextBtn);
}

// Global search function
function handleSearch(val) {
  if (currentScreen === 'dashboard') {
    const query = val.toLowerCase().trim();
    document.querySelectorAll('#featured-topics-container .topic-card').forEach(card => {
      const text = card.innerText.toLowerCase();
      if (text.includes(query)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  } else if (currentScreen === 'category') {
    currentPage = 1;
    renderCategoryTopics(val);
  }
}

// --- Practice Workspace Logic ---
function startPractice(catId, topicId) {
  const category = ESSAY_DATA.find(cat => cat.id === catId);
  if (!category) return;
  
  const topic = category.topics.find(t => t.id === topicId);
  if (!topic) return;
  
  currentCategory = category;
  currentTopic = topic;
  currentOutlineLevel = 'B1';
  currentTransLevel = 'B1'; // reset translation exercises level to B1
  currentSampleLevel = 'B1';
  
  // Switch to Workspace view state
  switchScreen('workspace');
  
  // Reset UI View State (remove submitted class)
  document.getElementById('workspace-layout-container').classList.remove('submitted');
  
  // Setup Workspace Headers
  document.getElementById('workspace-topic-title').innerText = topic.title_en;
  document.getElementById('workspace-topic-category').innerText = category.title_vi;
  
  const badge = document.getElementById('workspace-enrichment-badge');
  if (topic.has_full_details) {
    badge.innerText = 'Đã cập nhật';
    badge.style.background = 'var(--accent-gradient)';
  } else {
    badge.innerText = 'Đang cập nhật';
    badge.style.background = 'var(--panel-border)';
    badge.style.color = 'var(--text-secondary)';
    badge.style.border = '1px solid var(--panel-border)';
  }
  
  // Populate Left Resource Pane if elements exist (Optional reference)
  const wsPromptEn = document.getElementById('ws-prompt-en');
  if (wsPromptEn) {
    wsPromptEn.innerText = topic.context ? `${topic.context}\n\n${topic.prompt}` : topic.prompt;
  }
  const wsPromptVi = document.getElementById('ws-prompt-vi');
  if (wsPromptVi) {
    wsPromptVi.innerHTML = getPromptTranslation(topic, category);
  }
  
  // Populate Paraphrases if present and element exists
  const paraphraseContainer = document.getElementById('ws-paraphrase-container');
  const paraphraseList = document.getElementById('ws-paraphrase-list');
  if (paraphraseContainer && paraphraseList) {
    paraphraseList.innerHTML = '';
    if (topic.paraphrases && topic.paraphrases.length > 0) {
      paraphraseContainer.style.display = 'block';
      topic.paraphrases.forEach(p => {
        const li = document.createElement('li');
        li.innerText = p;
        paraphraseList.appendChild(li);
      });
    } else {
      paraphraseContainer.style.display = 'none';
    }
  }
  
  // Populate Vocabulary Flashcards if element exists
  const vocabList = document.getElementById('ws-vocab-list');
  if (vocabList) {
    vocabList.innerHTML = '';
    if (topic.has_full_details && topic.details && topic.details.vocab && topic.details.vocab.length > 0) {
      topic.details.vocab.forEach(v => {
        const card = document.createElement('div');
        card.className = 'flashcard-wrapper';
        card.onclick = () => card.classList.toggle('flipped');
        card.innerHTML = `
          <div class="flashcard">
            <div class="flashcard-front">
              <span class="vocab-word">${v.en}</span>
              <span class="vocab-type">Collocation</span>
            </div>
            <div class="flashcard-back">
              <span class="vocab-translation">${v.vi}</span>
              <span class="vocab-hint">Chạm để đóng</span>
            </div>
          </div>
        `;
        vocabList.appendChild(card);
      });
    } else {
      vocabList.innerHTML = `
        <div class="empty-state">
          Chủ đề này viết tự do, không có danh sách từ vựng gợi ý sẵn.
        </div>
      `;
    }
  }
  
  // Populate Outlines accordion data if elements exist
  renderOutline();
  renderVietnameseOutline();
  
  // Load full essay draft if exists
  const draftKey = `draft_${catId}_${topicId}`;
  const savedDraft = localStorage.getItem(draftKey);
  const textarea = document.getElementById('essay-textarea');
  if (savedDraft) {
    textarea.value = savedDraft;
  } else {
    textarea.value = '';
  }
  
  updateWordCount();
  
  // Reset Timer state
  resetTimer();
  
  // Reset VSTEP evaluation state
  hasSubmitted = false;
  document.getElementById('step3-editor-view').style.display = 'flex';
  document.getElementById('step3-evaluation-view').style.display = 'none';
  
  // Set translation level selectors
  document.getElementById('ws-trans-level-b1').classList.add('active');
  document.getElementById('ws-trans-level-b2').classList.remove('active');
  
  // Set model essay level selectors
  document.getElementById('ws-model-level-b1').classList.add('active');
  document.getElementById('ws-model-level-b2').classList.remove('active');
  currentSampleLevel = 'B1';
  
  // Switch to Step 1 (Reading & Analysis) by default
  switchStep(1);
}

// --- TWO-STEP PRACTICE WORKFLOW CONTROLS ---

// Switch between 4 workspace steps
function switchStep(stepNum) {
  if (!currentTopic) return;
  
  // Update wizard tabs active state
  document.getElementById('ws-step1-tab').classList.remove('active');
  document.getElementById('ws-step2-tab').classList.remove('active');
  document.getElementById('ws-step3-tab').classList.remove('active');
  document.getElementById('ws-step4-tab').classList.remove('active');
  document.getElementById(`ws-step${stepNum}-tab`).classList.add('active');
  
  // Update step container visibility
  document.getElementById('workspace-step1-container').classList.remove('active');
  document.getElementById('workspace-step2-container').classList.remove('active');
  document.getElementById('workspace-step3-container').classList.remove('active');
  document.getElementById('workspace-step4-container').classList.remove('active');
  document.getElementById(`workspace-step${stepNum}-container`).classList.add('active');
  
  currentStep = stepNum;
  
  if (stepNum === 1) {
    renderStep1Reading();
  } else if (stepNum === 2) {
    renderTranslationExercises();
  } else if (stepNum === 3) {
    if (hasSubmitted) {
      document.getElementById('step3-editor-view').style.display = 'none';
      document.getElementById('step3-evaluation-view').style.display = 'flex';
      stopTimer();
    } else {
      document.getElementById('step3-editor-view').style.display = 'flex';
      document.getElementById('step3-evaluation-view').style.display = 'none';
      // If entering Step 3: start or resume timer
      startTimer();
      // Auto focus textarea
      document.getElementById('essay-textarea').focus();
      showToast("📝 Bạn đã chuyển sang viết bài luận. Thời gian làm bài bắt đầu!", "info");
    }
  } else if (stepNum === 4) {
    renderStep4ModelEssay();
  }
  
  if (stepNum !== 3) {
    // If leaving Step 3: pause timer
    stopTimer();
  }
}

// Switch between B1 and B2 level outlines for Step 1 Translation Exercises
function switchTransLevel(level) {
  currentTransLevel = level;
  
  document.getElementById('ws-trans-level-b1').classList.remove('active');
  document.getElementById('ws-trans-level-b2').classList.remove('active');
  document.getElementById(`ws-trans-level-${level.toLowerCase()}`).classList.add('active');
  
  renderTranslationExercises();
}

// Helper to split paragraph into sentences
function splitSentences(text) {
  if (!text) return [];
  let cleaned = text.replace(/\\n/g, ' ').replace(/\n/g, ' ');
  let parts = cleaned.split(/\.\s+/);
  let sentences = [];
  parts.forEach(part => {
    let trimmed = part.trim();
    if (trimmed) {
      if (!trimmed.endsWith('.')) {
        trimmed += '.';
      }
      sentences.push(trimmed);
    }
  });
  return sentences;
}

// Helper to build flat translation exercises list
function buildTranslationExercises(topic, transLevel, category) {
  const ideasObj = transLevel === 'B1' ? topic.details.ideas_b1 : topic.details.ideas_b2;
  if (!ideasObj) return [];
  
  const exercises = [];
  const isCausesSolutions = category.id === 2;
  const isOpinion = category.id === 3;
  const isDiscussion = category.id === 4;
  const benefitLabel = isCausesSolutions ? "Nguyên nhân" : (isOpinion ? "Lý do" : (isDiscussion ? "Quan điểm 1" : "Lợi ích"));
  const drawbackLabel = isCausesSolutions ? "Giải pháp" : (isOpinion ? "Lý do" : (isDiscussion ? "Quan điểm 2" : "Bất lợi"));
  
  // Push benefits
  if (ideasObj.benefits) {
    ideasObj.benefits.forEach((item, idx) => {
      const baseTitle = item.title ? item.title : (isDiscussion ? benefitLabel : `${benefitLabel} 0${idx+1}`);
      // 1. Point
      exercises.push({
        type: 'benefit_point',
        title: `${baseTitle}<br/>Luận điểm`,
        vi: item.point_vi,
        en: item.point_en,
        collocations: item.collocations || []
      });
      // 2. Evidence
      const viSentences = splitSentences(item.evidence_vi);
      const enSentences = splitSentences(item.evidence_en);
      viSentences.forEach((viS, sIdx) => {
        const enS = enSentences[sIdx] || "";
        const sNum = String(sIdx + 1).padStart(2, '0');
        exercises.push({
          type: 'benefit_evidence',
          title: `${baseTitle}<br/>Luận cứ ${sNum}`,
          vi: viS,
          en: enS,
          collocations: item.collocations || []
        });
      });
    });
  }
  
  // Push drawbacks
  if (ideasObj.drawbacks) {
    ideasObj.drawbacks.forEach((item, idx) => {
      const baseTitle = item.title ? item.title : (isDiscussion ? drawbackLabel : `${drawbackLabel} 0${idx+1}`);
      // 1. Point
      exercises.push({
        type: 'drawback_point',
        title: `${baseTitle}<br/>Luận điểm`,
        vi: item.point_vi,
        en: item.point_en,
        collocations: item.collocations || []
      });
      // 2. Evidence
      const viSentences = splitSentences(item.evidence_vi);
      const enSentences = splitSentences(item.evidence_en);
      viSentences.forEach((viS, sIdx) => {
        const enS = enSentences[sIdx] || "";
        const sNum = String(sIdx + 1).padStart(2, '0');
        exercises.push({
          type: 'drawback_evidence',
          title: `${baseTitle}<br/>Luận cứ ${sNum}`,
          vi: viS,
          en: enS,
          collocations: item.collocations || []
        });
      });
    });
  }
  
  return exercises;
}

// Render dynamic translation cards for Step 1
function renderTranslationExercises() {
  const container = document.getElementById('ws-translation-list');
  container.innerHTML = '';
  
  const topic = currentTopic;
  if (!topic || !topic.has_full_details || !topic.details) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 4rem 1.5rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 0.5rem;">Đề bài Viết tự do</h3>
        <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto 1.5rem auto; line-height: 1.5;">
          Chủ đề này chưa có dàn ý, nếu muốn viết thì hãy viết tự do nhé.
        </p>
        <button class="btn btn-primary" onclick="switchStep(2)">VIẾT BÀI ›</button>
      </div>
    `;
    return;
  }
  
  const exercises = buildTranslationExercises(topic, currentTransLevel, currentCategory);
  
  if (exercises.length === 0) {
    container.innerHTML = '<div class="empty-state">Chưa có bài tập dịch cho cấp độ này.</div>';
    return;
  }
  
  exercises.forEach((ex, idx) => {
    const card = document.createElement('div');
    card.className = 'translation-card';
    
    // Check local storage for persistent values
    const inputKey = `trans_input_${currentCategory.id}_${currentTopic.id}_${currentTransLevel}_${idx}`;
    const checkedKey = `trans_checked_${currentCategory.id}_${currentTopic.id}_${currentTransLevel}_${idx}`;
    
    const savedInput = localStorage.getItem(inputKey) || '';
    const isChecked = localStorage.getItem(checkedKey) === 'true';
    
    // Format collocations hints as line-by-line list, hidden by default
    let vocabHintsHtml = '';
    let hintsListHtml = '';
    if (ex.collocations && ex.collocations.length > 0) {
      hintsListHtml = ex.collocations.map(c => `<li><strong>${c.en}</strong>: ${c.vi}</li>`).join('');
    } else if (topic.details.vocab && topic.details.vocab.length > 0) {
      // Fallback: show first 3 items from topic global vocab
      const fallbackList = topic.details.vocab.slice(0, 3);
      hintsListHtml = fallbackList.map(c => `<li><strong>${c.en}</strong>: ${c.vi}</li>`).join('');
    }

    if (hintsListHtml) {
      vocabHintsHtml = `
        <div class="trans-vocab-toggle-wrapper">
          <button class="vocab-toggle-btn" onclick="toggleVocabHints(${idx})">
            <span>💡 Hiện gợi ý từ vựng </span>
            <svg class="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 14px; height: 14px; transition: transform 0.2s;">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
            </svg>
          </button>
          <div class="trans-vocab-hints" id="trans-vocab-hints-${idx}" style="display: none; margin-top: 0.5rem;">
            <ul class="vocab-hints-list">
              ${hintsListHtml}
            </ul>
          </div>
        </div>
      `;
    }
    
    card.innerHTML = `
      <div class="trans-card-header">
        <span class="part-title">${ex.title}</span>
        <span style="font-size: 0.75rem; text-transform: none; color: var(--text-muted);">Cấp độ ${currentTransLevel}</span>
      </div>
      <div class="trans-vi-prompt">${ex.vi}</div>
      ${vocabHintsHtml}
      <textarea class="trans-input-area" autocomplete="off" id="trans-input-${idx}" placeholder="Gõ câu dịch tiếng Anh của bạn tại đây..." oninput="saveTransInput(${idx})">${savedInput}</textarea>
      
      <div class="trans-actions">
        <button class="btn ${isChecked ? 'btn-secondary' : 'btn-success'}" id="trans-check-btn-${idx}" onclick="checkTranslation(${idx})">
          ${isChecked ? 'Xem đáp án gợi ý' : 'Kiểm tra & Xem đáp án'}
        </button>
      </div>
      
      <div class="trans-answer-box" id="trans-answer-box-${idx}">
        <div id="trans-eval-result-${idx}"></div>
        <div class="trans-answer-title" style="margin-top: 0.5rem; border-top: 1px dashed var(--panel-border); padding-top: 0.5rem;">Đáp án gợi ý</div>
        <div class="trans-answer-text">${ex.en}</div>
      </div>
    `;
    container.appendChild(card);
  });
  
  // Footer navigation button
  const footerDiv = document.createElement('div');
  footerDiv.style.display = 'flex';
  footerDiv.style.justifyContent = 'center';
  footerDiv.style.padding = '1rem 0 2rem 0';
  footerDiv.innerHTML = `
    <button class="btn btn-primary" style="padding: 0.75rem 2rem; font-size: 1rem; box-shadow: var(--shadow-glow);" onclick="switchStep(3)">
      HOÀN THÀNH DỊCH Ý TƯỞNG → CHUYỂN SANG VIẾT BÀI LUẬN
    </button>
  `;
  container.appendChild(footerDiv);
}

// Mark progress as unsaved when typing translation
function saveTransInput(idx) {
  isDirty = true;
}

// Check translation card and reveal correct answer with VSTEP grammar/semantic checks
function checkTranslation(idx) {
  const ansBox = document.getElementById(`trans-answer-box-${idx}`);
  const btn = document.getElementById(`trans-check-btn-${idx}`);
  if (!ansBox || !btn) return;
  
  // Reconstruct the flat list of exercises to get the model answer
  const topic = currentTopic;
  const exercises = buildTranslationExercises(topic, currentTransLevel, currentCategory);
  
  const modelAnswer = exercises[idx] ? exercises[idx].en : "";
  
  const checkedKey = `trans_checked_${currentCategory.id}_${currentTopic.id}_${currentTransLevel}_${idx}`;
  const isChecked = localStorage.getItem(checkedKey) === 'true';
  
  // Evaluate the student's text
  const userInput = document.getElementById(`trans-input-${idx}`).value;
  const evalResult = evaluateTranslationInput(userInput, modelAnswer);
  
  // Render evaluation block in answer container
  const evalResultDiv = document.getElementById(`trans-eval-result-${idx}`);
  if (evalResultDiv) {
    if (evalResult.isCorrect) {
      evalResultDiv.innerHTML = `
        <div class="eval-badge eval-correct" style="display: inline-flex; align-items: center; gap: 0.35rem; background-color: var(--success-bg); color: var(--success); padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 700; margin-bottom: 0.75rem; border: 1px solid var(--success);">
          ✓ ĐÚNG
        </div>
        <div style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 1rem; line-height: 1.4; font-family: inherit;">
          ${evalResult.feedback}
        </div>
      `;
    } else {
      evalResultDiv.innerHTML = `
        <div class="eval-badge eval-incorrect" style="display: inline-flex; align-items: center; gap: 0.35rem; background-color: var(--danger-bg); color: var(--danger); padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 700; margin-bottom: 0.75rem; border: 1px solid var(--danger);">
          ✗ CHƯA ĐÚNG
        </div>
        <div style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 1rem; line-height: 1.4; font-family: inherit;">
          ${evalResult.reason}
        </div>
      `;
    }
  }
  
  if (!isChecked) {
    // First time checking: reveal answer, mark as checked
    ansBox.classList.add('active');
    btn.innerText = "Ẩn đáp án gợi ý";
    btn.className = "btn btn-secondary";
    localStorage.setItem(checkedKey, 'true');
    saveTransInput(idx);
    if (evalResult.isCorrect) {
      showToast("🎉 Chúc mừng! Câu dịch của bạn đã được đánh giá là ĐÚNG.", "success");
    } else {
      showToast("🔍 Câu dịch chưa chính xác hoàn toàn. Xem gợi ý chỉnh sửa nhé!", "warning");
    }
  } else {
    // Already checked in the past: toggle visibility
    if (ansBox.classList.contains('active')) {
      ansBox.classList.remove('active');
      btn.innerText = "Xem đáp án gợi ý";
    } else {
      ansBox.classList.add('active');
      btn.innerText = "Ẩn đáp án gợi ý";
    }
  }
}

// Levenshtein distance helper
function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Common english vocabulary words
const COMMON_ENGLISH_WORDS = new Set([
  
  "a", "abilities", "ability", "able", "about", "above", "abroad", "academic", "academically", "accelerating", "accept", "acceptable",
  "access", "accessed", "accesses", "accessibility", "accessible", "accessing", "accident", "accidental", "accidentally", "accidents", "accuracy", "accurate",
  "accurately", "achieve", "achievement", "achievements", "acquire", "acquisition", "across", "act", "action", "actions", "activating", "active",
  "actively", "activities", "activity", "actors", "actual", "actually", "adapt", "add", "added", "addiction", "addition", "additional",
  "additionally", "address", "addressed", "addressing", "adds", "administer", "administration", "administrative", "administrators", "admit", "admitted", "adopt",
  "adopting", "adoption", "adult", "adulthood", "adults", "advance", "advanced", "advancement", "advances", "advantage", "advantages", "adventure",
  "adverse", "advertise", "advertisement", "advertisements", "advertising", "advice", "advise", "advisor", "advocate", "aesthetic", "affect", "affected",
  "affecting", "affects", "afford", "affordability", "affordable", "afraid", "after", "afternoon", "afterwards", "again", "against", "age",
  "agency", "agent", "agents", "ages", "aggressive", "ago", "agree", "agreed", "agreement", "agrees", "agriculture", "ahead",
  "ai", "aid", "aim", "aimed", "aims", "air", "alarm", "alarming", "alcohol", "alike", "alive", "all",
  "alleviate", "allocate", "allocating", "allow", "allowed", "allowing", "allows", "allure", "almost", "alone", "along", "already",
  "also", "alter", "alternative", "alternatives", "although", "always", "am", "amaze", "amazing", "ambition", "among", "amount",
  "amounts", "an", "analyse", "analysis", "analyze", "ancient", "and", "anger", "angle", "angry", "animal", "animals",
  "annoy", "annual", "another", "answer", "answered", "answering", "answers", "anxiety", "anxious", "any", "anybody", "anymore",
  "anyone", "anything", "anytime", "anyway", "anywhere", "apart", "apartment", "apartments", "apologize", "app", "apparent", "apparently",
  "appeal", "appear", "appearance", "appeared", "appearing", "appears", "appetite", "apple", "apples", "appliances", "application", "applications",
  "applied", "applies", "apply", "applying", "appoint", "appointment", "appreciate", "appreciated", "appreciation", "approach", "approached", "approaches",
  "approaching", "appropriate", "appropriately", "approval", "approve", "approximate", "approximately", "apps", "april", "are", "area", "areas",
  "argue", "argued", "argues", "arguing", "argument", "arguments", "arise", "arisen", "arises", "arising", "arm", "arms",
  "army", "arose", "around", "arrange", "arranged", "arrangement", "arrangements", "arrest", "arrival", "arrive", "arrived", "arrives",
  "arriving", "art", "article", "articles", "artificial", "artist", "artistic", "artists", "as", "ashamed", "asian", "aside",
  "ask", "asked", "asking", "asks", "asleep", "aspect", "aspects", "aspiration", "aspirations", "aspire", "assessment", "assessments",
  "assign", "assignment", "assignments", "assist", "assistance", "assistant", "assistants", "associate", "associated", "associates", "associating", "association",
  "associations", "assume", "assumption", "assumptions", "assure", "at", "ate", "athlete", "athletes", "athletic", "atmosphere", "attach",
  "attack", "attempt", "attempted", "attempts", "attend", "attendance", "attended", "attending", "attends", "attention", "attitude", "attitudes",
  "attract", "attracted", "attracting", "attraction", "attractions", "attractive", "attracts", "attribute", "audience", "audiences", "august", "aunt",
  "authentic", "author", "authorities", "authority", "authors", "automobiles", "autumn", "availability", "available", "average", "avoid", "avoidance",
  "avoided", "avoiding", "awake", "award", "awards", "aware", "awareness", "away", "awful", "babies", "baby", "back",
  "background", "backgrounds", "backward", "bacon", "bad", "badly", "bag", "baggage", "bags", "bake", "baker", "balance",
  "balanced", "balances", "ball", "balls", "ban", "band", "bands", "bank", "banking", "banks", "banned", "banning",
  "bans", "bar", "barrier", "barriers", "bars", "base", "based", "bases", "basic", "basically", "basis", "basket",
  "basketball", "bath", "bathroom", "bathrooms", "batteries", "battery", "battle", "battlefields", "be", "beach", "beaches", "beam",
  "bear", "beard", "bears", "beast", "beat", "beaten", "beating", "beats", "beautiful", "beautifully", "beauty", "became",
  "because", "become", "becomes", "becoming", "bed", "bedroom", "bedrooms", "beds", "beef", "been", "beer", "before",
  "beforehand", "beg", "began", "begin", "beginning", "beginnings", "begins", "begun", "behalf", "behave", "behavior", "behaviors",
  "behaviour", "behaviours", "behind", "being", "beings", "belief", "beliefs", "believe", "believed", "believes", "believing", "bell",
  "bells", "belong", "belonged", "belonging", "belongs", "below", "belt", "belts", "bench", "bend", "beneath", "beneficial",
  "benefit", "benefited", "benefiting", "benefits", "beside", "besides", "best", "bet", "better", "between", "beyond", "bicycle",
  "bicycles", "big", "bigger", "biggest", "bike", "bikes", "bill", "billboards", "billion", "bills", "bind", "biodiversity",
  "biography", "biological", "biology", "biotech", "biotechnology", "bird", "birds", "birth", "birthday", "birthdays", "biscuit", "biscuits",
  "bit", "bite", "bites", "bitter", "black", "blade", "blame", "blank", "blanket", "blast", "bleed", "blend",
  "bless", "blind", "block", "blocks", "blood", "blow", "blows", "blue", "board", "boards", "boast", "boat",
  "boats", "bodies", "body", "boil", "bold", "bomb", "bombs", "bond", "bonds", "bone", "bones", "book",
  "books", "boosts", "boot", "boots", "border", "borders", "bore", "bored", "boring", "born", "borrow", "borrowed",
  "boss", "bosses", "both", "bother", "bottle", "bottleneck", "bottlenecks", "bottles", "bottom", "bought", "bound", "boundaries",
  "boundary", "bow", "bowl", "box", "boxes", "boy", "boys", "brain", "brains", "branch", "branches", "brand",
  "brands", "brave", "breaches", "bread", "break", "breakfast", "breakfasts", "breaking", "breaks", "breast", "breath", "breathe",
  "breathless", "breeze", "brick", "bricks", "bridge", "bridges", "brief", "briefly", "bright", "brightened", "brightly", "brilliant",
  "bring", "bringing", "brings", "broad", "broadcast", "broke", "broken", "brother", "brothers", "brought", "brown", "brt",
  "brush", "bubble", "bucket", "budget", "budgets", "bug", "bugs", "build", "building", "buildings", "builds", "built",
  "bullet", "bulletin", "bunch", "burden", "burn", "burned", "burning", "burns", "burnt", "burst", "bury", "bus",
  "buses", "bush", "bushes", "business", "businesses", "busy", "but", "butter", "button", "buttons", "buy", "buyer",
  "buyers", "buying", "buys", "by", "bypass", "cab", "cabin", "cabinet", "cable", "cables", "cafe", "cafes",
  "cake", "cakes", "calculate", "calculation", "calculations", "calendar", "calendars", "call", "called", "calling", "calls", "calm",
  "came", "camera", "cameras", "camp", "campaign", "campaigns", "can", "canal", "cancel", "cancer", "cancers", "candidate",
  "candidates", "candle", "cannot", "cap", "capable", "capacities", "capacity", "capital", "capitals", "caps", "captain", "capture",
  "car", "card", "cards", "care", "cared", "career", "careers", "careful", "carefully", "careless", "cares", "cargo",
  "caring", "carpet", "carriage", "carried", "carrier", "carries", "carry", "carrying", "cars", "cart", "cartoons", "case",
  "cases", "cash", "cashless", "castle", "cat", "catalog", "catch", "catches", "catching", "categories", "category", "cats",
  "cattle", "caught", "cause", "caused", "causes", "causing", "caution", "cautious", "cave", "caves", "cease", "ceeded",
  "ceiling", "celebrate", "celebration", "celebrations", "celebrities", "celebrity", "cell", "cellphone", "cellphones", "cells", "cement", "cemetery",
  "cent", "center", "centers", "central", "centralized", "centre", "centres", "cents", "centuries", "century", "ceremonies", "ceremony",
  "certain", "certainly", "certificate", "certificates", "cessant", "chain", "chains", "chair", "chairman", "chairs", "challenge", "challenges",
  "challenging", "chamber", "champion", "championship", "championships", "chance", "chances", "change", "changed", "changes", "changing", "channel",
  "channels", "chapter", "chapters", "character", "characteristic", "characteristics", "characters", "charge", "charged", "charges", "charging", "charities",
  "charity", "charm", "charming", "chart", "charts", "chase", "chat", "chatgpt", "cheap", "cheaper", "cheapest", "cheat",
  "check", "checked", "checking", "checks", "cheek", "cheer", "cheerful", "cheese", "chef", "chemical", "chemicals", "chemistry",
  "chest", "chew", "chicken", "chickens", "chief", "child", "childbirth", "childhood", "children", "chimney", "chin", "china",
  "chinese", "chip", "chips", "chocolate", "chocolates", "choice", "choices", "choke", "choose", "chooses", "choosing", "chop",
  "chore", "chores", "chorus", "chose", "chosen", "christ", "christian", "christmas", "chronic", "church", "churches", "cigarette",
  "cigarettes", "cinema", "cinemas", "circle", "circles", "circular", "circumstance", "circumstances", "cities", "citizen", "citizens", "city",
  "civil", "civilization", "claim", "claimed", "claims", "clarification", "clarifications", "clarified", "clarifies", "clarify", "clarifying", "clash",
  "class", "classes", "classic", "classical", "classification", "classmates", "classroom", "classrooms", "clay", "clean", "cleaned", "cleaner",
  "cleanest", "cleaning", "clear", "cleared", "clearly", "clerk", "clever", "click", "client", "clients", "cliff", "climate",
  "climates", "climb", "climbed", "climbing", "clinic", "clinical", "clip", "clock", "clocks", "close", "closed", "closely",
  "closer", "closest", "closet", "cloth", "clothes", "clothing", "cloud", "clouds", "cloudy", "club", "clubs", "clue",
  "clues", "cluster", "coach", "coaches", "coal", "coast", "coasts", "coat", "coats", "code", "codes", "coffee",
  "coffees", "cognitive", "coin", "coins", "cold", "colder", "coldest", "collaboration", "collapse", "collar", "colleague", "colleagues",
  "collect", "collection", "collections", "collective", "college", "colleges", "collision", "collocation", "collocations", "colloquial", "colony", "color",
  "colorful", "colors", "colourful", "column", "columns", "combat", "combination", "combinations", "combine", "combined", "combining", "come",
  "comedy", "comes", "comfort", "comfortable", "comfortably", "comic", "coming", "command", "comment", "comments", "commerce", "commercial",
  "commit", "commitment", "commitments", "committed", "committee", "committees", "common", "commonly", "communicate", "communicated", "communicates", "communicating",
  "communication", "communications", "communion", "communities", "community", "commute", "commuted", "commuter", "commuters", "commutes", "commuting", "companies",
  "companion", "companions", "companionship", "company", "comparative", "compare", "compared", "comparing", "comparison", "comparisons", "compass", "compatibility",
  "compel", "compensate", "compensation", "compete", "competent", "competition", "competitions", "competitive", "competitor", "competitors", "complain", "complaint",
  "complaints", "complete", "completely", "completing", "completion", "complex", "complexities", "complexity", "compliance", "complicate", "complicated", "complication",
  "complications", "comply", "component", "components", "compose", "composition", "compositions", "compound", "compounded", "comprehend", "comprehension", "comprehensive",
  "comprise", "compromise", "computer", "computers", "computing", "conceal", "concede", "concentrate", "concentrated", "concentrates", "concentration", "concept",
  "concepts", "concern", "concerned", "concerning", "concerns", "concert", "concerts", "conclude", "concluded", "concludes", "conclusion", "conclusions",
  "concrete", "condition", "conditions", "conduct", "conductor", "conference", "conferences", "conferencing", "confess", "confidence", "confident", "confidential",
  "confine", "confirm", "confirmation", "conflict", "conflicts", "confront", "confuse", "confused", "confusing", "confusion", "congestion", "congratulate",
  "congratulation", "congratulations", "congress", "connect", "connected", "connecting", "connection", "connections", "connects", "conquer", "conscience", "conscious",
  "consciousness", "consent", "consequence", "consequences", "consequently", "conservation", "conservative", "conserving", "consider", "considerable", "considerably", "consideration",
  "considerations", "considered", "considering", "considers", "consist", "consisted", "consistent", "consistently", "consists", "consoles", "constant", "constantly",
  "constitute", "constitution", "constrain", "constraint", "constraints", "construct", "constructing", "construction", "constructions", "consult", "consultant", "consultants",
  "consume", "consumer", "consumers", "consumption", "contact", "contacts", "contain", "contained", "containing", "contains", "contemporary", "contempt",
  "contend", "content", "contents", "contest", "context", "contexts", "continent", "continual", "continually", "continue", "continued", "continues",
  "continuing", "continuous", "continuously", "contract", "contracts", "contradict", "contradiction", "contrary", "contrast", "contrasts", "contribute", "contributed",
  "contributes", "contributing", "contribution", "contributions", "contributor", "control", "controlled", "controlling", "controls", "controversial", "controversy", "convenience",
  "conveniences", "convenient", "conveniently", "convention", "conventional", "conventions", "conversation", "conversations", "convert", "convey", "convinced", "cook",
  "cooked", "cooking", "cooks", "cool", "cooperate", "cooperation", "cooperative", "coordinate", "cope", "copies", "coping", "copy",
  "cord", "core", "corn", "corner", "corners", "corporate", "corporation", "corporations", "correct", "correctly", "correlation", "correspond",
  "correspondence", "corridor", "cost", "costly", "costs", "cottage", "cotton", "couch", "cough", "could", "council", "councils",
  "counsel", "count", "counted", "counter", "countless", "countries", "country", "countryside", "counts", "county", "couple", "coupled",
  "couples", "courage", "course", "courses", "court", "courts", "cousin", "cousins", "cover", "coverage", "covered", "covering",
  "covers", "cow", "cows", "crack", "craft", "crash", "crazy", "cream", "create", "created", "creates", "creating",
  "creation", "creations", "creative", "creativity", "creator", "creators", "creature", "creatures", "credit", "credits", "crew", "crews",
  "cries", "crime", "crimes", "criminal", "criminals", "crises", "crisis", "criteria", "criterion", "critic", "critical", "critically",
  "criticism", "criticize", "critics", "crop", "crops", "cross", "crossing", "crowd", "crowded", "crowds", "crown", "crucial",
  "crucially", "crude", "cruel", "crush", "cry", "crying", "crystal", "cues", "cuisine", "cultivate", "cultivation", "cultural",
  "culturally", "culture", "cultures", "cup", "cups", "cure", "curiosity", "curious", "currencies", "currency", "current", "currently",
  "curricula", "curriculum", "curriculums", "curtain", "curtains", "curve", "cushion", "custom", "customer", "customers", "customs", "cut",
  "cuts", "cutting", "cyberattacks", "cyberbullying", "cybercrime", "cycle", "cycles", "daily", "dairy", "dam", "damage", "damaged",
  "damages", "damaging", "damp", "dance", "dancer", "dancers", "dancing", "danger", "dangerous", "dangerously", "dangers", "dare",
  "dark", "darkness", "darling", "dash", "data", "database", "date", "dates", "daughter", "daughters", "dawn", "day",
  "days", "dead", "deadline", "deadlines", "deaf", "deal", "dealing", "deals", "dealt", "dear", "death", "deaths",
  "debate", "debated", "debates", "debris", "debt", "debts", "decade", "decades", "decay", "december", "decent", "decentralize",
  "decentralizing", "decide", "decided", "decides", "deciding", "decision", "decisions", "deck", "declaration", "declare", "decline", "declined",
  "declines", "declining", "decomposing", "decorate", "decoration", "decorations", "decrease", "decreased", "decreases", "decreasing", "dedicate", "dedicated",
  "dedication", "deed", "deeds", "deep", "deeper", "deeply", "deer", "defeat", "defend", "defendant", "defense", "defensive",
  "deficiency", "deficit", "define", "defined", "defines", "defining", "definite", "definitely", "definition", "definitions", "deforestation", "defy",
  "degradation", "degrading", "degree", "degrees", "delay", "delayed", "delaying", "delays", "deliberate", "deliberately", "delicate", "delicious",
  "delight", "delighted", "deliver", "delivered", "deliveries", "delivering", "delivers", "delivery", "demand", "demanding", "demands", "democracy",
  "democratic", "demolish", "demonstrate", "demonstrated", "demonstrates", "demonstration", "denial", "denied", "denies", "denote", "dense", "density",
  "dentist", "dentists", "deny", "denying", "depart", "department", "departments", "departure", "departures", "depend", "depended", "dependence",
  "dependency", "dependent", "depending", "depends", "depict", "depicted", "deploy", "deport", "deposit", "depress", "depressed", "depressing",
  "depression", "deprive", "deprived", "depth", "depths", "derive", "derived", "descend", "descendant", "describe", "described", "describes",
  "describing", "description", "descriptions", "desert", "deserts", "deserve", "deserved", "deserves", "design", "designed", "designer", "designers",
  "designing", "designs", "desire", "desired", "desires", "desk", "desks", "despair", "desperate", "despite", "destination", "destinations",
  "destroy", "destroyed", "destroying", "destroys", "destruction", "destructive", "detach", "detail", "detailed", "details", "detain", "detect",
  "detected", "detective", "deter", "determination", "determine", "determined", "determines", "develop", "developed", "developing", "development", "developmental",
  "developments", "develops", "device", "devices", "devil", "devise", "devote", "devoted", "devotion", "diagnose", "diagnosis", "diagram",
  "diagrams", "dial", "dialect", "dialogue", "dialogues", "diamond", "diamonds", "diaries", "diary", "dictate", "dictionaries", "dictionary",
  "did", "die", "died", "dies", "diesel", "diet", "diets", "differ", "differed", "difference", "differences", "different",
  "differently", "differs", "difficult", "difficulties", "difficulty", "dig", "digest", "digestion", "digging", "digital", "dignity", "digs",
  "dilemma", "dilemmas", "diligent", "dim", "dimension", "dimensions", "diminished", "dining", "dinner", "dinners", "dinosaur", "dinosaurs",
  "dip", "direct", "direction", "directions", "directly", "director", "directors", "directory", "dirt", "dirty", "disabilities", "disability",
  "disabled", "disadvantage", "disadvantages", "disagree", "disagreeable", "disagreed", "disagreeing", "disagreement", "disagreements", "disagrees", "disappear", "disappearance",
  "disappoint", "disappointed", "disappointing", "disappointment", "disaster", "disasters", "disastrous", "disc", "discard", "discern", "discharge", "discipline",
  "disciplined", "disciplines", "disclose", "disclosure", "discount", "discounts", "discourage", "discouraged", "discouragement", "discourages", "discouraging", "discourse",
  "discover", "discovered", "discoveries", "discovering", "discovery", "discretion", "discriminate", "discrimination", "discs", "discuss", "discussed", "discusses",
  "discussing", "discussion", "discussions", "disease", "diseases", "disgrace", "disguise", "disgust", "dish", "dishes", "disincentives", "dislike",
  "disliked", "dislikes", "dismiss", "disney", "disorder", "disorders", "dispatch", "displace", "display", "displays", "disposal", "dispose",
  "dispute", "disputes", "disrupt", "disrupted", "disruption", "disruptions", "dissolve", "distance", "distances", "distant", "distract", "distracted",
  "distracting", "distraction", "distractions", "distracts", "distribute", "distributed", "distribution", "district", "districts", "distrust", "disturb", "disturbance",
  "disturbed", "dive", "diverse", "diversity", "divert", "diverts", "divide", "divided", "dividers", "dividing", "division", "divorce",
  "do", "dock", "doctor", "doctors", "doctrine", "document", "documentaries", "documentary", "documents", "does", "dog", "dogs",
  "doing", "doll", "dollar", "dollars", "dolls", "domain", "domains", "domestic", "dominant", "dominate", "donation", "donations",
  "done", "donor", "donors", "door", "doors", "doorway", "dose", "dot", "dots", "double", "doubt", "doubtful",
  "doubts", "down", "downtown", "downward", "draft", "drag", "dragon", "dragons", "drain", "drama", "dramas", "dramatic",
  "dramatically", "drank", "draw", "drawback", "drawbacks", "drawing", "drawings", "drawn", "draws", "dread", "dreadful", "dream",
  "dreamed", "dreams", "dreamt", "dress", "dressed", "dresses", "dressing", "drew", "drift", "drill", "drink", "drinking",
  "drinks", "drip", "drive", "driven", "driver", "drivers", "drives", "driving", "drop", "dropped", "dropping", "drops",
  "drought", "droughts", "drove", "drown", "drowned", "drug", "drugs", "drum", "drums", "drunk", "dry", "dual",
  "duck", "ducks", "due", "dull", "dumb", "dump", "durable", "during", "dust", "dusty", "duties", "duty",
  "dwell", "dwelling", "dying", "dynamic", "each", "eager", "eagle", "ear", "earlier", "earliest", "early", "earn",
  "earned", "earning", "earnings", "earns", "ears", "earth", "earthquake", "earthquakes", "ease", "easier", "easiest", "easily",
  "east", "eastern", "easy", "eat", "eaten", "eating", "eats", "echo", "ecological", "ecology", "economic", "economical",
  "economics", "economies", "economy", "ecosystems", "edge", "edges", "edit", "edition", "editions", "editor", "editorial", "editors",
  "educate", "educated", "educating", "education", "educational", "educator", "educators", "eel", "eels", "effect", "effective", "effectively",
  "effectiveness", "effects", "efficiency", "efficient", "efficiently", "effort", "efforts", "egg", "eggs", "eight", "eighteen", "eighth",
  "eighty", "either", "elaborate", "elbow", "elder", "elderly", "elect", "election", "elections", "electric", "electrical", "electricity",
  "electronic", "elegant", "element", "elementary", "elements", "elephant", "elephants", "elevated", "elevation", "eleven", "eleventh", "eliminate",
  "elimination", "elite", "else", "elsewhere", "email", "emails", "embarrass", "embarrassed", "embarrassing", "embarrassment", "embassy", "embrace",
  "emerge", "emerged", "emergence", "emergencies", "emergency", "emission", "emissions", "emotion", "emotional", "emotionally", "emotions", "empathy",
  "emperor", "emphasis", "emphasize", "emphasized", "emphasizes", "empire", "employ", "employee", "employees", "employer", "employers", "employment",
  "empty", "en", "enable", "enabled", "enables", "enabling", "encourage", "encouraged", "encourages", "encouraging", "end", "energy",
  "enforce", "enforcement", "engage", "engaged", "engagement", "engaging", "engine", "engineer", "engineering", "engineers", "engines", "english",
  "enjoy", "enjoyable", "enjoyed", "enjoying", "enjoyment", "enjoys", "enlarge", "enormous", "enough", "enroll", "enrollment", "ensure",
  "ensured", "ensures", "ensuring", "enter", "entered", "entering", "enterprise", "enterprises", "enters", "entertain", "entertainment", "enthusiasm",
  "enthusiastic", "entire", "entirely", "entitle", "entrance", "entrepreneurs", "entries", "entry", "envelope", "envelopes", "environment", "environmental",
  "environmentalists", "environmentally", "environments", "envy", "epidemic", "episode", "episodes", "equal", "equality", "equally", "equation", "equations",
  "equip", "equipment", "equipped", "equivalent", "era", "eras", "erase", "erect", "errand", "errands", "error", "errors",
  "escape", "escaped", "escapes", "escaping", "especially", "essay", "essays", "essence", "essential", "essentially", "establish", "established",
  "establishes", "establishment", "estate", "estimate", "estimated", "estimates", "etc", "eternal", "ethical", "ethics", "ethnic", "euro",
  "europe", "european", "evaluate", "evaluated", "evaluates", "evaluating", "evaluation", "evaluations", "evaporate", "evaporation", "eve", "even",
  "evening", "evenings", "event", "events", "eventual", "eventually", "ever", "every", "everybody", "everyday", "everyone", "everything",
  "everywhere", "evidence", "evident", "evidently", "evil", "evolution", "evolve", "ex", "exact", "exactly", "exaggerate", "exaggeration",
  "exam", "examination", "examinations", "examine", "examined", "examiner", "examiners", "examines", "examining", "example", "examples", "exams",
  "exasperate", "exceed", "excel", "excellent", "except", "exception", "exceptional", "exceptions", "excess", "excessive", "exchange", "exchanged",
  "exchanges", "exchanging", "excite", "excited", "excitement", "exciting", "exclude", "exclusion", "exclusive", "exclusively", "excursion", "excursions",
  "excuse", "excuses", "execute", "execution", "executive", "executives", "exempt", "exercise", "exercised", "exercises", "exercising", "exert",
  "exhale", "exhaust", "exhausted", "exhausting", "exhibit", "exhibition", "exhibitions", "exhibits", "exile", "exist", "existed", "existence",
  "existences", "existing", "exists", "exit", "exits", "exotic", "expand", "expanded", "expanding", "expands", "expansion", "expect",
  "expectation", "expectations", "expected", "expecting", "expects", "expedition", "expeditions", "expel", "expenditure", "expense", "expenses", "expensive",
  "experience", "experienced", "experiences", "experiencing", "experiment", "experimental", "experiments", "expert", "expertise", "experts", "explain", "explained",
  "explaining", "explains", "explanation", "explanations", "explicit", "explicitly", "explode", "exploit", "exploration", "explore", "explored", "explorer",
  "explorers", "exploring", "explosion", "explosions", "export", "exports", "expose", "exposed", "exposes", "exposure", "express", "expressed",
  "expression", "expressions", "expressive", "exquisite", "extend", "extended", "extending", "extension", "extensive", "extent", "exterior", "external",
  "extinct", "extinction", "extra", "extract", "extraordinary", "extravagant", "extreme", "extremely", "eye", "eyes", "fabric", "fabrics",
  "face", "facebook", "faced", "faces", "facilitate", "facilities", "facility", "facing", "fact", "factor", "factories", "factors",
  "factory", "facts", "faculties", "faculty", "fade", "faded", "fades", "fading", "fail", "failed", "failing", "fails",
  "failure", "failures", "faint", "fair", "fairly", "fairy", "faith", "faithful", "fake", "fall", "fallen", "falling",
  "falls", "false", "fame", "familiar", "families", "family", "famine", "famines", "famous", "fan", "fancy", "fans",
  "fantastic", "far", "fare", "fares", "farewell", "farm", "farmer", "farmers", "farming", "farms", "farther", "farthest",
  "fascinate", "fascinating", "fascination", "fashion", "fashionable", "fast", "fasten", "faster", "fastest", "fat", "fatal", "fate",
  "father", "fathers", "fatigue", "fault", "faults", "favor", "favorable", "favorite", "favorites", "favors", "favour", "fear",
  "fearful", "fears", "feasible", "feast", "feat", "feather", "feathers", "feature", "features", "february", "fed", "federal",
  "fee", "feeble", "feed", "feedback", "feeding", "feeds", "feel", "feeling", "feelings", "feels", "fees", "feet",
  "fell", "fellow", "felt", "female", "females", "feminine", "fence", "fences", "ferry", "fertile", "fertilizer", "fertilizers",
  "festival", "festivals", "fetch", "fever", "few", "fewer", "fewest", "fiber", "fibers", "fiction", "field", "fields",
  "fierce", "fifteen", "fifth", "fifty", "fig", "fight", "fighter", "fighters", "fighting", "fights", "figure", "figures",
  "file", "files", "fill", "filled", "filling", "fills", "film", "films", "filter", "filters", "filthy", "final",
  "finally", "finance", "finances", "financial", "financially", "find", "finding", "findings", "finds", "fine", "finger", "fingers",
  "finish", "finished", "finishes", "finishing", "finite", "fir", "fire", "fired", "fireplace", "fires", "fireworks", "firing",
  "firm", "firmly", "firms", "first", "firstly", "fish", "fishes", "fishing", "fist", "fists", "fit", "fitness",
  "fits", "fitted", "fitting", "five", "fix", "fixed", "fixes", "fixing", "fixture", "flag", "flags", "flame",
  "flames", "flap", "flash", "flat", "flavor", "flavors", "flaw", "flaws", "fled", "flee", "fleeing", "flees",
  "fleet", "flesh", "flew", "flexibility", "flexible", "flicker", "flies", "flight", "flights", "float", "flock", "flood",
  "flooded", "floods", "floor", "floors", "flour", "flow", "flowed", "flower", "flowers", "flowing", "flown", "flows",
  "flu", "fluency", "fluent", "fluid", "flush", "flute", "fly", "flying", "foam", "focus", "focused", "focuses",
  "focusing", "foe", "foes", "fog", "foggy", "fold", "folded", "folds", "foliage", "folk", "folklore", "follow",
  "followed", "follower", "followers", "following", "follows", "fond", "food", "foods", "fool", "foolish", "fools", "foot",
  "football", "footnote", "footnotes", "for", "forbade", "forbid", "forbidden", "forbids", "force", "forced", "forces", "forcing",
  "forecast", "forecasts", "forehead", "foreign", "foreigner", "foreigners", "forest", "forests", "forever", "forgave", "forge", "forget",
  "forgetful", "forgive", "forgiven", "forgives", "forgiving", "fork", "forks", "form", "formal", "formally", "format", "formation",
  "formations", "formats", "formed", "former", "formerly", "forming", "forms", "formula", "formulae", "formulas", "fort", "forth",
  "fortnight", "fortunate", "fortunately", "fortune", "fortunes", "forty", "forward", "fossil", "fossils", "foster", "fought", "foul",
  "found", "foundation", "foundations", "founder", "fountain", "four", "fourteen", "fourth", "fraction", "frail", "frame", "frames",
  "framework", "frameworks", "frank", "frankly", "fraud", "free", "freedom", "freedoms", "freelancers", "freely", "freeze", "freezes",
  "freight", "french", "frequencies", "frequency", "frequent", "frequently", "fresh", "freshly", "freshwater", "friction", "friday", "friend",
  "friendly", "friends", "friendship", "friendships", "fright", "frighten", "frightened", "frightening", "frog", "frogs", "from", "front",
  "frontier", "frontiers", "frost", "frown", "froze", "frozen", "fruit", "fruits", "frustrate", "frustrated", "frustrating", "frustration",
  "frustrations", "fry", "fuel", "fuels", "fulfill", "fulfilled", "fulfilling", "fulfillment", "full", "fully", "fume", "fumes",
  "fun", "function", "functional", "functions", "fund", "fundamental", "fundamentally", "funds", "funeral", "funerals", "funny", "fur",
  "furious", "furnace", "furnish", "furniture", "further", "furthermore", "fury", "fuse", "fuss", "future", "futures", "gain",
  "gained", "gaining", "gains", "gale", "gales", "galleries", "gallery", "gallon", "gallons", "gamble", "gambling", "game",
  "games", "gaming", "gang", "gangs", "gap", "gaps", "garage", "garages", "garden", "gardener", "gardens", "garlic",
  "garment", "garments", "gas", "gases", "gasoline", "gasp", "gate", "gates", "gather", "gathered", "gathering", "gathers",
  "gauge", "gave", "gay", "gaze", "gear", "gears", "geese", "gem", "gemini", "gems", "gender", "general",
  "generally", "generate", "generated", "generates", "generating", "generation", "generations", "generosity", "generous", "genius", "geniuses", "gentle",
  "gentleman", "gently", "genuine", "genuinely", "geographical", "geography", "geology", "germ", "germs", "gesture", "gestures", "get",
  "gets", "getting", "ghost", "ghosts", "giant", "giants", "gift", "gifted", "gifts", "gigantic", "girl", "girls",
  "give", "given", "gives", "giving", "glad", "glance", "glances", "glass", "glasses", "gleam", "glide", "glimpse",
  "glitch", "glitches", "glitter", "global", "globalization", "globalized", "globally", "globe", "gloom", "gloomy", "glorious", "glory",
  "glove", "gloves", "glow", "glue", "go", "goal", "goals", "goat", "goats", "god", "goddess", "gods",
  "goes", "going", "gold", "golden", "golf", "gone", "good", "goodbye", "goodness", "goods", "google", "goose",
  "gossip", "got", "gotten", "govern", "governess", "governing", "government", "governmental", "governments", "governor", "governors", "gown",
  "gowns", "grace", "graceful", "grade", "graded", "grades", "grading", "gradual", "gradually", "graduate", "graduated", "graduates",
  "graduating", "graduation", "grain", "grains", "grammar", "grammarly", "grammatical", "grand", "grandchild", "grandchildren", "granddaughter", "grandfather",
  "grandmother", "grandparent", "grandparents", "grandson", "granite", "grant", "granted", "grants", "grape", "grapes", "grasp", "grass",
  "grasshopper", "grateful", "gratefully", "grave", "graves", "gravity", "gray", "grease", "great", "greater", "greatest", "greatly",
  "greed", "greedy", "greek", "green", "greet", "greeted", "greeting", "greetings", "greets", "grew", "gridlock", "gridlocks",
  "grief", "grieve", "grim", "grin", "grind", "grip", "groan", "grocer", "groceries", "grocery", "groove", "gross",
  "ground", "grounds", "group", "grouped", "grouping", "groups", "grove", "grow", "growing", "grown", "grows", "growth",
  "growths", "grumble", "guarantee", "guaranteed", "guarantees", "guard", "guardian", "guards", "guess", "guessed", "guesses", "guessing",
  "guest", "guests", "guidance", "guide", "guided", "guideline", "guidelines", "guides", "guiding", "guilt", "guilty", "guitar",
  "gulf", "gum", "gun", "guns", "gust", "gym", "gymnasium", "habit", "habitat", "habitats", "habits", "hacking",
  "had", "hail", "hair", "haircut", "hairs", "half", "hall", "halls", "halt", "halves", "ham", "hammer",
  "hand", "handed", "handful", "handicap", "handicapped", "handing", "handkerchief", "handle", "handled", "handles", "handling", "hands",
  "handsome", "handwriting", "handy", "hang", "hanging", "hangs", "happen", "happened", "happening", "happens", "happily", "happiness",
  "happings", "happy", "harbor", "harbors", "hard", "harder", "hardest", "hardly", "hardship", "hardships", "hardware", "hare",
  "hares", "harm", "harmed", "harmful", "harming", "harmless", "harmonious", "harmony", "harms", "harness", "harsh", "harvest",
  "harvests", "has", "haste", "hasten", "hasty", "hat", "hate", "hated", "hates", "hating", "hatred", "hats",
  "haul", "have", "having", "hawk", "hawks", "hay", "hazard", "hazardous", "hazards", "he", "head", "headache",
  "headaches", "headed", "heading", "headings", "headline", "headlines", "headquarters", "heads", "heal", "healed", "healing", "health",
  "healthcare", "healthier", "healthiest", "healthy", "heap", "heaps", "hear", "heard", "hearing", "hears", "hearse", "heart",
  "hearts", "heat", "heated", "heater", "heaters", "heating", "heaven", "heavens", "heavier", "heaviest", "heavily", "heavy",
  "hedge", "hedges", "heel", "heels", "height", "heights", "heir", "heirs", "held", "helicopter", "helicopters", "hell",
  "hello", "helmet", "helmets", "help", "helped", "helper", "helpers", "helpful", "helping", "helpless", "helps", "hem",
  "hemispheres", "hen", "hence", "hens", "her", "herb", "herbs", "herd", "herds", "here", "hereafter", "hereby",
  "heritage", "hero", "heroes", "heroic", "heroine", "hers", "herself", "hesitate", "hesitated", "hesitating", "hesitation", "hey",
  "hid", "hidden", "hide", "hides", "hiding", "high", "higher", "highest", "highlight", "highlighting", "highly", "highway",
  "highways", "hill", "hills", "hilly", "him", "himself", "hind", "hinder", "hindrance", "hint", "hints", "hip",
  "hips", "hire", "hired", "hiring", "his", "historian", "historians", "historic", "historical", "historically", "histories", "history",
  "hit", "hitherto", "hits", "hitting", "hive", "hives", "hobbies", "hobby", "hoe", "hoes", "hold", "holder",
  "holders", "holding", "holds", "hole", "holes", "holiday", "holidays", "hollow", "holy", "home", "homeland", "homes",
  "homeschooling", "homesickness", "homework", "honest", "honesty", "honey", "honor", "honors", "honour", "honoured", "honours", "hood",
  "hook", "hooks", "hop", "hope", "hoped", "hopeful", "hopeless", "hopes", "hoping", "hopping", "horizon", "horizons",
  "horn", "horns", "horrible", "horror", "horrors", "horse", "horses", "hospital", "hospitals", "host", "hostess", "hostile",
  "hostility", "hosts", "hot", "hotel", "hotels", "hotter", "hottest", "hour", "hourly", "hours", "house", "housed",
  "household", "households", "houses", "housewife", "housewives", "housework", "housing", "how", "however", "howl", "hug", "huge",
  "hugs", "human", "humanity", "humans", "humble", "humid", "humidity", "humiliate", "humor", "humorous", "humour", "hundred",
  "hundreds", "hung", "hunger", "hungry", "hunt", "hunted", "hunter", "hunters", "hunting", "hunts", "hurdle", "hurdles",
  "hurl", "hurricane", "hurried", "hurry", "hurrying", "hurt", "hurting", "hurts", "husband", "husbands", "hut", "huts",
  "hydrogen", "hydropower", "hygiene", "hymn", "hypocrisy", "hypotheses", "hypothesis", "i", "ice", "icy", "id", "idea",
  "ideal", "ideals", "ideas", "identification", "identified", "identifies", "identify", "identifying", "identities", "identity", "idiom", "idiomatic",
  "idioms", "idle", "idol", "if", "ignorance", "ignorant", "ignore", "ignored", "ignores", "ignoring", "ill", "illegal",
  "illegally", "illiteracy", "illness", "illnesses", "illuminate", "illusion", "illusions", "illustrate", "illustrated", "illustrates", "illustration", "illustrations",
  "image", "images", "imagination", "imaginative", "imagine", "imagined", "imagining", "imitate", "imitation", "immediacy", "immediate", "immediately",
  "immense", "immensely", "immigrant", "immigrants", "immigration", "imminent", "immoral", "immortality", "immune", "immunity", "impact", "impacted",
  "impacts", "impair", "impartial", "impatience", "impatient", "imperative", "imperfect", "imperial", "implement", "implementation", "implemented", "implementing",
  "implication", "implications", "implied", "implies", "implore", "imply", "implying", "import", "importance", "important", "importantly", "imported",
  "imports", "impose", "imposed", "imposes", "imposing", "impossibility", "impossible", "impress", "impressed", "impression", "impressions", "impressive",
  "imprison", "imprisonment", "improbable", "improper", "improve", "improved", "improvement", "improvements", "improves", "improving", "impulse", "impulses",
  "in", "inadequacy", "inadequate", "inappropriate", "inaugurate", "incapable", "incense", "incentive", "incentives", "inception", "inch", "inches",
  "incident", "incidental", "incidentally", "incidents", "inclination", "incline", "inclined", "include", "included", "includes", "including", "inclusion",
  "income", "incomes", "incomparable", "incompatible", "incompetent", "incomplete", "inconceivable", "inconsistent", "inconvenience", "inconveniences", "inconvenient", "incorporate",
  "incorrect", "incorrectly", "increase", "increased", "increases", "increasing", "increasingly", "incredible", "incredibly", "incur", "indeed", "indefinite",
  "indefinitely", "independence", "independent", "independently", "index", "indexes", "india", "indian", "indicate", "indicated", "indicates", "indicating",
  "indication", "indications", "indicator", "indicators", "indices", "indifference", "indifferent", "indigenous", "indignant", "indignation", "indirect", "indirectly",
  "indiscretion", "indispensable", "individual", "individuals", "induce", "indulge", "indulgence", "industrial", "industrialization", "industries", "industry", "ineffective",
  "inefficient", "inefficiently", "inequalities", "inevitable", "inevitably", "inexpensive", "infancy", "infant", "infants", "infect", "infection", "infections",
  "infectious", "infer", "inferior", "inferiority", "infinite", "inflation", "influence", "influenced", "influencers", "influences", "influencing", "influential",
  "influenza", "inform", "informal", "informally", "informant", "information", "informed", "informing", "infrastructure", "infrequent", "infringe", "infringement",
  "ingenious", "ingenuity", "ingredient", "ingredients", "inhabit", "inhabitant", "inhabitants", "inherent", "inherently", "inherit", "inheritance", "inherited",
  "inhibit", "inhibition", "initial", "initially", "initiate", "initiative", "initiatives", "inject", "injection", "injure", "injured", "injuries",
  "injury", "injustice", "ink", "inland", "inmate", "inmates", "inn", "inner", "innocence", "innocent", "innovate", "innovation",
  "innovations", "innovative", "inns", "innumerable", "inoculate", "input", "inputs", "inquire", "inquiries", "inquiry", "insane", "insanity",
  "inscribe", "inscription", "insect", "insects", "insecurity", "insert", "inserted", "insertion", "inside", "insight", "insights", "insignificant",
  "insist", "insisted", "insistent", "insists", "insolent", "inspect", "inspection", "inspections", "inspector", "inspectors", "inspiration", "inspirations",
  "inspire", "inspired", "inspires", "inspiring", "instagram", "install", "installation", "installed", "installing", "instance", "instances", "instant",
  "instantly", "instead", "instinct", "instinctive", "instincts", "institute", "institutes", "institution", "institutions", "instruct", "instructed", "instruction",
  "instructions", "instructive", "instructor", "instructors", "instrument", "instruments", "insufficient", "insult", "insulted", "insults", "insurance", "insure",
  "insurgent", "insurmountable", "intact", "intake", "integrate", "integrated", "integration", "integrity", "intellect", "intellectual", "intelligence", "intelligent",
  "intend", "intended", "intending", "intends", "intense", "intent", "intention", "intentional", "intentionally", "intentions", "intents", "interact",
  "interacted", "interacting", "interaction", "interactions", "interactive", "interacts", "intercept", "interchange", "interconnected", "intercourse", "interest", "interested",
  "interesting", "interestingly", "interests", "interfere", "interference", "interior", "intermediate", "intermittent", "internal", "internally", "international", "internationally",
  "internet", "interpersonal", "interpret", "interpretation", "interpretations", "interpreter", "interrupt", "interrupted", "interruption", "interruptions", "intersections", "interval",
  "intervals", "intervene", "intervention", "interventions", "interview", "interviewed", "interviewing", "interviews", "intimacy", "intimate", "into", "intolerable",
  "intolerance", "intolerant", "intoxicate", "intricate", "intrigue", "intrinsic", "intrinsically", "intro", "introduce", "introduced", "introduces", "introducing",
  "introduction", "introductions", "intrude", "intrusion", "intuition", "invade", "invader", "invaders", "invalid", "invaluable", "invariable", "invariably",
  "invasion", "invent", "invented", "invention", "inventions", "inventor", "inventors", "inventory", "inverse", "invert", "invest", "invested",
  "investigate", "investigated", "investigating", "investigation", "investigations", "investigator", "investigators", "investing", "investment", "investments", "investor", "investors",
  "invisible", "invitation", "invitations", "invite", "invited", "invites", "inviting", "invoice", "invoices", "invoke", "invoked", "involuntary",
  "involve", "involved", "involvement", "involves", "involving", "inward", "inwards", "iron", "irony", "irresponsible", "irrigate", "irrigation",
  "irritate", "irritated", "irritating", "irritation", "is", "island", "islands", "isolate", "isolated", "isolates", "isolating", "isolation",
  "issue", "issued", "issues", "it", "italian", "item", "items", "its", "itself", "ivory", "jacket", "jackets",
  "jail", "jails", "jam", "jams", "january", "japan", "japanese", "jar", "jars", "jaw", "jaws", "jazz",
  "jealous", "jealousy", "jeans", "jelly", "jeopardize", "jeopardy", "jerk", "jet", "jets", "jewel", "jewelry", "jewels",
  "job", "jobrelated", "jobs", "join", "joined", "joining", "joins", "joint", "joints", "joke", "jokes", "journal",
  "journalism", "journalist", "journalists", "journals", "journey", "journeys", "joy", "joyful", "joys", "judge", "judged", "judgements",
  "judges", "judging", "judgment", "judicial", "jug", "juice", "july", "jump", "jumped", "jumping", "jumps", "junction",
  "june", "jungle", "jungles", "junior", "juries", "jury", "just", "justice", "justification", "justified", "justifies", "justify",
  "justifying", "juvenile", "kahoot", "keen", "keep", "keeper", "keepers", "keeping", "keeps", "kept", "kettle", "key",
  "keys", "kick", "kicked", "kicking", "kicks", "kid", "kidnap", "kidnapped", "kidney", "kidneys", "kids", "kill",
  "killed", "killer", "killers", "killing", "kills", "kilogram", "kilograms", "kilometer", "kilometers", "kin", "kind", "kinder",
  "kindest", "kindly", "kindness", "kinds", "king", "kingdom", "kingdoms", "kings", "kiss", "kissed", "kisses", "kissing",
  "kitchen", "kitchens", "kite", "kites", "kitten", "kittens", "knee", "kneel", "kneels", "knees", "knelt", "knew",
  "knife", "knight", "knights", "knit", "knits", "knitted", "knitting", "knives", "knob", "knobs", "knock", "knocked",
  "knocking", "knocks", "knot", "knots", "know", "knowing", "knowledge", "known", "knows", "lab", "label", "labeled",
  "labels", "labor", "laboratories", "laboratory", "labour", "labs", "lace", "lack", "lacked", "lacking", "lacks", "lad",
  "ladder", "ladders", "ladies", "lads", "lady", "lag", "laid", "lain", "lake", "lakes", "lamb", "lambs",
  "lame", "lament", "lamp", "lamps", "land", "landed", "landing", "landlord", "landlords", "landmark", "landmarks", "lands",
  "landscape", "landscapes", "landslides", "lane", "lanes", "language", "languages", "lantern", "lanterns", "lap", "laps", "lapse",
  "laptop", "laptops", "large", "largely", "larger", "largest", "lark", "laser", "lasers", "last", "lastly", "lasts",
  "late", "lately", "latent", "later", "latest", "latitude", "latter", "laugh", "laughed", "laughing", "laughs", "laughter",
  "launch", "launched", "launching", "laundry", "laurel", "lavish", "law", "lawful", "lawn", "lawns", "laws", "lawyer",
  "lawyers", "lay", "layer", "layers", "laying", "lays", "laziness", "lazy", "lead", "leader", "leaders", "leadership",
  "leading", "leads", "leaf", "leaflet", "leaflets", "league", "leagues", "leak", "leaked", "leaking", "leaks", "lean",
  "leaned", "leaning", "leans", "leant", "leap", "leaped", "leaping", "leaps", "leapt", "learn", "learned", "learner",
  "learners", "learning", "learns", "learnt", "lease", "least", "leather", "leave", "leaves", "leaving", "lecture", "lectured",
  "lecturer", "lecturers", "lectures", "lecturing", "led", "ledge", "lee", "leek", "leeks", "left", "leg", "legal",
  "legally", "legend", "legendary", "legends", "legislation", "legislative", "legs", "leisure", "lemon", "lemons", "lend", "lending",
  "lends", "length", "lengthen", "lengths", "lenient", "lens", "lenses", "lent", "leopard", "leopards", "less", "lessen",
  "lesson", "lessons", "lest", "let", "lets", "letter", "letters", "letting", "level", "levels", "lever", "levers",
  "levy", "liabilities", "liability", "liable", "liar", "liars", "liberal", "liberate", "liberties", "liberty", "librarian", "librarians",
  "libraries", "library", "licence", "licences", "license", "licensed", "licenses", "lick", "licked", "licking", "licks", "lid",
  "lids", "lie", "lied", "lies", "life", "lifelong", "lifestyle", "lifestyles", "lifetime", "lift", "lifted", "lifting",
  "lifts", "light", "lighted", "lighter", "lightest", "lighting", "lightly", "lightning", "lights", "like", "liked", "likelihood",
  "likely", "likes", "likewise", "liking", "limb", "limbs", "lime", "limes", "limit", "limitation", "limitations", "limited",
  "limiting", "limits", "limp", "line", "linear", "lined", "lines", "linger", "linguistic", "linguistics", "lining", "link",
  "linked", "linking", "links", "lion", "lions", "lip", "lips", "liquid", "liquids", "liquor", "list", "listed",
  "listen", "listened", "listener", "listeners", "listening", "listens", "listing", "lists", "lit", "literacy", "literal", "literally",
  "literary", "literate", "literature", "litter", "litters", "little", "live", "lived", "livelihood", "lively", "liver", "livers",
  "lives", "livestock", "living", "lizard", "lizards", "load", "loaded", "loading", "loads", "loaf", "loan", "loans",
  "loath", "loathe", "loaves", "lobbies", "lobby", "local", "locally", "locate", "located", "locates", "locating", "location",
  "locations", "lock", "locked", "locking", "locks", "locomotive", "locomotives", "locust", "locusts", "lodge", "lodges", "lodging",
  "loft", "log", "logic", "logical", "logically", "logs", "lone", "loneliness", "lonely", "long", "longer", "longest",
  "longitude", "look", "looked", "looking", "looks", "loom", "loop", "loops", "loose", "loosely", "loosen", "lord",
  "lords", "lorries", "lorry", "lose", "loser", "losers", "loses", "losing", "loss", "losses", "lost", "lot",
  "lotion", "lotions", "lots", "loud", "loudly", "lounge", "love", "loved", "lovely", "lover", "lovers", "loves",
  "loving", "low", "lower", "lowering", "lowers", "lowest", "loyal", "loyalties", "loyalty", "lubricate", "luck", "luckily",
  "lucky", "lucrative", "luggage", "lumber", "lump", "lumps", "lunar", "lunch", "lunches", "lung", "lungs", "lure",
  "lurk", "lust", "luxuries", "luxurious", "luxury", "lying", "lyrics", "machine", "machinery", "machines", "mad", "madam",
  "made", "madness", "magazine", "magazines", "magic", "magical", "magistrate", "magnet", "magnetic", "magnets", "magnificent", "magnify",
  "magnitude", "maid", "maids", "mail", "mailbox", "mailboxes", "main", "mainland", "mainly", "maintain", "maintained", "maintaining",
  "maintains", "maintenance", "majesty", "major", "majorities", "majority", "make", "maker", "makers", "makes", "making", "maladies",
  "malady", "malaria", "male", "males", "malfunction", "malfunctioning", "malfunctions", "malice", "malicious", "mammal", "mammals", "man",
  "manage", "managed", "management", "manager", "managers", "manages", "managing", "mandate", "mandates", "mandatory", "manifest", "manifestation",
  "manipulate", "manipulation", "mankind", "manner", "manners", "manor", "manors", "mansion", "mansions", "manual", "manually", "manufacture",
  "manufactured", "manufacturer", "manufacturers", "manufacturing", "manuscript", "manuscripts", "many", "map", "maple", "maps", "marble", "marbles",
  "march", "marching", "margin", "marginal", "margins", "marine", "mark", "marked", "market", "marketing", "marketplace", "markets",
  "marking", "marks", "marriage", "marriages", "married", "marries", "marry", "marrying", "mars", "marsh", "marshes", "martial",
  "marvel", "marvelous", "masculine", "mask", "masks", "mass", "masses", "massive", "mast", "master", "masterpiece", "masterpieces",
  "masters", "mastery", "masts", "mat", "match", "matched", "matches", "matching", "mate", "material", "materials", "maternal",
  "mates", "math", "mathematical", "mathematics", "maths", "matrimony", "mats", "matter", "mattered", "matters", "mature", "maturity",
  "maximizing", "maximum", "may", "maybe", "mayor", "mayors", "me", "meadow", "meadows", "meal", "meals", "mean",
  "meaning", "meaningful", "meaningless", "meanings", "means", "meant", "meantime", "meanwhile", "measure", "measured", "measurement", "measurements",
  "measures", "measuring", "meat", "meats", "mechanic", "mechanical", "mechanics", "mechanism", "mechanisms", "medal", "medals", "media",
  "mediate", "mediation", "medical", "medication", "medicinal", "medicine", "medicines", "medieval", "mediocre", "meditate", "meditation", "medium",
  "meet", "meeting", "meetings", "meets", "melancholy", "melodies", "melody", "melon", "melons", "melt", "melted", "melting",
  "melts", "member", "members", "membership", "memberships", "memoir", "memoirs", "memorable", "memories", "memorize", "memorized", "memory",
  "men", "mental", "mentally", "mention", "mentioned", "mentioning", "mentions", "menu", "menus", "merchandise", "merchant", "merchants",
  "merciful", "merciless", "mercy", "merely", "merge", "merged", "merger", "mergers", "merit", "merits", "merry", "mess",
  "message", "messages", "messaging", "messenger", "messengers", "messy", "met", "metal", "metallic", "metals", "metaphor", "metaphors",
  "method", "methodical", "methodologies", "methodology", "methods", "metric", "metro", "metropolis", "metropolitan", "mexican", "mice", "microscope",
  "microscopes", "mid", "midday", "middle", "midnight", "midst", "might", "mighty", "migrant", "migrants", "migrate", "migration",
  "migrations", "mild", "mildly", "mile", "miles", "milestones", "military", "milk", "milky", "mill", "million", "millionaire",
  "millionaires", "millions", "mills", "mind", "minded", "mindful", "minding", "minds", "mine", "miner", "mineral", "minerals",
  "miners", "mines", "mingle", "miniature", "minimize", "minimized", "minimizes", "minimizing", "minimum", "minister", "ministers", "ministries",
  "ministry", "minor", "minorities", "minority", "mint", "minute", "minutes", "miracle", "miracles", "miraculous", "mirror", "mirrors",
  "mirth", "mischief", "mischievous", "miserable", "miseries", "misery", "misfortune", "misfortunes", "mislead", "misleading", "misleads", "misled",
  "miss", "missed", "misses", "missile", "missiles", "missing", "mission", "missionaries", "missionary", "missions", "mist", "mistake",
  "mistaken", "mistakes", "mistress", "mistresses", "misty", "misunderstand", "misunderstanding", "misunderstandings", "misunderstands", "misunderstood", "mitigate", "mix",
  "mixed", "mixes", "mixing", "mixture", "mixtures", "moan", "moans", "mob", "mobile", "mobs", "mock", "mode",
  "model", "models", "moderate", "moderately", "moderation", "modern", "modernize", "modernized", "modes", "modest", "modesty", "modification",
  "modifications", "modified", "modifies", "modify", "modifying", "moist", "moisture", "mold", "mole", "molecule", "molecules", "moles",
  "moment", "momentary", "momentous", "moments", "monarch", "monarchies", "monarchs", "monarchy", "monasteries", "monastery", "monday", "money",
  "monies", "monitor", "monitored", "monitoring", "monitors", "monkey", "monkeys", "monopolies", "monopoly", "monotonous", "monotony", "monster",
  "monsters", "monstrous", "month", "monthly", "months", "monument", "monumental", "monuments", "mood", "moods", "moody", "moon",
  "moonlight", "moral", "morality", "morally", "morals", "more", "moreover", "morning", "mornings", "mortal", "mortality", "mortgage",
  "mortgages", "mosque", "mosques", "moss", "most", "mostly", "mother", "motherhood", "mothers", "motif", "motifs", "motion",
  "motions", "motivate", "motivated", "motivates", "motivating", "motivation", "motivations", "motive", "motives", "motor", "motorbikes", "motorcycle",
  "motorcycles", "motorist", "motorists", "motors", "motto", "mottoes", "mottos", "mould", "mount", "mountain", "mountainous", "mountains",
  "mourn", "mournful", "mouse", "mouth", "mouths", "move", "moved", "movement", "movements", "moves", "movie", "movies",
  "moving", "much", "mud", "muddy", "mug", "mule", "mules", "multiple", "multiplied", "multiplies", "multiply", "multiplying",
  "multitasking", "multitude", "multitudes", "municipal", "murder", "murderer", "murderers", "murders", "murmur", "murmurs", "muscle", "muscles",
  "muscular", "museum", "museums", "music", "musical", "musician", "musicians", "must", "mustard", "mute", "mutter", "mutual",
  "my", "myself", "mysteries", "mysterious", "mysteriously", "mystery", "myth", "mythology", "myths", "n", "nail", "nails",
  "naked", "name", "named", "namely", "names", "naming", "nap", "napkin", "napkins", "narrative", "narratives", "narrow",
  "narrowly", "nasty", "nation", "national", "nationalities", "nationality", "nationally", "nations", "native", "natives", "natural", "naturally",
  "nature", "natures", "naval", "navies", "navigation", "navy", "near", "nearby", "nearly", "neat", "neatly", "necessarily",
  "necessary", "necessities", "necessity", "neck", "necklace", "necklaces", "necks", "need", "needed", "needing", "needle", "needles",
  "needs", "negative", "negatively", "neglect", "neglected", "neglecting", "negotiate", "negotiated", "negotiating", "negotiation", "negotiations", "negro",
  "negroes", "neighbor", "neighborhood", "neighborhoods", "neighbors", "neighbour", "neighbourhood", "neighbourhoods", "neighbours", "neither", "nephew", "nephews",
  "nerve", "nerves", "nervous", "nervously", "nest", "nests", "net", "netflix", "nets", "network", "networking", "networks",
  "neutral", "never", "nevertheless", "new", "newer", "newest", "newly", "news", "newspaper", "newspapers", "next", "nice",
  "nicely", "niche", "niches", "nickel", "niece", "nieces", "night", "nightmare", "nightmares", "nights", "nin", "nine",
  "nineteen", "ninety", "ninth", "no", "nobility", "noble", "nobles", "nobody", "nod", "nodded", "nodding", "nods",
  "noise", "noises", "noisily", "noisy", "nominal", "nominate", "nomination", "non", "none", "nonetheless", "nonsense", "noodle",
  "noodles", "noon", "nor", "normal", "normally", "north", "northern", "nose", "noses", "not", "note", "notebook",
  "notebooks", "noted", "notes", "nothing", "notice", "noticeable", "noticeably", "noticed", "notices", "noticing", "notification", "notifications",
  "notified", "notifies", "notify", "notifying", "noting", "notion", "notions", "noun", "nouns", "nourish", "nourishment", "novel",
  "novelist", "novelists", "novels", "november", "now", "nowadays", "nowhere", "nthe", "nthere", "nto", "nuclear", "nuisance",
  "nuisances", "null", "numb", "number", "numbered", "numbers", "numeral", "numerals", "numerous", "nun", "nuns", "nurse",
  "nurseries", "nursery", "nurses", "nut", "nutrients", "nutrition", "nutritional", "nutritious", "nuts", "oak", "oaks", "oar",
  "oars", "oat", "oath", "oaths", "oats", "obedience", "obedient", "obese", "obesity", "obey", "obeyed", "obeying",
  "obeys", "object", "objection", "objections", "objective", "objectives", "objects", "obligate", "obligation", "obligations", "oblige", "obliged",
  "obscure", "observable", "observance", "observation", "observations", "observe", "observed", "observer", "observers", "observes", "observing", "obstacle",
  "obstacles", "obstinate", "obtain", "obtained", "obtaining", "obvious", "obviously", "occasion", "occasional", "occasionally", "occasions", "occupation",
  "occupations", "occupied", "occupies", "occupy", "occupying", "occur", "occurred", "occurrence", "occurrences", "occurring", "occurs", "ocean",
  "oceans", "october", "odd", "odds", "odor", "odors", "odour", "odours", "of", "off", "offend", "offended",
  "offending", "offense", "offenses", "offensive", "offer", "offered", "offering", "offers", "office", "officer", "officers", "offices",
  "official", "officially", "offline", "offset", "offspring", "often", "oh", "oil", "oils", "oily", "ointment", "old",
  "older", "oldest", "olive", "olives", "omen", "omens", "omission", "omissions", "omit", "omits", "omitted", "omitting",
  "on", "once", "one", "ones", "ongoing", "onion", "onions", "online", "only", "onset", "onto", "open",
  "opened", "opening", "openly", "opens", "opera", "operate", "operated", "operates", "operating", "operation", "operational", "operations",
  "operator", "operators", "opinion", "opinions", "opponent", "opponents", "opportunities", "opportunity", "oppose", "opposed", "opposing", "opposite",
  "opposition", "oppress", "oppression", "optimism", "optimistic", "optimizes", "option", "optional", "options", "or", "oral", "orange",
  "oranges", "orbit", "orbits", "orchard", "orchards", "order", "ordered", "ordering", "orderly", "orders", "ordinarily", "ordinary",
  "organ", "organic", "organism", "organisms", "organization", "organizations", "organize", "organized", "organizes", "organizing", "organs", "orient",
  "oriental", "orientation", "origin", "original", "originally", "originate", "origins", "ornament", "ornaments", "orphan", "orphans", "other",
  "others", "otherwise", "ought", "ounce", "ounces", "our", "ours", "ourselves", "out", "outage", "outages", "outbreak",
  "outbreaks", "outcome", "outcomes", "outdated", "outdoor", "outdoors", "outer", "outlaw", "outlaws", "outlet", "outlets", "outline",
  "outlined", "outlines", "outlining", "outlook", "outlooks", "output", "outputs", "outrage", "outrageous", "outset", "outside", "outskirts",
  "outstanding", "outweigh", "oval", "oven", "ovens", "over", "overall", "overcame", "overcoat", "overcoats", "overcome", "overcomes",
  "overcoming", "overcrowding", "overland", "overlap", "overlaps", "overloaded", "overlook", "overlooked", "overlooking", "overnight", "overpopulation", "oversaw",
  "overseas", "oversee", "overseen", "oversees", "oversight", "overtake", "overtaken", "overtakes", "overthrow", "overtime", "overtook", "overuse",
  "overusing", "overweight", "overwhelm", "overwhelming", "owe", "owed", "owes", "owing", "owl", "owls", "own", "owned",
  "owner", "owners", "ownership", "owning", "owns", "ox", "oxen", "oxygen", "oyster", "oysters", "pace", "paces",
  "pacific", "pack", "package", "packages", "packed", "packet", "packets", "packing", "packs", "pad", "paddle", "paddles",
  "pads", "page", "pages", "pagodas", "paid", "pain", "painful", "painfully", "pains", "paint", "painted", "painter",
  "painters", "painting", "paintings", "paints", "pair", "pairs", "palace", "palaces", "pale", "palm", "palms", "pan",
  "pane", "panel", "panels", "panes", "panic", "panicked", "panics", "pans", "pant", "pantry", "pants", "paper",
  "papers", "par", "parade", "parades", "paragraph", "paragraphs", "parallel", "paralysis", "paralyze", "paraphrases", "parcel", "parcels",
  "pardon", "parent", "parental", "parentheses", "parenthesis", "parents", "parish", "parishes", "park", "parking", "parks", "parliament",
  "parlor", "parlors", "part", "partial", "partially", "participant", "participants", "participate", "participated", "participates", "participating", "participation",
  "particle", "particles", "particular", "particularly", "parties", "partisan", "partition", "partly", "partner", "partners", "partnership", "partnerships",
  "parts", "parttime", "party", "pass", "passage", "passages", "passed", "passenger", "passengers", "passes", "passing", "passion",
  "passionate", "passions", "passive", "passport", "passports", "past", "paste", "pastime", "pasture", "pastures", "pat", "patch",
  "patches", "patent", "patents", "path", "paths", "pathway", "patience", "patient", "patiently", "patients", "patriot", "patriotic",
  "patriots", "patron", "patrons", "pats", "patted", "pattern", "patterned", "patterns", "pause", "paused", "pauses", "pausing",
  "pave", "pavement", "pavements", "paw", "paws", "pay", "paying", "payment", "payments", "pays", "peace", "peaceful",
  "peacefully", "peach", "peaches", "peacock", "peacocks", "peak", "peaks", "pear", "pearl", "pearls", "pears", "peasant",
  "peasants", "pebble", "pebbles", "peculiar", "peculiarities", "peculiarity", "pedestrian", "pedestrians", "peel", "peels", "peep", "peer",
  "peered", "peering", "peers", "pen", "penalties", "penalty", "pencil", "pencils", "penetrate", "penetration", "penguin", "penguins",
  "peninsula", "peninsulas", "pennies", "penny", "pens", "pension", "pensions", "people", "peoples", "pepper", "peppers", "per",
  "perceive", "perceived", "percent", "percentage", "percentages", "perception", "perceptions", "perch", "perfect", "perfection", "perfectly", "perform",
  "performance", "performances", "performed", "performer", "performers", "performing", "performs", "perfume", "perfumes", "perhaps", "peril", "perilous",
  "perils", "period", "periodic", "periodical", "periodically", "periods", "perish", "permanent", "permanently", "permission", "permit", "permits",
  "permitted", "permitting", "perpendicular", "perpetual", "perplex", "persecute", "persecution", "perseverance", "persevere", "persist", "persisted", "persistence",
  "persistent", "persists", "person", "personal", "personalities", "personality", "personally", "personnel", "persons", "perspective", "perspectives", "persuade",
  "persuaded", "persuading", "persuasion", "pertain", "pertinent", "pessimism", "pessimistic", "pest", "pests", "pet", "petition", "petitions",
  "petroleum", "pets", "petty", "phase", "phases", "phenomena", "phenomenon", "philosopher", "philosophers", "philosophical", "philosophies", "philosophy",
  "phone", "phoned", "phones", "phonetic", "phoning", "photo", "photograph", "photographer", "photographers", "photographs", "photography", "photos",
  "phrase", "phrases", "physical", "physically", "physician", "physicians", "physicist", "physicists", "physics", "physiology", "piano", "pianos",
  "pick", "picked", "picking", "picks", "picnic", "picnics", "picture", "pictured", "pictures", "pie", "piece", "pieces",
  "pier", "pierce", "piers", "pies", "pig", "pigeon", "pigeons", "pigs", "pile", "piled", "piles", "pilgrim",
  "pilgrimage", "pilgrimages", "pilgrims", "piling", "pill", "pillar", "pillars", "pillow", "pillows", "pills", "pilot", "pilots",
  "pin", "pinch", "pine", "pineapple", "pineapples", "pines", "pink", "pins", "pint", "pints", "pioneer", "pioneers",
  "pipe", "pipeline", "pipes", "pirate", "pirates", "pistol", "pistols", "pit", "pitch", "pits", "pity", "place",
  "placed", "placement", "places", "placing", "plague", "plagues", "plaguing", "plain", "plainly", "plains", "plan", "plane",
  "planes", "planet", "planetary", "planets", "planned", "planner", "planners", "planning", "plans", "plant", "plantation", "plantations",
  "planted", "planting", "plants", "plaster", "plastic", "plastics", "plate", "plateau", "plateaus", "plates", "platform", "platforms",
  "platinum", "play", "played", "player", "players", "playground", "playgrounds", "playing", "plays", "playwright", "playwrights", "plea",
  "plead", "pleas", "pleasant", "pleasantly", "please", "pleased", "pleasing", "pleasure", "pleasures", "pledge", "plentiful", "plenty",
  "plight", "plot", "plots", "plough", "plow", "pluck", "plug", "plugs", "plum", "plumber", "plumbers", "plumbing",
  "plump", "plums", "plunge", "plural", "plurals", "plus", "pocket", "pockets", "poem", "poems", "poet", "poetry",
  "poets", "point", "pointed", "pointing", "points", "poison", "poisonous", "poisons", "pole", "poles", "police", "policeman",
  "policemen", "policies", "policy", "policymakers", "polish", "polished", "polite", "politely", "politeness", "political", "politically", "politician",
  "politicians", "politics", "poll", "pollen", "polls", "pollute", "polluted", "pollutes", "polluting", "pollution", "pond", "ponder",
  "ponds", "ponies", "pony", "pool", "pools", "poor", "poorer", "poorest", "poorly", "pop", "pope", "popular",
  "popularity", "popularly", "populate", "populated", "population", "populations", "porch", "porches", "pork", "port", "portable", "porter",
  "porters", "portfolio", "portfolios", "portion", "portions", "portrait", "portraits", "portray", "portrayal", "portrayed", "ports", "pose",
  "posed", "poses", "posing", "position", "positioned", "positions", "positive", "positively", "possess", "possessed", "possesses", "possession",
  "possessions", "possessor", "possibilities", "possibility", "possible", "possibly", "post", "postage", "postal", "posted", "poster", "posters",
  "posting", "postman", "postmen", "postpone", "postponed", "postponement", "posts", "posture", "postures", "pot", "potato", "potatoes",
  "potent", "potential", "potentially", "pots", "potter", "pottery", "pouch", "pouches", "poultry", "pound", "pounds", "pour",
  "poured", "pouring", "pours", "poverty", "powder", "powders", "power", "powered", "powerful", "powerfully", "powers", "practical",
  "practically", "practice", "practiced", "practices", "practicing", "practise", "practised", "practises", "practising", "practitioner", "practitioners", "praise",
  "praised", "praises", "praiseworthy", "pray", "prayed", "prayer", "prayers", "prays", "preach", "preacher", "precaution", "precautions",
  "precede", "preceded", "precedence", "preceding", "precious", "precise", "precisely", "precision", "predecessor", "predecessors", "predict", "predictable",
  "predicted", "prediction", "predictions", "predicts", "predominant", "predominantly", "preface", "prefaces", "prefer", "preferable", "preferably", "preference",
  "preferences", "preferred", "preferring", "prefers", "pregnancies", "pregnancy", "pregnant", "prejudice", "prejudices", "preliminary", "prelude", "premature",
  "premier", "premise", "premises", "premium", "premiums", "preoccupied", "prepaid", "preparation", "preparations", "preparatory", "prepare", "prepared",
  "prepares", "preparing", "preposition", "prepositions", "preposterous", "prescribe", "prescription", "prescriptions", "presence", "present", "presentation", "presentations",
  "presented", "presenting", "presently", "presents", "preservation", "preservative", "preservatives", "preserve", "preserved", "preserves", "preserving", "preside",
  "president", "presidential", "presidents", "press", "pressed", "presses", "pressing", "pressure", "pressures", "prestige", "prestigious", "presume",
  "presumed", "presumption", "pretend", "pretended", "pretending", "pretense", "pretenses", "prettier", "prettiest", "pretty", "prevail", "prevalent",
  "prevalently", "prevent", "prevented", "preventing", "prevention", "preventive", "prevents", "previous", "previously", "prey", "price", "priced",
  "priceless", "prices", "pricing", "prick", "pride", "priest", "priests", "primarily", "primary", "prime", "primitive", "prince",
  "princes", "princess", "princesses", "principal", "principally", "principle", "principles", "print", "printed", "printer", "printers", "printing",
  "prints", "prior", "priorities", "prioritized", "prioritizing", "priority", "prison", "prisoner", "prisoners", "prisons", "privacy", "private",
  "privately", "privilege", "privileges", "prize", "prized", "prizes", "probabilities", "probability", "probable", "probably", "probation", "probe",
  "probes", "problem", "problematic", "problems", "procedure", "procedures", "proceed", "proceeded", "proceeding", "proceedings", "proceeds", "process",
  "processed", "processes", "processing", "procession", "processions", "proclaim", "proclamation", "procure", "produce", "produced", "producer", "producers",
  "produces", "producing", "product", "production", "productions", "productive", "productivity", "products", "profession", "professional", "professionally", "professionals",
  "professions", "professor", "professors", "proficiency", "proficient", "profile", "profiles", "profit", "profitable", "profits", "profound", "profoundly",
  "program", "programme", "programmed", "programmes", "programming", "programs", "progress", "progressed", "progresses", "progressing", "progression", "progressive",
  "prohibit", "prohibited", "prohibition", "prohibitions", "prohibits", "project", "projected", "projector", "projectors", "projects", "prolong", "prolonged",
  "prominent", "prominently", "promise", "promised", "promises", "promising", "promote", "promoted", "promotes", "promoting", "promotion", "promotions",
  "prompt", "prompted", "promptly", "prompts", "pronoun", "pronounce", "pronounced", "pronounces", "pronouncing", "pronouns", "pronunciation", "pronunciations",
  "proof", "proofs", "prop", "propaganda", "propel", "propeller", "proper", "properly", "properties", "property", "prophecies", "prophecy",
  "prophet", "prophets", "proponents", "proportion", "proportional", "proportions", "proposal", "proposals", "propose", "proposed", "proposes", "proposing",
  "proposition", "propositions", "prose", "prosecute", "prosecution", "prospect", "prospective", "prospects", "prosperity", "prosperous", "protect", "protected",
  "protecting", "protection", "protections", "protective", "protects", "protein", "proteins", "protest", "protested", "protestor", "protestors", "protests",
  "protocol", "protocols", "prototype", "prototypes", "proud", "proudly", "prove", "proved", "proven", "proverb", "proverbs", "proves",
  "provide", "provided", "provider", "providers", "provides", "providing", "province", "provinces", "provincial", "proving", "provision", "provisions",
  "provoke", "provoked", "provoking", "prowess", "proximity", "prudence", "prudent", "psychological", "psychologist", "psychologists", "psychology", "pub",
  "public", "publication", "publications", "publicity", "publicly", "publish", "published", "publisher", "publishers", "publishes", "publishing", "pubs",
  "pudding", "puddings", "pull", "pulled", "pulling", "pulls", "pulse", "pulses", "pump", "pumped", "pumps", "punch",
  "punches", "punctual", "punish", "punished", "punishes", "punishing", "punishment", "punishments", "pupil", "pupils", "puppet", "puppets",
  "purchase", "purchased", "purchases", "purchasing", "pure", "purely", "purify", "purity", "purple", "purpose", "purposely", "purposes",
  "purse", "purses", "pursue", "pursued", "pursues", "pursuing", "pursuit", "pursuits", "push", "pushed", "pushes", "pushing",
  "put", "puts", "putting", "puzzle", "puzzled", "puzzles", "puzzling", "pyramid", "pyramids", "qr", "qualification", "qualifications",
  "qualified", "qualifies", "qualify", "qualifying", "qualities", "quality", "quantities", "quantity", "quarrel", "quarrelled", "quarrels", "quarries",
  "quarry", "quarter", "quarters", "queen", "queens", "queer", "quell", "quench", "queries", "query", "quest", "question",
  "questioned", "questioning", "questionnaire", "questionnaires", "questions", "quests", "queue", "queues", "quick", "quicker", "quickest", "quickly",
  "quiet", "quieter", "quietest", "quietly", "quill", "quills", "quilt", "quilts", "quit", "quite", "quits", "quitting",
  "quiver", "quivers", "quiz", "quizlet", "quizzes", "quota", "quotas", "quotation", "quotations", "quote", "quoted", "quotes",
  "quoting", "rabbit", "rabbits", "race", "races", "racial", "racing", "rack", "racks", "radar", "radiant", "radiate",
  "radiation", "radical", "radically", "radio", "radios", "radish", "radishes", "raft", "rafts", "rag", "rage", "rages",
  "rags", "raid", "raids", "rail", "railroad", "railroads", "rails", "railway", "railways", "rain", "rainbow", "rainbows",
  "raincoat", "raincoats", "rained", "raining", "rains", "rainy", "raise", "raised", "raises", "raising", "rake", "rakes",
  "rallies", "rally", "ram", "rambler", "ran", "ranch", "ranches", "random", "rang", "range", "ranged", "ranges",
  "ranging", "rank", "ranked", "ranking", "ranks", "rapid", "rapidity", "rapidly", "rapids", "rare", "rarely", "rascal",
  "rascals", "rash", "rate", "rated", "rates", "rather", "ratify", "rating", "ratio", "ration", "rational", "ratios",
  "rattle", "ravage", "raw", "ray", "rays", "razor", "razors", "reach", "reached", "reaches", "reaching", "react",
  "reacted", "reacting", "reaction", "reactions", "reacts", "read", "reader", "readers", "readily", "readiness", "reading", "readings",
  "reads", "ready", "real", "realities", "reality", "realization", "realizations", "realize", "realized", "realizes", "realizing", "really",
  "realm", "realms", "reap", "rear", "rears", "reason", "reasonable", "reasonably", "reasoned", "reasoning", "reasons", "rebel",
  "rebellion", "rebellions", "rebellious", "rebels", "recall", "recalled", "recalling", "receipt", "receipts", "receive", "received", "receiver",
  "receivers", "receives", "receiving", "recent", "recently", "reception", "receptive", "recess", "recesses", "recipe", "recipes", "recipient",
  "recipients", "reciprocal", "recital", "recite", "reckless", "reckon", "reclaim", "recognition", "recognize", "recognized", "recognizes", "recognizing",
  "recommend", "recommendation", "recommendations", "recommended", "recommending", "recommends", "reconcile", "reconciliation", "record", "recorded", "recorder", "recorders",
  "recording", "records", "recount", "recover", "recovered", "recoveries", "recovering", "recovery", "recreation", "recreational", "recreations", "recruit",
  "recruitment", "recruits", "rectangle", "rectangles", "rectangular", "recur", "recycle", "recycled", "recycling", "red", "redden", "reddish",
  "redistributes", "reduce", "reduced", "reduces", "reducing", "reduction", "reductions", "redundancy", "redundant", "reed", "reeds", "reef",
  "reefs", "refer", "reference", "references", "referred", "referring", "refers", "refine", "refined", "refinement", "reflect", "reflected",
  "reflecting", "reflection", "reflections", "reflective", "reflects", "reform", "reformed", "reformer", "reformers", "reforms", "refractive", "refrain",
  "refresh", "refreshed", "refreshing", "refreshment", "refreshments", "refrigerator", "refrigerators", "refuge", "refugee", "refugees", "refusal", "refusals",
  "refuse", "refused", "refuses", "refusing", "regain", "regal", "regard", "regarded", "regarding", "regardless", "regards", "regent",
  "regime", "regiment", "regimes", "region", "regional", "regions", "register", "registered", "registration", "regret", "regretful", "regrets",
  "regretted", "regretting", "regular", "regularity", "regularly", "regulate", "regulated", "regulating", "regulation", "regulations", "regulatory", "rehabilitate",
  "rehabilitation", "rehearsal", "rehearsals", "rehearse", "reign", "reigned", "reigning", "reigns", "reinforce", "reinforced", "reinforcement", "reinforcements",
  "reject", "rejected", "rejecting", "rejection", "rejections", "rejoice", "relate", "related", "relates", "relating", "relation", "relations",
  "relationship", "relationships", "relative", "relatively", "relatives", "relax", "relaxation", "relaxed", "relay", "relays", "release", "released",
  "releases", "releasing", "relentless", "relevance", "relevant", "reliability", "reliable", "reliance", "reliant", "relied", "relief", "relies",
  "relieve", "relieved", "religion", "religions", "religious", "religiously", "relinquish", "relish", "relocate", "relocating", "reluctance", "reluctant",
  "rely", "relying", "remain", "remainder", "remained", "remaining", "remains", "remark", "remarkable", "remarkably", "remarked", "remarks",
  "remedies", "remedy", "remember", "remembered", "remembering", "remembers", "remembrance", "remind", "reminded", "reminder", "reminders", "reminding",
  "reminds", "remiss", "remit", "remittance", "remnant", "remnants", "remote", "remotely", "remoteness", "removal", "removals", "remove",
  "removed", "removes", "removing", "render", "rendered", "renders", "renew", "renewal", "renounce", "renown", "renowned", "rent",
  "rental", "renting", "rents", "repaid", "repair", "repaired", "repairing", "repairs", "repay", "repayment", "repeal", "repeat",
  "repeated", "repeatedly", "repeating", "repeats", "repel", "repent", "repentance", "repetition", "repetitions", "replace", "replaced", "replacement",
  "replacements", "replaces", "replacing", "replay", "replied", "replies", "reply", "replying", "report", "reported", "reporter", "reporters",
  "reporting", "reports", "repose", "represent", "representation", "representations", "representative", "representatives", "represented", "representing", "represents", "repress",
  "repression", "reproach", "reproduce", "reproduction", "reptile", "reptiles", "republic", "republics", "reputation", "reputations", "repute", "reputed",
  "request", "requested", "requesting", "requests", "require", "required", "requirement", "requirements", "requires", "requiring", "requisite", "rescue",
  "rescued", "rescuer", "rescuers", "rescuing", "research", "researched", "researcher", "researchers", "researches", "researching", "resemblance", "resemble",
  "resembled", "resembles", "resent", "resented", "resentment", "reservation", "reservations", "reserve", "reserved", "reserves", "reservoir", "reservoirs",
  "reside", "resided", "residence", "residences", "resident", "residential", "residents", "resides", "residual", "residue", "resign", "resignation",
  "resignations", "resigned", "resist", "resistance", "resistant", "resisted", "resists", "resolute", "resolution", "resolutions", "resolve", "resolved",
  "resolves", "resolving", "resonance", "resort", "resorts", "resource", "resourceful", "resources", "respect", "respectable", "respected", "respectful",
  "respective", "respectively", "respects", "respiration", "respiratory", "respire", "respond", "responded", "responding", "responds", "response", "responses",
  "responsibilities", "responsibility", "responsible", "responsibly", "responsive", "rest", "restaurant", "restaurants", "rested", "resting", "restless", "restoration",
  "restore", "restored", "restores", "restoring", "restrain", "restrained", "restraint", "restraints", "restrict", "restricted", "restricting", "restriction",
  "restrictions", "restrictive", "rests", "result", "resulted", "resulting", "results", "resume", "resumed", "resuming", "resumption", "retail",
  "retailer", "retailers", "retain", "retained", "retaining", "retains", "retaliate", "retaliation", "retard", "retention", "reticent", "retire",
  "retired", "retirement", "retiring", "retort", "retorts", "retreat", "retreats", "retrospect", "return", "returned", "returning", "returns",
  "reunions", "reveal", "revealed", "revealing", "reveals", "revelation", "revelations", "revenge", "revenue", "revenues", "reverence", "reverse",
  "reversed", "reverses", "reversing", "revert", "review", "reviewed", "reviewer", "reviewers", "reviewing", "reviews", "revise", "revised",
  "revising", "revision", "revisions", "revival", "revive", "revived", "revoke", "revolt", "revolts", "revolution", "revolutionary", "revolutionized",
  "revolutions", "revolve", "revolved", "revolves", "revolving", "reward", "rewarded", "rewards", "rhetoric", "rhythm", "rhythms", "rib",
  "ribbon", "ribbons", "ribs", "rice", "rich", "richer", "richest", "richly", "rid", "ridden", "ridding", "riddle",
  "riddles", "ride", "rider", "riders", "rides", "ridge", "ridges", "ridicule", "ridiculous", "riding", "rids", "rifle",
  "rifles", "rift", "rifts", "right", "righteous", "rightly", "rights", "rigid", "rigor", "rigorous", "rim", "rims",
  "ring", "ringing", "rings", "riot", "riots", "ripe", "ripen", "rise", "risen", "rises", "rising", "risk",
  "risked", "risking", "risks", "risky", "rite", "rites", "ritual", "rituals", "rival", "rivalries", "rivalry", "rivals",
  "river", "rivers", "road", "roads", "roadside", "roam", "roamed", "roaming", "roams", "roar", "roared", "roaring",
  "roars", "roast", "roasts", "rob", "robbed", "robber", "robberies", "robbers", "robbery", "robbing", "robe", "robes",
  "robot", "robots", "robs", "robust", "rock", "rocket", "rockets", "rocks", "rocky", "rod", "rode", "rods",
  "rogue", "rogues", "role", "roles", "roll", "rolled", "roller", "rolling", "rolls", "roman", "romance", "romantic",
  "roof", "roofs", "room", "rooms", "roomy", "roost", "root", "rooted", "roots", "rope", "ropes", "rose",
  "roses", "rot", "rotate", "rotation", "rotations", "rots", "rotted", "rotten", "rotting", "rough", "roughly", "round",
  "rounded", "rounds", "rouse", "route", "routes", "routine", "routines", "row", "rowed", "rowing", "rows", "royal",
  "royalty", "rub", "rubbed", "rubber", "rubbers", "rubbing", "rubbish", "rubies", "rubs", "ruby", "rude", "rudely",
  "rudeness", "rug", "rugged", "rugs", "ruin", "ruined", "ruining", "ruinous", "ruins", "rule", "ruled", "ruler",
  "rulers", "rules", "ruling", "rumor", "rumors", "rumour", "rumours", "run", "rung", "runner", "runners", "running",
  "runs", "runway", "runways", "rural", "rush", "rushed", "rushes", "rushing", "rust", "rusty", "s", "sack",
  "sacks", "sacred", "sacrifice", "sacrifices", "sad", "sadden", "saddle", "saddles", "sadly", "sadness", "safe", "safeguard",
  "safely", "safety", "sag", "sage", "sages", "said", "sail", "sailed", "sailing", "sailor", "sailors", "sails",
  "saint", "saints", "sake", "salad", "salads", "salaries", "salary", "sale", "sales", "salient", "saliva", "salmon",
  "salmons", "saloon", "saloons", "salt", "salty", "salute", "salutes", "salvage", "salvation", "same", "sameness", "sample",
  "sampled", "samples", "sampling", "sanction", "sanctions", "sanctuaries", "sanctuary", "sand", "sandwich", "sandwiches", "sandy", "sane",
  "sang", "sanitary", "sanity", "sank", "sap", "sardine", "sardines", "sash", "sat", "satellite", "satellites", "satisfaction",
  "satisfactory", "satisfied", "satisfies", "satisfy", "satisfying", "saturday", "sauce", "saucer", "saucers", "sauces", "sausage", "sausages",
  "savage", "save", "saved", "saves", "saving", "savings", "savior", "saviour", "saw", "say", "saying", "says",
  "scaffold", "scaffolds", "scale", "scales", "scaly", "scan", "scandal", "scandals", "scanned", "scanning", "scar", "scarce",
  "scarcely", "scarcity", "scare", "scared", "scarf", "scarfs", "scars", "scarves", "scary", "scatter", "scattered", "scenarios",
  "scene", "scenery", "scenes", "scenic", "scent", "scents", "schedule", "scheduled", "schedules", "scheduling", "scheme", "schemes",
  "scholar", "scholars", "scholarship", "scholarships", "school", "schoolers", "schooling", "schools", "science", "sciences", "scientific", "scientifically",
  "scientist", "scientists", "scissors", "scold", "scolded", "scolding", "scolds", "scope", "scopes", "scorch", "score", "scored",
  "scores", "scoring", "scorn", "scornful", "scotch", "scoundrel", "scoundrels", "scour", "scout", "scouts", "scowl", "scram",
  "scramble", "scrap", "scrape", "scrapes", "scraps", "scratch", "scratched", "scratches", "scream", "screamed", "screaming", "screams",
  "screen", "screens", "screw", "screws", "scribble", "script", "scripts", "scrub", "sculptor", "sculptors", "sculpture", "sculptures",
  "scum", "sea", "seafood", "seal", "sealed", "seals", "seam", "seaman", "seamen", "seams", "seaport", "seaports",
  "search", "searched", "searches", "searching", "seas", "season", "seasonal", "seasons", "seat", "seated", "seating", "seats",
  "second", "secondary", "secondly", "seconds", "secrecy", "secret", "secretaries", "secretary", "secretly", "secrets", "sect", "section",
  "sections", "sector", "sectors", "sects", "secure", "secured", "securely", "securities", "security", "sedentary", "see", "seed",
  "seeds", "seeing", "seek", "seeker", "seekers", "seeking", "seeks", "seem", "seemed", "seeming", "seemingly", "seems",
  "seen", "seep", "sees", "segment", "segments", "seize", "seized", "seizes", "seizure", "seizures", "seldom", "select",
  "selected", "selecting", "selection", "selections", "selective", "self", "selfesteem", "selfish", "selfishness", "sell", "seller", "sellers",
  "selling", "sells", "semester", "semesters", "semi", "seminar", "seminars", "senate", "senator", "senators", "send", "sender",
  "senders", "sending", "sends", "senior", "sensation", "sensational", "sensations", "sense", "sensed", "senseless", "senses", "sensible",
  "sensibly", "sensing", "sensitive", "sensitivity", "sensor", "sensors", "sensory", "sensual", "sent", "sentence", "sentenced", "sentences",
  "sentiment", "sentimental", "sentiments", "sentinel", "sentinels", "sentries", "sentry", "separable", "separate", "separated", "separately", "separating",
  "separation", "separations", "september", "sequence", "sequences", "sequential", "serene", "serenity", "sergeant", "sergeants", "series", "serious",
  "seriously", "seriousness", "sermon", "sermons", "serpent", "serpents", "servant", "servants", "serve", "served", "serves", "service",
  "services", "serving", "servitude", "session", "sessions", "set", "sets", "setting", "settings", "settle", "settled", "settlement",
  "settlements", "settler", "settlers", "settles", "seven", "seventeen", "seventh", "seventy", "sever", "several", "severe", "severely",
  "severity", "sew", "sewage", "sewed", "sewer", "sewers", "sewing", "sewn", "sews", "sex", "sexes", "sexual",
  "shabby", "shack", "shacks", "shade", "shades", "shadow", "shadows", "shadowy", "shady", "shaft", "shafts", "shake",
  "shaken", "shakes", "shaking", "shaky", "shall", "shallow", "sham", "shame", "shameful", "shameless", "shampoo", "shape",
  "shaped", "shapeless", "shapes", "shaping", "share", "shared", "shareholder", "shareholders", "shares", "sharing", "shark", "sharks",
  "sharp", "sharpen", "sharper", "sharpest", "sharply", "shatter", "shattered", "shave", "shaved", "shaven", "shaves", "shaving",
  "shawl", "shawls", "she", "sheaf", "shear", "shears", "sheaves", "shed", "sheds", "sheep", "sheer", "sheet",
  "sheets", "shelf", "shell", "shells", "shelter", "sheltered", "shelters", "shelves", "shepherd", "shepherds", "sheriff", "sheriffs",
  "shield", "shields", "shift", "shifted", "shifting", "shifts", "shill", "shine", "shines", "shining", "shiny", "ship",
  "shipment", "shipments", "shipped", "shipping", "ships", "shirt", "shirts", "shiver", "shivers", "shock", "shocked", "shocking",
  "shocks", "shoe", "shoes", "shone", "shook", "shoot", "shooting", "shoots", "shop", "shopped", "shopper", "shoppers",
  "shopping", "shops", "shore", "shores", "short", "shortage", "shortages", "shortcoming", "shortcomings", "shorten", "shorter", "shortest",
  "shorthand", "shortly", "shot", "should", "shoulder", "shoulders", "shout", "shouted", "shouting", "shouts", "shove", "shovel",
  "shovels", "show", "showed", "shower", "showers", "showing", "shown", "shows", "showy", "shrank", "shrewd", "shriek",
  "shrieked", "shrieking", "shrieks", "shrill", "shrimp", "shrimps", "shrine", "shrines", "shrink", "shrinking", "shrinks", "shrub",
  "shrubs", "shrug", "shrugged", "shrugging", "shrugs", "shrunk", "shudder", "shudders", "shuffled", "shun", "shunned", "shunning",
  "shuns", "shut", "shuts", "shutter", "shutters", "shutting", "shuttle", "shuttles", "shy", "shyness", "sick", "sickly",
  "sickness", "sicknesses", "side", "sides", "sidewalk", "sidewalks", "sideways", "siege", "sieges", "sieve", "sieves", "sigh",
  "sighed", "sighing", "sighs", "sight", "sights", "sightseeing", "sign", "signal", "signals", "signature", "signatures", "signed",
  "significance", "significant", "significantly", "signified", "signifies", "signify", "signifying", "signing", "signs", "silence", "silences", "silent",
  "silently", "silk", "silks", "silky", "sill", "sills", "silly", "silver", "similar", "similarities", "similarity", "similarly",
  "simple", "simpler", "simplest", "simplicity", "simplified", "simplifies", "simplify", "simplifying", "simply", "simulation", "simultaneous", "simultaneously",
  "sin", "since", "sincere", "sincerely", "sincerity", "sinew", "sing", "singer", "singers", "singing", "single", "sings",
  "singular", "singulars", "sinister", "sink", "sinking", "sinks", "sins", "sip", "sips", "sir", "sire", "sister",
  "sisters", "sit", "site", "sites", "sits", "sitting", "situation", "situations", "six", "sixteen", "sixth", "sixty",
  "size", "sized", "sizes", "skate", "skates", "skating", "sketch", "sketches", "ski", "skies", "skiing", "skill",
  "skilled", "skillful", "skills", "skin", "skins", "skip", "skipped", "skipping", "skips", "skirt", "skirts", "skis",
  "sky", "skytrain", "skytrains", "slab", "slabs", "slack", "slain", "slam", "slams", "slang", "slant", "slants",
  "slap", "slaps", "slate", "slaughter", "slave", "slavery", "slaves", "slay", "slaying", "slays", "sled", "sledge",
  "sleep", "sleeping", "sleepless", "sleeps", "sleepy", "sleeve", "sleeves", "slender", "slept", "slew", "slice", "slices",
  "slid", "slide", "slides", "sliding", "slight", "slightly", "slim", "slime", "slimy", "sling", "slip", "slipped",
  "slipper", "slippers", "slippery", "slipping", "slips", "slit", "slits", "slogan", "slogans", "slope", "slopes", "sloping",
  "slot", "sloth", "slots", "slouch", "slow", "slower", "slowest", "slowly", "slum", "slumber", "slums", "sly",
  "smack", "small", "smaller", "smallest", "smart", "smarter", "smartest", "smartphone", "smartphones", "smash", "smashes", "smear",
  "smell", "smelled", "smelling", "smells", "smelly", "smelt", "smile", "smiled", "smiles", "smiling", "smith", "smiths",
  "smoke", "smoked", "smoker", "smokers", "smokes", "smoking", "smoky", "smooth", "smoother", "smoothly", "smother", "smuggle",
  "snack", "snacks", "snail", "snails", "snake", "snakes", "snap", "snapped", "snaps", "snare", "snatch", "sneath",
  "sneer", "sneeze", "sneezes", "sniff", "snob", "snobs", "snore", "snores", "snow", "snows", "snowy", "so",
  "soak", "soap", "soar", "soars", "sob", "sober", "sobs", "soccer", "sociable", "social", "socialize", "socially",
  "societies", "society", "sociology", "sock", "socks", "soda", "sofa", "sofas", "soft", "soften", "softer", "softest",
  "softly", "software", "softwares", "soil", "soils", "solace", "solar", "sold", "soldier", "soldiers", "sole", "solely",
  "solemn", "solicit", "solitary", "solitude", "solo", "solos", "solution", "solutions", "solve", "solved", "solves", "solving",
  "some", "somebody", "somehow", "someone", "something", "sometime", "sometimes", "somewhat", "somewhere", "son", "song", "songs",
  "sons", "soon", "sooner", "soonest", "soot", "soothe", "sophisticated", "sore", "sorrow", "sorrows", "sorry", "sort",
  "sorted", "sorts", "sought", "soul", "souls", "sound", "sounded", "sounding", "soundly", "sounds", "soup", "soups",
  "sour", "source", "sources", "south", "southern", "souvenir", "souvenirs", "sovereign", "sovereignty", "sow", "sowed", "sown",
  "sows", "space", "spaces", "spacious", "spade", "spades", "span", "spans", "spare", "spark", "sparked", "sparkle",
  "sparks", "sparrow", "sparrows", "sparse", "spat", "speak", "speaker", "speakers", "speaking", "speaks", "spear", "spears",
  "special", "specialist", "specialists", "specialize", "specialized", "specializes", "specializing", "specially", "specialties", "specialty", "species", "specific",
  "specifically", "specification", "specifications", "specified", "specifies", "specify", "specifying", "specimen", "specimens", "spectacle", "spectacles", "spectacular",
  "spectator", "spectators", "specter", "spectrum", "speculate", "speculation", "speech", "speeches", "speed", "speeds", "speedy", "spell",
  "spellcheck", "spelled", "spelling", "spells", "spelt", "spend", "spending", "spends", "spent", "sphere", "spheres", "spice",
  "spices", "spicy", "spider", "spiders", "spies", "spill", "spilled", "spills", "spilt", "spin", "spinach", "spine",
  "spines", "spinning", "spins", "spire", "spires", "spirit", "spirits", "spiritual", "spit", "spite", "spits", "spitting",
  "spoil", "spoiled", "spoils", "spoilt", "spoke", "spoken", "sponsor", "sponsored", "sponsors", "spontaneous", "spoon", "spoons",
  "sport", "sporting", "sports", "spot", "spots", "spotted", "spouse", "spouses", "spout", "sprain", "sprang", "sprawl",
  "spray", "sprays", "spread", "spreading", "spreads", "spring", "springs", "springtime", "sprinkle", "sprinkles", "sprout", "sprouts",
  "sprung", "spun", "spur", "spurs", "spy", "squad", "squads", "squalid", "squalor", "square", "squares", "squash",
  "squat", "squats", "squeeze", "squeezed", "squeezes", "squire", "squires", "squirrel", "squirrels", "stab", "stability", "stabilize",
  "stable", "stabs", "stack", "stacks", "stadium", "stadiums", "staff", "staffs", "stage", "stages", "stagger", "staggers",
  "stain", "stained", "stains", "stair", "staircase", "staircases", "stairs", "stake", "stakes", "stale", "stalk", "stalks",
  "stall", "stalls", "stamen", "stamens", "stammer", "stamp", "stamped", "stamps", "stance", "stances", "stand", "standard",
  "standardization", "standardize", "standardized", "standards", "standing", "stands", "staple", "staples", "star", "starch", "stare", "stared",
  "stares", "staring", "stars", "start", "started", "starting", "startle", "startled", "starts", "starvation", "starve", "starved",
  "starves", "state", "stated", "statement", "statements", "states", "stating", "station", "stationary", "stationery", "stations", "statistical",
  "statistics", "statue", "statues", "stature", "status", "statuses", "statute", "statutes", "stay", "stayed", "staying", "stays",
  "stead", "steadily", "steady", "steak", "steaks", "steal", "stealing", "steals", "steam", "steamer", "steamers", "steel",
  "steep", "steer", "steered", "steers", "stem", "stems", "stencil", "stencils", "step", "stepped", "stepping", "steps",
  "stereo", "stereos", "stereotype", "stereotypes", "sterile", "stern", "stew", "steward", "stewards", "stick", "sticking", "sticks",
  "sticky", "stiff", "stifle", "stigma", "stigmas", "still", "stimulate", "stimulated", "stimulates", "stimulating", "stimulation", "stimuli",
  "stimulus", "sting", "stings", "stingy", "stir", "stirred", "stirring", "stirs", "stitch", "stitches", "stock", "stocking",
  "stockings", "stocks", "stole", "stolen", "stomach", "stomachs", "stone", "stones", "stony", "stood", "stool", "stools",
  "stop", "stoppage", "stoppages", "stopped", "stopping", "stops", "storage", "store", "stored", "storehouse", "storehouses", "stores",
  "stories", "storing", "storm", "storms", "stormy", "story", "storytelling", "stout", "stove", "stoves", "straight", "straighten",
  "straightforward", "strain", "strains", "strait", "straits", "strand", "strands", "strang", "strange", "strangely", "stranger", "strangers",
  "strap", "straps", "strategic", "strategically", "strategies", "strategy", "straw", "strawberries", "strawberry", "straws", "stray", "strays",
  "streak", "streaks", "stream", "streaming", "streams", "street", "streetlights", "streets", "strength", "strengthen", "strengthened", "strengths",
  "strenuous", "stress", "stressed", "stresses", "stressful", "stretch", "stretched", "stretches", "stretching", "strict", "strictly", "stride",
  "strides", "striding", "strife", "strike", "strikes", "striking", "string", "strings", "strip", "stripe", "striped", "stripes",
  "stripped", "strips", "strive", "striven", "strives", "striving", "stroke", "strokes", "stroll", "strolls", "strong", "stronger",
  "strongest", "strongly", "strove", "struck", "structural", "structurally", "structure", "structured", "structures", "struggle", "struggled", "struggles",
  "struggling", "strung", "stubborn", "stuck", "student", "students", "studied", "studies", "studio", "studios", "studious", "study",
  "studying", "stuff", "stumble", "stumbles", "stump", "stumps", "stun", "stung", "stunned", "stuns", "stunt", "stunts",
  "stupid", "stupidity", "sturdy", "stutter", "style", "styled", "styles", "stylish", "sub", "subdivide", "subdivision", "subdue",
  "subdued", "subject", "subjection", "subjective", "subjects", "sublime", "submarine", "submarines", "submerge", "submerged", "submit", "submits",
  "submitted", "submitting", "subordinate", "subordinates", "subscribe", "subscription", "subscriptions", "subsequent", "subsequently", "subside", "subsidies", "subsidize",
  "subsidized", "subsidy", "subsist", "substance", "substances", "substantial", "substantially", "substitute", "substitutes", "substitution", "subtle", "subtly",
  "subtopics", "subtract", "subtraction", "suburb", "suburban", "suburbs", "subway", "subways", "succeed", "succeeding", "succeeds", "success",
  "successes", "successful", "successfully", "succession", "successive", "successor", "successors", "such", "suck", "sucked", "sucks", "sudden",
  "suddenly", "sue", "sued", "sues", "suffer", "suffered", "suffering", "sufferings", "suffers", "suffice", "sufficient", "sufficiently",
  "suffix", "suffixes", "sugar", "sugars", "sugary", "suggest", "suggested", "suggesting", "suggestion", "suggestions", "suggests", "suicide",
  "suicides", "suing", "suit", "suitable", "suitably", "suitcase", "suitcases", "suite", "suited", "suites", "suiting", "suits",
  "sullen", "sulphur", "sum", "summaries", "summarize", "summarized", "summarizes", "summary", "summed", "summer", "summers", "summit",
  "summits", "summon", "summons", "sums", "sun", "sunday", "sung", "sunk", "sunlight", "sunny", "sunrise", "sunset",
  "sunshine", "super", "superb", "superficial", "superfluous", "superintendent", "superior", "superiority", "supermarket", "supermarkets", "supernatural", "supersede",
  "superstition", "superstitions", "superstitious", "supervise", "supervised", "supervision", "supervisor", "supervisors", "supper", "suppers", "supplement", "supplementary",
  "supplied", "supplier", "suppliers", "supplies", "supply", "supplying", "support", "supported", "supporter", "supporters", "supporting", "supportive",
  "supports", "suppose", "supposed", "supposes", "supposing", "suppress", "suppression", "supremacy", "supreme", "sure", "surely", "surface",
  "surfaces", "surge", "surgeon", "surgeons", "surgeries", "surgery", "surgical", "surplus", "surpluses", "surprise", "surprised", "surprises",
  "surprising", "surrender", "surrendered", "surround", "surrounded", "surrounding", "surroundings", "surrounds", "survey", "surveyed", "surveying", "surveys",
  "survival", "survive", "survived", "survives", "surviving", "survivor", "survivors", "suspect", "suspected", "suspects", "suspend", "suspended",
  "suspension", "suspicion", "suspicions", "suspicious", "sustain", "sustainability", "sustainable", "sustained", "swallow", "swallowed", "swallows", "swam",
  "swamp", "swamps", "swan", "swans", "swarm", "swarms", "sway", "sways", "swear", "swearing", "swears", "sweat",
  "sweater", "sweaters", "swedish", "sweep", "sweeping", "sweeps", "sweet", "sweeter", "sweetest", "sweetly", "sweetness", "swell",
  "swelled", "swelling", "swells", "swept", "swift", "swiftly", "swim", "swimmer", "swimmers", "swimming", "swims", "swindle",
  "swing", "swings", "swiss", "switch", "switched", "switches", "switching", "swollen", "sword", "swords", "swore", "sworn",
  "swum", "swung", "syllable", "syllables", "symbol", "symbolic", "symbolize", "symbols", "symmetry", "sympathetic", "sympathies", "sympathize",
  "sympathy", "symptom", "symptoms", "synonym", "synonyms", "syntax", "system", "systematic", "systematically", "systems", "tab", "table",
  "tables", "tablet", "tablets", "tabs", "tack", "tackle", "tackled", "tact", "tactics", "tags", "tail", "tailor",
  "tailors", "tails", "take", "taken", "takes", "taking", "tale", "talent", "talented", "talents", "tales", "talk",
  "talkative", "talked", "talking", "talks", "tall", "taller", "tallest", "tame", "tan", "tangible", "tank", "tanks",
  "tap", "tape", "tapes", "tapped", "taps", "tar", "target", "targets", "tariff", "tariffs", "task", "tasks",
  "taste", "tasted", "tastes", "tasting", "tasty", "taught", "tax", "taxation", "taxes", "taxi", "taxis", "tea",
  "teach", "teacher", "teachers", "teaches", "teaching", "team", "teams", "teamwork", "tear", "tears", "teas", "tease",
  "teased", "teaspoon", "teaspoons", "technical", "technically", "technique", "techniques", "technological", "technologies", "technology", "tedious", "teenager",
  "teenagers", "teens", "teeth", "telegram", "telegrams", "telegraph", "telephone", "telephoned", "telephones", "telescope", "telescopes", "television",
  "televisions", "tell", "telling", "tells", "temper", "temperament", "temperature", "temperatures", "tempers", "tempest", "tempests", "temple",
  "temples", "temporarily", "temporary", "tempt", "temptation", "temptations", "ten", "tenant", "tenants", "tend", "tended", "tendencies",
  "tendency", "tender", "tending", "tends", "tennis", "tense", "tenses", "tension", "tensions", "tent", "tentative", "tenth",
  "tents", "term", "terminal", "terminals", "terminate", "termination", "terms", "terrace", "terraces", "terrestrial", "terrible", "terribly",
  "terrific", "terrified", "terrify", "territories", "territory", "terror", "terrorism", "terrorist", "terrorists", "terrors", "test", "testament",
  "tested", "testify", "testimony", "testing", "tests", "tet", "text", "textbook", "textbooks", "textile", "textiles", "texts",
  "textual", "than", "thank", "thanked", "thankful", "thanks", "that", "thatch", "the", "theater", "theaters", "theatre",
  "theatres", "theft", "thefts", "their", "theirs", "them", "theme", "themes", "themselves", "then", "theology", "theoretical",
  "theories", "theory", "therapies", "therapy", "there", "thereby", "therefore", "thermometer", "thermometers", "these", "theses", "thesis",
  "they", "thick", "thicken", "thickness", "thief", "thieves", "thigh", "thighs", "thin", "thing", "things", "think",
  "thinker", "thinkers", "thinking", "thinks", "thinner", "thinnest", "third", "thirdly", "thirst", "thirsty", "thirteen", "thirty",
  "this", "thorn", "thorns", "thorough", "thoroughly", "those", "though", "thought", "thoughtful", "thoughts", "thousand", "thousands",
  "thread", "threads", "threat", "threaten", "threatened", "threatening", "threatens", "threats", "three", "threshold", "threw", "thrift",
  "thrifty", "thrill", "thrilled", "thrills", "throat", "throats", "throne", "thrones", "throng", "throngs", "through", "throughout",
  "throw", "throwing", "thrown", "throws", "thrust", "thrusts", "thumb", "thumbs", "thunder", "thursday", "thus", "ticket",
  "tickets", "tide", "tides", "tidy", "tie", "tied", "ties", "tiger", "tigers", "tight", "tightly", "tiktok",
  "tile", "tiles", "till", "timber", "time", "timed", "times", "timetable", "timetables", "timid", "timidity", "timing",
  "tin", "tiny", "tip", "tips", "tire", "tired", "tires", "tiring", "tissue", "tissues", "title", "titled",
  "titles", "to", "toad", "toads", "toast", "tobacco", "today", "toddlers", "toe", "toes", "together", "toil",
  "toilet", "toilets", "token", "tokens", "told", "tolerable", "tolerant", "tolerate", "toleration", "toll", "tolls", "tomato",
  "tomatoes", "tomb", "tombs", "tomorrow", "ton", "tone", "tones", "tongue", "tongues", "tonight", "tons", "too",
  "took", "tool", "tools", "tooth", "toothbrush", "toothpaste", "top", "topic", "topical", "topics", "tops", "torch",
  "torches", "tore", "torment", "torn", "tornado", "tornadoes", "torrent", "torrents", "tortoise", "tortoises", "torture", "toss",
  "tossed", "tosses", "tossing", "total", "totally", "touch", "touched", "touches", "touching", "tough", "tour", "tourism",
  "tourist", "tourists", "tournament", "tournaments", "tours", "tow", "toward", "towards", "towel", "towels", "tower", "towers",
  "town", "towns", "toxic", "toy", "toys", "trace", "traced", "traces", "tracing", "track", "tracked", "tracks",
  "tract", "trade", "traded", "trader", "traders", "trades", "trading", "tradition", "traditional", "traditionally", "traditions", "traffic",
  "traffics", "tragedies", "tragedy", "tragic", "trail", "trails", "train", "trained", "trainee", "trainees", "trainer", "trainers",
  "training", "trains", "trait", "traitor", "traitors", "traits", "tramp", "trample", "tramps", "transact", "transaction", "transactions",
  "transcend", "transcription", "transfer", "transferred", "transferring", "transform", "transformation", "transformations", "transformed", "transforming", "transient", "transit",
  "transition", "transitional", "transitions", "translate", "translated", "translates", "translating", "translation", "translations", "translator", "translators", "translucent",
  "transmission", "transmit", "transmits", "transmitted", "transparency", "transparent", "transport", "transportable", "transportation", "transported", "transporting", "trap",
  "trapped", "trapping", "traps", "trash", "travel", "traveled", "traveler", "travelers", "traveling", "travelled", "traveller", "travellers",
  "travelling", "travels", "traverse", "tray", "trays", "treach", "tread", "treason", "treasure", "treasurer", "treasures", "treasury",
  "treat", "treated", "treaties", "treating", "treatment", "treatments", "treats", "treaty", "treble", "tree", "trees", "tremble",
  "trembled", "trembles", "trembling", "tremendous", "trench", "trenches", "trend", "trends", "trespass", "trial", "trials", "triangle",
  "triangles", "triangular", "tribe", "tribes", "tribute", "tributes", "trick", "tricks", "tricky", "tried", "tries", "trifle",
  "trifles", "trigger", "trim", "trimmed", "trimming", "trims", "trip", "trips", "triumph", "triumphant", "triumphs", "trivial",
  "trolley", "trolleys", "troop", "troops", "trophies", "trophy", "tropical", "trouble", "troubled", "troubles", "troublesome", "trough",
  "troughs", "trousers", "truck", "trucks", "true", "truly", "trumpet", "trumpets", "trunk", "trunks", "trust", "trusted",
  "trusting", "trusts", "trustworthy", "truth", "truthful", "truths", "try", "trying", "tub", "tube", "tubes", "tubs",
  "tuesday", "tuition", "tuitions", "tumble", "tumbles", "tumor", "tumors", "tune", "tunes", "tunnel", "tunnels", "turbine",
  "turbines", "turf", "turkey", "turkeys", "turn", "turned", "turning", "turnip", "turnips", "turns", "tutor", "tutorial",
  "tutorials", "tutoring", "tutors", "tv", "twelfth", "twelve", "twenty", "twice", "twig", "twigs", "twilight", "twin",
  "twinkle", "twinkles", "twins", "twist", "twisted", "twisting", "twists", "two", "tying", "type", "typed", "types",
  "typical", "typically", "typing", "tyranny", "tyrant", "tyrants", "ubiquity", "ugly", "ultimate", "ultimately", "umbrella", "umbrellas",
  "unable", "unacceptable", "unanimous", "unavoidable", "unaware", "uncertain", "uncertainties", "uncertainty", "uncle", "unclear", "uncles", "uncomfortable",
  "unconscious", "unconsciously", "uncover", "under", "undergo", "undergoes", "undergoing", "undergone", "underground", "underlie", "underline", "underlined",
  "underneath", "understand", "understanding", "understandings", "understands", "understood", "undertake", "undertaken", "undertaker", "undertakes", "undertook", "underwear",
  "underwent", "undesirable", "undoubtedly", "undress", "undressed", "undresses", "uneasy", "unemployed", "unemployment", "unequal", "unequally", "uneven",
  "unexpected", "unexpectedly", "unfair", "unfairly", "unfavorable", "unfit", "unfold", "unfortunate", "unfortunately", "unhappy", "unhealthy", "unification",
  "unified", "unifies", "uniform", "uniforms", "unify", "unifying", "union", "unions", "unique", "uniquely", "unit", "unite",
  "united", "unites", "uniting", "units", "unity", "universal", "universally", "universe", "universes", "universities", "university", "unjust",
  "unkind", "unknown", "unless", "unlike", "unlikely", "unlimited", "unload", "unlucky", "unnecessary", "unpaid", "unpleasant", "unprecedented",
  "unproductive", "unreal", "unreasonable", "unrest", "unruly", "unsafe", "unsatisfactory", "unstable", "unsuccessful", "unsuccessfully", "unsuitable", "untidy",
  "untie", "untied", "unties", "until", "untold", "unusual", "unusually", "unwilling", "unwillingness", "unworthy", "up", "updated",
  "updates", "upgrading", "upon", "upper", "upright", "uproot", "upset", "upsets", "upsetting", "upside", "upward", "urban",
  "urbanization", "urge", "urged", "urgency", "urgent", "urgently", "urges", "urging", "us", "usage", "use", "used",
  "useful", "usefully", "usefulness", "useless", "user", "users", "uses", "using", "usual", "usually", "utilities", "utility",
  "utilization", "utilize", "utilized", "utilizes", "utilizing", "utmost", "utter", "utterly", "vacancies", "vacancy", "vacant", "vacate",
  "vacation", "vacations", "vaccinate", "vaccine", "vaccines", "vacuum", "vacuums", "vague", "vaguely", "vain", "valiant", "valid",
  "validate", "validated", "validating", "validation", "validity", "valley", "valleys", "valuable", "valuables", "valuation", "value", "valued",
  "values", "valuing", "valve", "valves", "van", "vanish", "vanished", "vanishes", "vanishing", "vanity", "vanquish", "vans",
  "vapor", "vapors", "vapour", "vapours", "variable", "variables", "variance", "variant", "variation", "variations", "varied", "varies",
  "varieties", "variety", "various", "variously", "vary", "varying", "vase", "vases", "vast", "vastly", "vault", "vaults",
  "veal", "vegetable", "vegetables", "vegetarian", "vegetarians", "vehicle", "vehicles", "vehicular", "veil", "veils", "vein", "veins",
  "velocity", "velvet", "vendor", "vendors", "venerable", "vengeance", "venom", "vent", "ventilate", "ventilation", "vents", "venture",
  "ventured", "ventures", "venus", "verb", "verbal", "verbs", "verdict", "verdicts", "verge", "verified", "verifies", "verify",
  "verifying", "veritable", "verse", "verses", "version", "versions", "versus", "vertical", "vertically", "very", "vessel", "vessels",
  "vest", "vests", "veteran", "veterans", "veto", "vetoes", "vetos", "vex", "vi", "via", "viable", "viaduct",
  "viaducts", "vibrant", "vibrate", "vibration", "vibrations", "vicar", "vicars", "vice", "vices", "vicinity", "victim", "victims",
  "victories", "victorious", "victory", "video", "videos", "view", "viewed", "viewer", "viewers", "viewing", "viewpoint", "viewpoints",
  "views", "vigor", "vigorous", "vigorously", "vile", "village", "villager", "villagers", "villages", "villain", "villains", "vine",
  "vinegar", "vines", "violate", "violated", "violates", "violating", "violation", "violations", "violence", "violent", "violently", "violet",
  "violets", "violin", "violins", "virgin", "virgins", "virtual", "virtually", "virtue", "virtues", "virtuous", "virus", "viruses",
  "visa", "visas", "visibility", "visible", "visibly", "vision", "visions", "visit", "visited", "visiting", "visitor", "visitors",
  "visits", "visual", "visualization", "visually", "visuals", "vital", "vitally", "vitamin", "vitamins", "vivid", "vividly", "vocab",
  "vocabularies", "vocabulary", "vocal", "vocation", "vocational", "vogue", "voice", "voiced", "voices", "voicing", "void", "volcano",
  "volcanoes", "volcanos", "volleyball", "volt", "voltage", "voltages", "volts", "volume", "volumes", "voluntarily", "voluntary", "volunteer",
  "volunteered", "volunteering", "volunteers", "vomit", "vote", "voted", "voter", "voters", "votes", "voting", "vow", "vowel",
  "vowels", "vows", "voyage", "voyages", "vs", "vulgar", "vulnerability", "vulnerable", "wade", "wafer", "wafers", "wag",
  "wage", "wager", "wagers", "wages", "wagon", "wagons", "wags", "waist", "waists", "wait", "waited", "waiter",
  "waiters", "waiting", "waitress", "waitresses", "waits", "wake", "wakes", "waking", "walk", "walked", "walking", "walks",
  "wall", "walled", "walls", "walnut", "walnuts", "wander", "wandered", "wandering", "wanders", "want", "wanted", "wanting",
  "wants", "war", "ward", "warden", "wardens", "wardrobe", "wardrobes", "wards", "ware", "warehouse", "warehouses", "wares",
  "warm", "warmer", "warmest", "warmly", "warmth", "warn", "warned", "warning", "warnings", "warns", "warrant", "warrants",
  "warrior", "warriors", "wars", "wary", "was", "wash", "washed", "washer", "washers", "washes", "washing", "wasp",
  "wasps", "waste", "wasted", "wasteful", "wastes", "wasting", "watch", "watched", "watches", "watching", "watchman", "watchmen",
  "water", "watered", "waterfall", "waterfalls", "watering", "waterproof", "waters", "wave", "waved", "waves", "waving", "wavy",
  "wax", "way", "ways", "we", "weak", "weaken", "weaker", "weakest", "weakly", "weakness", "weaknesses", "wealth",
  "wealthier", "wealthiest", "wealthy", "weapon", "weapons", "wear", "weariness", "wearing", "wears", "weary", "weather", "weathers",
  "weave", "weaver", "weavers", "weaves", "weaving", "web", "webs", "website", "websites", "wed", "wedded", "wedding",
  "weddings", "wednesday", "weds", "weed", "weeds", "week", "weekday", "weekdays", "weekend", "weekends", "weekly", "weeks",
  "weep", "weeping", "weeps", "weigh", "weighed", "weighing", "weighs", "weight", "weighted", "weights", "welcome", "welcomed",
  "welcomes", "welcoming", "welfare", "well", "went", "wept", "were", "west", "western", "wet", "wetter", "wettest",
  "whale", "whales", "wharf", "wharves", "what", "whatever", "wheat", "wheel", "wheelbarrow", "wheelbarrows", "wheelchair", "wheelchairs",
  "wheeled", "wheels", "when", "whenever", "where", "whereabouts", "whereas", "whereby", "wherefore", "wherever", "whether", "which",
  "whichever", "while", "whip", "whipped", "whipping", "whips", "whirl", "whirls", "whiskey", "whisky", "whisper", "whispered",
  "whispering", "whispers", "whistle", "whistled", "whistles", "whistling", "white", "whiten", "whitish", "who", "whoever", "whole",
  "wholesome", "wholly", "whom", "whose", "why", "wicked", "wide", "widely", "widen", "wider", "widespread", "widest",
  "widow", "widower", "widowers", "widows", "width", "widths", "wife", "wild", "wilder", "wilderness", "wildest", "wildlife",
  "wildly", "will", "willing", "willingly", "willingness", "willow", "willows", "win", "wind", "winding", "windmill", "windmills",
  "window", "windows", "winds", "windy", "wine", "wines", "wing", "winged", "wings", "wink", "winked", "winking",
  "winks", "winner", "winners", "winning", "wins", "winter", "winters", "wipe", "wiped", "wipes", "wiping", "wire",
  "wired", "wires", "wiring", "wisdom", "wise", "wisely", "wish", "wished", "wishes", "wishing", "wit", "witch",
  "witches", "with", "withdraw", "withdrawal", "withdrawals", "withdrawing", "withdrawn", "withdraws", "withdrew", "wither", "withered", "withering",
  "withers", "within", "without", "withstand", "withstanding", "withstands", "withstood", "witness", "witnessed", "witnesses", "witnessing", "wits",
  "witty", "wives", "woke", "woken", "wolf", "wolves", "woman", "women", "won", "wonder", "wondered", "wonderful",
  "wonderfully", "wondering", "wonders", "wood", "wooden", "woods", "woody", "wool", "woollen", "wooly", "word", "worded",
  "wording", "words", "wore", "work", "worked", "worker", "workers", "workforce", "working", "workloads", "workplace", "workplaces",
  "works", "workshop", "workshops", "world", "worlds", "worldwide", "worm", "worms", "worn", "worried", "worries", "worry",
  "worrying", "worse", "worship", "worshipped", "worshipping", "worst", "worth", "worthy", "would", "wound", "wounded", "wounding",
  "wounds", "wove", "woven", "wrap", "wrapped", "wrapping", "wraps", "wrath", "wreath", "wreaths", "wreck", "wreckage",
  "wrecked", "wrecks", "wren", "wrens", "wrestle", "wrestled", "wrestler", "wrestlers", "wrestles", "wrestling", "wretched", "wrinkle",
  "wrinkled", "wrinkles", "wrist", "wrists", "write", "writer", "writers", "writes", "writing", "writings", "written", "wrong",
  "wrongdoing", "wrongdoings", "wrongly", "wrote", "x", "yard", "yards", "yarn", "yarns", "yawn", "yawned", "yawning",
  "yawns", "year", "yearly", "yearn", "yearned", "yearns", "years", "yeast", "yell", "yelled", "yelling", "yellow",
  "yells", "yes", "yesterday", "yesterdays", "yet", "yield", "yielded", "yielding", "yields", "yoke", "yokes", "yolk",
  "yolks", "you", "young", "younger", "youngest", "youngster", "youngsters", "your", "yours", "yourself", "yourselves", "youth",
  "youthful", "youths", "youtube", "zeal", "zealous", "zebra", "zebras", "zenith", "zero", "zeroes", "zeros", "zinc",
  "zone", "zones", "zoo", "zoological", "zoology", "zoos",

]);

// Build domain specific spellcheck dictionary
function getValidWordDictionary() {
  const dict = new Set(COMMON_ENGLISH_WORDS);
  if (currentTopic && currentTopic.details) {
    if (currentTopic.details.vocab) {
      currentTopic.details.vocab.forEach(v => {
        const words = v.en.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
        words.forEach(w => dict.add(w));
      });
    }
    const addFromIdeas = (ideas) => {
      if (!ideas) return;
      const processText = (text) => {
        if (!text) return;
        const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
        words.forEach(w => dict.add(w));
      };
      if (ideas.benefits) {
        ideas.benefits.forEach(b => {
          processText(b.point_en);
          processText(b.evidence_en);
          if (b.collocations) {
            b.collocations.forEach(c => processText(c.en));
          }
        });
      }
      if (ideas.drawbacks) {
        ideas.drawbacks.forEach(d => {
          processText(d.point_en);
          processText(d.evidence_en);
          if (d.collocations) {
            d.collocations.forEach(c => processText(c.en));
          }
        });
      }
    };
    addFromIdeas(currentTopic.details.ideas_b1);
    addFromIdeas(currentTopic.details.ideas_b2);
    
    const addFromText = (text) => {
      if (!text) return;
      const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
      words.forEach(w => dict.add(w));
    };
    addFromText(currentTopic.details.sample_b1);
    addFromText(currentTopic.details.sample_b2);
  }
  return dict;
}

// Contraction mappings for academic writing check
const ACADEMIC_CONTRACTIONS = {
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "can't": "cannot",
  "won't": "will not",
  "shouldn't": "should not",
  "wouldn't": "would not",
  "couldn't": "could not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "i'm": "I am",
  "you're": "you are",
  "they're": "they are",
  "we're": "we are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "let's": "let us",
  "there's": "there is",
  "that's": "that is",
  "who's": "who is",
  "we've": "we have",
  "they've": "they have",
  "you've": "you have",
  "i've": "I have",
  "should've": "should have",
  "would've": "would have",
  "could've": "could have",
  "might've": "might have",
  "must've": "must have",

  // Misspelled contractions without apostrophe
  "dont": "do not",
  "doesnt": "does not",
  "didnt": "did not",
  "cant": "cannot",
  "wont": "will not",
  "shouldnt": "should not",
  "wouldnt": "would not",
  "couldnt": "could not",
  "isnt": "is not",
  "arent": "are not",
  "wasnt": "was not",
  "werent": "were not",
  "havent": "have not",
  "hasnt": "has not",
  "hadnt": "had not",
  "im": "I am",
  "youre": "you are",
  "theyre": "they are",
  "theres": "there is",
  "thats": "that is",
  "whos": "who is",
  "ive": "I have",
  "youve": "you have",
  "theyve": "they have",
  "weve": "we have",
  "shouldve": "should have",
  "wouldve": "would have",
  "couldve": "could have"
};

const NOUN_SINGULAR_TO_PLURAL = {
  'learner': 'learners',
  'student': 'students',
  'teacher': 'teachers',
  'school': 'schools',
  'activity': 'activities',
  'cost': 'costs',
  'expense': 'expenses',
  'device': 'devices',
  'computer': 'computers',
  'phone': 'phones',
  'benefit': 'benefits',
  'drawback': 'drawbacks',
  'problem': 'problems',
  'solution': 'solutions',
  'parent': 'parents',
  'child': 'children',
  'class': 'classes',
  'lesson': 'lessons',
  'course': 'courses',
  'network': 'networks',
  'opportunity': 'opportunities',
  'advantage': 'advantages',
  'disadvantage': 'disadvantages',
  'peer': 'peers',
  'friend': 'friends',
  'country': 'countries',
  'skill': 'skills',
  'result': 'results',
  'connection': 'connections',
  'platform': 'platforms'
};

const NOUN_PLURAL_TO_SINGULAR = {};
for (const [sing, plur] of Object.entries(NOUN_SINGULAR_TO_PLURAL)) {
  NOUN_PLURAL_TO_SINGULAR[plur] = sing;
}

const VERB_SINGULAR_TO_PLURAL = {
  'brings': 'bring',
  'offers': 'offer',
  'provides': 'provide',
  'gives': 'give',
  'saves': 'save',
  'helps': 'help',
  'creates': 'create',
  'improves': 'improve',
  'allows': 'allow',
  'enables': 'enable',
  'becomes': 'become',
  'has': 'have',
  'affects': 'affect',
  'wants': 'want',
  'needs': 'need',
  'shares': 'share',
  'focuses': 'focus',
  'makes': 'make',
  'causes': 'cause',
  'leads': 'lead',
  'reduces': 'reduce',
  'lives': 'live',
  'is': 'are'
};
const VERB_PLURAL_TO_SINGULAR = {};
for (const [sing, plur] of Object.entries(VERB_SINGULAR_TO_PLURAL)) {
  VERB_PLURAL_TO_SINGULAR[plur] = sing;
}

const ADJECTIVE_TO_NOUN = {
  'flexible': 'flexibility',
  'convenient': 'convenience',
  'independent': 'independence',
  'distracted': 'distraction',
  'isolated': 'isolation',
  'interacted': 'interaction',
  'difficult': 'difficulty',
  'expensive': 'expense',
  'costly': 'cost'
};
const NOUN_TO_ADJECTIVE = {};
for (const [adj, noun] of Object.entries(ADJECTIVE_TO_NOUN)) {
  NOUN_TO_ADJECTIVE[noun] = adj;
}

const PAST_TO_PRESENT = {
  'brought': { sing: 'brings', plur: 'bring' },
  'offered': { sing: 'offers', plur: 'offer' },
  'provided': { sing: 'provides', plur: 'provide' },
  'gave': { sing: 'gives', plur: 'give' },
  'saved': { sing: 'saves', plur: 'save' },
  'helped': { sing: 'helps', plur: 'help' },
  'created': { sing: 'creates', plur: 'create' },
  'improved': { sing: 'improves', plur: 'improve' },
  'allowed': { sing: 'allows', plur: 'allow' },
  'enabled': { sing: 'enables', plur: 'enable' },
  'learnt': { sing: 'learns', plur: 'learn' },
  'learned': { sing: 'learns', plur: 'learn' },
  'spent': { sing: 'spends', plur: 'spend' },
  'reduced': { sing: 'reduces', plur: 'reduce' },
  'went': { sing: 'goes', plur: 'go' },
  'was': { sing: 'is', plur: 'is' },
  'were': { sing: 'are', plur: 'are' }
};

const CONTEXTUAL_WORD_CHOICES = {
  'lose costs': 'reduce costs / lower costs',
  'drop costs': 'reduce costs / lower costs',
  'fall costs': 'reduce costs / lower costs',
  'keep time': 'save time',
  'hold time': 'save time',
  'make convenience': 'bring convenience / offer convenience',
  'take convenience': 'bring convenience / offer convenience',
  'make flexibility': 'bring flexibility / offer flexibility',
  'take flexibility': 'bring flexibility / offer flexibility',
  'get benefits': 'bring benefits / provide benefits (nếu mang nghĩa là mang lại lợi ích)',
  'make benefits': 'bring benefits / provide benefits',
  'at anytime': 'at any time',
  'feel boring': 'feel bored',
  'through Internet': 'through the Internet'
};

// Evaluate user typed translation against VSTEP requirements
function evaluateTranslationInput(userInput, modelAnswer) {
  const trimmed = userInput.trim();
  if (trimmed === "") {
    return { isCorrect: false, reason: "Bạn chưa nhập câu trả lời." };
  }

  const structuredErrors = [];

  // Clean inputs for matching
  const cleanInput = trimmed.toLowerCase();
  const cleanModel = modelAnswer.trim().toLowerCase();

  // Tokenize user input preserving internal apostrophes and hyphens
  const userWords = trimmed.split(/\s+/)
    .map(t => t.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ''))
    .filter(w => w.length > 0);

  const modelWords = modelAnswer.toLowerCase().split(/\s+/)
    .map(t => t.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ''))
    .filter(w => w.length > 0);
  const modelWordsSet = new Set(modelWords);

  // 1. Check capitalization (Lỗi viết hoa/viết thường)
  // Check start of sentence
  const firstChar = trimmed.charAt(0);
  if (firstChar !== firstChar.toUpperCase() || !/[A-Z]/.test(firstChar)) {
    structuredErrors.push({
      category: "Lỗi cấu trúc câu (Sentence Structure)",
      location: `Chữ cái đầu tiên "${firstChar}"`,
      explanation: "Chữ cái đầu tiên của câu tiếng Anh phải viết hoa."
    });
  }

  // Check unnecessary capitalization inside the sentence (excluding first word, 'I', and proper nouns)
  const rawWords = trimmed.split(/\s+/).filter(w => w.length > 0);
  for (let i = 1; i < rawWords.length; i++) {
    const rawWord = rawWords[i].replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '');
    if (rawWord.length > 0 && rawWord !== 'I') {
      const firstL = rawWord.charAt(0);
      if (firstL === firstL.toUpperCase() && /[A-Z]/.test(firstL)) {
        const isProperInModel = modelWords.some(mw => 
          mw === rawWord.toLowerCase() || 
          (mw.charAt(0) === mw.charAt(0).toUpperCase() && mw.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '') === rawWord)
        );
        if (!isProperInModel) {
          structuredErrors.push({
            category: "Lỗi chính tả (Spelling)",
            location: `"${rawWord}"`,
            explanation: `Từ này ở giữa câu không cần viết hoa chữ cái đầu.`
          });
        }
      }
    }
  }

  // 2. Check punctuation (Lỗi dấu câu)
  const lastChar = trimmed.slice(-1);
  if (!/[.!?]/.test(lastChar)) {
    structuredErrors.push({
      category: "Lỗi dấu câu (Punctuation)",
      location: `Cuối câu`,
      explanation: "Thiếu dấu chấm (.) hoặc dấu câu kết thúc ở cuối câu."
    });
  }

  // 3. Exact match (without final punctuation)
  const cleanInputNoPunct = cleanInput.replace(/[.!?]/g, '');
  const cleanModelNoPunct = cleanModel.replace(/[.!?]/g, '');
  if (structuredErrors.length === 0 && cleanInputNoPunct === cleanModelNoPunct) {
    return { isCorrect: true, feedback: "Chính xác hoàn hảo! Câu viết đúng ngữ pháp, dấu câu và giống 100% đáp án mẫu." };
  }

  // 4. Subject-Verb Agreement checks (Lỗi sự hoà hợp giữa chủ từ và động từ)
  if (cleanInput.includes("online learning help ") && !cleanInput.includes("helps")) {
    structuredErrors.push({
      category: "Lỗi hòa hợp chủ ngữ - động từ (Subject-Verb Agreement)",
      location: '"online learning help"',
      explanation: "Động từ đi sau chủ ngữ số ít 'online learning' phải chia số ít ('helps' thay vì 'help')."
    });
  }
  if (cleanInput.includes("distance learning help ") && !cleanInput.includes("helps")) {
    structuredErrors.push({
      category: "Lỗi hòa hợp chủ ngữ - động từ (Subject-Verb Agreement)",
      location: '"distance learning help"',
      explanation: "Động từ đi sau chủ ngữ số ít 'distance learning' phải chia số ít ('helps' thay vì 'help')."
    });
  }
  if (cleanInput.includes("e-learning help ") && !cleanInput.includes("helps")) {
    structuredErrors.push({
      category: "Lỗi hòa hợp chủ ngữ - động từ (Subject-Verb Agreement)",
      location: '"e-learning help"',
      explanation: "Động từ đi sau chủ ngữ số ít 'e-learning' phải chia số ít ('helps' thay vì 'help')."
    });
  }

  // Subject-Verb Agreement Check for other common verbs
  const singularSubjects = ["online learning", "distance learning", "e-learning", "it", "education", "study", "studying online", "learning online"];
  singularSubjects.forEach(subj => {
    const subjIdx = cleanInput.indexOf(subj);
    if (subjIdx !== -1) {
      for (const [plurVerb, singVerb] of Object.entries(VERB_PLURAL_TO_SINGULAR)) {
        const verbIdx = cleanInput.indexOf(plurVerb);
        if (verbIdx > subjIdx) {
          const verbRegex = new RegExp('\\b' + plurVerb + '\\b');
          if (verbRegex.test(cleanInput.slice(subjIdx))) {
            structuredErrors.push({
              category: "Lỗi hòa hợp chủ ngữ - động từ (Subject-Verb Agreement)",
              location: `"${plurVerb}" đi sau chủ ngữ "${subj}"`,
              explanation: `Động từ đi sau chủ ngữ số ít '${subj}' phải chia số ít. Hãy dùng '${singVerb}' thay vì '${plurVerb}'.`
            });
          }
        }
      }
    }
  });

  // 5. Tense Check (Lỗi về thì)
  userWords.forEach(w => {
    const presentForms = PAST_TO_PRESENT[w];
    if (presentForms) {
      const hasSingularSubject = /\b(online learning|distance learning|e-learning|study|education|it)\b/i.test(cleanInput);
      const suggestedForm = hasSingularSubject ? presentForms.sing : presentForms.plur;
      structuredErrors.push({
        category: "Lỗi thì (Tense)",
        location: `"${w}"`,
        explanation: `Hãy dùng thì Hiện tại Đơn (Present Simple) để diễn đạt chân lý/sự thật khách quan. Nên dùng '${suggestedForm}' thay vì dạng quá khứ '${w}'.`
      });
    }
  });

  // 6. Word Form (Lỗi từ loại) Check
  const foundWordFormErrors = new Set();
  userWords.forEach(w => {
    const nounForm = ADJECTIVE_TO_NOUN[w];
    if (nounForm && modelWordsSet.has(nounForm)) {
      foundWordFormErrors.add({ adj: w, noun: nounForm });
    }
  });
  if (foundWordFormErrors.size > 0) {
    foundWordFormErrors.forEach(err => {
      structuredErrors.push({
        category: "Lỗi dạng từ (Word Form)",
        location: `"${err.adj}"`,
        explanation: `Từ '${err.adj}' là tính từ. Ở đây bạn cần dùng dạng danh từ '${err.noun}' (sự linh hoạt/sự tiện lợi) đóng vai trò làm tân ngữ.`
      });
    });
  }

  // 7. Preposition Checks (Lỗi giới từ)
  const recipients = ['learner', 'learners', 'student', 'students', 'people', 'person', 'user', 'users'];
  const hasUserForRecipient = userWords.some((w, idx) => w === 'for' && idx < userWords.length - 1 && recipients.includes(userWords[idx + 1]));
  const hasModelToRecipient = modelWords.some((w, idx) => w === 'to' && idx < modelWords.length - 1 && recipients.includes(modelWords[idx + 1]));
  if (hasUserForRecipient && hasModelToRecipient) {
    structuredErrors.push({
      category: "Lỗi giới từ (Preposition)",
      location: '"for" trước đối tượng tiếp nhận',
      explanation: "Hãy dùng giới từ 'to' thay vì 'for' để kết nối với đối tượng tiếp nhận (ví dụ: 'bring/offer flexibility to learners')."
    });
  }

  // spend time/money for -> on
  if (cleanInput.includes("spend") && /\b(time|money|costs|hours|days)\b/.test(cleanInput)) {
    const spendIdx = userWords.indexOf("spend");
    const forIdx = userWords.indexOf("for");
    if (spendIdx !== -1 && forIdx > spendIdx && forIdx - spendIdx <= 4) {
      structuredErrors.push({
        category: "Lỗi giới từ (Preposition)",
        location: '"for" đi sau "spend"',
        explanation: "Cấu trúc 'spend time/money' đi với giới từ 'on' (ví dụ: spend time on studying), không dùng 'for'."
      });
    }
  }

  // focus to/in/at -> on
  if (userWords.includes("focus")) {
    const focusIdx = userWords.indexOf("focus");
    if (focusIdx !== -1 && focusIdx < userWords.length - 1) {
      const nextWord = userWords[focusIdx + 1];
      if (nextWord === 'to' || nextWord === 'in' || nextWord === 'at' || nextWord === 'for') {
        structuredErrors.push({
          category: "Lỗi giới từ (Preposition)",
          location: `"${nextWord}" đi sau "focus"`,
          explanation: "Cấu trúc 'focus' đi với giới từ 'on' (ví dụ: focus on something)."
        });
      }
    }
  }

  // participate on/to/for -> in
  if (userWords.includes("participate")) {
    const partIdx = userWords.indexOf("participate");
    if (partIdx !== -1 && partIdx < userWords.length - 1) {
      const nextWord = userWords[partIdx + 1];
      if (nextWord === 'on' || nextWord === 'to' || nextWord === 'at' || nextWord === 'for') {
        structuredErrors.push({
          category: "Lỗi giới từ (Preposition)",
          location: `"${nextWord}" đi sau "participate"`,
          explanation: "Cấu trúc 'participate' đi với giới từ 'in' (ví dụ: participate in learning/activities)."
        });
      }
    }
  }

  // 8. Word Choice / Context Check (Lỗi dùng từ sai ngữ cảnh)
  for (const [wrongPhrase, suggestion] of Object.entries(CONTEXTUAL_WORD_CHOICES)) {
    if (cleanInput.includes(wrongPhrase)) {
      structuredErrors.push({
        category: "Lỗi kết hợp từ (Collocation)",
        location: `"${wrongPhrase}"`,
        explanation: `Cụm từ '${wrongPhrase}' chưa tự nhiên. Bạn nên dùng '${suggestion}'.`
      });
    }
  }

  // 9. Contraction check (Lỗi viết tắt)
  const foundContractions = new Set();
  userWords.forEach(w => {
    if (ACADEMIC_CONTRACTIONS[w]) {
      foundContractions.add(w);
    }
  });
  if (foundContractions.size > 0) {
    foundContractions.forEach(c => {
      structuredErrors.push({
        category: "Lỗi tự nhiên trong văn học thuật (Academic Style)",
        location: `"${c}"`,
        explanation: `Văn viết học thuật không được viết tắt. Hãy viết đầy đủ là '${ACADEMIC_CONTRACTIONS[c]}' thay vì '${c}'.`
      });
    });
  }

  // 10. Pluralization check (Lỗi số ít số nhiều)
  const SINGULAR_DETERMINERS = ['a', 'an', 'each', 'every', 'one', 'another', 'this', 'that'];
  const foundPluralErrors = new Set();
  for (let i = 0; i < userWords.length; i++) {
    const w = userWords[i];
    const pluralForm = NOUN_SINGULAR_TO_PLURAL[w];
    if (pluralForm && modelWordsSet.has(pluralForm)) {
      const prevWord = i > 0 ? userWords[i - 1] : null;
      if (!prevWord || !SINGULAR_DETERMINERS.includes(prevWord)) {
        foundPluralErrors.add(w);
      }
    }
  }
  if (foundPluralErrors.size > 0) {
    foundPluralErrors.forEach(sing => {
      const plur = NOUN_SINGULAR_TO_PLURAL[sing];
      structuredErrors.push({
        category: "Lỗi số ít - số nhiều (Singular/Plural)",
        location: `"${sing}"`,
        explanation: `Danh từ '${sing}' nên ở dạng số nhiều '${plur}' (thiếu '-s' hoặc '-es' ở cuối).`
      });
    });
  }

  // 11. Spellchecking (Lỗi chính tả)
  const dict = getValidWordDictionary();
  const foundSpellingErrors = [];

  userWords.forEach(w => {
    if (foundContractions.has(w)) return;
    if (/[0-9]/.test(w)) return;
    
    const pureWord = w.replace(/[^a-z]/g, '');
    if (pureWord.length === 0) return;

    if (!dict.has(w) && !dict.has(pureWord)) {
      let closestWord = "";
      let minDistance = 999;
      dict.forEach(dictWord => {
        if (Math.abs(dictWord.length - w.length) <= 2) {
          const dist = getLevenshteinDistance(w, dictWord);
          if (dist < minDistance) {
            minDistance = dist;
            closestWord = dictWord;
          }
        }
      });
      
      if (minDistance <= 2 && closestWord !== "") {
        foundSpellingErrors.push({ word: w, suggestion: closestWord });
      }
    }
  });

  if (foundSpellingErrors.length > 0) {
    foundSpellingErrors.forEach(err => {
      structuredErrors.push({
        category: "Lỗi chính tả (Spelling)",
        location: `"${err.word}"`,
        explanation: `Từ '${err.word}' có vẻ bị viết sai (bạn có ý định viết là '${err.suggestion}'?).`
      });
    });
  }

  // Return list of errors if any grammar/spelling issues exist
  if (structuredErrors.length > 0) {
    // Generate corrected sentence
    let corrected = trimmed;
    
    // 1. Contractions
    for (const [contra, full] of Object.entries(ACADEMIC_CONTRACTIONS)) {
      const regex = new RegExp('\\b' + contra + '\\b', 'gi');
      corrected = corrected.replace(regex, full);
    }

    // 2. Word Choice / Context
    for (const [wrongPhrase, suggestion] of Object.entries(CONTEXTUAL_WORD_CHOICES)) {
      const cleanSuggestion = suggestion.split(' / ')[0].split(' (')[0];
      const regex = new RegExp('\\b' + wrongPhrase + '\\b', 'gi');
      corrected = corrected.replace(regex, cleanSuggestion);
    }

    // 3. Subject-Verb Agreement specific cases
    corrected = corrected.replace(/\bonline learning help\b/gi, "online learning helps");
    corrected = corrected.replace(/\bdistance learning help\b/gi, "distance learning helps");
    corrected = corrected.replace(/\be-learning help\b/gi, "e-learning helps");

    // General S-V agreement
    for (const [plurVerb, singVerb] of Object.entries(VERB_PLURAL_TO_SINGULAR)) {
      const regex = new RegExp('\\b' + plurVerb + '\\b', 'gi');
      corrected = corrected.replace(regex, singVerb);
    }

    // 4. Tense Check
    for (const [past, presObj] of Object.entries(PAST_TO_PRESENT)) {
      const regex = new RegExp('\\b' + past + '\\b', 'gi');
      const hasSingularSubject = /\b(online learning|distance learning|e-learning|study|education|it)\b/i.test(corrected);
      const suggestedForm = hasSingularSubject ? presObj.sing : presObj.plur;
      corrected = corrected.replace(regex, suggestedForm);
    }

    // 5. Word Form Check
    for (const [adj, noun] of Object.entries(ADJECTIVE_TO_NOUN)) {
      const regex = new RegExp('\\b' + adj + '\\b', 'gi');
      corrected = corrected.replace(regex, noun);
    }

    // 6. Prepositions
    recipients.forEach(r => {
      const regex = new RegExp('\\bfor\\s+' + r + '\\b', 'gi');
      corrected = corrected.replace(regex, "to " + r);
    });
    corrected = corrected.replace(/\b(spend\s+\w+\s+)for\b/gi, "$1on");
    corrected = corrected.replace(/\b(spend\s+\w+\s+\w+\s+)for\b/gi, "$1on");
    corrected = corrected.replace(/\bfocus\s+(to|in|at|for)\b/gi, "focus on");
    corrected = corrected.replace(/\bparticipate\s+(on|to|at|for)\b/gi, "participate in");

    // 7. Pluralization check
    for (const [sing, plur] of Object.entries(NOUN_SINGULAR_TO_PLURAL)) {
      const regex = new RegExp('\\b' + sing + '\\b', 'gi');
      corrected = corrected.replace(regex, plur);
    }

    // 8. Spelling errors
    foundSpellingErrors.forEach(err => {
      const regex = new RegExp('\\b' + err.word + '\\b', 'gi');
      corrected = corrected.replace(regex, err.suggestion);
    });

    // 9. Capitalization start of sentence
    if (corrected.length > 0) {
      corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    }

    // 10. Capitalization inside sentence (unnecessary)
    for (let i = 1; i < rawWords.length; i++) {
      const rawWord = rawWords[i].replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '');
      if (rawWord.length > 0 && rawWord !== 'I') {
        const firstL = rawWord.charAt(0);
        if (firstL === firstL.toUpperCase() && /[A-Z]/.test(firstL)) {
          const isProperInModel = modelWords.some(mw => 
            mw === rawWord.toLowerCase() || 
            (mw.charAt(0) === mw.charAt(0).toUpperCase() && mw.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '') === rawWord)
          );
          if (!isProperInModel) {
            const regex = new RegExp('\\b' + rawWord + '\\b', 'g');
            corrected = corrected.replace(regex, rawWord.toLowerCase());
          }
        }
      }
    }

    // 11. Final punctuation
    if (corrected.length > 0 && !/[.!?]/.test(corrected.slice(-1))) {
      corrected = corrected + ".";
    }

    // Format error list HTML
    const errorsHtml = structuredErrors.map((err, idx) => `
      <div class="vstep-error-card" style="background-color: var(--panel-bg); border: 1px solid var(--panel-border); border-left: 4px solid var(--danger); padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 0.75rem; font-family: inherit;">
        <div style="font-weight: 700; font-size: 0.85rem; color: var(--danger); margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em;">LỖI ${idx + 1}</div>
        <div style="font-size: 0.9rem; margin-bottom: 0.25rem;"><strong style="color: var(--text-muted);">Loại lỗi:</strong> <span style="font-weight: 600; color: var(--text-primary);">${err.category}</span></div>
        <div style="font-size: 0.9rem; margin-bottom: 0.25rem;"><strong style="color: var(--text-muted);">Vị trí lỗi:</strong> <span style="font-family: var(--font-mono); font-size: 0.85rem; background-color: var(--input-bg); padding: 0.1rem 0.35rem; border-radius: 3px; color: var(--danger); font-weight: 500;">${err.location}</span></div>
        <div style="font-size: 0.9rem; line-height: 1.4;"><strong style="color: var(--text-muted);">Giải thích:</strong> ${err.explanation}</div>
      </div>
    `).join('');

    return {
      isCorrect: false,
      reason: `
        <div style="margin-bottom: 1rem; font-family: inherit;">
          <div style="font-weight: 700; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.25rem;">CÂU GỐC:</div>
          <div style="background-color: var(--input-bg); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--panel-border); color: var(--text-primary); font-family: var(--font-mono); font-size: 0.9rem; line-height: 1.4;">"${trimmed}"</div>
        </div>

        <div style="margin-bottom: 1rem;">
          <div style="font-weight: 700; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.5rem;">DANH SÁCH LỖI PHÁT HIỆN:</div>
          ${errorsHtml}
        </div>

        <div style="margin-bottom: 1rem; font-family: inherit;">
          <div style="font-weight: 700; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.25rem;">CÂU ĐÃ SỬA:</div>
          <div style="background-color: var(--success-bg); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--success); color: var(--text-primary); font-family: var(--font-mono); font-size: 0.95rem; font-weight: 600; line-height: 1.4;">"${corrected}"</div>
        </div>

        <div style="border-top: 1px solid var(--panel-border); padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">
          <div>KIỂM TRA CUỐI:</div>
          <div style="display: flex; gap: 1rem; color: var(--text-primary);">
            <span>Tổng số lỗi phát hiện: <strong style="color: var(--danger);">${structuredErrors.length}</strong></span>
            <span>|</span>
            <span>Tổng số lỗi đã sửa: <strong style="color: var(--success);">${structuredErrors.length}</strong></span>
          </div>
        </div>
      `
    };
  }

  // 8. Meaning / Content matching check (Permissive 70% threshold)
  // Ensure we match at least 70% of the essential words (excluding stop words) or their synonyms
  const stopWords = ['a', 'an', 'the', 'to', 'and', 'or', 'for', 'of', 'in', 'on', 'at', 'with', 'by', 'that', 'this', 'these', 'those'];
  
  const getBaseForm = (word) => {
    if (NOUN_PLURAL_TO_SINGULAR[word]) {
      return NOUN_PLURAL_TO_SINGULAR[word];
    }
    if (word.endsWith('s') && word.length > 3) {
      return word.slice(0, -1);
    }
    return word;
  };

  const inputTokens = cleanInputNoPunct.split(/\s+/).filter(w => w.length > 0);
  const modelTokens = cleanModelNoPunct.split(/\s+/).filter(w => w.length > 0);
  const essentialModelTerms = modelTokens.filter(t => !stopWords.includes(t) && t.length > 2);
  
  const synonyms = {
    'learners': ['students', 'people', 'users', 'pupils', 'learners', 'children', 'individuals'],
    'students': ['learners', 'people', 'users', 'pupils', 'students', 'children', 'individuals'],
    'helps': ['assists', 'supports', 'allows', 'enables', 'helps', 'makes'],
    'saves': ['save', 'saves'],
    'save': ['saves', 'save'],
    'online': ['digital', 'internet', 'web', 'virtual', 'e-learning'],
    'learning': ['education', 'study', 'studying', 'learning', 'courses'],
    'internet': ['online', 'network', 'web', 'digital'],
    'travel': ['go', 'commute', 'commuting', 'travel', 'move'],
    'reduce': ['cut', 'decrease', 'lower', 'reduce', 'minimize'],
    'costs': ['expenses', 'spending', 'fees', 'costs', 'prices']
  };

  let matchedTerms = 0;
  
  essentialModelTerms.forEach(term => {
    const baseTerm = getBaseForm(term);
    
    // Check exact term
    if (inputTokens.includes(term)) {
      matchedTerms++;
      return;
    }
    const termSynonyms = synonyms[term] || [];
    const hasSynonym = termSynonyms.some(syn => inputTokens.includes(syn));
    if (hasSynonym) {
      matchedTerms++;
    }
  });
  
  const matchRatio = matchedTerms / essentialModelTerms.length;
  if (matchRatio >= 0.70) {
    return { isCorrect: true, feedback: "Chính xác! Câu của bạn đúng ngữ pháp, dấu câu và truyền tải đầy đủ ý nghĩa gốc." };
  } else {
    return {
      isCorrect: false,
      reason: `
        <div style="margin-bottom: 1rem; font-family: inherit;">
          <div style="font-weight: 700; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.25rem;">CÂU GỐC:</div>
          <div style="background-color: var(--input-bg); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--panel-border); color: var(--text-primary); font-family: var(--font-mono); font-size: 0.9rem; line-height: 1.4;">"${trimmed}"</div>
        </div>

        <div style="margin-bottom: 1rem;">
          <div style="font-weight: 700; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.5rem;">DANH SÁCH LỖI PHÁT HIỆN:</div>
          <div class="vstep-error-card" style="background-color: var(--panel-bg); border: 1px solid var(--panel-border); border-left: 4px solid var(--danger); padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 0.75rem; font-family: inherit;">
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--danger); margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em;">LỖI 1</div>
            <div style="font-size: 0.9rem; margin-bottom: 0.25rem;"><strong style="color: var(--text-muted);">Loại lỗi:</strong> <span style="font-weight: 600; color: var(--text-primary);">Lỗi cấu trúc câu (Sentence Structure)</span></div>
            <div style="font-size: 0.9rem; margin-bottom: 0.25rem;"><strong style="color: var(--text-muted);">Vị trí lỗi:</strong> <span style="font-family: var(--font-mono); font-size: 0.85rem; background-color: var(--input-bg); padding: 0.1rem 0.35rem; border-radius: 3px; color: var(--danger); font-weight: 500;">Cả câu</span></div>
            <div style="font-size: 0.9rem; line-height: 1.4;"><strong style="color: var(--text-muted);">Giải thích:</strong> Chưa diễn đạt đúng nghĩa gốc hoặc thiếu ý quan trọng của câu mẫu.</div>
          </div>
        </div>

        <div style="margin-bottom: 1rem; font-family: inherit;">
          <div style="font-weight: 700; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.25rem;">CÂU ĐÃ SỬA:</div>
          <div style="background-color: var(--success-bg); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--success); color: var(--text-primary); font-family: var(--font-mono); font-size: 0.95rem; font-weight: 600; line-height: 1.4;">"${modelAnswer}"</div>
        </div>

        <div style="border-top: 1px solid var(--panel-border); padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">
          <div>KIỂM TRA CUỐI:</div>
          <div style="display: flex; gap: 1rem; color: var(--text-primary);">
            <span>Tổng số lỗi phát hiện: <strong style="color: var(--danger);">1</strong></span>
            <span>|</span>
            <span>Tổng số lỗi đã sửa: <strong style="color: var(--success);">1</strong></span>
          </div>
        </div>
      `
    };
  }
}

function switchResourceTab(tabName) {
  // Update tabs active state
  document.querySelectorAll('.resource-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    const label = btn.innerText.toLowerCase();
    if ((tabName === 'prompt' && label.includes('đề')) || (tabName === 'vocab' && label.includes('từ'))) {
      btn.classList.add('active');
    }
  });
  
  // Show section
  document.querySelectorAll('.resource-pane-section').forEach(sec => {
    sec.classList.remove('active');
  });
  
  let targetSec = 'prompt';
  if (tabName === 'vocab') targetSec = 'vocab';
  
  const secEl = document.getElementById(`resource-sec-${targetSec}`);
  if (secEl) secEl.classList.add('active');
}

// Render Outline accordion nodes
function renderOutline() {
  const container = document.getElementById('ws-outline-container');
  if (!container) return;
  container.innerHTML = '';
  
  const topic = currentTopic;
  if (!topic || !topic.has_full_details || !topic.details) {
    container.innerHTML = '<div class="empty-state">Chưa có dàn ý chi tiết mẫu. Hãy tự xây dựng bài viết dựa trên cấu trúc chuẩn của thể loại này!</div>';
    return;
  }
  
  // Get ideas based on B1 or B2 level selection
  const ideasObj = currentOutlineLevel === 'B1' ? topic.details.ideas_b1 : topic.details.ideas_b2;
  if (!ideasObj) return;
  
  // Set pills active states
  const b1Pill = document.getElementById('ws-level-b1-pill');
  const b2Pill = document.getElementById('ws-level-b2-pill');
  if (b1Pill && b2Pill) {
    if (currentOutlineLevel === 'B1') {
      b1Pill.classList.add('active');
      b2Pill.classList.remove('active');
    } else {
      b2Pill.classList.add('active');
      b1Pill.classList.remove('active');
    }
  }
  
  // Render benefits (or causes)
  const isCausesSolutions = currentCategory.id === 2;
  const isOpinion = currentCategory.id === 3;
  const isDiscussion = currentCategory.id === 4;
  const benefitLabel = isCausesSolutions ? "CAUSES (NGUYÊN NHÂN)" : (isOpinion ? "REASONS (LÝ DO)" : (isDiscussion ? "VIEW 01 (QUAN ĐIỂM 1)" : "ADVANTAGES (LỢI ÍCH)"));
  const drawbackLabel = isCausesSolutions ? "SOLUTIONS (GIẢI PHÁP)" : (isOpinion ? "REASONS (LÝ DO)" : (isDiscussion ? "VIEW 02 (QUAN ĐIỂM 2)" : "DISADVANTAGES (BẤT LỢI)"));
  
  if (ideasObj.benefits && ideasObj.benefits.length > 0) {
    ideasObj.benefits.forEach((item, idx) => {
      const node = document.createElement('div');
      node.className = 'outline-node';
      const nodeBodyId = `outline-node-benefit-${idx}`;
      
      node.innerHTML = `
        <div class="outline-node-header benefit" onclick="toggleAccordion('${nodeBodyId}')">
          <span>${item.title || `${benefitLabel} 0${idx+1}`}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        <div class="outline-node-body" id="${nodeBodyId}" style="display: none;">
          <div class="outline-point">Luận điểm: ${item.point_vi}</div>
          <div style="font-style: italic; color: var(--text-secondary); margin-bottom: 0.5rem;">→ ${item.point_en}</div>
          
          <div class="outline-point">Luận cứ:</div>
          <div class="outline-desc">${item.evidence_vi}</div>
          <div class="outline-desc" style="font-style: italic; margin-top: 0.25rem;">${item.evidence_en}</div>
        </div>
      `;
      container.appendChild(node);
    });
  }
  
  // Render drawbacks (or solutions)
  if (ideasObj.drawbacks && ideasObj.drawbacks.length > 0) {
    ideasObj.drawbacks.forEach((item, idx) => {
      const node = document.createElement('div');
      node.className = 'outline-node';
      const nodeBodyId = `outline-node-drawback-${idx}`;
      
      node.innerHTML = `
        <div class="outline-node-header drawback" onclick="toggleAccordion('${nodeBodyId}')">
          <span>${item.title || `${drawbackLabel} 0${idx+1}`}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        <div class="outline-node-body" id="${nodeBodyId}" style="display: none;">
          <div class="outline-point">Luận điểm: ${item.point_vi}</div>
          <div style="font-style: italic; color: var(--text-secondary); margin-bottom: 0.5rem;">→ ${item.point_en}</div>
          
          <div class="outline-point">Luận cứ:</div>
          <div class="outline-desc">${item.evidence_vi}</div>
          <div class="outline-desc" style="font-style: italic; margin-top: 0.25rem;">${item.evidence_en}</div>
        </div>
      `;
      container.appendChild(node);
    });
  }
}

// Toggle accordion items in outlines
function toggleAccordion(id) {
  const element = document.getElementById(id);
  if (!element) return;
  if (element.style.display === 'none') {
    element.style.display = 'flex';
  } else {
    element.style.display = 'none';
  }
}

// Switch outline level (B1 vs B2)
function switchOutlineLevel(level) {
  currentOutlineLevel = level;
  renderOutline();
}

// Render Vietnamese Outline View
function renderVietnameseOutline() {
  const container = document.getElementById('ws-vietnamese-outline-container');
  if (!container) return;
  container.innerHTML = '';
  
  const topic = currentTopic;
  if (!topic || !topic.has_full_details || !topic.details) {
    container.innerHTML = '<div class="empty-state">Chủ đề này viết tự do, bạn có thể tự xây dựng ý tưởng nháp nháp tiếng Việt trước khi bắt đầu viết luận tiếng Anh.</div>';
    return;
  }
  
  const ideasObj = topic.details.ideas_b1; // Default to B1 for simple Vietnamese hints
  
  const div = document.createElement('div');
  div.className = 'prompt-card';
  div.innerHTML = `
    <h5 style="margin-bottom: 0.75rem;">Gợi ý cấu trúc dàn bài chi tiết:</h5>
    <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-secondary);">
      <p><strong>1. Mở bài (Introduction):</strong></p>
      <ul style="padding-left: 1rem; margin-bottom: 0.75rem;">
        <li>Dẫn dắt chủ đề (Paraphrase lại đề bài)</li>
        <li>Tuyên bố luận đề (Nêu rõ mục đích bài viết - thảo luận cả hai khía cạnh và nêu quan điểm cá nhân)</li>
      </ul>
      
      <p><strong>2. Thân bài 1 (Body Paragraph 1):</strong></p>
      <ul style="padding-left: 1rem; margin-bottom: 0.75rem;">
        <li>Nêu ý chính thứ nhất (Lợi ích / Nguyên nhân / Mặt đồng ý):
          <br><span style="color: var(--text-primary); font-weight: 500;">- ${ideasObj.benefits[0].point_vi}</span>
        </li>
        <li>Ý phụ bổ sung lý giải:
          <br><span>- ${ideasObj.benefits[0].evidence_vi}</span>
        </li>
        ${ideasObj.benefits[1] ? `
        <li style="margin-top: 0.25rem;">Nêu ý chính thứ hai:
          <br><span style="color: var(--text-primary); font-weight: 500;">- ${ideasObj.benefits[1].point_vi}</span>
        </li>
        <li>Ý phụ bổ sung lý giải:
          <br><span>- ${ideasObj.benefits[1].evidence_vi}</span>
        </li>
        ` : ''}
      </ul>
      
      <p><strong>3. Thân bài 2 (Body Paragraph 2):</strong></p>
      <ul style="padding-left: 1rem; margin-bottom: 0.75rem;">
        <li>Nêu ý chính bất lợi/giải pháp đầu tiên:
          <br><span style="color: var(--text-primary); font-weight: 500;">- ${ideasObj.drawbacks[0].point_vi}</span>
        </li>
        <li>Ý phụ bổ sung lý giải:
          <br><span>- ${ideasObj.drawbacks[0].evidence_vi}</span>
        </li>
        ${ideasObj.drawbacks[1] ? `
        <li style="margin-top: 0.25rem;">Nêu ý phụ thứ hai:
          <br><span style="color: var(--text-primary); font-weight: 500;">- ${ideasObj.drawbacks[1].point_vi}</span>
        </li>
        <li>Ý phụ bổ sung lý giải:
          <br><span>- ${ideasObj.drawbacks[1].evidence_vi}</span>
        </li>
        ` : ''}
      </ul>
      
      <p><strong>4. Kết bài (Conclusion):</strong></p>
      <ul style="padding-left: 1rem;">
        <li>Khẳng định lại vấn đề (Tóm tắt lại các điểm chính của hai đoạn thân bài)</li>
        <li>Ý kiến hoặc khuyến nghị cuối cùng của bản thân</li>
      </ul>
    </div>
  `;
  container.appendChild(div);
}

// --- Timer Controllers ---
function startTimer() {
  if (isTimerRunning) return;
  isTimerRunning = true;
  
  const timerBtn = document.getElementById('timer-toggle-btn');
  // Update timer SVG to pause icon
  document.getElementById('timer-icon-svg').innerHTML = `<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />`;
  
  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
    } else {
      stopTimer();
      showToast("⏰ Hết thời gian làm bài thi 40 phút! Hãy kiểm tra và nộp bài viết nhé.", "warning");
    }
  }, 1000);
}

function stopTimer() {
  if (!isTimerRunning) return;
  isTimerRunning = false;
  clearInterval(timerInterval);
  
  // Update timer SVG to play icon
  document.getElementById('timer-icon-svg').innerHTML = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />`;
}

function toggleTimer() {
  if (isTimerRunning) {
    stopTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  stopTimer();
  timerSeconds = 40 * 60;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('timer-text').innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- Manual Progress Save System ---
function saveProgressAction() {
  if (!currentCategory || !currentTopic) return;
  
  // 1. Save all Step 2 translation inputs
  const inputs = document.querySelectorAll('.trans-input-area');
  inputs.forEach((input) => {
    const parts = input.id.split('-');
    if (parts.length === 3) {
      const idx = parts[2];
      const text = input.value;
      const inputKey = `trans_input_${currentCategory.id}_${currentTopic.id}_${currentTransLevel}_${idx}`;
      localStorage.setItem(inputKey, text);
    }
  });

  // 2. Save Step 3 essay textarea
  const text = document.getElementById('essay-textarea').value;
  if (text.trim() || inputs.length > 0) {
    const key = `draft_${currentCategory.id}_${currentTopic.id}`;
    if (text.trim()) {
      localStorage.setItem(key, text);
    }
  }
  
  // Update UI and state
  updateStats();
  isDirty = false;
  showToast("💾 Đã lưu tiến độ bài làm thành công!", "success");
}

// --- Textarea helper functions ---
function clearProgressAction() {
  if (!currentCategory || !currentTopic) return;
  
  if (confirm("Bạn có chắc chắn muốn xóa toàn bộ bản lưu và nội dung hiện tại của đề bài này? Hành động này không thể khôi phục.")) {
    // 1. Clear Step 2 DOM and localStorage
    const inputs = document.querySelectorAll('.trans-input-area');
    inputs.forEach((input) => {
      input.value = '';
    });

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`trans_input_${currentCategory.id}_${currentTopic.id}_`)) {
        localStorage.removeItem(k);
      }
    }

    // 2. Clear Step 3 DOM and localStorage
    const textarea = document.getElementById('essay-textarea');
    if (textarea) {
      textarea.value = '';
    }
    const key = `draft_${currentCategory.id}_${currentTopic.id}`;
    localStorage.removeItem(key);
    
    // 3. Update UI and State
    isDirty = false;
    updateWordCount();
    updateStats();
    showToast("Đã xóa bản lưu và làm mới tiến độ bài làm!", "success");
  }
}

function copyToClipboard() {
  const text = document.getElementById('essay-textarea').value;
  if (!text.trim()) {
    showToast("Nội dung trống, không thể sao chép!", "warning");
    return;
  }
  
  navigator.clipboard.writeText(text).then(() => {
    showToast("📋 Đã sao chép bài viết vào Clipboard của hệ thống!", "success");
  }).catch(() => {
    showToast("Không thể sao chép tự động. Vui lòng tự bôi đen và sao chép.", "danger");
  });
}

function updateWordCount() {
  isDirty = true;
  const text = document.getElementById('essay-textarea').value;
  
  // Calculate words
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  const chars = text.length;
  
  document.getElementById('words-typed').innerText = words;
  document.getElementById('char-count-display').innerText = `${chars} ký tự`;
  
  // Update progress bar
  const target = 250;
  const progressPercent = Math.min(100, (words / target) * 100);
  const progressBar = document.getElementById('word-progress-fill');
  progressBar.style.width = `${progressPercent}%`;
  
  if (words >= target) {
    progressBar.classList.add('target-met');
  } else {
    progressBar.classList.remove('target-met');
  }
}

// --- Simulated AI Grading & Assessment Engine ---

// --- Sentence Segmenter for Error Detection Mode ---
function segmentSentences(text) {
  if (!text) return [];
  const abbreviations = ["e.g.", "i.e.", "etc.", "a.m.", "p.m.", "dr.", "mr.", "mrs.", "vs.", "st.", "prof."];
  let sentences = [];
  let currentStart = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '.' || char === '!' || char === '?') {
      const nextChar = text[i + 1];
      if (!nextChar || /\s/.test(nextChar)) {
        let wordStart = i - 1;
        while (wordStart >= currentStart && /[\w]/.test(text[wordStart])) {
          wordStart--;
        }
        wordStart++;
        const precedingWord = text.slice(wordStart, i + 1).toLowerCase();
        
        let checkLonger = text.slice(Math.max(currentStart, i - 4), i + 1).toLowerCase();
        let isAbbrev = false;
        for (const abbrev of abbreviations) {
          if (precedingWord === abbrev || checkLonger.endsWith(abbrev)) {
            isAbbrev = true;
            break;
          }
        }
        
        if (!isAbbrev) {
          sentences.push(text.slice(currentStart, i + 1));
          currentStart = i + 1;
          while (currentStart < text.length && /\s/.test(text[currentStart])) {
            currentStart++;
          }
          i = currentStart - 1;
        }
      }
    }
  }
  
  if (currentStart < text.length) {
    const lastPart = text.slice(currentStart).trim();
    if (lastPart.length > 0) {
      sentences.push(lastPart);
    }
  }
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

// --- Word-by-Word Sentence Error Analyzer ---
function analyzeSentenceErrors(sentenceStr) {
  const trimmed = sentenceStr.trim();
  if (trimmed === "") return { errors: [], corrected: "" };
  
  const errors = [];
  const lowerSentence = trimmed.toLowerCase();
  
  const rawWords = trimmed.split(/\s+/).filter(w => w.length > 0);
  
  // 1. Capitalization (Sentence Structure)
  const firstChar = trimmed.charAt(0);
  if (/[a-z]/.test(firstChar)) {
    errors.push({
      errorType: "Sentence Structure (Viết hoa)",
      incorrect: firstChar,
      explanation: "Chữ cái đầu tiên của câu tiếng Anh phải được viết hoa.",
      correction: firstChar.toUpperCase(),
      impact: "Minor"
    });
  }
  
  for (let i = 1; i < rawWords.length; i++) {
    const rawWord = rawWords[i].replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '');
    if (rawWord.length > 0 && rawWord !== 'I') {
      const firstL = rawWord.charAt(0);
      if (firstL === firstL.toUpperCase() && /[A-Z]/.test(firstL)) {
        const clean = rawWord.toLowerCase();
        if (COMMON_ENGLISH_WORDS.has(clean)) {
          errors.push({
            errorType: "Sentence Structure (Viết hoa)",
            incorrect: rawWord,
            explanation: `Từ '${rawWord}' ở giữa câu không thuộc nhóm danh từ riêng, không cần viết hoa chữ cái đầu.`,
            correction: clean,
            impact: "Minor"
          });
        }
      }
    }
  }
  
  // 2. Punctuation (Sentence Structure)
  const lastChar = trimmed.slice(-1);
  if (!/[.!?]/.test(lastChar)) {
    errors.push({
      errorType: "Sentence Structure (Dấu câu)",
      incorrect: "Thiếu dấu câu cuối câu",
      explanation: "Câu viết chưa có dấu kết thúc. Vui lòng thêm dấu chấm (.) ở cuối câu.",
      correction: ".",
      impact: "Minor"
    });
  }
  
  const punctuationSpaceRegex = /\s+([,;.!?])/g;
  let punctMatch;
  while ((punctMatch = punctuationSpaceRegex.exec(trimmed)) !== null) {
    errors.push({
      errorType: "Sentence Structure (Dấu câu)",
      incorrect: punctMatch[0],
      explanation: "Quy tắc viết dấu câu tiếng Anh không cho phép khoảng trắng trước dấu câu.",
      correction: punctMatch[1],
      impact: "Minor"
    });
  }
  
  // 3. Contractions (Vocabulary)
  for (let i = 0; i < rawWords.length; i++) {
    const rawWord = rawWords[i];
    const cleanWord = rawWord.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
    if (ACADEMIC_CONTRACTIONS[cleanWord]) {
      errors.push({
        errorType: "Vocabulary (Academic Style)",
        incorrect: rawWord,
        explanation: `Từ viết tắt '${rawWord}' không phù hợp với văn phong bài viết học thuật VSTEP. Nên viết đầy đủ dạng trang trọng hơn.`,
        correction: ACADEMIC_CONTRACTIONS[cleanWord],
        impact: "Minor"
      });
    }
  }
  
  // 4. Collocations (Collocation)
  for (const [wrongPhrase, suggestion] of Object.entries(CONTEXTUAL_WORD_CHOICES)) {
    const regex = new RegExp('\\b' + wrongPhrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
    if (regex.test(lowerSentence)) {
      errors.push({
        errorType: "Collocation",
        incorrect: wrongPhrase,
        explanation: `Cụm từ '${wrongPhrase}' chưa chuẩn tự nhiên trong tiếng Anh. Nên thay thế để tăng tính chuyên nghiệp.`,
        correction: suggestion.split(' / ')[0].split(' (')[0],
        impact: "Moderate"
      });
    }
  }
  
  // 5. Spelling (Vocabulary)
  const dict = getValidWordDictionary();
  dict.add("vstep");
  dict.add("ielts");
  dict.add("toefl");
  
  for (let i = 0; i < rawWords.length; i++) {
    const rawWord = rawWords[i];
    const cleanWord = rawWord.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
    if (cleanWord.length === 0 || /[0-9]/.test(cleanWord) || ACADEMIC_CONTRACTIONS[cleanWord]) continue;
    
    const isCapitalizedMiddle = i > 0 && rawWord[0] === rawWord[0].toUpperCase() && rawWord !== "I";
    if (isCapitalizedMiddle && !COMMON_ENGLISH_WORDS.has(cleanWord)) continue;
    
    // Check hyphenated/slashed compound words
    let isCompoundWordValid = false;
    if (cleanWord.includes('-') || cleanWord.includes('/')) {
      const parts = cleanWord.split(/[-/]/);
      isCompoundWordValid = parts.every(part => {
        const p = part.trim();
        return p.length === 0 || dict.has(p) || p.length <= 2 || /^[0-9]+$/.test(p);
      });
    }
    
    if (!dict.has(cleanWord) && !isCompoundWordValid) {
      let closestWord = "";
      let minDistance = 999;
      dict.forEach(dictWord => {
        if (Math.abs(dictWord.length - cleanWord.length) <= 2) {
          const dist = getLevenshteinDistance(cleanWord, dictWord);
          if (dist < minDistance) {
            minDistance = dist;
            closestWord = dictWord;
          }
        }
      });
      
      let correction = "";
      let explanation = "";
      if (minDistance <= 2 && closestWord !== "") {
        correction = closestWord;
        explanation = `Từ '${rawWord}' có vẻ bị viết sai chính tả. Phải chăng bạn muốn viết là '${closestWord}'?`;
      } else {
        correction = cleanWord;
        explanation = `Từ '${rawWord}' viết sai chính tả hoặc không tồn tại trong từ điển chuẩn tiếng Anh.`;
      }
      
      errors.push({
        errorType: "Vocabulary (Spelling)",
        incorrect: rawWord,
        explanation: explanation,
        correction: correction,
        impact: "Minor"
      });
    }
  }
  
  // 6. Prepositions (Article/Preposition)
  const spendRegex = /\b(spend\s+(?:time|money|costs|hours|days|energy|resources)\s+)(for)\b/i;
  const spendMatch = spendRegex.exec(trimmed);
  if (spendMatch) {
    errors.push({
      errorType: "Article/Preposition",
      incorrect: "for",
      explanation: "Cấu trúc 'spend time/money' đi với giới từ 'on' để liên kết danh từ, không sử dụng 'for'.",
      correction: "on",
      impact: "Moderate"
    });
  }
  
  const focusRegex = /\bfocus\s+(?:more\s+)?(to|in|at|for)\b/i;
  const focusMatch = focusRegex.exec(trimmed);
  if (focusMatch) {
    errors.push({
      errorType: "Article/Preposition",
      incorrect: focusMatch[1],
      explanation: "Động từ 'focus' đi kèm giới từ 'on' (focus on something).",
      correction: "on",
      impact: "Moderate"
    });
  }
  
  const participateRegex = /\bparticipate\s+(on|to|at|for)\b/i;
  const participateMatch = participateRegex.exec(trimmed);
  if (participateMatch) {
    errors.push({
      errorType: "Article/Preposition",
      incorrect: participateMatch[1],
      explanation: "Động từ 'participate' đi kèm giới từ 'in' (participate in something).",
      correction: "in",
      impact: "Moderate"
    });
  }
  
  // Article/determiner check: "technical problem is/was" -> "a technical problem is/was"
  const techProblemRegex = /\b(technical\s+problem)\s+(is|was)\b/i;
  const techProblemMatch = techProblemRegex.exec(trimmed);
  if (techProblemMatch) {
    errors.push({
      errorType: "Article/Preposition",
      incorrect: "technical problem",
      explanation: `Danh từ đếm được số ít 'technical problem' cần có mạo từ 'a' đi kèm ở phía trước.`,
      correction: "a technical problem",
      impact: "Minor"
    });
  }
  
  // 7. Word Form (Word Form)
  const verbAdjRegex = /\b(bring|brings|offer|offers|provide|provides|have|has|get|gets|show|shows|gain|gains)\s+(flexible|convenient|independent|distracted|isolated|interacted|difficult|expensive|costly)\b/i;
  const verbAdjMatch = verbAdjRegex.exec(trimmed);
  if (verbAdjMatch) {
    const adj = verbAdjMatch[2].toLowerCase();
    const noun = ADJECTIVE_TO_NOUN[adj] || adj;
    errors.push({
      errorType: "Word Form",
      incorrect: verbAdjMatch[2],
      explanation: `Từ '${verbAdjMatch[2]}' là tính từ. Cần sử dụng dạng danh từ '${noun}' làm tân ngữ của động từ '${verbAdjMatch[1]}'.`,
      correction: noun,
      impact: "Serious"
    });
  }
  
  // 8. Subject-Verb Agreement (Grammar)
  const ADVERBS = ["always", "often", "usually", "sometimes", "rarely", "seldom", "never", "greatly", "strongly", "actively", "directly", "indirectly", "successfully", "easily", "actually", "probably", "certainly", "definitely", "highly", "fully", "totally", "completely"];
  const adverbPattern = '(?:(?:' + ADVERBS.join('|') + ')\\s+)?';

  for (const subj of ["online learning", "distance learning", "e-learning", "it", "he", "she", "this", "that", "education", "study", "connection", "platform", "benefit", "drawback", "problem", "solution", "learner", "student", "teacher", "school", "parent", "child", "peer", "friend"]) {
    const subjIdx = lowerSentence.indexOf(subj);
    if (subjIdx !== -1) {
      for (const [plurVerb, singVerb] of Object.entries(VERB_PLURAL_TO_SINGULAR)) {
        const verbRegex = new RegExp('\\b' + subj + '\\s+' + adverbPattern + plurVerb + '\\b', 'i');
        if (verbRegex.test(trimmed)) {
          errors.push({
            errorType: "Grammar (Subject-Verb Agreement)",
            incorrect: plurVerb,
            explanation: `Chủ ngữ ngôi thứ ba số ít '${subj}' đi với động từ chia số nhiều '${plurVerb}'. Cần chia số ít là '${singVerb}'.`,
            correction: singVerb,
            impact: "Moderate"
          });
        }
      }
    }
  }
  
  for (const subj of ["learners", "students", "teachers", "schools", "parents", "children", "peers", "friends", "people", "they", "we", "connections", "platforms", "benefits", "drawbacks", "problems", "solutions"]) {
    const subjIdx = lowerSentence.indexOf(subj);
    if (subjIdx !== -1) {
      for (const [singVerb, plurVerb] of Object.entries(VERB_SINGULAR_TO_PLURAL)) {
        const verbRegex = new RegExp('\\b' + subj + '\\s+' + adverbPattern + singVerb + '\\b', 'i');
        if (verbRegex.test(trimmed)) {
          errors.push({
            errorType: "Grammar (Subject-Verb Agreement)",
            incorrect: singVerb,
            explanation: `Chủ ngữ số nhiều '${subj}' đi với động từ chia số ít '${singVerb}'. Cần chia số nhiều là '${plurVerb}'.`,
            correction: plurVerb,
            impact: "Moderate"
          });
        }
      }
    }
  }

  // S-V agreement in compound predicate: "it is ... and [plural verb]" -> "[singular verb]"
  const compoundSingRegex = /\b(it|he|she|this|that|online learning|distance learning|e-learning)\s+(?:is|was)\s+([\w\s]{1,15})\s+and\s+(become|have|save|provide|make|do|go|help|affect|bring)\b/i;
  const compoundSingMatch = compoundSingRegex.exec(trimmed);
  if (compoundSingMatch) {
    const plurVerb = compoundSingMatch[3].toLowerCase();
    const singVerb = VERB_PLURAL_TO_SINGULAR[plurVerb] || (plurVerb + 's');
    errors.push({
      errorType: "Grammar (Subject-Verb Agreement)",
      incorrect: plurVerb,
      explanation: `Chủ ngữ ngôi thứ ba số ít '${compoundSingMatch[1]}' đi với động từ chia số nhiều '${plurVerb}' sau từ nối 'and'. Cần chia số ít là '${singVerb}'.`,
      correction: singVerb,
      impact: "Moderate"
    });
  }

  // S-V agreement with relative pronoun: "who/that + plural verb" preceded by singular noun
  const relSingRegex = /\b(student|learner|person|child|parent|teacher|peer|friend)\s+(who|that)\s+(become|have|live|save|provide|make|do|go|help|affect|bring)\b/i;
  const relSingMatch = relSingRegex.exec(trimmed);
  if (relSingMatch) {
    const plurVerb = relSingMatch[3].toLowerCase();
    const singVerb = VERB_PLURAL_TO_SINGULAR[plurVerb] || (plurVerb + 's');
    errors.push({
      errorType: "Grammar (Subject-Verb Agreement)",
      incorrect: plurVerb,
      explanation: `Mệnh đề quan hệ bổ nghĩa cho danh từ số ít '${relSingMatch[1]}' phải đi với động từ số ít '${singVerb}', không dùng '${plurVerb}'.`,
      correction: singVerb,
      impact: "Moderate"
    });
  }

  // Clause-modifying "which + plural verb" -> "which + singular verb"
  const relWhichRegex = /\bwhich\s+(affect|make|cause|help|provide|lead|bring|allow|do|go)\b/i;
  const relWhichMatch = relWhichRegex.exec(trimmed);
  if (relWhichMatch) {
    const plurVerb = relWhichMatch[1].toLowerCase();
    const singVerb = VERB_PLURAL_TO_SINGULAR[plurVerb] || (plurVerb + 's');
    errors.push({
      errorType: "Grammar (Subject-Verb Agreement)",
      incorrect: plurVerb,
      explanation: `Đại từ quan hệ 'which' thay thế cho một mệnh đề/sự việc ở trước phải đi với động từ chia số ít '${singVerb}'.`,
      correction: singVerb,
      impact: "Moderate"
    });
  }
  
  // 9. Verb Tense (Grammar)
  for (let i = 0; i < rawWords.length; i++) {
    const rawWord = rawWords[i];
    const cleanWord = rawWord.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
    if (PAST_TO_PRESENT[cleanWord]) {
      const presForms = PAST_TO_PRESENT[cleanWord];
      const hasSingularSubject = /\b(online learning|distance learning|e-learning|study|education|it|he|she)\b/i.test(trimmed);
      const suggestedForm = hasSingularSubject ? presForms.sing : presForms.plur;
      
      errors.push({
        errorType: "Grammar (Verb Tense)",
        incorrect: rawWord,
        explanation: `Trong văn phong nghị luận học thuật VSTEP về chủ đề thực tế, nên dùng thì Hiện tại Đơn thay vì Quá khứ Đơn '${rawWord}'.`,
        correction: suggestedForm,
        impact: "Moderate"
      });
    }
  }
  
  // 10. Pluralization (Grammar)
  const DETERMINERS = ['a', 'an', 'the', 'each', 'every', 'one', 'another', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'our', 'their', 'no', 'any', 'some', 'many', 'all', 'few', 'several'];
  for (let i = 0; i < rawWords.length; i++) {
    const rawWord = rawWords[i];
    const cleanWord = rawWord.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
    if (NOUN_SINGULAR_TO_PLURAL[cleanWord]) {
      const pluralForm = NOUN_SINGULAR_TO_PLURAL[cleanWord];
      
      let hasDeterminer = false;
      for (let j = Math.max(0, i - 3); j < i; j++) {
        const w = rawWords[j].toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
        if (DETERMINERS.includes(w) || w.endsWith('ing') || ['at', 'in', 'to', 'by', 'for', 'with', 'from', 'as', 'of', 'on', 'about', 'without', 'after', 'before', 'during', 'into', 'onto', 'upon', 'over', 'under', 'through', 'between', 'among'].includes(w)) {
          hasDeterminer = true;
          break;
        }
      }
      
      if (!hasDeterminer) {
        errors.push({
          errorType: "Grammar (Singular/Plural)",
          incorrect: rawWord,
          explanation: `Danh từ đếm được '${rawWord}' dùng ở nghĩa chung chung nên để ở dạng số nhiều '${pluralForm}' hoặc thêm từ hạn định.`,
          correction: pluralForm,
          impact: "Minor"
        });
      }
    }
  }

  // 11. Verb Pattern (Grammar)
  const verbPatternRegex = /\b(avoid|suggest|mind|enjoy|practice|keep)\s+to\s+([a-z]+)\b/i;
  const verbPatternMatch = verbPatternRegex.exec(trimmed);
  if (verbPatternMatch) {
    const verb = verbPatternMatch[1].toLowerCase();
    const action = verbPatternMatch[2].toLowerCase();
    let gerund = action;
    if (action.endsWith('e') && !action.endsWith('ee')) {
      gerund = action.slice(0, -1) + 'ing';
    } else if (action.endsWith('y')) {
      gerund = action + 'ing';
    } else if (/[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(action) && !/[aeiou]{2}[bcdfghjklmnpqrstvwxyz]$/.test(action)) {
      if (action.length <= 4) {
        gerund = action + action.slice(-1) + 'ing';
      } else {
        gerund = action + 'ing';
      }
    } else {
      gerund = action + 'ing';
    }
    errors.push({
      errorType: "Grammar (Verb Pattern)",
      incorrect: `to ${verbPatternMatch[2]}`,
      explanation: `Động từ '${verb}' đi sau bởi dạng danh động từ (Gerund - V-ing), không dùng động từ nguyên mẫu có 'to'.`,
      correction: gerund,
      impact: "Serious"
    });
  }
  
  const spendPatternRegex = /\b(spend|spends|spent|waste|wastes|wasted)\s+([\w\s]{1,15})\s+to\s+([a-z]+)\b/i;
  const spendPatternMatch = spendPatternRegex.exec(trimmed);
  if (spendPatternMatch && !/\b(money|time|hours|days|energy|resources|costs)\b/i.test(spendPatternMatch[3])) {
    const action = spendPatternMatch[3].toLowerCase();
    let gerund = action;
    if (action.endsWith('e') && !action.endsWith('ee')) {
      gerund = action.slice(0, -1) + 'ing';
    } else {
      gerund = action + 'ing';
    }
    errors.push({
      errorType: "Grammar (Verb Pattern)",
      incorrect: `to ${spendPatternMatch[3]}`,
      explanation: `Cấu trúc 'spend/waste + time/money' đi kèm danh động từ (V-ing), không sử dụng 'to + Verb'.`,
      correction: gerund,
      impact: "Serious"
    });
  }

  // Check "need + base verb" -> "need to + base verb"
  const needPatternRegex = /\b(need|needs|needed)\s+(go|study|learn|have|do|take|make|provide|attend|focus)\b/i;
  const needPatternMatch = needPatternRegex.exec(trimmed);
  if (needPatternMatch) {
    errors.push({
      errorType: "Grammar (Verb Pattern)",
      incorrect: `${needPatternMatch[1]} ${needPatternMatch[2]}`,
      explanation: `Động từ '${needPatternMatch[1]}' phải đi kèm với 'to + Verb' để biểu thị nhu cầu cần làm gì.`,
      correction: `${needPatternMatch[1]} to ${needPatternMatch[2]}`,
      impact: "Serious"
    });
  }

  // 12. Relative Clauses (Grammar)
  const relPeopleRegex = /\b(people|learners?|students?|teachers?|parents?|children|kids?|peers?)\s+(which)\b/i;
  const relPeopleMatch = relPeopleRegex.exec(trimmed);
  if (relPeopleMatch) {
    errors.push({
      errorType: "Grammar (Relative Clause)",
      incorrect: "which",
      explanation: `Đại từ quan hệ chỉ người '${relPeopleMatch[1]}' phải dùng 'who' hoặc 'that', không dùng 'which'.`,
      correction: "who",
      impact: "Serious"
    });
  }
  
  const relThingRegex = /\b(devices?|computers?|phones?|schools?|things?|benefits?|drawbacks?|problems?|solutions?|courses?|networks?|opportunities?|advantages?|disadvantages?)\s+(who)\b/i;
  const relThingMatch = relThingRegex.exec(trimmed);
  if (relThingMatch) {
    errors.push({
      errorType: "Grammar (Relative Clause)",
      incorrect: "who",
      explanation: `Đại từ quan hệ chỉ vật '${relThingMatch[1]}' phải dùng 'which' hoặc 'that', không dùng 'who'.`,
      correction: "which",
      impact: "Serious"
    });
  }

  // Sentence Structure check: "make students difficult to join" -> "make it difficult for students to join"
  const makeAdjRegex = /\bmake\s+([\w\s]{1,20}?)\s+(difficult|easy|possible|impossible)\s+to\s+([a-z]+)\b/i;
  const makeAdjMatch = makeAdjRegex.exec(trimmed);
  if (makeAdjMatch) {
    errors.push({
      errorType: "Sentence Structure",
      incorrect: makeAdjMatch[0],
      explanation: `Cấu trúc 'make + tân ngữ + tính từ + to Verb' không chuẩn. Phải dùng cấu trúc chủ ngữ giả: 'make it + tính từ + for + tân ngữ + to Verb'.`,
      correction: `make it ${makeAdjMatch[2]} for ${makeAdjMatch[1].trim()} to ${makeAdjMatch[3]}`,
      impact: "Serious"
    });
  }

  // Build corrected sentence
  let corrected = trimmed;
  const sortedErrors = [...errors].sort((a, b) => b.incorrect.length - a.incorrect.length);
  sortedErrors.forEach(err => {
    if (err.incorrect === "Thiếu dấu câu cuối câu" || err.incorrect.includes("dấu câu")) {
      return;
    }
    const escIncorrect = err.incorrect.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('\\b' + escIncorrect + '\\b', 'gi');
    corrected = corrected.replace(regex, err.correction);
  });
  corrected = corrected.replace(/\s+([,;.!?])/g, '$1');
  if (corrected.length > 0 && !/[.!?]/.test(corrected.slice(-1))) {
    corrected = corrected + ".";
  }
  if (corrected.length > 0) {
    corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
  }
  
  return { errors, corrected };
}

function submitEssay() {
  const text = document.getElementById('essay-textarea').value;
  const trimmed = text.trim();
  
  if (trimmed === "") {
    showToast("Vui lòng nhập nội dung bài viết trước khi nộp chấm điểm!", "warning");
    return;
  }
  
  const words = trimmed.split(/\s+/).filter(w => w.length > 0).length;
  
  // --- ESSAY VALIDATION CHECK ---
  // 1. Check for Evaluation Comments / Random text
  const isVietnamese = (trimmed.match(/[àáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳýỹỷỵ]/gi) || []).length > 10;
  const evalKeywords = /bài viết|đề bài|chấm|điểm|hoàn thành|tương đối|bố cục|ngữ pháp|từ vựng|tiêu chí|band|score|rubric|feedback|comment|outline|prompt/gi;
  const evalMatches = (trimmed.match(evalKeywords) || []).length;
  
  if (isVietnamese || evalMatches >= 2) {
    renderStep3Rejection("Submission Rejected.\n\nThe text provided is an evaluation comment, not an essay response.");
    return;
  }

  // 2. Check structure (150 words minimum, multiple sentences)
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 3);
  if (words < 150 || sentences.length < 5) {
    renderStep3Rejection("Submission Rejected.\n\nThe text provided is not an essay response. Please submit a complete essay written in response to the task prompt.");
    return;
  }
  // --- END VALIDATION ---
  
  stopTimer();
  
  // 1. Scan and Match Vocabulary Collocations
  const vocabMatches = [];
  let matchedCount = 0;
  
  if (currentTopic.has_full_details && currentTopic.details && currentTopic.details.vocab) {
    currentTopic.details.vocab.forEach(v => {
      const regex = new RegExp(`\\b${v.en.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
      const isMatched = regex.test(text);
      if (isMatched) matchedCount++;
      vocabMatches.push({
        en: v.en,
        vi: v.vi,
        matched: isMatched
      });
    });
  }
  
  // 2. Scan for Cohesion Transitions
  const transitions = [
    'firstly', 'secondly', 'thirdly', 'furthermore', 'moreover', 'in addition', 'besides',
    'on the one hand', 'on the other hand', 'however', 'nevertheless', 'nonetheless',
    'consequently', 'therefore', 'as a result', 'in conclusion', 'to sum up', 'overall',
    'for example', 'for instance', 'in contrast', 'although', 'even though', 'despite'
  ];
  
  let transitionMatches = 0;
  const matchedTransitions = [];
  transitions.forEach(t => {
    const regex = new RegExp(`\\b${t}\\b`, 'gi');
    if (regex.test(text)) {
      transitionMatches++;
      matchedTransitions.push(t);
    }
  });

  // 3. Paragraph-based Sentence-by-Sentence Error Analysis
  const paragraphsList = text.split(/\n+/).filter(p => p.trim().length > 0);
  const sentenceAnalysisList = [];
  
  let totalSVAErrors = 0;
  let totalWFErrors = 0;
  let totalPrepErrors = 0;
  let totalCollocErrors = 0;
  let totalPlurErrors = 0;
  let totalSpellingErrors = 0;
  let totalTenseErrors = 0;
  let totalContractionErrors = 0;
  let totalStructureErrors = 0;
  let totalVerbPatternErrors = 0;
  let totalRelativeClauseErrors = 0;
  
  const paragraphErrors = {
    sva: new Set(),
    wf: new Set(),
    prep: new Set(),
    colloc: new Set(),
    plur: new Set()
  };
  
  let globalSentenceIdx = 1;
  
  paragraphsList.forEach((paraText, pIdx) => {
    const sentences = segmentSentences(paraText);
    sentences.forEach(s => {
      const analysis = analyzeSentenceErrors(s);
      
      analysis.errors.forEach(err => {
        const type = err.errorType;
        if (type === "Grammar (Subject-Verb Agreement)") {
          totalSVAErrors++;
          paragraphErrors.sva.add(pIdx);
        } else if (type === "Word Form") {
          totalWFErrors++;
          paragraphErrors.wf.add(pIdx);
        } else if (type === "Article/Preposition") {
          totalPrepErrors++;
          paragraphErrors.prep.add(pIdx);
        } else if (type === "Collocation") {
          totalCollocErrors++;
          paragraphErrors.colloc.add(pIdx);
        } else if (type === "Grammar (Singular/Plural)") {
          totalPlurErrors++;
          paragraphErrors.plur.add(pIdx);
        } else if (type === "Vocabulary (Spelling)") {
          totalSpellingErrors++;
        } else if (type === "Vocabulary (Academic Style)") {
          totalContractionErrors++;
        } else if (type === "Grammar (Verb Tense)") {
          totalTenseErrors++;
        } else if (type === "Grammar (Verb Pattern)") {
          totalVerbPatternErrors++;
        } else if (type === "Grammar (Relative Clause)") {
          totalRelativeClauseErrors++;
        } else if (type.includes("Sentence Structure") || type.includes("Dấu câu") || type.includes("Viết hoa")) {
          totalStructureErrors++;
        }
      });
      
      sentenceAnalysisList.push({
        index: globalSentenceIdx++,
        original: s,
        errors: analysis.errors,
        corrected: analysis.corrected
      });
    });
  });

  const totalGrammarErrors = totalSVAErrors + totalPlurErrors + totalTenseErrors + totalPrepErrors + totalWFErrors + totalVerbPatternErrors + totalRelativeClauseErrors;
  const totalVocabErrors = totalSpellingErrors + totalContractionErrors;

  // 4. VSTEP Band Calibration Checks
  const hasRepeatedErrors = (
    paragraphErrors.sva.size >= 2 ||
    paragraphErrors.wf.size >= 2 ||
    paragraphErrors.prep.size >= 2 ||
    paragraphErrors.colloc.size >= 2
  );
  const totalControlErrors = totalSVAErrors + totalWFErrors + totalPrepErrors + totalCollocErrors + totalPlurErrors + totalVerbPatternErrors + totalRelativeClauseErrors;
  const frequentLanguageControlIssues = (totalControlErrors >= 4 || hasRepeatedErrors);

  // 5. Compute VSTEP Criteria Scores out of 10
  let tfScore = 4.0;
  if (words >= 350) tfScore = 9.0;
  else if (words >= 300) tfScore = 8.0;
  else if (words >= 250) tfScore = 7.0;
  else if (words >= 200) tfScore = 6.0;
  else if (words >= 170) tfScore = 5.0;
  else tfScore = 4.0;

  // TOPIC RELEVANCE VALIDATION
  if (currentTopic && currentTopic.title_en) {
    const titleWords = currentTopic.title_en.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    let titleHits = 0;
    titleWords.forEach(w => {
      const regex = new RegExp('\\b' + w + '\\b', 'gi');
      const matches = trimmed.match(regex);
      if (matches) titleHits += matches.length;
    });
    
    const totalRelevanceScore = titleHits + matchedCount;
    let topicRelevancePenalty = 0;
    
    if (totalRelevanceScore >= 8) {
      topicRelevancePenalty = 0;
    } else if (totalRelevanceScore >= 5) {
      topicRelevancePenalty = 1.0;
    } else if (totalRelevanceScore >= 3) {
      topicRelevancePenalty = 2.0;
    } else if (totalRelevanceScore >= 1) {
      topicRelevancePenalty = 3.0;
    } else {
      tfScore = Math.min(3.0, tfScore);
    }
    
    if (totalRelevanceScore > 0 && totalRelevanceScore < 8) {
      tfScore = Math.max(1.0, tfScore - topicRelevancePenalty);
    }
  }
  const paragraphsCount = paragraphsList.length;
  let orgBase = 3.5;
  if (paragraphsCount >= 4) orgBase = 5.5;
  else if (paragraphsCount === 3) orgBase = 4.5;
  
  const orgBonus = Math.min(1.5, transitionMatches * 0.3);
  const orgScore = Math.min(10.0, orgBase + orgBonus);

  let vocabBase = 6.0;
  if (vocabMatches.length > 0) {
    vocabBase += (matchedCount / vocabMatches.length) * 2.0;
  } else {
    const avgWordLen = trimmed.replace(/\s+/g, '').length / words;
    if (avgWordLen > 5.5) vocabBase += 1.5;
    else if (avgWordLen > 5.0) vocabBase += 0.5;
  }
  const vocabDeduction = (totalVocabErrors * 0.3) + (totalCollocErrors * 0.4);
  let vocabScore = Math.max(1.0, Math.min(10.0, vocabBase - vocabDeduction));

  let grammarBase = 6.0;
  const complexSentenceRegex = /\b(although|because|which|who|whom|whose|if|unless|while|whereas|despite|whether|provided)\b/gi;
  const complexMatches = trimmed.match(complexSentenceRegex);
  if (complexMatches && complexMatches.length >= 3) grammarBase += 1.0;
  else if (complexMatches && complexMatches.length >= 1) grammarBase += 0.5;

  const grammarDeduction = (totalGrammarErrors * 0.4) + (totalStructureErrors * 0.1);
  let grammarScore = Math.max(1.0, Math.min(10.0, grammarBase - grammarDeduction));

  // Apply calibration limits if frequent control issues exist
  if (totalControlErrors >= 12) {
    vocabScore = Math.min(4.0, vocabScore);
    grammarScore = Math.min(4.0, grammarScore);
  } else if (totalControlErrors >= 8) {
    vocabScore = Math.min(4.5, vocabScore);
    grammarScore = Math.min(4.5, grammarScore);
  } else if (frequentLanguageControlIssues) {
    vocabScore = Math.min(5.0, vocabScore);
    grammarScore = Math.min(5.0, grammarScore);
  }

  const rawScore = (tfScore + orgScore + vocabScore + grammarScore) / 4;
  let finalScore = Math.min(10.0, Math.round(rawScore * 2) / 2);
  
  // OFF-TOPIC CRITICAL OVERRIDE
  let isOffTopic = false;
  if (currentTopic && currentTopic.title_en) {
    const titleWords = currentTopic.title_en.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    let titleHits = 0;
    titleWords.forEach(w => {
      const regex = new RegExp('\\b' + w + '\\b', 'gi');
      const matches = trimmed.match(regex);
      if (matches) titleHits += matches.length;
    });
    const totalRelevanceScore = titleHits + matchedCount;
    if (totalRelevanceScore === 0) {
      finalScore = 1.0; // Band 1: totally irrelevant or memorized response
      isOffTopic = true;
    } else if (totalRelevanceScore < 3) {
      finalScore = Math.min(4.5, finalScore);
    }
  }
  
  // Directly cap overall score to B1 (max 5.0) if frequent errors limit control
  if (frequentLanguageControlIssues) {
    finalScore = Math.min(5.0, finalScore);
  }
  
  // LANGUAGE CONTROL OVERRIDE: Grammar and Vocabulary are decisive factors
  let languageControlOverrideTriggered = false;
  let languageControlOverrideSevere = false;
  
  if (grammarScore < 4.5 && vocabScore < 4.5) {
    finalScore = Math.min(4.0, finalScore);
    languageControlOverrideSevere = true;
  } else if (grammarScore < 5.0 && vocabScore < 5.0) {
    finalScore = Math.min(4.5, finalScore);
    languageControlOverrideTriggered = true;
  }
  
  let feedbackText = "";
  if (isOffTopic) {
    feedbackText = "LẠC ĐỀ HOÀN TOÀN (0% Topic Match): Bài làm không giải quyết bất cứ yêu cầu nào của đề thi hoặc có dấu hiệu học tủ một bài mẫu khác. Ngôn ngữ mạnh không thể bù đắp cho việc trả lời sai đề. Bài viết bị đánh trượt (1.0).";
  } else if (languageControlOverrideSevere && rawScore > 4.0) {
    feedbackText = "Bài viết có độ dài hoặc bố cục đạt yêu cầu nhưng việc kiểm soát ngôn ngữ (Từ vựng & Ngữ pháp) đều yếu (dưới 4.5). Điểm số tổng thể bị giới hạn tối đa ở mức 4.0 do ngôn từ không đủ chính xác để bù đắp cho cấu trúc.";
  } else if (languageControlOverrideTriggered && rawScore > 4.5) {
    feedbackText = "Mặc dù độ dài bài viết và bố cục có thể đạt yêu cầu, nhưng do cả hai tiêu chí Ngữ pháp và Từ vựng đều dưới 5.0, điểm số tổng thể bị giới hạn tối đa ở mức 4.5. Bạn cần ưu tiên cải thiện độ chính xác ngôn ngữ trước khi tập trung vào cấu trúc phức tạp.";
  } else if (frequentLanguageControlIssues && rawScore >= 5.5) {
    feedbackText = "Bài viết có độ dài tốt nhưng mắc nhiều lỗi lặp lại hoặc xuất hiện lỗi hệ thống (chia động từ, giới từ, dạng từ, collocation) tại nhiều đoạn văn khác nhau. Điều này thể hiện khả năng kiểm soát ngôn ngữ còn hạn chế, do đó điểm số được giới hạn ở trình độ B1 (tối đa 5.0).";
  } else {
    if (finalScore >= 8.5) feedbackText = "Xuất sắc! Đạt trình độ C1. Sử dụng từ vựng đa dạng và liên kết đoạn tốt.";
    else if (finalScore >= 6.0) feedbackText = "Khá tốt! Đạt trình độ B2. Bài viết mạch lạc, đủ từ và cấu trúc hợp lệ.";
    else if (finalScore >= 4.0) feedbackText = "Đạt yêu cầu! Trình độ B1. Hãy bổ sung thêm từ nối và mở rộng luận cứ.";
    else feedbackText = "Dưới trung bình. Cần cố gắng viết dài hơn và bổ sung từ vựng cơ bản.";
  }
  
  document.getElementById('estimated-score').innerText = finalScore.toFixed(1);
  document.getElementById('ws-feedback-general').innerText = feedbackText;
  
  const detailsList = document.getElementById('feedback-details-list');
  detailsList.innerHTML = `
    <div class="grade-detail-card ${tfScore >= 8.0 ? 'success-card' : 'warning-card'}" style="margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span class="grade-detail-title" style="font-weight: 700;">1. TASK FULFILLMENT</span>
        <span style="font-weight: bold;">${tfScore.toFixed(1)} / 10</span>
      </div>
      <div class="grade-detail-desc" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
        Độ dài: ${words} từ. ${words >= 250 ? 'Đạt độ dài tiêu chuẩn tối thiểu 250 từ.' : 'Chưa đạt độ dài yêu cầu. Hãy viết dài hơn.'}
      </div>
    </div>
    <div class="grade-detail-card ${orgScore >= 8.0 ? 'success-card' : 'warning-card'}" style="margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span class="grade-detail-title" style="font-weight: 700;">2. ORGANIZATION</span>
        <span style="font-weight: bold;">${orgScore.toFixed(1)} / 10</span>
      </div>
      <div class="grade-detail-desc" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
        Bài viết chia thành ${paragraphsCount} đoạn. Phát hiện ${transitionMatches} từ liên kết chuyển ý.
      </div>
    </div>
    <div class="grade-detail-card ${vocabScore >= 7.0 ? 'success-card' : 'warning-card'}" style="margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span class="grade-detail-title" style="font-weight: 700;">3. LEXICAL RESOURCE</span>
        <span style="font-weight: bold;">${vocabScore.toFixed(1)} / 10</span>
      </div>
      <div class="grade-detail-desc" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
        Sử dụng ${matchedCount} collocations từ bài học. Tổng số lỗi từ vựng/collocations: ${totalVocabErrors + totalCollocErrors}.
      </div>
    </div>
    <div class="grade-detail-card ${grammarScore >= 7.0 ? 'success-card' : 'warning-card'}" style="margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span class="grade-detail-title" style="font-weight: 700;">4. GRAMMAR & ACCURACY</span>
        <span style="font-weight: bold;">${grammarScore.toFixed(1)} / 10</span>
      </div>
      <div class="grade-detail-desc" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
        Tổng số lỗi ngữ pháp/dấu câu phát hiện: ${totalGrammarErrors + totalStructureErrors}.
      </div>
    </div>
  `;
  
  const matchContainer = document.getElementById('ws-vocab-match-container');
  matchContainer.innerHTML = '';
  if (vocabMatches.length > 0) {
    vocabMatches.forEach(item => {
      const div = document.createElement('div');
      div.className = `vocab-match-item ${item.matched ? 'matched' : 'unmatched'}`;
      div.innerHTML = `
        <span><strong>${item.en}</strong> (${item.vi})</span>
        <span class="match-status">${item.matched ? '✓ Sử dụng' : '✗ Chưa dùng'}</span>
      `;
      matchContainer.appendChild(div);
    });
  } else {
    matchContainer.innerHTML = '<div class="empty-state">Không có bộ collocations đối chiếu cho bài luận tự do.</div>';
  }
  
  renderSampleEssay();
  
  saveSubmission(finalScore, words, text);
  updateStats();
  
  const draftKey = `draft_${currentCategory.id}_${currentTopic.id}`;
  localStorage.removeItem(draftKey);
  
  hasSubmitted = true;
  
  renderStep3VstepEvaluation({
    score: finalScore,
    wordCount: words,
    tfScore: tfScore,
    orgScore: orgScore,
    vocabScore: vocabScore,
    grammarScore: grammarScore,
    feedback: feedbackText,
    text: text,
    sentenceAnalysisList: sentenceAnalysisList,
    totalGrammarErrors: totalGrammarErrors,
    totalVocabErrors: totalVocabErrors,
    totalCollocErrors: totalCollocErrors,
    totalStructureErrors: totalStructureErrors,
    frequentLanguageControlIssues: frequentLanguageControlIssues
  });

  document.getElementById('step3-editor-view').style.display = 'none';
  document.getElementById('step3-evaluation-view').style.display = 'flex';
  
  showToast("🎉 Đã hoàn thành nộp bài! Báo cáo đánh giá chi tiết hiển thị bên dưới.", "success");
}

function renderStep3Rejection(message) {
  const container = document.getElementById('step3-evaluation-view');
  if (!container) return;
  
  container.innerHTML = `
    <div class="evaluation-header">
      <h3 style="color: var(--danger-color); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Submission Rejected
      </h3>
      <button class="btn btn-secondary" onclick="rewriteEssay()">Viết lại / Chỉnh sửa bài</button>
    </div>
    <div class="eval-card" style="border-left: 4px solid var(--danger-color); padding: 2rem; margin-top: 1rem;">
      <p style="white-space: pre-wrap; font-size: 1.1rem; line-height: 1.6; margin: 0; color: var(--text-color);">${message}</p>
    </div>
  `;
  
  document.getElementById('step3-editor-view').style.display = 'none';
  document.getElementById('step3-evaluation-view').style.display = 'flex';
  
  showToast("Lỗi: Bài viết không hợp lệ!", "danger");
}

function renderStep3VstepEvaluation(data) {
  const container = document.getElementById('step3-evaluation-view');
  if (!container) return;
  
  const {
    score,
    wordCount,
    tfScore,
    orgScore,
    vocabScore,
    grammarScore,
    feedback,
    text,
    sentenceAnalysisList,
    totalGrammarErrors,
    totalVocabErrors,
    totalCollocErrors,
    totalStructureErrors,
    frequentLanguageControlIssues
  } = data;

  const pTF = (tfScore / 10) * 100;
  const pORG = (orgScore / 10) * 100;
  const pVocab = (vocabScore / 10) * 100;
  const pGrammar = (grammarScore / 10) * 100;
  
  let commentTF = tfScore >= 9.0 
    ? "Xuất sắc! Bài viết đạt độ dài lý tưởng (trên 250 từ) đáp ứng hoàn hảo yêu cầu VSTEP Task 2."
    : tfScore >= 7.0 
    ? "Khá tốt. Bài viết đạt trên 200 từ, đáp ứng tương đối đầy đủ yêu cầu nhưng nên mở rộng sâu hơn."
    : "Bài viết chưa đạt độ dài khuyến nghị (250 từ). Bạn cần đưa thêm luận điểm và ví dụ cụ thể hơn.";

  let commentORG = orgScore >= 9.0
    ? "Tuyệt vời! Bố cục mạch lạc chuẩn 4 đoạn với hệ thống từ nối (Transitions) cực kỳ liên kết, chuyển mạch tự nhiên."
    : orgScore >= 7.0
    ? "Bố cục rõ ràng, các phần cân đối. Nên làm phong phú thêm các liên từ chuyển tiếp."
    : "Bố cục thiếu cân đối hoặc thiếu liên từ kết nối câu và đoạn. Cần chia đoạn chuẩn (Mở, 2 Thân, Kết).";

  let commentVocab = vocabScore >= 9.0
    ? "Từ vựng phong phú! Lồng ghép thành thạo các collocations nâng cao, diễn đạt học thuật tự nhiên, ít lỗi."
    : vocabScore >= 7.0
    ? "Vốn từ khá tốt. Đã sử dụng collocations chuyên đề phù hợp nhưng còn một số lỗi chính tả hoặc dùng từ."
    : "Vốn từ còn đơn giản, lặp từ nhiều và gặp lỗi từ loại/collocations. Hãy chèn từ vựng chuyên đề ở Bước 2.";

  let commentGrammar = grammarScore >= 9.0
    ? "Ngữ pháp xuất sắc! Cấu trúc câu phức hợp đa dạng, hầu như không mắc lỗi chia động từ hay dấu câu."
    : grammarScore >= 7.0
    ? "Ngữ pháp khá ổn. Bài viết dùng được câu phức nhưng vẫn còn một số lỗi nhỏ về chia động từ, giới từ."
    : "Mắc nhiều lỗi ngữ pháp cơ bản (chia động từ, số ít số nhiều, giới từ). Cần chú ý rà soát lỗi kĩ hơn.";

  const getSummary = (freq, type) => {
    let severity = "None";
    let effect = "Không ảnh hưởng";
    
    if (type === "grammar") {
      if (freq >= 4) {
        severity = "Serious";
        effect = "Ảnh hưởng nghiêm trọng đến điểm B2 (Giới hạn tối đa 5.0 điểm Grammar)";
      } else if (freq >= 2) {
        severity = "Moderate";
        effect = "Ảnh hưởng nhẹ đến điểm B2 (Giới hạn tối đa 6.5 điểm Grammar)";
      } else if (freq >= 1) {
        severity = "Minor";
        effect = "Trừ nhẹ điểm chính xác của Grammar (-0.5 điểm)";
      }
    } else if (type === "vocab") {
      if (freq >= 4) {
        severity = "Serious";
        effect = "Giới hạn điểm từ vựng ở mức B1 (-1.5 đến -2.0 điểm)";
      } else if (freq >= 2) {
        severity = "Moderate";
        effect = "Cản trở việc đạt điểm tối đa B2 của Lexical Resource";
      } else if (freq >= 1) {
        severity = "Minor";
        effect = "Trừ điểm nhẹ đối với lỗi chính tả không hệ thống";
      }
    } else if (type === "colloc") {
      if (freq >= 3) {
        severity = "Serious";
        effect = "Hạn chế nghiêm trọng tính tự nhiên của câu (Khó đạt B2)";
      } else if (freq >= 1) {
        severity = "Moderate";
        effect = "Ảnh hưởng mức độ lưu loát và tự nhiên khi chấm thi";
      }
    } else if (type === "structure") {
      if (freq >= 5) {
        severity = "Serious";
        effect = "Cực kỳ mất thiện cảm, ảnh hưởng nghiêm trọng đến mạch lạc câu";
      } else if (freq >= 2) {
        severity = "Moderate";
        effect = "Gây gián đoạn nhẹ tiến trình đọc hiểu bài viết của giám khảo";
      } else if (freq >= 1) {
        severity = "Minor";
        effect = "Trừ lỗi hình thức nhỏ (dấu câu/viết hoa)";
      }
    }
    return { severity, effect };
  };

  const gSum = getSummary(totalGrammarErrors, "grammar");
  const vSum = getSummary(totalVocabErrors, "vocab");
  const cSum = getSummary(totalCollocErrors, "colloc");
  const sSum = getSummary(totalStructureErrors, "structure");

  let rawReportText = "";
  sentenceAnalysisList.forEach(item => {
    const checks = [
      { name: "Subject-Verb Agreement", category: "Grammar (Subject-Verb Agreement)" },
      { name: "Verb Pattern", category: "Grammar (Verb Pattern)" },
      { name: "Tense", category: "Grammar (Verb Tense)" },
      { name: "Articles", category: "Article/Preposition", filter: err => err.errorType === "Article/Preposition" && /^(a|an|the|this|that|these|those)$/i.test(err.incorrect) },
      { name: "Prepositions", category: "Article/Preposition", filter: err => err.errorType === "Article/Preposition" && !/^(a|an|the|this|that|these|those)$/i.test(err.incorrect) },
      { name: "Word Form", category: "Word Form" },
      { name: "Singular/Plural", category: "Grammar (Singular/Plural)" },
      { name: "Relative Clauses", category: "Grammar (Relative Clause)" },
      { name: "Collocations", category: "Collocation", filter: err => err.errorType === "Collocation" || err.errorType.includes("Spelling") || err.errorType.includes("Academic Style") },
      { name: "Sentence Structure", category: "Sentence Structure", filter: err => err.errorType.includes("Sentence Structure") || err.errorType.includes("Dấu câu") || err.errorType.includes("Viết hoa") }
    ];

    const sentenceCheckResults = [];
    checks.forEach((check, index) => {
      const matchingErrors = item.errors.filter(err => {
        if (check.filter) return check.filter(err);
        return err.errorType === check.category;
      });
      
      const hasErr = matchingErrors.length > 0;
      let explanation = "";
      if (hasErr) {
        explanation = matchingErrors.map(err => `${err.explanation} (Sai: '${err.incorrect}' -> Sửa: '${err.correction}')`).join("; ");
      } else {
        explanation = `Không phát hiện lỗi về ${check.name}.`;
      }
      
      sentenceCheckResults.push({
        num: index + 1,
        name: check.name,
        result: hasErr ? "✗ Error Detected" : "✓ No Error",
        explanation: explanation,
        hasError: hasErr
      });
    });

    rawReportText += `Sentence ${item.index}\n\nOriginal:\n${item.original}\n\n`;
    rawReportText += `--- MANDATORY ERROR CHECKLIST (ONLY SHOWING ERRORS) ---\n`;
    let errorChecksCount = 0;
    sentenceCheckResults.forEach(c => {
      if (c.hasError) {
        rawReportText += `CHECK ${c.num}: ${c.name}\nResult: ${c.result}\nExplanation (Vietnamese): ${c.explanation}\n\n`;
        errorChecksCount++;
      }
    });
    if (errorChecksCount === 0) {
      rawReportText += `Tất cả các tiêu chí đều đạt chuẩn, không phát hiện lỗi.\n\n`;
    }
    rawReportText += `Conclusion: ${item.errors.length > 0 ? "✗ Error Detected" : "✓ No Error"}\n`;
    rawReportText += `Corrected Sentence:\n${item.corrected}\n\n`;
    rawReportText += `--------------------------------------------------\n\n`;
  });

  rawReportText += `Grammar Error Summary:\nFrequency: ${totalGrammarErrors}\nSeverity: ${gSum.severity}\nEffect on B1/B2 score: ${gSum.effect}\n\n`;
  rawReportText += `Vocabulary Error Summary:\nFrequency: ${totalVocabErrors}\nSeverity: ${vSum.severity}\nEffect on B1/B2 score: ${vSum.effect}\n\n`;
  rawReportText += `Collocation Error Summary:\nFrequency: ${totalCollocErrors}\nSeverity: ${cSum.severity}\nEffect on B1/B2 score: ${cSum.effect}\n\n`;
  rawReportText += `Sentence Structure Error Summary:\nFrequency: ${totalStructureErrors}\nSeverity: ${sSum.severity}\nEffect on B1/B2 score: ${sSum.effect}\n\n`;
  rawReportText += `FINAL SCORING\n\nEvaluate using VSTEP criteria:\nTask Fulfillment: ${tfScore.toFixed(1)}/10\nOrganization: ${orgScore.toFixed(1)}/10\nVocabulary: ${vocabScore.toFixed(1)}/10\nGrammar: ${grammarScore.toFixed(1)}/10\n\nEstimated Overall Band: ${score.toFixed(1)} (${score >= 8.5 ? 'C1' : score >= 6.0 ? 'B2' : score >= 4.0 ? 'B1' : 'Dưới B1'})\n`;

  let sentencesHtml = "";
  sentenceAnalysisList.forEach(item => {
    const hasErrors = item.errors.length > 0;
    
    const checks = [
      { name: "Subject-Verb Agreement", category: "Grammar (Subject-Verb Agreement)" },
      { name: "Verb Pattern", category: "Grammar (Verb Pattern)" },
      { name: "Tense", category: "Grammar (Verb Tense)" },
      { name: "Articles", category: "Article/Preposition", filter: err => err.errorType === "Article/Preposition" && /^(a|an|the|this|that|these|those)$/i.test(err.incorrect) },
      { name: "Prepositions", category: "Article/Preposition", filter: err => err.errorType === "Article/Preposition" && !/^(a|an|the|this|that|these|those)$/i.test(err.incorrect) },
      { name: "Word Form", category: "Word Form" },
      { name: "Singular/Plural", category: "Grammar (Singular/Plural)" },
      { name: "Relative Clauses", category: "Grammar (Relative Clause)" },
      { name: "Collocations", category: "Collocation", filter: err => err.errorType === "Collocation" || err.errorType.includes("Spelling") || err.errorType.includes("Academic Style") },
      { name: "Sentence Structure", category: "Sentence Structure", filter: err => err.errorType.includes("Sentence Structure") || err.errorType.includes("Dấu câu") || err.errorType.includes("Viết hoa") }
    ];

    let checklistCardsHtml = "";
    let errorChecksCount = 0;
    checks.forEach((check, index) => {
      const matchingErrors = item.errors.filter(err => {
        if (check.filter) return check.filter(err);
        return err.errorType === check.category;
      });
      
      const hasErr = matchingErrors.length > 0;
      if (!hasErr) return;
      
      errorChecksCount++;
      const badgeColor = "var(--danger)";
      const badgeBg = "rgba(239, 68, 68, 0.1)";
      const borderStyle = "1px solid var(--danger)";
      const icon = "✗";
      const resultText = "Error Detected";
      
      let explanation = matchingErrors.map(err => {
        return `${err.explanation} <span style="font-family: var(--font-mono); font-size: 0.75rem; background-color: var(--bg-secondary); padding: 0.1rem 0.3rem; border-radius: 3px; color: var(--danger); font-weight: bold;">${err.incorrect}</span> → <span style="font-family: var(--font-mono); font-size: 0.75rem; background-color: var(--success-bg); padding: 0.1rem 0.3rem; border-radius: 3px; color: var(--success); font-weight: bold;">${err.correction}</span>`;
      }).join("<br/>");
      
      checklistCardsHtml += `
        <div style="border: ${borderStyle}; border-radius: var(--radius-sm); padding: 0.75rem 1rem; background-color: var(--bg-primary); display: flex; flex-direction: column; gap: 0.25rem; transition: all 0.2s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--panel-border); padding-bottom: 0.25rem;">
            <span style="font-weight: 700; font-size: 0.75rem; color: var(--text-primary); letter-spacing: 0.02em;">CHECK ${index + 1}: ${check.name.toUpperCase()}</span>
            <span style="font-size: 0.7rem; font-weight: 700; color: ${badgeColor}; background-color: ${badgeBg}; padding: 0.15rem 0.45rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.2rem;">
              <span>${icon}</span> ${resultText}
            </span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; margin-top: 0.2rem;">${explanation}</div>
        </div>
      `;
    });

    if (errorChecksCount === 0) {
      checklistCardsHtml = `
        <div style="grid-column: span 2; border: 1px dashed var(--success); border-radius: var(--radius-sm); padding: 1rem; background-color: rgba(16, 185, 129, 0.05); display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: var(--success); font-weight: 600; font-size: 0.9rem;">
          <span>✓</span> Tất cả các tiêu chí đều đạt chuẩn, không phát hiện lỗi.
        </div>
      `;
    }

    sentencesHtml += `
      <div class="sentence-analysis-block" style="background-color: var(--bg-secondary); border: 1px solid var(--panel-border); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--panel-border); padding-bottom: 0.75rem;">
          <span style="font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
            <span style="display: inline-flex; justify-content: center; align-items: center; background-color: var(--accent-primary); color: #fff; width: 24px; height: 24px; border-radius: 50%; font-size: 0.8rem; font-weight: bold;">${item.index}</span>
            CÂU LUYỆN TẬP ${item.index}
          </span>
          ${hasErrors 
            ? `<span class="badge" style="background-color: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid var(--danger); font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 50px; font-weight: 700;">✗ PHÁT HIỆN SAI PHẠM</span>`
            : `<span class="badge" style="background-color: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid var(--success); font-size: 0.75rem; padding: 0.25rem 0.75rem; border-radius: 50px; font-weight: 700;">✓ HỢP LỆ</span>`
          }
        </div>
        
        <div>
          <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem; letter-spacing: 0.05em;">Câu gốc của bạn:</div>
          <div style="font-size: 1.05rem; line-height: 1.6; color: var(--text-primary); font-style: italic; background-color: var(--bg-primary); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px dashed var(--panel-border);">"${item.original}"</div>
        </div>

        <div>
          <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.05em;">Đánh giá theo checklist 10 tiêu chí VSTEP:</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            ${checklistCardsHtml}
          </div>
        </div>

        <div style="margin-top: 0.5rem; border-top: 1px solid var(--panel-border); padding-top: 1rem;">
          <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem; letter-spacing: 0.05em;">Bản sửa đề xuất chuẩn hóa:</div>
          <div style="font-size: 1.05rem; line-height: 1.6; color: var(--success); font-weight: 700; background-color: var(--success-bg); padding: 0.85rem 1.15rem; border-radius: var(--radius-sm); border: 1px solid var(--success); box-shadow: 0 2px 8px rgba(16, 185, 129, 0.05);">"${item.corrected}"</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <!-- HEADER -->
    <div class="evaluation-report-header" style="border-bottom: 2px solid var(--panel-border); padding-bottom: 1rem;">
      <h2 style="font-family: var(--font-display); font-size: 1.5rem; color: var(--accent-primary); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 24px; height: 24px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0110 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0114 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
        BÁO CÁO PHÂN TÍCH LỖI & CHẤM ĐIỂM VSTEP (ERROR DETECTION MODE)
      </h2>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0.25rem 0 0 0;">Quá trình quét và rà soát lỗi toàn bộ bài luận song song đánh giá chi tiết theo 4 tiêu chí VSTEP.</p>
    </div>
    
    <!-- radial score & bands -->
    <div class="evaluation-score-overview" style="display: flex; gap: 2rem; align-items: center; background-color: var(--bg-secondary); border: 1px solid var(--panel-border); padding: 1.5rem; border-radius: var(--radius-lg);">
      <div class="score-radial-wrapper" style="position: relative; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; background: radial-gradient(closest-side, var(--bg-secondary) 85%, transparent 86% 100%), conic-gradient(var(--accent-primary) ${score * 10}%, var(--panel-border) 0); border-radius: 50%;">
        <div style="text-align: center; position: relative; z-index: 2;">
          <div style="font-size: 2.25rem; font-weight: 800; font-family: var(--font-display); color: var(--accent-primary); line-height: 1;">${score.toFixed(1)}</div>
          <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-top: 0.15rem;">Overall Band</div>
        </div>
      </div>
      
      <div class="score-text-summary" style="flex-grow: 1;">
        <div class="score-badge-level" style="display: inline-block; background: var(--accent-gradient); color: #fff; padding: 0.35rem 0.85rem; border-radius: 50px; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.25);">
          Kết quả ước lượng: Trình độ ${score >= 8.5 ? 'C1' : score >= 6.0 ? 'B2' : score >= 4.0 ? 'B1' : 'Dưới B1'}
        </div>
        <p style="font-size: 1.05rem; font-weight: 600; line-height: 1.5; color: var(--text-primary); margin: 0;">${feedback}</p>
        <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
          <span>⏱️ Độ dài: <strong>${wordCount} từ</strong></span>
          <span>⚡ Trạng thái kiểm tra: <strong>Double-Review Pass ✓</strong></span>
        </div>
      </div>
    </div>

    <!-- VSTEP BAND CALIBRATION ALERT -->
    ${frequentLanguageControlIssues ? `
      <div style="background-color: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md); padding: 1rem 1.25rem; display: flex; align-items: flex-start; gap: 0.75rem;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="var(--danger)" style="width: 20px; height: 20px; margin-top: 0.1rem; flex-shrink: 0;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-primary);">
          <strong style="color: var(--danger);">Hiệu chuẩn điểm VSTEP (Band Calibration):</strong> Phát hiện các lỗi hệ thống về Hòa hợp Chủ-Vị, Giới từ, Dạng từ hoặc Collocations xuất hiện thường xuyên hoặc lặp lại qua nhiều đoạn văn. Để phản ánh đúng khả năng kiểm soát ngôn ngữ thực tế theo tiêu chuẩn khảo thí VSTEP, bài viết bị giới hạn điểm ở trình độ B1 (tối đa 5.5).
        </div>
      </div>
    ` : ''}

    <!-- DOUBLE REVIEW PASS BADGE -->
    <div style="background-color: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: var(--radius-md); padding: 1rem 1.25rem; display: flex; align-items: flex-start; gap: 0.75rem;">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="var(--info)" style="width: 20px; height: 20px; margin-top: 0.1rem; flex-shrink: 0;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
      <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-primary);">
        <strong style="color: var(--info);">Double-Review Pass (Rà soát 2 lượt):</strong> Đã tiến hành đối chiếu kiểm tra chéo hai lần toàn diện các lỗi ngữ pháp, chính tả, dấu câu, mạo từ/giới từ, dạng từ (word forms) và collocations để đảm bảo báo cáo phân tích đạt độ chính xác tối đa.
      </div>
    </div>
    
    <!-- 4-CRITERIA SCORE GRID -->
    <div class="vstep-criteria-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
      <!-- TF -->
      <div class="vstep-criterion-card" style="background-color: var(--bg-secondary); border: 1px solid var(--panel-border); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em;">1. Task Fulfillment ( TF )</span>
          <span style="font-weight: 700; color: var(--accent-primary); font-size: 1rem;">${tfScore.toFixed(1)} / 10</span>
        </div>
        <div class="vstep-progress-wrapper" style="background-color: var(--bg-primary); border-radius: 4px; height: 8px; overflow: hidden; width: 100%;">
          <div style="background-color: var(--success); height: 100%; width: ${pTF}%;"></div>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; margin: 0;">${commentTF}</p>
      </div>

      <!-- ORG -->
      <div class="vstep-criterion-card" style="background-color: var(--bg-secondary); border: 1px solid var(--panel-border); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em;">2. Organization ( ORG )</span>
          <span style="font-weight: 700; color: var(--accent-primary); font-size: 1rem;">${orgScore.toFixed(1)} / 10</span>
        </div>
        <div class="vstep-progress-wrapper" style="background-color: var(--bg-primary); border-radius: 4px; height: 8px; overflow: hidden; width: 100%;">
          <div style="background-color: var(--info); height: 100%; width: ${pORG}%;"></div>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; margin: 0;">${commentORG}</p>
      </div>

      <!-- LEX -->
      <div class="vstep-criterion-card" style="background-color: var(--bg-secondary); border: 1px solid var(--panel-border); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em;">3. Lexical Resource ( VOCAB )</span>
          <span style="font-weight: 700; color: var(--accent-primary); font-size: 1rem;">${vocabScore.toFixed(1)} / 10</span>
        </div>
        <div class="vstep-progress-wrapper" style="background-color: var(--bg-primary); border-radius: 4px; height: 8px; overflow: hidden; width: 100%;">
          <div style="background-color: var(--warning); height: 100%; width: ${pVocab}%;"></div>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; margin: 0;">${commentVocab}</p>
      </div>

      <!-- GRA -->
      <div class="vstep-criterion-card" style="background-color: var(--bg-secondary); border: 1px solid var(--panel-border); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em;">4. Grammar & Accuracy ( GRA )</span>
          <span style="font-weight: 700; color: var(--accent-primary); font-size: 1rem;">${grammarScore.toFixed(1)} / 10</span>
        </div>
        <div class="vstep-progress-wrapper" style="background-color: var(--bg-primary); border-radius: 4px; height: 8px; overflow: hidden; width: 100%;">
          <div style="background-color: var(--accent-primary); height: 100%; width: ${pGrammar}%;"></div>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; margin: 0;">${commentGrammar}</p>
      </div>
    </div>

    <!-- ERROR SUMMARIES PANEL -->
    <div style="background-color: var(--bg-secondary); border: 1px solid var(--panel-border); border-radius: var(--radius-md); padding: 1.5rem;">
      <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--panel-border); padding-bottom: 0.5rem; margin-top: 0; margin-bottom: 1rem;">
        BẢNG TỔNG HỢP LỖI SAI (ERROR CATEGORY SUMMARY)
      </h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; font-size: 0.85rem; text-align: left; border-collapse: collapse; border: none;">
          <thead>
            <tr style="border-bottom: 1px solid var(--panel-border); color: var(--text-secondary);">
              <th style="padding: 0.5rem;">Phân loại lỗi</th>
              <th style="padding: 0.5rem; text-align: center;">Tần suất (Số lỗi)</th>
              <th style="padding: 0.5rem; text-align: center;">Mức độ nghiêm trọng</th>
              <th style="padding: 0.5rem;">Ảnh hưởng đến điểm B1/B2</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px dashed var(--panel-border);">
              <td style="padding: 0.75rem; font-weight: 600;">Grammar (Ngữ pháp, Dạng từ, Giới từ)</td>
              <td style="padding: 0.75rem; text-align: center; font-weight: bold; color: ${totalGrammarErrors > 0 ? 'var(--danger)' : 'var(--success)'};">${totalGrammarErrors}</td>
              <td style="padding: 0.75rem; text-align: center;"><span style="background-color: ${gSum.severity === 'Serious' ? 'var(--danger)' : gSum.severity === 'Moderate' ? 'var(--warning)' : gSum.severity === 'Minor' ? 'var(--info)' : 'var(--success)'}; color:#fff; font-size:0.75rem; padding:0.15rem 0.5rem; border-radius:3px; font-weight:bold; text-transform:uppercase;">${gSum.severity}</span></td>
              <td style="padding: 0.75rem; color: var(--text-secondary);">${gSum.effect}</td>
            </tr>
            <tr style="border-bottom: 1px dashed var(--panel-border);">
              <td style="padding: 0.75rem; font-weight: 600;">Vocabulary (Chính tả, Từ viết tắt)</td>
              <td style="padding: 0.75rem; text-align: center; font-weight: bold; color: ${totalVocabErrors > 0 ? 'var(--danger)' : 'var(--success)'};">${totalVocabErrors}</td>
              <td style="padding: 0.75rem; text-align: center;"><span style="background-color: ${vSum.severity === 'Serious' ? 'var(--danger)' : vSum.severity === 'Moderate' ? 'var(--warning)' : vSum.severity === 'Minor' ? 'var(--info)' : 'var(--success)'}; color:#fff; font-size:0.75rem; padding:0.15rem 0.5rem; border-radius:3px; font-weight:bold; text-transform:uppercase;">${vSum.severity}</span></td>
              <td style="padding: 0.75rem; color: var(--text-secondary);">${vSum.effect}</td>
            </tr>
            <tr style="border-bottom: 1px dashed var(--panel-border);">
              <td style="padding: 0.75rem; font-weight: 600;">Collocation (Từ ghép tự nhiên)</td>
              <td style="padding: 0.75rem; text-align: center; font-weight: bold; color: ${totalCollocErrors > 0 ? 'var(--danger)' : 'var(--success)'};">${totalCollocErrors}</td>
              <td style="padding: 0.75rem; text-align: center;"><span style="background-color: ${cSum.severity === 'Serious' ? 'var(--danger)' : cSum.severity === 'Moderate' ? 'var(--warning)' : cSum.severity === 'Minor' ? 'var(--info)' : 'var(--success)'}; color:#fff; font-size:0.75rem; padding:0.15rem 0.5rem; border-radius:3px; font-weight:bold; text-transform:uppercase;">${cSum.severity}</span></td>
              <td style="padding: 0.75rem; color: var(--text-secondary);">${cSum.effect}</td>
            </tr>
            <tr>
              <td style="padding: 0.75rem; font-weight: 600;">Sentence Structure (Dấu câu, Viết hoa)</td>
              <td style="padding: 0.75rem; text-align: center; font-weight: bold; color: ${totalStructureErrors > 0 ? 'var(--danger)' : 'var(--success)'};">${totalStructureErrors}</td>
              <td style="padding: 0.75rem; text-align: center;"><span style="background-color: ${sSum.severity === 'Serious' ? 'var(--danger)' : sSum.severity === 'Moderate' ? 'var(--warning)' : sSum.severity === 'Minor' ? 'var(--info)' : 'var(--success)'}; color:#fff; font-size:0.75rem; padding:0.15rem 0.5rem; border-radius:3px; font-weight:bold; text-transform:uppercase;">${sSum.severity}</span></td>
              <td style="padding: 0.75rem; color: var(--text-secondary);">${sSum.effect}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- DETAILED SENTENCE REPORT -->
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--panel-border); padding-bottom: 0.5rem; margin-top: 0; margin-bottom: 0.5rem;">
        CHI TIẾT PHÂN TÍCH TỪNG CÂU (SENTENCE-BY-SENTENCE REPORT)
      </h4>
      ${sentencesHtml}
    </div>


    <!-- SUBMITTED ESSAY PREVIEW -->
    <div class="submitted-essay-preview-card" style="background-color: var(--bg-secondary); border: 1px solid var(--panel-border); border-radius: var(--radius-md); padding: 1.5rem;">
      <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--panel-border); padding-bottom: 0.5rem; margin-top: 0; margin-bottom: 1rem;">
        BÀI VIẾT ĐÃ NỘP CỦA BẠN (ORIGINAL ESSAY PREVIEW)
      </h4>
      <div style="font-family: inherit; font-size: 0.95rem; line-height: 1.7; color: var(--text-primary); white-space: pre-wrap; font-style: italic;">${text}</div>
    </div>
    
    <!-- ACTIONS -->
    <div class="evaluation-actions-row" style="display: flex; gap: 1rem; justify-content: flex-end; margin-bottom: 2rem;">
      <button class="btn btn-secondary" style="padding: 0.65rem 1.5rem;" onclick="rewriteEssay()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px; margin-right: 0.35rem; display: inline-block; vertical-align: middle;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>Viết lại bài
      </button>
      <button class="btn btn-primary" style="padding: 0.65rem 1.5rem;" onclick="switchStep(4)">
        Xem bài mẫu B1/B2 →
      </button>
    </div>
  `;
}


// Rewrite essay: toggles back to editor from grading view
function rewriteEssay() {
  hasSubmitted = false;
  document.getElementById('step3-evaluation-view').style.display = 'none';
  document.getElementById('step3-editor-view').style.display = 'flex';
  
  // Re-enable editing and focus textarea
  const textarea = document.getElementById('essay-textarea');
  if (textarea) textarea.focus();
  
  showToast("✏️ Bạn có thể tiếp tục chỉnh sửa bài luận để cải thiện điểm số.", "info");
}

// Switch between Right Analysis tabs (Score, Vocab checklist, Model essay)
function switchAnalysisTab(tabName) {
  // Update active tab buttons
  document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.innerText.toLowerCase().includes(tabName === 'score' ? 'chấm' : tabName === 'vocab-check' ? 'đối' : 'mẫu')) {
      btn.classList.add('active');
    }
  });
  
  // Show section
  document.querySelectorAll('.analysis-section').forEach(sec => {
    sec.classList.remove('active');
  });
  
  let targetSec = 'score';
  if (tabName === 'vocab-check') targetSec = 'vocab-check';
  if (tabName === 'model') targetSec = 'model';
  
  document.getElementById(`analysis-sec-${targetSec}`).classList.add('active');
}

// Render sample essay based on B1/B2 toggle
function renderSampleEssay() {
  const textEl = document.getElementById('ws-sample-essay-text');
  
  // Set sample pills active state
  const b1Pill = document.getElementById('ws-sample-b1-pill');
  const b2Pill = document.getElementById('ws-sample-b2-pill');
  
  if (currentSampleLevel === 'B1') {
    b1Pill.classList.add('active');
    b2Pill.classList.remove('active');
  } else {
    b2Pill.classList.add('active');
    b1Pill.classList.remove('active');
  }
  
  const topic = currentTopic;
  if (!topic || !topic.has_full_details || !topic.details) {
    textEl.innerHTML = '<div class="empty-state">Xin lỗi, chủ đề tự viết tự do này hiện chưa có bài giải mẫu được lưu trữ trong cơ sở dữ liệu.</div>';
    return;
  }
  
  const essayText = currentSampleLevel === 'B1' ? topic.details.sample_b1 : topic.details.sample_b2;
  textEl.innerHTML = essayText;
}

function switchSampleLevel(level) {
  currentSampleLevel = level;
  renderSampleEssay();
}

function closeFeedbackPane() {
  document.getElementById('workspace-layout-container').classList.remove('submitted');
}

// --- History / Submission Storage ---
function getHistory() {
  const history = localStorage.getItem("writing_history");
  return history ? JSON.parse(history) : [];
}

function saveSubmission(score, wordCount, content) {
  const history = getHistory();
  const submission = {
    id: Date.now(),
    date: new Date().toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    catId: currentCategory.id,
    catTitleVi: currentCategory.title_vi,
    topicId: currentTopic.id,
    topicTitle: currentTopic.title_en,
    wordCount: wordCount,
    score: score,
    content: content,
    outlineLevel: currentOutlineLevel,
    sampleLevel: currentSampleLevel
  };
  
  history.unshift(submission); // Add to beginning
  localStorage.setItem("writing_history", JSON.stringify(history));
}

function renderHistory() {
  const tbody = document.getElementById('history-table-body');
  const history = getHistory();
  
  if (history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">Chưa có lịch sử làm bài nào được ghi lại. Hãy chọn đề và luyện tập viết ngay nhé!</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = '';
  history.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.date}</td>
      <td>${item.catTitleVi}</td>
      <td style="font-weight: 500;">${item.topicId}. ${item.topicTitle}</td>
      <td>${item.wordCount} từ</td>
      <td><strong style="color: var(--accent-primary); font-size: 1.05rem;">${item.score.toFixed(1)}</strong> / 10</td>
      <td>
        <button class="history-action-btn" onclick="reviewSubmission(${item.id})">Xem lại & So sánh</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function reviewSubmission(submissionId) {
  const history = getHistory();
  const sub = history.find(item => item.id === submissionId);
  if (!sub) return;
  
  // Load workspace context but set in submitted/feedback state
  const category = ESSAY_DATA.find(cat => cat.id === sub.catId);
  const topic = category.topics.find(t => t.id === sub.topicId);
  
  currentCategory = category;
  currentTopic = topic;
  currentOutlineLevel = sub.outlineLevel || 'B1';
  currentSampleLevel = sub.sampleLevel || 'B1';
  currentTransLevel = sub.outlineLevel || 'B1';
  
  // Switch to Workspace Screen
  switchScreen('workspace');
  
  // Setup Workspace Headers
  document.getElementById('workspace-topic-title').innerText = topic.title_en;
  document.getElementById('workspace-topic-category').innerText = category.title_vi;
  
  const badge = document.getElementById('workspace-enrichment-badge');
  if (topic.has_full_details) {
    badge.innerText = 'Đã cập nhật';
    badge.style.background = 'var(--accent-gradient)';
  } else {
    badge.innerText = 'Đang cập nhật';
    badge.style.background = 'var(--panel-border)';
    badge.style.color = 'var(--text-secondary)';
  }
  
  document.getElementById('ws-prompt-en').innerText = topic.context ? `${topic.context}\n\n${topic.prompt}` : topic.prompt;
  document.getElementById('ws-prompt-vi').innerHTML = getPromptTranslation(topic, category);
  
  // Paraphrases
  const paraphraseContainer = document.getElementById('ws-paraphrase-container');
  const paraphraseList = document.getElementById('ws-paraphrase-list');
  paraphraseList.innerHTML = '';
  
  if (topic.paraphrases && topic.paraphrases.length > 0) {
    paraphraseContainer.style.display = 'block';
    topic.paraphrases.forEach(p => {
      const li = document.createElement('li');
      li.innerText = p;
      paraphraseList.appendChild(li);
    });
  } else {
    paraphraseContainer.style.display = 'none';
  }
  
  // Vocab
  const vocabList = document.getElementById('ws-vocab-list');
  vocabList.innerHTML = '';
  if (topic.has_full_details && topic.details && topic.details.vocab && topic.details.vocab.length > 0) {
    topic.details.vocab.forEach(v => {
      const card = document.createElement('div');
      card.className = 'flashcard-wrapper';
      card.onclick = () => card.classList.toggle('flipped');
      card.innerHTML = `
        <div class="flashcard">
          <div class="flashcard-front">
            <span class="vocab-word">${v.en}</span>
            <span class="vocab-type">Collocation</span>
          </div>
          <div class="flashcard-back">
            <span class="vocab-translation">${v.vi}</span>
            <span class="vocab-hint">Chạm để đóng</span>
          </div>
        </div>
      `;
      vocabList.appendChild(card);
    });
  } else {
    vocabList.innerHTML = '<div class="empty-state">Không có danh sách từ vựng gợi ý.</div>';
  }
  
  renderOutline();
  renderVietnameseOutline();
  
  // Set Step 3 writing pane and editor content
  document.getElementById('essay-textarea').value = sub.content;
  updateWordCount();
  
  // Set submission flag to true to avoid timer/toast trigger in switchStep
  hasSubmitted = true;
  
  // Switch to Step 3 to show feedback
  switchStep(3);
  
  // Re-run evaluation to populate feedback details
  submitEssay(); 
}

// --- Render Saved Drafts Screen ---
function renderDrafts() {
  const container = document.getElementById('drafts-list-container');
  container.innerHTML = '';
  
  const drafts = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("draft_")) {
      const parts = key.split("_");
      const catId = parseInt(parts[1]);
      const topicId = parseInt(parts[2]);
      const text = localStorage.getItem(key);
      
      const category = ESSAY_DATA.find(cat => cat.id === catId);
      if (category) {
        const topic = category.topics.find(t => t.id === topicId);
        if (topic) {
          drafts.push({
            key: key,
            catId: catId,
            catTitleVi: category.title_vi,
            topicId: topicId,
            topicTitle: topic.title_en,
            text: text,
            wordCount: text.trim() === "" ? 0 : text.trim().split(/\s+/).length
          });
        }
      }
    }
  }
  
  if (drafts.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: span 3; padding: 4rem;">
        Chưa có bản nháp nào được lưu. Hãy thử gõ văn bản trong phòng luyện viết, hệ thống sẽ tự động tạo bản nháp.
      </div>
    `;
    return;
  }
  
  drafts.forEach(draft => {
    const card = document.createElement('div');
    card.className = 'topic-card';
    card.onclick = () => startPractice(draft.catId, draft.topicId);
    
    // Create preview
    const preview = draft.text.length > 90 ? draft.text.substring(0, 90) + "..." : draft.text;
    
    card.innerHTML = `
      <div class="card-header">
        <span class="category-tag tag-adv">${draft.catTitleVi}</span>
        <span class="detail-badge" style="background-color: var(--warning-bg); color: var(--warning)">Nháp (${draft.wordCount} từ)</span>
      </div>
      <div class="card-body">
        <h4 style="font-size: 1rem; margin-bottom: 0.5rem;">${draft.topicId}. ${draft.topicTitle}</h4>
        <p style="font-size: 0.825rem; color: var(--text-muted); line-height: 1.4; white-space: pre-line;">"${preview}"</p>
      </div>
      <div class="card-footer" style="margin-top: 1rem;">
        <button class="history-action-btn" onclick="event.stopPropagation(); deleteDraft('${draft.key}')" style="color: var(--danger)">Xóa nháp</button>
        <div class="start-btn" style="color: var(--warning);">
          Viết tiếp
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function deleteDraft(key) {
  if (confirm("Bạn có chắc chắn muốn xóa bản nháp này?")) {
    localStorage.removeItem(key);
    renderDrafts();
    updateStats();
    showToast("Đã xóa bản nháp thành công.", "success");
  }
}

// --- Dynamic Stats calculation ---
function updateStats() {
  const history = getHistory();
  
  // 1. Completed essays
  document.getElementById('stat-completed-count').innerText = history.length;
  
  // 2. Drafts count
  let draftsCount = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).startsWith("draft_")) draftsCount++;
  }
  document.getElementById('stat-draft-count').innerText = draftsCount;
  
  // 3. Vocab accumulated
  let totalVocab = 0;
  ESSAY_DATA.forEach(cat => {
    cat.topics.forEach(t => {
      if (t.has_full_details && t.details && t.details.vocab) {
        totalVocab += t.details.vocab.length;
      }
    });
  });
  document.getElementById('stat-vocab-count').innerText = totalVocab;
  
  // 4. Average score
  let avgScore = 0.0;
  if (history.length > 0) {
    const sum = history.reduce((acc, item) => acc + item.score, 0);
    avgScore = sum / history.length;
  }
  document.getElementById('stat-avg-score').innerText = avgScore.toFixed(1);
}

// --- Side-by-Side Comparison Modal Controls ---
function openComparisonModal() {
  const text = document.getElementById('essay-textarea').value;
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  
  document.getElementById('compare-user-header').innerText = `Bài viết của bạn (${words} từ)`;
  document.getElementById('compare-user-text').innerText = text;
  
  const modalHeader = document.getElementById('compare-model-header');
  const modalText = document.getElementById('compare-model-text');
  
  modalHeader.innerText = `Bài giải mẫu VSTEP ${currentSampleLevel}`;
  
  const topic = currentTopic;
  if (topic && topic.has_full_details && topic.details) {
    const essayText = currentSampleLevel === 'B1' ? topic.details.sample_b1 : topic.details.sample_b2;
    modalText.innerHTML = essayText;
  } else {
    modalText.innerHTML = '<div class="empty-state">Không có bài viết mẫu cho chủ đề này.</div>';
  }
  
  document.getElementById('comparison-modal').classList.add('active');
}

function closeComparisonModal() {
  document.getElementById('comparison-modal').classList.remove('active');
}

// --- Toast notification helpers ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 18px; height: 18px;">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  `; 
  
  if (type === 'warning') {
    icon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 18px; height: 18px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    `;
  } else if (type === 'danger') {
    icon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 18px; height: 18px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    `;
  }
  
  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after 3.5 seconds
  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s reverse forwards";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// Get Vietnamese translation of the essay prompt context and question
function getPromptTranslation(topic, category) {
  if (!topic) return "";
  
  // Hand-crafted translations for the 5 featured topics
  if (category.id === 1 && topic.id === 1) { // Online learning
    return `<p style="margin-bottom: 0.75rem;"><strong>Ngữ cảnh:</strong> Ngày nay, việc học trực tuyến ngày càng trở nên phổ biến ở nhiều quốc gia. Nhờ sự phát triển của công nghệ, học sinh có thể tham gia các lớp học, xem bài giảng và nộp bài tập qua Internet mà không cần đến trường học hay trường đại học. Một số người tin rằng học trực tuyến mang lại nhiều lợi ích, trong khi những người khác lập luận rằng nó cũng có một vài hạn chế.</p>
            <p><strong>Yêu cầu đề bài:</strong> Hãy viết một bài luận gửi đến một độc giả có học thức để thảo luận về những lợi ích và tác hại của việc học trực tuyến. Đưa ra các lý do và ví dụ liên quan để hỗ trợ cho câu trả lời của bạn. Bạn nên viết ít nhất 250 từ. Bài làm của bạn sẽ được đánh giá dựa trên các tiêu chí: Hoàn thành nhiệm vụ, Bố cục bài viết, Từ vựng và Ngữ pháp.</p>`;
  }
  if (category.id === 1 && topic.id === 2) { // Studying abroad
    return `<p style="margin-bottom: 0.75rem;"><strong>Ngữ cảnh:</strong> Ngày nay, du học đã trở thành một lựa chọn phổ biến của nhiều học sinh, sinh viên. Một số học sinh tin rằng việc học tập ở một quốc gia khác mang lại cho họ cơ hội giáo dục tốt hơn và giúp họ trải nghiệm một nền văn hóa mới. Tuy nhiên, những người khác lập luận rằng điều đó cũng có thể mang lại nhiều thách thức, chẳng hạn như chi phí sinh hoạt cao, nỗi nhớ nhà và sự khác biệt về văn hóa.</p>
            <p><strong>Yêu cầu đề bài:</strong> Hãy viết một bài luận gửi đến một độc giả có học thức để thảo luận về những lợi ích và tác hại của việc đi du học. Đưa ra các lý do và ví dụ liên quan để hỗ trợ cho câu trả lời của bạn. Bạn nên viết ít nhất 250 từ. Bài làm của bạn sẽ được đánh giá dựa trên các tiêu chí: Hoàn thành nhiệm vụ, Bố cục bài viết, Từ vựng và Ngữ pháp.</p>`;
  }
  if (category.id === 2 && topic.id === 1) { // Traffic jams
    return `<p style="margin-bottom: 0.75rem;"><strong>Ngữ cảnh:</strong> Ùn tắc giao thông đã trở thành một vấn đề nghiêm trọng ở nhiều thành phố trên thế giới. Khi dân số đô thị tiếp tục tăng và số lượng phương tiện cá nhân ngày càng nhiều, đường sá trở nên đông đúc hơn và hệ thống giao thông phải đối mặt với áp lực lớn hơn. Tình trạng tắc nghẽn giao thông ảnh hưởng đến cuộc sống hàng ngày, gây ra sự chậm trễ và tạo ra các vấn đề về kinh tế cũng như môi trường.</p>
            <p><strong>Yêu cầu đề bài:</strong> Hãy viết một bài luận gửi đến một độc giả có học thức để thảo luận về các nguyên nhân gây ùn tắc giao thông và đề xuất các giải pháp khả thi cho vấn đề này. Đưa ra các lý do và ví dụ liên quan để hỗ trợ cho câu trả lời của bạn. Bạn nên viết ít nhất 250 từ. Bài làm của bạn sẽ được đánh giá dựa trên các tiêu chí: Hoàn thành nhiệm vụ, Bố cục bài viết, Từ vựng và Ngữ pháp.</p>`;
  }
  if (category.id === 3 && topic.id === 1) { // Mobile phones should be banned in primary schools
    return `<p style="margin-bottom: 0.75rem;"><strong>Ngữ cảnh:</strong> Điện thoại di động đã trở thành một phần thiết yếu của cuộc sống hàng ngày và được sử dụng rộng rãi để liên lạc, học tập và giải trí. Tuy nhiên, đang có những tranh luận liên tục về việc liệu trẻ em có nên được phép sử dụng điện thoại di động ở trường hay không. Một số người tin rằng điện thoại di động có thể hỗ trợ việc học và giúp học sinh giữ kết nối với gia đình, trong khi những người khác lập luận rằng chúng có thể gây xao nhãng và ảnh hưởng tiêu cực đến sự phát triển và giáo dục của trẻ.</p>
            <p><strong>Yêu cầu đề bài:</strong> Bạn đồng ý hay phản đối ở mức độ nào với ý kiến cho rằng điện thoại di động nên bị cấm ở các trường tiểu học? Đưa ra các lý do và ví dụ liên quan để hỗ trợ cho câu trả lời của bạn. Bạn nên viết ít nhất 250 từ. Bài làm của bạn sẽ được đánh giá dựa trên các tiêu chí: Hoàn thành nhiệm vụ, Bố cục bài viết, Từ vựng và Ngữ pháp.</p>`;
  }
  if (category.id === 4 && topic.id === 1) { // Children should or should not read picture books
    return `<p style="margin-bottom: 0.75rem;"><strong>Ngữ cảnh:</strong> Việc đọc đóng vai trò quan trọng trong sự phát triển của trẻ nhỏ, và sách tranh là một trong những tài liệu đọc phổ biến nhất đối với trẻ em. Một số người tin rằng sách tranh rất thú vị, dễ hiểu và khuyến khích trẻ phát triển thói quen đọc sách. Những người khác lại lập luận rằng sách tranh có thể làm giảm trí tưởng tượng và khả năng sáng tạo của trẻ, tương tự như tác hại của việc xem tivi.</p>
            <p><strong>Yêu cầu đề bài:</strong> Hãy thảo luận về cả hai quan điểm và đưa ra ý kiến của riêng bạn. Đưa ra các lý do và ví dụ liên quan để hỗ trợ cho câu trả lời của bạn. Bạn nên viết ít nhất 250 từ. Bài làm của bạn sẽ được đánh giá dựa trên các tiêu chí: Hoàn thành nhiệm vụ, Bố cục bài viết, Từ vựng và Ngữ pháp.</p>`;
  }

  // Generative translation template for all other 171 topics
  const titleVi = topic.title_vi || "";
  const titleViLower = titleVi.charAt(0).toLowerCase() + titleVi.slice(1);
  
  if (category.id === 1) { // Advantages & Disadvantages
    return `<p style="margin-bottom: 0.75rem;"><strong>Ngữ cảnh:</strong> Ngày nay, chủ đề về <strong>${titleViLower}</strong> đã trở nên phổ biến và thu hút nhiều sự quan tâm. Một số người tin rằng điều này mang lại nhiều lợi ích thiết thực, trong khi những người khác lập luận rằng nó cũng đi kèm với một số tác hại không mong muốn.</p>
            <p><strong>Yêu cầu đề bài:</strong> Hãy viết một bài luận gửi đến một độc giả có học thức để thảo luận về những lợi ích và tác hại của <strong>${titleViLower}</strong>. Đưa ra các lý do và ví dụ liên quan để hỗ trợ cho câu trả lời của bạn. Bạn nên viết ít nhất 250 từ. Bài làm của bạn sẽ được đánh giá dựa trên các tiêu chí: Hoàn thành nhiệm vụ, Bố cục bài viết, Từ vựng và Ngữ pháp.</p>`;
  }
  
  if (category.id === 2) { // Causes & Solutions
    return `<p style="margin-bottom: 0.75rem;"><strong>Ngữ cảnh:</strong> Hiện nay, vấn đề <strong>${titleViLower}</strong> đang trở thành một thách thức đáng lo ngại ở nhiều nơi. Tình trạng này gây ra nhiều ảnh hưởng tiêu cực đến đời sống xã hội cũng như sự phát triển bền vững của cộng đồng.</p>
            <p><strong>Yêu cầu đề bài:</strong> Hãy viết một bài luận gửi đến một độc giả có học thức để phân tích nguyên nhân của <strong>${titleViLower}</strong> và đề xuất giải pháp khả thi nhằm khắc phục tình trạng này. Đưa ra các lý do và ví dụ liên quan để hỗ trợ cho câu trả lời của bạn. Bạn nên viết ít nhất 250 từ. Bài làm của bạn sẽ được đánh giá dựa trên các tiêu chí: Hoàn thành nhiệm vụ, Bố cục bài viết, Từ vựng và Ngữ pháp.</p>`;
  }
  
  if (category.id === 3) { // Opinion Essays
    return `<p style="margin-bottom: 0.75rem;"><strong>Ngữ cảnh:</strong> Hiện nay, ý kiến về việc <strong>${titleViLower}</strong> đang nhận được nhiều sự quan tâm và tranh luận trái chiều từ công chúng. Có nhiều góc nhìn khác nhau xung quanh tính đúng đắn và hiệu quả của quan điểm này.</p>
            <p><strong>Yêu cầu đề bài:</strong> Bạn đồng ý hay phản đối ở mức độ nào với ý kiến cho rằng <strong>${titleViLower}</strong>? Đưa ra các lý do và ví dụ liên quan để hỗ trợ cho câu trả lời của bạn. Bạn nên viết ít nhất 250 từ. Bài làm của bạn sẽ được đánh giá dựa trên các tiêu chí: Hoàn thành nhiệm vụ, Bố cục bài viết, Từ vựng và Ngữ pháp.</p>`;
  }
  
  if (category.id === 4) { // Discussion Essays
    return `<p style="margin-bottom: 0.75rem;"><strong>Ngữ cảnh:</strong> Trong xã hội hiện đại, vấn đề liên quan đến việc <strong>${titleViLower}</strong> đang gây ra nhiều ý kiến tranh cãi. Một bộ phận dư luận ủng hộ xu hướng này, trong khi nhóm khác lại thể hiện sự lo ngại hoặc phản đối.</p>
            <p><strong>Yêu cầu đề bài:</strong> Hãy thảo luận về cả hai quan điểm trên và đưa ra ý kiến cá nhân của riêng bạn. Đưa ra các lý do và ví dụ liên quan để hỗ trợ cho câu trả lời của bạn. Bạn nên viết ít nhất 250 từ. Bài làm của bạn sẽ được đánh giá dựa trên các tiêu chí: Hoàn thành nhiệm vụ, Bố cục bài viết, Từ vựng và Ngữ pháp.</p>`;
  }
  
  // Default fallback
  return `<p>Đề bài: ${topic.title_vi}</p>`;
}

// Get specific subtype label for a topic card
function getTopicSubtypeLabel(topic, catId) {
  if (catId === 1) {
    if (topic.title_vi.includes('chỉ phân tích')) {
      return "CHỈ PHÂN TÍCH THUẬN LỢI";
    }
    return "THUẬN LỢI & BẤT LỢI";
  }
  if (catId === 2) {
    const rawTag = (topic.tags || '').trim();
    let firstTag = '';
    if (rawTag.includes(']')) {
      firstTag = rawTag.split(']')[0].trim() + ']';
    } else {
      firstTag = rawTag;
    }
    firstTag = firstTag.toLowerCase();
    
    if (firstTag === '[causes & solutions]' || firstTag === '[problems & solutions]') {
      return "NGUYÊN NHÂN & GIẢI PHÁP";
    } else if (firstTag === '[causes & effects]' || firstTag === '[causes & effects – on youth and society]') {
      return "NGUYÊN NHÂN & ẢNH HƯỞNG";
    } else if (firstTag === '[effects & solutions]' || firstTag === '[impacts & solutions]') {
      return "ẢNH HƯỞNG & GIẢI PHÁP";
    } else if (firstTag === '[causes]' || firstTag === '[factors]' || firstTag === '[causes / factors]' || firstTag === '[causes / reasons]') {
      return "CHỈ PHÂN TÍCH NGUYÊN NHÂN";
    } else if (firstTag === '[effects]' || firstTag === '[positive & negative effects]') {
      return "CHỈ PHÂN TÍCH ẢNH HƯỞNG";
    } else if (firstTag === '[measures]' || firstTag === '[solutions]' || firstTag === '[measures / solutions]') {
      return "CHỈ PHÂN TÍCH GIẢI PHÁP";
    }
    return "NGUYÊN NHÂN – TÁC ĐỘNG – GIẢI PHÁP";
  }
  if (catId === 3) {
    return "Ý KIẾN (AGREE / DISAGREE)";
  }
  if (catId === 4) {
    return "BÀN LUẬN (DISCUSS BOTH VIEWS)";
  }
  return "";
}

// Toggle vocab hints in Step 2 translation exercises
function toggleVocabHints(idx) {
  const container = document.getElementById(`trans-vocab-hints-${idx}`);
  if (!container) return;
  const btn = container.previousElementSibling;
  const chevron = btn.querySelector('.chevron');
  
  if (container.style.display === 'none') {
    container.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    btn.querySelector('span').innerText = '💡 Ẩn gợi ý từ vựng ';
  } else {
    container.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    btn.querySelector('span').innerText = '💡 Hiện gợi ý từ vựng ';
  }
}

// Get specific paraphrase expressions based on the current topic title
function getTopicParaphrases(topic) {
  if (!topic) return [];
  
  // Use custom database paraphrases if available
  if (topic.paraphrases) {
    if (Array.isArray(topic.paraphrases) && topic.paraphrases.length > 0) {
      return topic.paraphrases.map(p => {
        if (typeof p === 'string') {
          return { en: p, vi: "" };
        }
        return { en: p.en || "", vi: p.vi || "" };
      });
    } else if (typeof topic.paraphrases === 'object') {
      return topic.paraphrases;
    }
  }
  
  const title = topic.title_en.toLowerCase();
  
  if (title.includes("online learning") || title.includes("studying at school instead of online")) {
    return [
      { en: "Distance learning / Distance education", vi: "Học từ xa" },
      { en: "E-learning / Online education", vi: "Học tập trực tuyến" },
      { en: "Digital education / Virtual schooling", vi: "Giáo dục kỹ thuật số / lớp học ảo" },
      { en: "Web-based learning / Internet-based study", vi: "Học tập qua mạng internet" }
    ];
  }
  
  if (title.includes("studying abroad") || title.includes("studying in another country")) {
    return [
      { en: "Studying abroad / Studying overseas", vi: "Du học / Học tập ở nước ngoài" },
      { en: "Pursuing higher education in a foreign country", vi: "Theo đuổi giáo dục bậc cao ở quốc gia khác" },
      { en: "International education / Overseas study", vi: "Giáo dục quốc tế / Học tập tại nước ngoài" },
      { en: "Learning in a foreign academic environment", vi: "Học tập trong môi trường học thuật nước ngoài" }
    ];
  }
  
  if (title.includes("internet")) {
    return [
      { en: "The Internet / The world wide web", vi: "Mạng Internet / Mạng lưới toàn cầu" },
      { en: "Digital networks / Online platforms", vi: "Mạng lưới kỹ thuật số / Nền tảng trực tuyến" },
      { en: "Global cyber network", vi: "Mạng không gian mạng toàn cầu" },
      { en: "Information highway", vi: "Xa lộ thông tin" }
    ];
  }
  
  if (title.includes("homeschooling")) {
    return [
      { en: "Homeschooling / Home-based education", vi: "Học tập tại nhà / Giáo dục tại nhà" },
      { en: "Schooling at home / Domestic learning", vi: "Học ở nhà / Học tập tại gia đình" },
      { en: "Parent-led education", vi: "Giáo dục do cha mẹ hướng dẫn" },
      { en: "Educating children outside of traditional schools", vi: "Giáo dục trẻ em ngoài trường học truyền thống" }
    ];
  }
  
  if (title.includes("public transport")) {
    return [
      { en: "Public transport / Public transit", vi: "Giao thông công cộng / Vận tải công cộng" },
      { en: "Mass transportation / Mass transit systems", vi: "Hệ thống vận tải đại chúng" },
      { en: "Commuter buses and trains", vi: "Xe buýt và tàu hỏa chở khách đi lại hàng ngày" },
      { en: "State-funded transit services", vi: "Dịch vụ vận tải do nhà nước tài trợ" }
    ];
  }
  
  if (title.includes("working from home")) {
    return [
      { en: "Working from home / Remote working", vi: "Làm việc tại nhà / Làm việc từ xa" },
      { en: "Telecommuting / Home-based work", vi: "Làm việc từ xa qua mạng / Công việc tại nhà" },
      { en: "Flexible location working", vi: "Làm việc có địa điểm linh hoạt" },
      { en: "Performing job duties from one's residence", vi: "Thực hiện nhiệm vụ công việc từ nơi ở cá nhân" }
    ];
  }

  if (title.includes("nuclear family")) {
    return [
      { en: "Nuclear family / Nuclear household", vi: "Gia đình hạt nhân" },
      { en: "Two-generation family unit", vi: "Đơn vị gia đình hai thế hệ (cha mẹ và con cái)" },
      { en: "Small family structure", vi: "Cấu trúc gia đình nhỏ" }
    ];
  }

  if (title.includes("extended family")) {
    return [
      { en: "Extended family / Multi-generational household", vi: "Gia đình lớn / Hộ gia đình nhiều thế hệ" },
      { en: "Large family structure", vi: "Cấu trúc gia đình lớn" },
      { en: "Living with grandparents, parents, and relatives", vi: "Sống chung với ông bà, bố mẹ và họ hàng" }
    ];
  }

  // Fallback templates with keywords from the topic title
  const cleanTitle = topic.title_en.replace(/advantages\s*&\s*disadvantages\s*of\s*/i, "").replace(/pros\s*&\s*cons\s*of\s*/i, "");
  return [
    { en: `It is believed by many that ${cleanTitle.toLowerCase()}...`, vi: `Nhiều người tin rằng ${topic.title_vi.toLowerCase()}...` },
    { en: `A highly controversial topic is whether ${cleanTitle.toLowerCase()} is beneficial...`, vi: `Một chủ đề gây nhiều tranh cãi là liệu ${topic.title_vi.toLowerCase()} có mang lại lợi ích...` },
    { en: `There is a growing concern about the impacts of ${cleanTitle.toLowerCase()}...`, vi: `Ngày càng có nhiều sự lo ngại về những tác động của ${topic.title_vi.toLowerCase()}...` }
  ];
}

// Render Step 1 Reading & Analysis
function renderStep1Reading() {
  const container = document.getElementById('ws-step1-reading-content');
  if (!container) return;
  container.innerHTML = '';
  
  const topic = currentTopic;
  const category = currentCategory;
  if (!topic) return;
  
  const promptEn = topic.context ? `${topic.context}\n\n${topic.prompt}` : topic.prompt;
  const promptVi = getPromptTranslation(topic, category);
  
  const paraphrases = getTopicParaphrases(topic);
  let paraphraseHtml = '';
  if (paraphrases) {
    if (Array.isArray(paraphrases) && paraphrases.length > 0) {
      paraphraseHtml = `
        <ul class="paraphrase-list">
          ${paraphrases.map(p => `<li><strong>${p.en}</strong>${p.vi ? ` (${p.vi})` : ''}</li>`).join('')}
        </ul>
      `;
    } else if (typeof paraphrases === 'object' && !Array.isArray(paraphrases)) {
      let partsHtml = [];
      if (paraphrases.view1) {
        partsHtml.push(`
          <div class="viewpoint-paraphrase-section" style="margin-bottom: 1.25rem;">
            <div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 0.5rem; font-size: 0.95rem; display: flex; align-items: flex-start; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; white-space: nowrap; padding-top: 2px;">
                <span class="badge" style="background-color: rgba(99, 102, 241, 0.15); color: var(--accent-primary); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">VIEW 1</span>
                <span>Quan điểm gốc 1:</span>
              </div>
              <span style="color: var(--text-primary); font-weight: 500;">"${paraphrases.view1.title_en}" (${paraphrases.view1.title_vi})</span>
            </div>
            <ul class="paraphrase-list">
              ${paraphrases.view1.items.map(p => `<li><strong>${p.en}</strong>${p.vi ? ` (${p.vi})` : ''}</li>`).join('')}
            </ul>
          </div>
        `);
      }
      if (paraphrases.view2) {
        partsHtml.push(`
          <div class="viewpoint-paraphrase-section">
            <div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 0.5rem; font-size: 0.95rem; display: flex; align-items: flex-start; gap: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; white-space: nowrap; padding-top: 2px;">
                <span class="badge" style="background-color: rgba(99, 102, 241, 0.15); color: var(--accent-primary); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">VIEW 2</span>
                <span>Quan điểm gốc 2:</span>
              </div>
              <span style="color: var(--text-primary); font-weight: 500;">"${paraphrases.view2.title_en}" (${paraphrases.view2.title_vi})</span>
            </div>
            <ul class="paraphrase-list">
              ${paraphrases.view2.items.map(p => `<li><strong>${p.en}</strong>${p.vi ? ` (${p.vi})` : ''}</li>`).join('')}
            </ul>
          </div>
        `);
      }
      paraphraseHtml = partsHtml.join('');
    }
  }
  
  let outlineSummaryHtml = '';
  let outlineIntroText = 'Định hướng các luận điểm chính mà bạn sẽ phân tích trong bài viết:';
  
  if (topic.has_full_details && topic.details) {
    if (category.id === 3) {
      outlineIntroText = 'Đối với đề này, phương án ĐỒNG Ý sẽ dễ diễn đạt hơn. Sau đây là những LÝ DO CHÍNH để bảo vệ quan điểm:';
    } else if (category.id === 4) {
      outlineIntroText = 'Sau đây là những LUẬN ĐIỂM CHÍNH của hai quan điểm trái chiều và ý kiến cá nhân:';
    }
    
    const formatPoint = (p, defaultLabel) => {
      let label = defaultLabel;
      if (p.title && p.title.includes(':')) {
        label = p.title.split(':')[0].trim();
      }
      return `<li><strong>${label}:</strong> ${p.point_vi}</li>`;
    };

    const b1Benefits = (topic.details.ideas_b1.benefits || []).map(b => formatPoint(b, 'LỢI ÍCH')).join('');
    const b1Drawbacks = (topic.details.ideas_b1.drawbacks || []).map(d => formatPoint(d, 'BẤT LỢI')).join('');
    
    outlineSummaryHtml = `
      <ul class="outline-summary-list">
        ${b1Benefits}
        ${b1Drawbacks}
      </ul>
    `;
  } else {
    outlineSummaryHtml = `
      <div class="empty-state" style="padding: 1.5rem; border: 1px dashed var(--panel-border); text-align: left; font-size: 0.9rem; border-radius: var(--radius-md);">
        Chủ đề tự viết tự do này không có dàn ý ý tưởng sẵn. Bạn có thể dựa trên cấu trúc chuẩn của thể loại này để triển khai:
        <ul style="padding-left: 1.25rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem;">
          <li>Mở bài (Introduction): Nêu ngữ cảnh và quan điểm tổng quan.</li>
          <li>Thân bài đoạn 1 (Body Paragraph 1): Phân tích khía cạnh thứ nhất (thuận lợi / nguyên nhân).</li>
          <li>Thân bài đoạn 2 (Body Paragraph 2): Phân tích khía cạnh thứ hai (bất lợi / giải pháp).</li>
          <li>Kết bài (Conclusion): Tóm tắt lại vấn đề và đưa ra ý kiến chốt hạ.</li>
        </ul>
      </div>
    `;
  }
  
  container.innerHTML = `
    <div class="reading-section-card">
      <h3>Dịch & Phân tích đề bài</h3>
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <h5 style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.35rem; font-weight: 700; letter-spacing: 0.05em;">ĐỀ BÀI TIẾNG ANH:</h5>
          <div style="font-size: 0.95rem; line-height: 1.5; color: var(--text-primary); white-space: pre-line; background-color: var(--bg-primary); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--panel-border); font-family: inherit;">${promptEn}</div>
        </div>
        <div>
          <h5 style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.35rem; font-weight: 700; letter-spacing: 0.05em;">BẢN DỊCH TIẾNG VIỆT:</h5>
          <div style="font-size: 0.95rem; line-height: 1.5; color: var(--text-primary); background-color: var(--bg-primary); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--panel-border); font-family: inherit;">${promptVi}</div>
        </div>
      </div>
    </div>
    
    <div class="reading-section-card">
      <h3>Gợi ý diễn đạt lại chủ đề (Paraphrases)</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">Sử dụng các từ đồng nghĩa hoặc cấu trúc khác dưới đây để viết phần mở bài (Introduction) tránh lặp từ khóa của đề:</p>
      ${paraphraseHtml}
    </div>
    
    <div class="reading-section-card">
      <h3>Gợi ý tóm tắt ý tưởng sẽ viết</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${outlineIntroText}</p>
      ${outlineSummaryHtml}
    </div>
    
    <div style="text-align: right; margin: 1rem 0 2rem 0;">
      <button class="btn btn-primary" style="padding: 0.75rem 2rem; font-size: 1rem; box-shadow: var(--shadow-glow);" onclick="switchStep(2)">
        TIẾP THEO: LUYỆN DIỄN ĐẠT Ý TƯỞNG CỤ THỂ →
      </button>
    </div>
  `;
}

// Render Step 4 Model Essays
function renderStep4ModelEssay() {
  const container = document.getElementById('ws-model-step-view');
  if (!container) return;
  container.innerHTML = '';
  
  const topic = currentTopic;
  if (!topic) return;
  
  if (!topic.has_full_details || !topic.details) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 4rem 1.5rem;">
        <h3 style="font-family: var(--font-display); font-size: 1.25rem; margin-bottom: 0.5rem;">Không có bài mẫu</h3>
        <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto; line-height: 1.5;">
          Xin lỗi, chủ đề tự viết tự do này hiện chưa có bài giải mẫu được lưu trữ trong cơ sở dữ liệu.
        </p>
      </div>
    `;
    return;
  }
  
  const essayText = currentSampleLevel === 'B1' ? topic.details.sample_b1 : topic.details.sample_b2;
  const translationText = currentSampleLevel === 'B1' ? topic.details.translation_b1 : topic.details.translation_b2;
  
  let vocabNotesHtml = '';
  if (topic.details.key_vocab_notes && topic.details.key_vocab_notes.length > 0) {
    const listItems = topic.details.key_vocab_notes.map(v => `
      <li><strong>${v.en}</strong>: ${v.vi}</li>
    `).join('');
    vocabNotesHtml = `
      <div class="vocab-notes-card" style="margin-top: 1.5rem;">
        <h4>Cụm từ vựng quan trọng cần lưu ý</h4>
        <ul class="vocab-notes-list">
          ${listItems}
        </ul>
      </div>
    `;
  }
  
  container.innerHTML = `
    <div class="essay-comparison-grid">
      <div class="essay-col">
        <h4>BÀI LUẬN TIẾNG ANH (${currentSampleLevel})</h4>
        <div class="essay-text-content" style="white-space: pre-wrap; font-family: inherit; font-size: 1rem; line-height: 1.7; color: var(--text-primary); text-align: justify;">${essayText}</div>
      </div>
      <div class="essay-col">
        <h4>BẢN DỊCH TIẾNG VIỆT</h4>
        <div class="essay-text-content" style="white-space: pre-wrap; font-family: inherit; font-size: 1rem; line-height: 1.7; color: var(--text-primary); text-align: justify;">${translationText || 'Đang tải bản dịch...'}</div>
      </div>
    </div>
    ${vocabNotesHtml}
  `;
}

// Function to switch level in Step 4
function switchModelEssayLevel(level) {
  currentSampleLevel = level;
  
  document.getElementById('ws-model-level-b1').classList.remove('active');
  document.getElementById('ws-model-level-b2').classList.remove('active');
  document.getElementById(`ws-model-level-${level.toLowerCase()}`).classList.add('active');
  
  renderStep4ModelEssay();
}
