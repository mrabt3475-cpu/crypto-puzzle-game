/**
 * Crypto Puzzle Game - Modern JavaScript Frontend
 */

// API Configuration
const API_URL = localStorage.getItem('apiUrl') || 'http://localhost:3000';

// State Management
const STATE = {
    token: localStorage.getItem('token') || null,
    user: null,
    currentPuzzle: null,
    level: 1,
    points: 0,
    attempts: 3,
    isLogin: true
};

// DOM Elements
const elements = {
    authSection: document.getElementById('authSection'),
    gameSection: document.getElementById('gameSection'),
    leaderboardSection: document.getElementById('leaderboardSection'),
    authForm: document.getElementById('authForm'),
    emailInput: document.getElementById('emailInput'),
    passwordInput: document.getElementById('passwordInput'),
    answerInput: document.getElementById('answerInput'),
    balance: document.getElementById('balance'),
    currentLevel: document.getElementById('currentLevel'),
    totalPoints: document.getElementById('totalPoints'),
    progressFill: document.getElementById('progressFill'),
    puzzleQuestion: document.getElementById('puzzleQuestion'),
    puzzleType: document.getElementById('puzzleType'),
    attempts: document.getElementById('attempts'),
    timer: document.getElementById('timer'),
    hintModal: document.getElementById('hintModal'),
    hintText: document.getElementById('hintText'),
    toastContainer: document.getElementById('toastContainer'),
    navBtns: document.querySelectorAll('.nav-btn'),
    tabBtns: document.querySelectorAll('.tab-btn')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkAuth();
});

// Event Listeners
function initEventListeners() {
    // Auth Form
    elements.authForm.addEventListener('submit', handleAuth);
    
    // Tab Switching
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Navigation
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });
    
    // Answer Input
    elements.answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitAnswer();
    });
    
    // Submit Button
    document.getElementById('submitBtn').addEventListener('click', submitAnswer);
    
    // Hint Modal
    document.querySelector('.puzzle-hint').addEventListener('click', showHint);
    document.querySelector('.close-modal').addEventListener('click', hideHint);
    document.querySelector('.btn-hint').addEventListener('click', useHint);
    
    // Password Toggle
    document.querySelector('.toggle-password').addEventListener('click', togglePassword);
}

// Check Authentication
async function checkAuth() {
    if (STATE.token) {
        try {
            const response = await fetch(`${API_URL}/api/auth/me`, {
                headers: { 'x-auth-token': STATE.token }
            });
            if (response.ok) {
                const data = await response.json();
                STATE.user = data;
                showGame();
                await loadPuzzle();
                await updateBalance();
            } else {
                logout();
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            logout();
        }
    }
}

// Handle Authentication
async function handleAuth(e) {
    e.preventDefault();
    
    const email = elements.emailInput.value;
    const password = elements.passwordInput.value;
    const endpoint = STATE.isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
        showToast('جاري التحقق...', 'info');
        
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            STATE.token = data.token;
            STATE.user = data.user;
            localStorage.setItem('token', data.token);
            
            showToast(STATE.isLogin ? 'مرحباً بعودتك!' : 'تم إنشاء حسابك بنجاح!', 'success');
            showGame();
            await loadPuzzle();
            await updateBalance();
        } else {
            showToast(data.msg || 'حدث خطأ', 'error');
        }
    } catch (err) {
        showToast('فشل الاتصال بالخادم', 'error');
        console.error(err);
    }
}

// Switch Auth Tab
function switchTab(tab) {
    STATE.isLogin = tab === 'login';
    
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    const submitBtn = elements.authForm.querySelector('.btn-primary span');
    submitBtn.textContent = tab === 'login' ? 'دخول' : 'إنشاء حساب';
}

// Show Game Section
function showGame() {
    elements.authSection.style.display = 'none';
    elements.gameSection.style.display = 'block';
    elements.leaderboardSection.style.display = 'none';
    
    elements.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === 'game');
    });
}

// Navigate Between Pages
function navigateTo(page) {
    elements.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    switch(page) {
        case 'game':
            elements.authSection.style.display = 'none';
            elements.gameSection.style.display = 'block';
            elements.leaderboardSection.style.display = 'none';
            break;
        case 'leaderboard':
            elements.authSection.style.display = 'none';
            elements.gameSection.style.display = 'none';
            elements.leaderboardSection.style.display = 'block';
            loadLeaderboard();
            break;
        case 'wallet':
            showToast('قسم المحفظة قريباً!', 'info');
            break;
        case 'profile':
            showToast('قسم الإعدادات قريباً!', 'info');
            break;
    }
}

