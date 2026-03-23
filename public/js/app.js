/**
 * ========================================
 * Crypto Puzzle Game - JavaScript
 * ========================================
 */

// ========================================
// PUZZLES DATA
// ========================================
const PUZZLES = [
    { id: 1, type: 'أحجية', question: 'ما هو الرقم الذي يأتي بعد 9 وأقل من 11؟', answer: ['10', 'عشرة'] },
    { id: 2, type: 'أحجية', question: 'ما هو الشهر الذي عدد أيامه 28 يوم؟', answer: ['فبراير', 'شباط', 'February'] },
    { id: 3, type: 'أحجية', question: 'ما هو الحيوان الذي يُعرف بملك الغابة؟', answer: ['أسد', 'lion', 'الأسد'] },
    { id: 4, type: 'أحجية', question: 'كم عدد ألوان قوس قزح الأساسية؟', answer: ['7', 'سبعة', 'seven'] },
    { id: 5, type: 'أحجية', question: 'ما هو الشيء الذي كلما أخذت منه كبر؟', answer: ['صورة', 'photo', 'رسم'] },
    { id: 6, type: 'أحجية', question: 'ما هو اليوم الذي يأتي قبل الجمعة؟', answer: ['الخميس', 'Thursday'] },
    { id: 7, type: 'أحجية', question: 'ما هو لون الدم في الشرايين؟', answer: ['أحمر', 'red', 'الأحمر'] },
    { id: 8, type: 'أحجية', question: 'ما هو أضخم حيوان على الأرض؟', answer: ['حوت', 'whale', 'الحوت'] },
    { id: 9, type: 'أحجية', question: 'ما هو عكس كلمة كبير؟', answer: ['صغير', 'small', 'الصغير'] },
    { id: 10, type: 'أحجية', question: 'في أي قارة تقع مصر؟', answer: ['أفريقيا', 'Africa', 'افريقيا'] },
    { id: 11, type: 'أحجية', question: 'ما هو المعدن الذي يصدأ؟', answer: ['حديد', 'iron', 'الحديد'] },
    { id: 12, type: 'أحجية', question: 'كم عظمة في جسم الإنسان؟', answer: ['206', 'مئتين وست', '206 عظمة'] },
    { id: 13, type: 'أحجية', question: 'ما هو الغاز الذي تتنفسه النباتات؟', answer: ['ثاني أكسيد الكربون', 'كربون', 'CO2'] },
    { id: 14, type: 'أحجية', question: 'ما هو أطول نهر في العالم؟', answer: ['النيل', 'Nile', 'النيل'] },
    { id: 15, type: 'أحجية', question: 'ما هو لون الياقوت الأزرق؟', answer: ['أزرق', 'blue', 'الأزرق'] },
    { id: 16, type: 'أحجية', question: 'من هو مؤلف كتاب ألف ليلة وليلة؟', answer: ['عربي', 'غير معروف', 'unknown'] },
    { id: 17, type: 'أحجية', question: 'ما هو الشيء الذي ليس له بداية ولا نهاية؟', answer: ['دائرة', 'circle', 'الدائرة'] },
    { id: 18, type: 'أحجية', question: 'في أي سنة بدأ القرن الحادي والعشرون؟', answer: ['2001', 'عام 2001'] },
    { id: 19, type: 'أحجية', question: 'ما هو أقدم مدينتين في التاريخ؟', answer: ['دمشق', 'Damascus'] },
    { id: 20, type: 'أحجية', question: 'ما هو مفتاح النجاح؟', answer: ['العمل', 'الجد', 'effort'] }
];

// ========================================
// GAME CONFIG
// ========================================
const CONFIG = {
    TOTAL_LEVELS: 20,
    POINTS_PER_PUZZLE: 100,
    MAX_ATTEMPTS: 3,
    PRIZE_AMOUNT: 1000,
    TEAM_MONTHLY_FEE: 5,
    TEAM_ADD_MEMBER_FEE: 5
};

// ========================================
// GAME CLASS
// ========================================
class CryptoPuzzleGame {
    constructor() {
        // Game state
        this.currentLevel = 1;
        this.totalPoints = 0;
        this.attempts = CONFIG.MAX_ATTEMPTS;
        this.timer = 0;
        this.timerInterval = null;
        this.isLoggedIn = false;
        this.user = null;
        
        // Team state
        this.hasTeam = false;
        this.teamCode = null;
        this.teamMember2 = null;
        
        // Initialize
        this.init();
    }
    
