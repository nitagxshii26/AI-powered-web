// Environment fallback for client-side (Note: Ideally keys come from server or user input in a real prod app without auth)
// For this demo, we'll assume Supabase URL and Anon Key are hardcoded here or fetched securely.
// YOU MUST REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://ovucqztgxnfwdvgxglmi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iVltdSB8DzhDCvmYjD7NWQ_6Dg1uGQD';

let supabaseClient;
if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Global State
let currentFlashcards = [];
let currentIndex = 0;

// DOM Elements
const textInput = document.getElementById('textInput');
const generateBtn = document.getElementById('generateBtn');
const errorMsg = document.getElementById('errorMsg');
const flashcardSection = document.getElementById('flashcardSection');
const flashcard = document.getElementById('flashcard');
const cardQuestion = document.getElementById('cardQuestion');
const cardAnswer = document.getElementById('cardAnswer');
const cardCounter = document.getElementById('cardCounter');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const saveBtn = document.getElementById('saveBtn');
const saveSuccess = document.getElementById('saveSuccess');

// Page routing logic
const isIndexPage = document.getElementById('generateBtn') !== null;
const isMyCardsPage = document.getElementById('savedCardsGrid') !== null;

if (isIndexPage) {
    initIndexPage();
} else if (isMyCardsPage) {
    initMyCardsPage();
}

function initIndexPage() {
    generateBtn.addEventListener('click', handleGenerate);
    flashcard.addEventListener('click', () => flashcard.classList.toggle('is-flipped'));
    prevBtn.addEventListener('click', showPreviousCard);
    nextBtn.addEventListener('click', showNextCard);
    saveBtn.addEventListener('click', saveCurrentCard);

    // Auto-resize textarea
    textInput.addEventListener('input', function () {
        this.style.height = '200px';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

async function handleGenerate() {
    const text = textInput.value.trim();
    if (!text) {
        showError("Please enter some text to generate flashcards.");
        return;
    }
    if (text.length > 2000) {
        showError("Text is too long. Please keep it under 2000 characters.");
        return;
    }

    setLoading(true);
    hideError();

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            let errMsg = `API Error: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData.error) errMsg = errData.error;
            } catch (e) {}
            throw new Error(errMsg);
        }

        const data = await response.json();

        if (data.flashcards && data.flashcards.length > 0) {
            currentFlashcards = data.flashcards;
            currentIndex = 0;
            displayCurrentCard();
            flashcardSection.classList.remove('hidden');
            // Scroll to cards
            flashcardSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            throw new Error("No flashcards were generated. Please try different text.");
        }
    } catch (err) {
        console.error(err);
        showError(err.message || "An error occurred while generating flashcards.");
    } finally {
        setLoading(false);
    }
}

function displayCurrentCard() {
    const card = currentFlashcards[currentIndex];
    // Reset flip state
    flashcard.classList.remove('is-flipped');

    // Brief timeout to allow un-flip animation before changing text
    setTimeout(() => {
        cardQuestion.textContent = card.question;
        cardAnswer.textContent = card.answer;
        cardCounter.textContent = `${currentIndex + 1} / ${currentFlashcards.length}`;

        // Update buttons
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === currentFlashcards.length - 1;

        // Reset save button state
        saveSuccess.classList.add('hidden');
        saveBtn.disabled = card.saved === true;
        saveBtn.textContent = card.saved ? "Saved" : "Save to My Cards";
    }, 150);
}

function showPreviousCard() {
    if (currentIndex > 0) {
        currentIndex--;
        displayCurrentCard();
    }
}

function showNextCard() {
    if (currentIndex < currentFlashcards.length - 1) {
        currentIndex++;
        displayCurrentCard();
    }
}

async function saveCurrentCard() {
    if (!supabaseClient) {
        showError("Supabase is not initialized. Please set credentials in script.js.");
        return;
    }

    const card = currentFlashcards[currentIndex];
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const { data, error } = await supabaseClient
            .from('flashcards')
            .insert([
                {
                    question: card.question,
                    answer: card.answer
                }
            ]);

        if (error) throw error;

        // Mark as saved
        card.saved = true;
        saveSuccess.classList.remove('hidden');
        saveBtn.textContent = "Saved";

        setTimeout(() => {
            saveSuccess.classList.add('hidden');
        }, 3000);

    } catch (err) {
        console.error("Supabase Error:", err);
        showError("Failed to save card. Did you create the 'flashcards' table?");
        saveBtn.disabled = false;
        saveBtn.textContent = "Save to My Cards";
    }
}

function setLoading(isLoading) {
    const btnText = generateBtn.querySelector('.btn-text');
    const loader = generateBtn.querySelector('.loader');

    if (isLoading) {
        generateBtn.disabled = true;
        btnText.textContent = "Generating...";
        loader.classList.remove('hidden');
    } else {
        generateBtn.disabled = false;
        btnText.textContent = "Generate Flashcards";
        loader.classList.add('hidden');
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

function hideError() {
    errorMsg.classList.add('hidden');
}

// ---- My Cards Page Logic ----

async function initMyCardsPage() {
    const loadingState = document.getElementById('loadingCards');
    const emptyState = document.getElementById('emptyState');
    const cardsGrid = document.getElementById('savedCardsGrid');

    if (!supabaseClient) {
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.querySelector('h2').textContent = "Supabase not configured";
        emptyState.querySelector('p').textContent = "Please add your credentials in script.js";
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('flashcards')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        loadingState.classList.add('hidden');

        if (data && data.length > 0) {
            renderSavedCards(data, cardsGrid);
        } else {
            emptyState.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Error fetching cards:", err);
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.querySelector('h2').textContent = "Error loading cards";
        emptyState.querySelector('p').textContent = "Make sure your Supabase table 'flashcards' exists.";
    }
}

function renderSavedCards(cards, container) {
    container.innerHTML = '';

    cards.forEach(card => {
        const date = new Date(card.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const cardEl = document.createElement('div');
        cardEl.className = 'mini-card';
        cardEl.innerHTML = `
            <div class="mc-question">${escapeHTML(card.question)}</div>
            <div class="mc-answer">${escapeHTML(card.answer)}</div>
            <div class="mc-date">${date}</div>
        `;
        container.appendChild(cardEl);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );
}
