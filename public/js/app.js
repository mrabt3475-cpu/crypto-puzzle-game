// ========================================
// Crypto Puzzle Game - JavaScript
// ========================================

const PUZZLES = [
    {
        id: 1,
        type: 'أحجية',
        question: 'ما هو الرقم الذي يأتي بعد 9 وأقل من 11؟',
        answer: ['10', 'عشرة'],
        hint: 'رقم واحد فقط'
    },
    {
        id: 2,
        type: 'أحجية',
        question: 'ما هو الشهر الذي عدد أيامه 28 يوم؟',
        answer: ['فبراير', 'شباط', 'February'],
        hint: 'الشهر الثاني في السنة'
    },
    {
        id: 3,
        type: 'أحجية',
        question: 'ما هو الحيوان الذي يُعرف بملك الغابة؟',
        answer: ['أسد', 'lion', 'الأسد'],
        hint: 'يبدأ بحرف الألف'
    },
    {
        id: 4,
        type: 'أحجية',
        question: 'كم عدد ألوان قوس قزح الأساسية؟',
        answer: ['7', 'سبعة', 'seven'],
        hint: 'عدد أكبر من 5 وأقل من 10'
    },
    {
        id: 5,
        type: 'أحجية',
        question: 'ما هو الشيء الذي كلما أخذت منه كبر؟',
        answer: ['صورة', 'photo', 'رسم'],
        hint: 'شيء موجود في الإطار'
    },
    {
        id: 6,
        type: 'أحجية',
        question: 'ما هو اليوم الذي يأتي قبل الجمعة؟',
        answer: ['الخميس', 'Thursday'],
        hint: 'يوم نهاية الأسبوع'
    },
    {
        id: 7,
        type: 'أحجية',
        question: 'ما هو لون الدم في الشرايين؟',
        answer: ['أحمر', 'red', 'الأحمر'],
        hint: 'لون معروف'
    },
    {
        id: 8,
        type: 'أحجية',
        question: 'ما هو أضخم حيوان على الأرض؟',
        answer: ['حوت', 'whale', 'الحوت'],
        hint: 'حيوان بحري ضخم'
    },
    {
        id: 9,
        type: 'أحجية',
        question: 'ما هو عكس كلمة كبير؟',
        answer: ['صغير', 'small', 'الصغير'],
        hint: 'نقيض الحجم'
    },
    {
        id: 10,
        type: 'أحجية',
        question: 'في أي قارة تقع مصر؟',
        answer: ['أفريقيا', 'Africa', 'افريقيا'],
        hint: 'قارة سوداء'
    },
    {
        id: 11,
        type: 'أحجية',
        question: 'ما هو المعدن الذي يصدأ؟',
        answer: ['حديد', 'iron', 'الحديد'],
        hint: 'فلز قوي'
    },
    {
        id: 12,
        type: 'أحجية',
        question: 'كم عظمة في جسم الإنسان؟',
        answer: ['206', 'مئتين وست', '206 عظمة'],
        hint: 'عدد كبير'
    },
    {
        id: 13,
        type: 'أحجية',
        question: 'ما هو الغاز الذي تتنفسه النباتات؟',
        answer: ['ثاني أكسيد الكربون', 'كربون', 'CO2'],
        hint: 'غاز لونه عديم'
    },
    {
        id: 14,
        type: 'أحجية',
        question: 'ما هو أطول نهر في العالم؟',
        answer: ['النيل', 'Nile', 'النيل'],
        hint: 'نهر في أفريقيا'
    },
    {
        id: 15,
        type: 'أحجية',
        question: 'ما هو لون الياقوت الأزرق؟',
        answer: ['أزرق', 'blue', 'الأزرق'],
        hint: 'لون السماء'
    },
    {
        id: 16,
        type: 'أحجية',
        question: 'من هو مؤلف كتاب ألف ليلة وليلة؟',
        answer: ['عربي', 'غير معروف', 'unknown'],
        hint: 'مجموعة قصص'
    },
    {
        id: 17,
        type: 'أحجية',
        question: 'ما هو الشيء الذي ليس له بداية ولا نهاية؟',
        answer: ['دائرة', 'circle', 'الدائرة'],
        hint: 'شكل هندسي'
    },
    {
        id: 18,
        type: 'أحجية',
        question: 'في أي سنة بدأ القرن الحادي والعشرون؟',
        answer: ['2001', 'عام 2001'],
        hint: 'سنة قريبة'
    },
    {
        id: 19,
        type: 'أحجية',
        question: 'ما هو أقدم مدينتين في التاريخ؟',
        answer: ['دمشق', 'Damascus'],
        hint: 'عاصمة سوريا'
    },
    {
        id: 20,
        type: 'أحجية',
        question: 'ما هو مفتاح النجاح؟',
        answer: ['العمل', 'الجد', 'effort'],
        hint: 'كلمة من 4 حروف'
    }
];