// Load Puzzle
async function loadPuzzle() {
    try {
        const response = await fetch(`${API_URL}/api/puzzles/current`, {
            headers: { 'x-auth-token': STATE.token }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            STATE.currentPuzzle = data.puzzle;
            STATE.level = data.puzzle.level;
            STATE.attempts = data.attempts || 3;
            
            renderPuzzle(data.puzzle);
            updateProgress();
        } else {
            showToast(data.msg || 'فشل تحميل اللغز', 'error');
        }
    } catch (err) {
        showToast('فشل الاتصال بالخادم', 'error');
        console.error(err);
    }
}

// Render Puzzle
function renderPuzzle(puzzle) {
    elements.currentLevel.textContent = puzzle.level;
    elements.puzzleType.textContent = getPuzzleTypeName(puzzle.type);
    elements.attempts.textContent = STATE.attempts;
    
    let questionHTML = '';
    
    switch(puzzle.type) {
        case 'cipher':
            questionHTML = `
                <div class="puzzle-text">${puzzle.question}</div>
                <div class="code-block">${puzzle.encrypted || puzzle.hint}</div>
            `;
            break;
        case 'math':
            questionHTML = `
                <div class="puzzle-text">${puzzle.question}</div>
                <div class="code-block">${puzzle.equation || ''}</div>
            `;
            break;
        case 'logic':
            questionHTML = `
                <div class="puzzle-text">${puzzle.question}</div>
            `;
            break;
        default:
            questionHTML = `<div class="puzzle-text">${puzzle.question}</div>`;
    }
    
    elements.puzzleQuestion.innerHTML = questionHTML;
    elements.answerInput.value = '';
    elements.answerInput.focus();
}

// Get Puzzle Type Name
function getPuzzleTypeName(type) {
    const types = {
        'cipher': 'لغز تشفير',
        'math': 'لغز رياضي',
        'logic': 'لغز منطق',
        'pattern': 'لغز نمط',
        'riddle': 'أحجية'
    };
    return types[type] || 'لغز';
}

// Submit Answer
async function submitAnswer() {
    const answer = elements.answerInput.value.trim();
    
    if (!answer) {
        showToast('أدخل إجابتك أولاً', 'warning');
        return;
    }
    
    if (!STATE.currentPuzzle) {
        showToast('لا يوجد لغز حالياً', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/puzzles/submit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-auth-token': STATE.token
            },
            body: JSON.stringify({ answer })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.completed) {
                showToast(`🎉恭喜！你完成了第 ${STATE.level} 关！`, 'success');
                STATE.points += data.reward || 10;
                await loadPuzzle();
                await updateBalance();
            } else {
                showToast('إجابة خاطئة، حاول مرة أخرى', 'error');
                STATE.attempts = data.attempts;
                elements.attempts.textContent = STATE.attempts;
                
                if (STATE.attempts <= 0) {
                    showToast('انتهت محاولاتك!', 'error');
                    setTimeout(() => loadPuzzle(), 2000);
                }
            }
        } else {
            showToast(data.msg || 'حدث خطأ', 'error');
        }
    } catch (err) {
        showToast('فشل الاتصال بالخادم', 'error');
        console.error(err);
    }
}

// Update Progress
function updateProgress() {
    const progress = (STATE.level / 20) * 100;
    elements.progressFill.style.width = `${progress}%`;
    elements.totalPoints.textContent = STATE.points;
}

// Update Balance
async function updateBalance() {
    try {
        const response = await fetch(`${API_URL}/api/payment/balance`, {
            headers: { 'x-auth-token': STATE.token }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            elements.balance.textContent = (data.balance || 0).toFixed(2);
        }
    } catch (err) {
        console.error('Failed to update balance:', err);
    }
}

// Show Hint
function showHint() {
    if (STATE.currentPuzzle && STATE.currentPuzzle.hint) {
        elements.hintText.textContent = STATE.currentPuzzle.hint;
        elements.hintModal.classList.add('active');
    } else {
        showToast('لا يوجد تلميح لهذا اللغز', 'info');
    }
}

// Hide Hint
function hideHint() {
    elements.hintModal.classList.remove('active');
}

// Use Hint
async function useHint() {
    if (STATE.points >= 5) {
        STATE.points -= 5;
        updateProgress();
        hideHint();
        showToast('تم استخدام التلميح -5 نقاط', 'success');
    } else {
        showToast('نقاطك غير كافية!', 'error');
    }
}

// Load Leaderboard
async function loadLeaderboard() {
    try {
        const response = await fetch(`${API_URL}/api/leaderboard`);
        const data = await response.json();
        
        if (response.ok) {
            renderLeaderboard(data.leaderboard || []);
        }
    } catch (err) {
        console.error('Failed to load leaderboard:', err);
    }
}

// Render Leaderboard
function renderLeaderboard(players) {
    const list = document.getElementById('leaderboardList');
    
    if (!players.length) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-muted);">لا يوجد لاعبون بعد</p>';
        return;
    }
    
    list.innerHTML = players.map((player, index) => `
        <div class="leaderboard-item ${index < 3 ? 'top-3' : ''}">
            <div class="rank">${index + 1}</div>
            <div class="player-info">
                <div class="player-name">${player.username || player.email}</div>
                <div class="player-level">المستوى ${player.level || 1}</div>
            </div>
            <div class="player-score">
                <div class="points">${player.points || 0}</div>
                <div class="label">نقطة</div>
            </div>
        </div>
    `).join('');
}

// Toggle Password Visibility
function togglePassword() {
    const input = elements.passwordInput;
    const icon = document.querySelector('.toggle-password i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Show Toast Message
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Logout
function logout() {
    localStorage.removeItem('token');
    STATE.token = null;
    STATE.user = null;
    STATE.currentPuzzle = null;
    
    elements.authSection.style.display = 'flex';
    elements.gameSection.style.display = 'none';
    elements.leaderboardSection.style.display = 'none';
    
    elements.emailInput.value = '';
    elements.passwordInput.value = '';
    
    showToast('تم تسجيل الخروج', 'info');
}

// Export for global access
window.submitAnswer = submitAnswer;