    // Initialize the game
    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadUserData();
    }
    
    // Check if user is logged in
    checkAuth() {
        const userData = localStorage.getItem('puzzleUser');
        if (userData) {
            this.user = JSON.parse(userData);
            this.isLoggedIn = true;
            this.showGame();
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Auth tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchAuthTab(btn.dataset.tab));
        });
        
        // Auth form
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });
        
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
        });
        
        // Submit answer
        document.getElementById('submitBtn').addEventListener('click', () => this.submitAnswer());
        document.getElementById('answerInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitAnswer();
        });
    }
    
    // Switch auth tab
    switchAuthTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
    }
    
    // Handle authentication
    handleAuth() {
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        
        if (!email || !password) {
            this.showToast('يرجى إدخال جميع البيانات', 'error');
            return;
        }
        
        this.user = {
            email: email,
            name: email.split('@')[0],
            balance: 0
        };
        
        localStorage.setItem('puzzleUser', JSON.stringify(this.user));
        this.isLoggedIn = true;
        
        this.showToast('مرحباً بك! 🎉', 'success');
        this.showGame();
    }
    
    // Show game section
    showGame() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
        
        this.loadPuzzle();
        this.startTimer();
    }
    
    // Load current puzzle
    loadPuzzle() {
        const puzzle = PUZZLES.find(p => p.id === this.currentLevel);
        
        if (!puzzle) {
            this.showToast('🎉 تهانينا! لقد أنهيت اللعبة!', 'success');
            return;
        }
        
        document.getElementById('puzzleType').textContent = puzzle.type;
        document.getElementById('puzzleQuestion').textContent = puzzle.question;
        document.getElementById('currentLevel').textContent = this.currentLevel;
        document.getElementById('attempts').textContent = this.attempts;
        document.getElementById('answerInput').value = '';
        
        this.updateProgress();
    }
    
    // Submit answer
    submitAnswer() {
        const answer = document.getElementById('answerInput').value.trim().toLowerCase();
        
        if (!answer) {
            this.showToast('أدخل إجابة أولاً!', 'warning');
            return;
        }
        
        const puzzle = PUZZLES.find(p => p.id === this.currentLevel);
        const isCorrect = puzzle.answer.some(a => a.toLowerCase() === answer);
        
        if (isCorrect) {
            this.totalPoints += CONFIG.POINTS_PER_PUZZLE;
            this.currentLevel++;
            this.attempts = CONFIG.MAX_ATTEMPTS;
            
            this.showToast(`✅ إجابة صحيحة! +${CONFIG.POINTS_PER_PUZZLE} نقطة`, 'success');
            
            if (this.currentLevel > CONFIG.TOTAL_LEVELS) {
                this.showToast(`🎉 تهانينا! فزت بالجائزة الكبرى! ${CONFIG.PRIZE_AMOUNT}$ USDT`, 'success');
            } else {
                this.loadPuzzle();
            }
        } else {
            this.attempts--;
            document.getElementById('attempts').textContent = this.attempts;
            
            if (this.attempts <= 0) {
                this.showToast('❌ انتهت المحاولات! جرب المستوى القادم', 'error');
                this.currentLevel++;
                this.attempts = CONFIG.MAX_ATTEMPTS;
                this.loadPuzzle();
            } else {
                this.showToast('❌ إجابة خاطئة! حاول مجدداً', 'error');
            }
        }
        
        this.updateProgress();
    }
    
    // Start timer
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            this.timer++;
            const minutes = Math.floor(this.timer / 60).toString().padStart(2, '0');
            const seconds = (this.timer % 60).toString().padStart(2, '0');
            document.getElementById('timer').textContent = `${minutes}:${seconds}`;
        }, 1000);
    }
    
    // Update progress
    updateProgress() {
        document.getElementById('totalPoints').textContent = this.totalPoints;
        document.getElementById('walletBalance').textContent = this.totalPoints.toFixed(2);
        document.getElementById('statPoints').textContent = this.totalPoints;
        document.getElementById('statLevels').textContent = this.currentLevel - 1;
        document.getElementById('statTime').textContent = document.getElementById('timer').textContent;
        
        const progress = (this.currentLevel / CONFIG.TOTAL_LEVELS) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;
    }
    
    // Switch page
    switchPage(page) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
        
        document.getElementById('gameSection').style.display = page === 'game' ? 'block' : 'none';
        document.getElementById('teamSection').style.display = page === 'team' ? 'block' : 'none';
        document.getElementById('walletSection').style.display = page === 'wallet' ? 'block' : 'none';
        document.getElementById('profileSection').style.display = page === 'profile' ? 'block' : 'none';
    }
    
    // Load user data
    loadUserData() {
        if (this.user) {
            document.getElementById('balance').textContent = this.user.balance.toFixed(2);
            document.getElementById('profileName').textContent = this.user.name;
            document.getElementById('profileEmail').textContent = this.user.email;
        }
    }
    
    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${this.getToastIcon(type)}"></i><span>${message}</span>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toastIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // Get toast icon
    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'times-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// ========================================
// TEAM FUNCTIONS
// ========================================

function createTeam() {
    game.showToast(`جاري إنشاء الفريق مقابل $${CONFIG.TEAM_MONTHLY_FEE}...`, 'info');
    
    setTimeout(() => {
        game.hasTeam = true;
        game.teamCode = 'TEAM-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        document.getElementById('teamPlans').style.display = 'none';
        document.getElementById('teamActions').style.display = 'block';
        document.getElementById('teamCode').value = game.teamCode;
        
        game.showToast(`✅ تم إنشاء الفريق بنجاح! $${CONFIG.TEAM_MONTHLY_FEE}/شهر`, 'success');
    }, 1000);
}

function addTeamMember() {
    game.showToast(`جاري إضافة العضو مقابل $${CONFIG.TEAM_ADD_MEMBER_FEE}...`, 'info');
    
    setTimeout(() => {
        game.teamMember2 = 'صديق';
        
        document.getElementById('member2Name').textContent = game.teamMember2;
        document.getElementById('member2Status').textContent = 'عضو نشط';
        document.getElementById('member2Card').style.opacity = '1';
        document.getElementById('addMemberSection').style.display = 'none';
        
        game.showToast('✅ تم إضافة العضو للفريق!', 'success');
    }, 1000);
}

function copyTeamCode() {
    const code = document.getElementById('teamCode');
    code.select();
    document.execCommand('copy');
    game.showToast('📋 تم نسخ كود الفريق!', 'success');
}

function logout() {
    localStorage.removeItem('puzzleUser');
    location.reload();
}

// ========================================
// INITIALIZE GAME
// ========================================
const game = new CryptoPuzzleGame();