class CryptoPuzzleGame {
    constructor() {
        this.currentLevel = 1;
        this.totalPoints = 0;
        this.attempts = 3;
        this.timer = 0;
        this.timerInterval = null;
        this.isLoggedIn = false;
        this.user = null;
        
        this.init();
    }
    
    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadUserData();
    }
    
    checkAuth() {
        const userData = localStorage.getItem('puzzleUser');
        if (userData) {
            this.user = JSON.parse(userData);
            this.isLoggedIn = true;
            this.showGame();
        }
    }
    
    setupEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchAuthTab(btn.dataset.tab));
        });
        
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });
        
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchPage(btn.dataset.page));
        });
        
        document.getElementById('submitBtn').addEventListener('click', () => this.submitAnswer());
        document.getElementById('answerInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitAnswer();
        });
        
        document.querySelector('.puzzle-hint').addEventListener('click', () => this.showHint());
        document.querySelector('.close-modal').addEventListener('click', () => this.hideHint());
        document.querySelector('.btn-hint').addEventListener('click', () => this.useHint());
        
        document.getElementById('hintModal').addEventListener('click', (e) => {
            if (e.target.id === 'hintModal') this.hideHint();
        });
    }
    
    switchAuthTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
    }
    
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
    
    showGame() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
        
        this.loadPuzzle();
        this.startTimer();
    }
    
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
    
    submitAnswer() {
        const answer = document.getElementById('answerInput').value.trim().toLowerCase();
        
        if (!answer) {
            this.showToast('أدخل إجابة أولاً!', 'warning');
            return;
        }
        
        const puzzle = PUZZLES.find(p => p.id === this.currentLevel);
        const isCorrect = puzzle.answer.some(a => a.toLowerCase() === answer);
        
        if (isCorrect) {
            this.totalPoints += 100;
            this.currentLevel++;
            this.attempts = 3;
            
            this.showToast('✅ إجابة صحيحة! +100 نقطة', 'success');
            
            if (this.currentLevel > 20) {
                this.showToast('🎉 تهانينا! فزت بالجائزة الكبرى! 1000$ USDT', 'success');
            } else {
                this.loadPuzzle();
            }
        } else {
            this.attempts--;
            document.getElementById('attempts').textContent = this.attempts;
            
            if (this.attempts <= 0) {
                this.showToast('❌ انتهت المحاولات! جرب المستوى القادم', 'error');
                this.currentLevel++;
                this.attempts = 3;
                this.loadPuzzle();
            } else {
                this.showToast('❌ إجابة خاطئة! حاول مجدداً', 'error');
            }
        }
        
        this.updateProgress();
    }
    
    showHint() {
        const puzzle = PUZZLES.find(p => p.id === this.currentLevel);
        document.getElementById('hintText').textContent = puzzle.hint;
        document.getElementById('hintModal').classList.add('active');
    }
    
    hideHint() {
        document.getElementById('hintModal').classList.remove('active');
    }
    
    useHint() {
        if (this.totalPoints >= 5) {
            this.totalPoints -= 5;
            this.updateProgress();
            this.hideHint();
            this.showToast('✅ تم استخدام التلميح! -5 نقاط', 'success');
        } else {
            this.showToast('❌ نقاط غير كافية!', 'error');
        }
    }
    
    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            this.timer++;
            const minutes = Math.floor(this.timer / 60).toString().padStart(2, '0');
            const seconds = (this.timer % 60).toString().padStart(2, '0');
            document.getElementById('timer').textContent = `${minutes}:${seconds}`;
        }, 1000);
    }
    
    updateProgress() {
        document.getElementById('totalPoints').textContent = this.totalPoints;
        
        const progress = (this.currentLevel / 20) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;
    }
    
    switchPage(page) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
        
        document.getElementById('gameSection').style.display = page === 'game' ? 'block' : 'none';
        document.getElementById('leaderboardSection').style.display = page === 'leaderboard' ? 'block' : 'none';
        
        if (page === 'leaderboard') {
            this.loadLeaderboard();
        }
    }
    
    loadLeaderboard() {
        const leaderboardData = [
            { name: 'أحمد', level: 20, score: 2000 },
            { name: 'محمد', level: 18, score: 1800 },
            { name: 'سارة', level: 15, score: 1500 },
            { name: 'علي', level: 12, score: 1200 },
            { name: 'فاطمة', level: 10, score: 1000 }
        ];
        
        const list = document.getElementById('leaderboardList');
        list.innerHTML = leaderboardData.map((player, index) => `
            <div class="leaderboard-item top-${index + 1}">
                <div class="rank">${index + 1}</div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-level">المستوى ${player.level}</div>
                </div>
                <div class="player-score">${player.score}</div>
            </div>
        `).join('');
    }
    
    loadUserData() {
        if (this.user) {
            document.getElementById('balance').textContent = this.user.balance.toFixed(2);
        }
    }
    
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

const game = new CryptoPuzzleGame();