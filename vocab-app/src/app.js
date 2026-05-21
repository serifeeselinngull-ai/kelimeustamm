// Kelime Ustası - Modern İngilizce Kelime Öğrenme Uygulaması
// Core State Management, Router, and UI Views

const AppState = {
    currentUser: null,
    rememberMe: false,
    activeSeconds: 0,
    activeTimerInterval: null,
    data: {
        users: {} // username -> password, streak, lastStudyDate, totalStudyTime, levels: {...}, favorites: [], notifications: []
    },

    load() {
        const stored = localStorage.getItem('vocab_app_data');
        if (stored) {
            try {
                this.data = JSON.parse(stored);
            } catch (e) {
                console.error("Error loading app data", e);
            }
        }
        
        // Auto-login check: first localStorage, then sessionStorage
        const remembered = localStorage.getItem('vocab_app_remembered_user');
        if (remembered) {
            this.currentUser = remembered;
            this.rememberMe = true;
        } else {
            const logged = sessionStorage.getItem('vocab_app_user');
            if (logged) {
                this.currentUser = logged;
            }
        }

        // Initialize predefined mock students if empty
        ensureMockDataInitialized();
    },

    save() {
        localStorage.setItem('vocab_app_data', JSON.stringify(this.data));
        if (this.currentUser) {
            if (this.rememberMe) {
                localStorage.setItem('vocab_app_remembered_user', this.currentUser);
            } else {
                sessionStorage.setItem('vocab_app_user', this.currentUser);
                localStorage.removeItem('vocab_app_remembered_user');
            }
        } else {
            sessionStorage.removeItem('vocab_app_user');
            localStorage.removeItem('vocab_app_remembered_user');
        }
    },

    getUserData() {
        if (!this.currentUser) return null;
        if (!this.data.users[this.currentUser]) {
            this.data.users[this.currentUser] = {
                password: "123",
                class: "9/A",
                streak: 0,
                lastStudyDate: "",
                totalStudyTime: 0,
                favorites: [],
                notifications: [
                    { id: 1, text: "Kelime Ustası'na Hoş Geldin! 🎉 Seviyeleri tamamlayarak yeni rozetler kazan.", read: false }
                ],
                levels: {
                    a1: { unlockedChapters: [0], progress: {}, unknownWords: [] },
                    a2: { unlockedChapters: [0], progress: {}, unknownWords: [] },
                    b1: { unlockedChapters: [0], progress: {}, unknownWords: [] },
                    b2: { unlockedChapters: [0], progress: {}, unknownWords: [] }
                },
                currentLevel: null,
                studyTimeByMode: { sequential: 0, matching: 0, test: 0, fill_blank: 0 },
                quizStats: { history: [], avgScore: 0 },
                activityLogs: [],
                teacherNotes: "",
                matchingHighscore: null
            };
        }
        
        const user = this.data.users[this.currentUser];
        // Migration support for fields
        if (!user.favorites) user.favorites = [];
        if (!user.notifications) user.notifications = [];
        if (user.streak === undefined) user.streak = 0;
        if (user.totalStudyTime === undefined) user.totalStudyTime = 0;
        if (!user.class) user.class = '9/A';
        if (!user.studyTimeByMode) user.studyTimeByMode = { sequential: 0, matching: 0, test: 0, fill_blank: 0 };
        if (!user.quizStats) user.quizStats = { history: [], avgScore: 0 };
        if (!user.activityLogs) user.activityLogs = [];
        if (user.teacherNotes === undefined) user.teacherNotes = '';
        if (user.matchingHighscore === undefined) user.matchingHighscore = null;
        
        return user;
    },

    PREDEFINED_USERS: {
        "admin": "admin",
        "ogrenci1": "123",
        "ogrenci2": "123",
        "ogrenci3": "123",
        "ogrenci4": "123",
        "ogrenci5": "123",
        "ogrenci6": "123",
        "ogrenci7": "123",
        "ogrenci8": "123"
    },

    login(username, password, remember) {
        username = username.trim().toLowerCase();
        if (!username || !password) return { success: false, message: "Kullanıcı adı ve şifre gereklidir." };

        const correctPassword = this.PREDEFINED_USERS[username] || (this.data.users[username] ? this.data.users[username].password : null);
        
        if (correctPassword === password) {
            this.currentUser = username;
            this.rememberMe = remember;
            
            // Set up blank structural shell if user is registering new
            this.getUserData();
            
            if (username !== 'admin') {
                logStudentActivity('login', 'Sisteme giriş yaptı.');
            }
            
            this.updateStreak();
            this.save();
            this.startStudyTimer();
            
            return { success: true, message: `Hoş geldin, ${username.toUpperCase()}!` };
        } else {
            return { success: false, message: "Kullanıcı adı veya şifre hatalı!" };
        }
    },

    logout() {
        this.stopStudyTimer();
        this.currentUser = null;
        sessionStorage.removeItem('vocab_app_user');
        localStorage.removeItem('vocab_app_remembered_user');
        showToast("Oturum kapatıldı", "info");
        renderApp();
    },

    updateStreak() {
        const user = this.getUserData();
        if (!user || this.currentUser === 'admin') return;

        const todayStr = new Date().toISOString().slice(0, 10);
        const lastDate = user.lastStudyDate;

        if (lastDate) {
            const today = new Date(todayStr);
            const last = new Date(lastDate);
            const diffTime = Math.abs(today - last);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                user.streak += 1;
                this.addNotification(`Harika gidiyorsun! Günlük çalışma serin ${user.streak} güne yükseldi! 🔥`);
            } else if (diffDays > 1) {
                user.streak = 1;
                this.addNotification("Serin maalesef bozuldu ama bugün yeniden başlayabilirsin! ⚡");
            }
        } else {
            user.streak = 1;
            this.addNotification("Tebrikler! İlk günlük serin başladı. 🔥");
        }
        user.lastStudyDate = todayStr;
        this.save();
    },

    addNotification(text) {
        const user = this.getUserData();
        if (!user) return;
        user.notifications.unshift({
            id: Date.now(),
            text: text,
            read: false
        });
        this.save();
    },

    startStudyTimer() {
        this.stopStudyTimer();
        if (this.currentUser === 'admin') return;
        this.activeSeconds = 0;
        this.activeTimerInterval = setInterval(() => {
            this.activeSeconds += 5;
            const user = this.getUserData();
            if (user) {
                user.totalStudyTime += 5;
                
                if (!user.studyTimeByMode) {
                    user.studyTimeByMode = {
                        sequential: 0,
                        matching: 0,
                        test: 0,
                        fill_blank: 0
                    };
                }
                
                // Detect active mode
                let mode = 'sequential';
                if (document.getElementById('matching-timer')) {
                    mode = 'matching';
                } else if (typeof activePracticeMode !== 'undefined' && activePracticeMode === 'fill_blank') {
                    mode = 'fill_blank';
                } else if (typeof activePracticeMode !== 'undefined' && activePracticeMode) {
                    mode = 'test';
                }
                
                user.studyTimeByMode[mode] = (user.studyTimeByMode[mode] || 0) + 5;
                
                // Auto save every 30 seconds
                if (this.activeSeconds % 30 === 0) {
                    this.save();
                }
            }
        }, 5000);
    },

    stopStudyTimer() {
        if (this.activeTimerInterval) {
            clearInterval(this.activeTimerInterval);
            this.activeTimerInterval = null;
        }
        const user = this.getUserData();
        if (user) this.save();
    }
};

// Configurable Levels Data Constraints
const LEVELS_CONFIG = {
    a1: { totalWords: 800, name: "A1 Seviyesi", desc: "Başlangıç Seviyesi", words: () => A1_WORDS },
    a2: { totalWords: 800, name: "A2 Seviyesi", desc: "Temel Seviye", words: () => A2_WORDS },
    b1: { totalWords: 890, name: "B1 Seviyesi", desc: "Orta Seviye", words: () => B1_WORDS },
    b2: { totalWords: 800, name: "B2 Seviyesi", desc: "Üst Orta Seviye", words: () => B2_WORDS }
};

// Calculates how many chapters exist in a level (dynamic modules of 100, last module gets remaining words)
function getChaptersForLevel(levelCode) {
    const config = LEVELS_CONFIG[levelCode];
    if (!config) return [];
    
    const words = config.words();
    const total = words.length;
    const chapters = [];
    let startIdx = 0;
    
    while (startIdx < total) {
        const endIdx = Math.min(startIdx + 100, total);
        chapters.push({
            index: chapters.length,
            title: `${chapters.length + 1}. Bölüm`,
            range: `${startIdx + 1} - ${endIdx}`,
            start: startIdx,
            end: endIdx,
            count: endIdx - startIdx
        });
        startIdx = endIdx;
    }
    return chapters;
}

// Active level progression and vocabulary mapping helpers
function getActiveLevelData() {
    const user = AppState.getUserData();
    if (!user || !user.currentLevel) return null;
    return user.levels[user.currentLevel];
}

function getActiveLevelWords() {
    const user = AppState.getUserData();
    if (!user || !user.currentLevel) return A1_WORDS;
    const config = LEVELS_CONFIG[user.currentLevel];
    return config ? config.words() : A1_WORDS;
}

// Theme Manager
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    showToast(isLight ? "Açık tema aktifleştirildi" : "Koyu tema aktifleştirildi", "info");
    
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.className = isLight ? "fas fa-moon" : "fas fa-sun";
    }
}

// Custom Toast helper
function showToast(message, type = "success") {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = "fa-check-circle";
    if (type === "error") icon = "fa-exclamation-circle";
    if (type === "info") icon = "fa-info-circle";
    if (type === "warning") icon = "fa-exclamation-triangle";
    
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = "none";
        toast.offsetHeight; // Reflow trigger
        toast.style.transition = "opacity 0.4s ease, transform 0.4s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-20px)";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// App Router
function renderApp() {
    AppState.load();
    const appEl = document.getElementById('app');
    
    // Check if splash screen is playing
    const splashShown = sessionStorage.getItem('vocab_splash_played');
    if (!splashShown) {
        renderSplashScreen(appEl);
        return;
    }

    if (!AppState.currentUser) {
        renderLogin(appEl);
    } else if (AppState.currentUser === 'admin') {
        renderTeacherPanel(appEl);
    } else {
        const user = AppState.getUserData();
        if (!user.currentLevel) {
            renderLevelSelectorScreen();
        } else {
            renderDashboard(appEl);
        }
    }
}

// SPLASH SCREEN ANIMATION
function renderSplashScreen(container) {
    container.innerHTML = `
        <div class="splash-screen" id="app-splash">
            <div class="splash-logo-container">
                <i class="fas fa-graduation-cap"></i>
                <div class="splash-title">Kelime Ustası</div>
                <div class="splash-subtitle">kelimeustası.com</div>
            </div>
            <div class="splash-loader">
                <div class="splash-loader-bar"></div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const splash = document.getElementById('app-splash');
        if (splash) {
            splash.classList.add('fade-out');
            sessionStorage.setItem('vocab_splash_played', 'true');
            setTimeout(() => {
                renderApp();
            }, 600);
        }
    }, 1800);
}

// LEVEL PROGRESSION & COMPLETION LOCKS
function isLevelCompleted(user, levelCode) {
    if (!user || !user.levels || !user.levels[levelCode]) return false;
    const progress = user.levels[levelCode].progress || {};
    const chapters = getChaptersForLevel(levelCode);
    
    for (let c = 0; c < chapters.length; c++) {
        const chProgress = progress[c] || {};
        if (Object.keys(chProgress).length < chapters[c].count) {
            return false;
        }
    }
    return true;
}

function isLevelUnlocked(user, levelCode) {
    if (levelCode === 'a1') return true;
    if (levelCode === 'a2') return isLevelCompleted(user, 'a1');
    if (levelCode === 'b1') return isLevelCompleted(user, 'a2');
    if (levelCode === 'b2') return isLevelCompleted(user, 'b1');
    return false;
}

// LEVEL SELECTOR SCREEN
function renderLevelSelectorScreen() {
    AppState.load();
    const appEl = document.getElementById('app');
    const user = AppState.getUserData();
    
    appEl.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-slide" style="flex-grow: 1; max-width: 960px; margin: 0 auto; width: 100%; padding: 1rem 0;">
            <div style="margin-bottom: 2rem; text-align: center;">
                <h1 style="font-size: 2.2rem; font-weight: 800; background: linear-gradient(135deg, #fff 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem;">Seviye Seçin</h1>
                <p class="subtitle" style="font-size: 1rem; max-width: 600px; margin: 0 auto;">Bir sonraki seviyenin kilidini açmak için mevcut seviyedeki tüm bölümleri başarıyla bitirmelisiniz.</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
                ${renderLevelCard(user, 'a1', 'A1 Seviyesi', 'Başlangıç Seviyesi')}
                ${renderLevelCard(user, 'a2', 'A2 Seviyesi', 'Temel Seviye')}
                ${renderLevelCard(user, 'b1', 'B1 Seviyesi', 'Orta Seviye')}
                ${renderLevelCard(user, 'b2', 'B2 Seviyesi', 'Üst Orta Seviye')}
            </div>
        </div>
    `;
}

function renderLevelCard(user, levelCode, title, subtitle) {
    const levelData = user.levels[levelCode];
    const totalWords = LEVELS_CONFIG[levelCode].totalWords;
    let answeredWords = 0;
    
    const progress = levelData.progress || {};
    Object.keys(progress).forEach(chIdx => {
        answeredWords += Object.keys(progress[chIdx] || {}).length;
    });
    
    const percent = Math.min(Math.round((answeredWords / totalWords) * 100), 100);
    const unlocked = isLevelUnlocked(user, levelCode);
    const isActive = user.currentLevel === levelCode;

    let borderStyle = '';
    if (isActive) borderStyle = 'border: 2px solid var(--primary); box-shadow: 0 0 15px var(--primary-glow);';

    if (!unlocked) {
        return `
            <div class="glass-panel animate-fade level-card locked" style="padding: 1.8rem; border-radius: 16px; text-align: center; opacity: 0.65; position: relative; background: rgba(15, 23, 42, 0.45); display:flex; flex-direction:column; justify-content:space-between; height:240px; border: 1px solid var(--border-color); box-shadow: none;">
                <div>
                    <div style="font-size: 2.2rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fas fa-lock"></i></div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 0.2rem 0;">${title}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0 0 0.8rem 0;">${subtitle}</p>
                    <span style="font-size: 0.75rem; color: var(--danger); font-weight: 600; background: rgba(239, 68, 68, 0.08); padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.15); display: inline-block;">
                        Önceki Seviye Bitmeli!
                    </span>
                </div>
                <div style="margin-top: auto; padding-top: 1rem;">
                    <button class="btn btn-secondary" style="width: 100%; cursor: not-allowed; opacity: 0.5; min-height:36px; font-size:0.8rem; padding:0.4rem;" disabled>
                        <i class="fas fa-ban"></i> Kilitli
                    </button>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="glass-panel animate-fade level-card" style="padding: 1.8rem; border-radius: 16px; text-align: center; display:flex; flex-direction:column; justify-content:space-between; height:240px; transition: var(--transition); border: 1px solid var(--border-color); ${borderStyle}">
                <div>
                    <div style="font-size: 2.2rem; color: var(--primary); margin-bottom: 0.5rem;"><i class="fas fa-layer-group"></i></div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 0.2rem 0; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                        ${title}
                        ${isActive ? '<span style="font-size:0.6rem; color:white; background:var(--primary); padding:0.1rem 0.35rem; border-radius:4px; font-weight:700;">AKTİF</span>' : ''}
                    </h3>
                    <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0 0 0.5rem 0;">${subtitle} (${totalWords} Kelime)</p>
                    
                    <div class="level-progress-bar" style="margin-top: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 6px; height: 8px; width: 100%; overflow: hidden; border:1px solid var(--border-color);">
                        <div style="width: ${percent}%; height: 100%; background: var(--primary); transition: width 0.3s ease;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.3rem; font-weight:600;">
                        <span>İlerleme: %${percent}</span>
                        <span>${answeredWords} / ${totalWords} Kelime</span>
                    </div>
                </div>
                
                <div style="margin-top: auto; padding-top: 1rem;">
                    <button class="btn ${isActive ? 'btn-success' : 'btn-primary'}" onclick="selectActiveLevel('${levelCode}')" style="width: 100%; min-height: 38px; font-size:0.85rem; padding:0.4rem 0.8rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem; border-radius: 8px;">
                        ${isActive ? '<i class="fas fa-play"></i> Devam Et' : '<i class="fas fa-check-circle"></i> Seviyeyi Seç'}
                    </button>
                </div>
            </div>
        `;
    }
}

function selectActiveLevel(levelCode) {
    const user = AppState.getUserData();
    user.currentLevel = levelCode;
    AppState.save();
    showToast(`${levelCode.toUpperCase()} seviyesi başarıyla seçildi!`, "success");
    renderApp();
}

// LOGIN SCREEN WITH KEEP LOGGED IN (BENİ HATIRLA)
function renderLogin(container) {
    container.innerHTML = `
        <div class="login-wrapper animate-fade">
            <div class="glass-panel login-card">
                <div class="login-header">
                    <i class="fas fa-graduation-cap"></i>
                    <h1 style="margin-bottom:0.1rem;">Kelime Ustası</h1>
                    <p style="font-size: 0.85rem; color: var(--primary); font-weight: 600; letter-spacing: 0.5px; margin-bottom: 0.75rem; margin-top: 0;">kelimeustası.com</p>
                    <p class="subtitle">A1-B2 İngilizce kelimeleri eğlenerek ve pratik yaparak kalıcı olarak öğrenin</p>
                </div>
                <form id="login-form">
                    <div class="input-group">
                        <label for="username">Kullanıcı Adı</label>
                        <input type="text" id="username" class="input-field" placeholder="Kullanıcı adınızı girin" required autocomplete="username">
                    </div>
                    <div class="input-group">
                        <label for="password">Şifre</label>
                        <input type="password" id="password" class="input-field" placeholder="Şifrenizi girin" required autocomplete="current-password">
                        <div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.45rem; padding-left:0.1rem;">
                            <input type="checkbox" id="toggle-password" style="width:14px; height:14px; accent-color:var(--primary); cursor:pointer;">
                            <label for="toggle-password" style="font-size:0.75rem; color:var(--text-secondary); cursor:pointer; user-select:none;">Şifreyi Göster</label>
                        </div>
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom: 1.2rem; padding-left: 0.2rem;">
                        <input type="checkbox" id="remember-me" style="width:16px; height:16px; accent-color:var(--primary); cursor:pointer;">
                        <label for="remember-me" style="font-size:0.85rem; color:var(--text-secondary); cursor:pointer; user-select:none;">Oturumu açık tut (Beni Hatırla)</label>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        Giriş Yap <i class="fas fa-sign-in-alt"></i>
                    </button>
                    
                    <div style="text-align:center; font-size:0.75rem; color:var(--text-secondary); margin-top:1rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                        <span style="font-weight:600;">Hazır Öğrenci Şifreleri:</span> ogrenci1 - 5 (şifre: 123)<br>
                        <span style="font-weight:600;">Öğretmen / Admin Paneli:</span> admin (şifre: admin)
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const form = document.getElementById('login-form');
    
    // Toggle password visibility
    const togglePass = document.getElementById('toggle-password');
    const passInput = document.getElementById('password');
    if (togglePass && passInput) {
        togglePass.addEventListener('change', () => {
            passInput.type = togglePass.checked ? 'text' : 'password';
        });
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const remember = document.getElementById('remember-me').checked;
        
        const result = AppState.login(user, pass, remember);
        if (result.success) {
            showToast(result.message, "success");
            renderApp();
        } else {
            showToast(result.message, "error");
        }
    });
}

// HEADER PANEL WITH NOTIFICATIONS BELL DRAWER
function getHeaderHTML() {
    const isLight = document.body.classList.contains('light-theme');
    const themeIcon = isLight ? "fa-moon" : "fa-sun";
    const user = AppState.getUserData();
    const activeLevelLabel = user.currentLevel ? user.currentLevel.toUpperCase() : '';
    
    let notificationBellHTML = '';
    if (user && AppState.currentUser !== 'admin') {
        const unreadCount = user.notifications.filter(n => !n.read).length;
        const badgeDot = unreadCount > 0 ? `<span class="notification-badge"></span>` : '';
        
        notificationBellHTML = `
            <div class="notification-bell-container">
                <button onclick="toggleNotificationsDropdown()" class="btn btn-secondary" style="padding: 0.5rem 0.8rem; min-height: 38px; font-size: 0.9rem;" title="Bildirimler">
                    <i class="fas fa-bell"></i>
                    ${badgeDot}
                </button>
                <div class="notification-dropdown" id="notification-dropdown">
                    <div style="font-weight:700; font-size:0.85rem; padding: 0.4rem 1rem; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <span>Bildirimler</span>
                        ${unreadCount > 0 ? `<span onclick="markNotificationsRead()" style="color:var(--primary); font-size:0.75rem; cursor:pointer;">Hepsini Oku</span>` : ''}
                    </div>
                    <div style="max-height: 240px; overflow-y:auto;" id="notifications-list">
                        ${user.notifications.length === 0 
                            ? `<div style="text-align:center; color:var(--text-secondary); padding: 1.5rem; font-size:0.75rem;">Bildiriminiz bulunmamaktadır.</div>` 
                            : user.notifications.map(n => `
                                <div class="notification-item" style="${!n.read ? 'background:rgba(99,102,241,0.04);' : ''}">
                                    <i class="fas fa-info-circle" style="color:${!n.read ? 'var(--primary)' : 'var(--text-secondary)'};"></i>
                                    <div>${n.text}</div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <header class="app-header animate-fade">
            <div class="logo" onclick="renderApp()" style="cursor: pointer; display: flex; flex-direction: column; align-items: flex-start; gap: 0.1rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <i class="fas fa-graduation-cap" style="font-size: 1.6rem; color: var(--primary);"></i>
                    <h2 style="font-weight: 700; letter-spacing: -0.5px; background: linear-gradient(135deg, #fff 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin:0;">Kelime Ustası</h2>
                </div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); opacity: 0.7; font-weight: 500; padding-left: 2.1rem; line-height:1;">kelimeustası.com</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                ${user && user.currentLevel && AppState.currentUser !== 'admin' ? `
                    <button onclick="renderLevelSelectorScreen()" class="btn btn-secondary" style="padding: 0.4rem 0.7rem; min-height: 38px; font-size: 0.85rem; border-color: var(--primary); display: flex; align-items: center; gap: 0.35rem;" title="Seviye Değiştir">
                        <i class="fas fa-layer-group" style="color: var(--primary);"></i> Seviye: <strong>${activeLevelLabel}</strong>
                    </button>
                ` : ''}
                
                ${notificationBellHTML}
                
                <div class="user-badge" style="min-height: 38px; display: flex; align-items: center; gap: 0.35rem; padding: 0 0.6rem;">
                    <i class="fas fa-user-circle" style="font-size: 1.05rem; color: var(--secondary);"></i>
                    <span style="font-weight: 600; font-size:0.85rem;">${AppState.currentUser.toUpperCase()}</span>
                </div>
                <button onclick="toggleTheme()" class="btn btn-secondary" style="padding: 0.5rem 0.8rem; min-height: 38px; font-size: 0.9rem;" title="Tema Değiştir">
                    <i id="theme-icon" class="fas ${themeIcon}"></i>
                </button>
                <button onclick="AppState.logout()" class="btn btn-secondary" style="padding: 0.5rem 0.8rem; min-height: 38px; font-size: 0.9rem;" title="Oturumu Kapat">
                    <i class="fas fa-sign-out-alt"></i> Çıkış
                </button>
            </div>
        </header>
    `;
}

// Notification Drawer triggers
function toggleNotificationsDropdown() {
    const el = document.getElementById('notification-dropdown');
    if (el) {
        const isShowing = el.style.display === 'block';
        el.style.display = isShowing ? 'none' : 'block';
    }
}

// Close notifications drawer when clicking elsewhere
window.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown && dropdown.style.display === 'block') {
        const trigger = e.target.closest('.notification-bell-container');
        if (!trigger) {
            dropdown.style.display = 'none';
        }
    }
});

function markNotificationsRead() {
    const user = AppState.getUserData();
    if (!user) return;
    user.notifications.forEach(n => n.read = true);
    AppState.save();
    showToast("Tüm bildirimler okundu.", "info");
    
    // Refresh Bell interface elements
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    renderApp();
}

// DASHBOARD VIEW
function renderDashboard(container) {
    const userData = getActiveLevelData();
    const rootUser = AppState.getUserData();
    const currentLevelName = rootUser.currentLevel.toUpperCase();
    const levelWords = getActiveLevelWords();
    const chapters = getChaptersForLevel(rootUser.currentLevel);
    const chaptersData = [];
    
    // Process chapters dynamic layout data
    for (let c = 0; c < chapters.length; c++) {
        const chapter = chapters[c];
        const chapterWords = levelWords.slice(chapter.start, chapter.end);
        
        // Progress for this chapter
        const progressData = userData.progress[c] || {};
        const completedCount = Object.keys(progressData).length;
        const percent = Math.min(Math.round((completedCount / chapter.count) * 100), 100);
        
        // Locked if c > 0 and previous chapter is not finished
        let isLocked = false;
        if (c > 0) {
            const prevCh = chapters[c - 1];
            const prevProgress = userData.progress[c - 1] || {};
            const prevCompleted = Object.keys(prevProgress).length;
            if (prevCompleted < prevCh.count) {
                isLocked = true;
            }
        }
        
        // Maintain legacy array values if unlockedChapters doesn't cover
        if (!isLocked && !userData.unlockedChapters.includes(c)) {
            userData.unlockedChapters.push(c);
            AppState.save();
        }
        
        chaptersData.push({
            index: c,
            title: chapter.title,
            range: chapter.range,
            percent: percent,
            isLocked: isLocked,
            completedCount: completedCount,
            totalCount: chapter.count
        });
    }

    const unknownCount = userData.unknownWords.length;
    const streak = rootUser.streak || 0;
    
    // Calculate total study time representation
    const minutes = Math.floor((rootUser.totalStudyTime || 0) / 60);
    const hoursStr = minutes >= 60 ? `${Math.floor(minutes / 60)}s ${minutes % 60}d` : `${minutes} dk`;
    
    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-slide" style="flex-grow: 1;">
            <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h1 style="display:flex; align-items:center; gap: 0.6rem; flex-wrap:wrap; font-size:1.6rem; margin:0 0 0.2rem 0;">
                        Hoş Geldin, ${AppState.currentUser.toUpperCase()}!
                        <span style="font-size: 0.8rem; color: var(--primary); font-weight: 700; background: rgba(167, 139, 250, 0.08); padding: 0.3rem 0.6rem; border-radius: 8px; border: 1px solid var(--border-color); vertical-align: middle;">
                            AKTİF SEVİYE: ${currentLevelName}
                        </span>
                    </h1>
                    <p class="subtitle" style="margin: 0; font-size:0.85rem;">Seviyedeki ${levelWords.length} kelimeyi sırayla bölümlerde tamamlayın.</p>
                </div>
                
                <!-- STREAK & STUDY TIME ROW -->
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    <div style="background: rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.2); padding: 0.4rem 0.8rem; border-radius: 10px; display:flex; align-items:center; gap:0.4rem;" title="Günlük Çalışma Serisi">
                        <i class="fas fa-fire" style="color:var(--warning); font-size:1.1rem; animation: splashPulse 1.5s infinite;"></i>
                        <span style="font-weight:700; font-size:0.9rem; color:var(--warning);">${streak} Gün Seri</span>
                    </div>
                    <div style="background: rgba(56, 189, 248, 0.08); border:1px solid rgba(56, 189, 248, 0.2); padding: 0.4rem 0.8rem; border-radius: 10px; display:flex; align-items:center; gap:0.4rem;" title="Toplam Çalışma Süresi">
                        <i class="fas fa-stopwatch" style="color:var(--secondary); font-size:1.1rem;"></i>
                        <span style="font-weight:700; font-size:0.9rem; color:var(--secondary);">${hoursStr}</span>
                    </div>
                </div>
            </div>

            <!-- GAMIFIED BADGES TEASER -->
            <div class="glass-panel" style="padding:1rem; margin-bottom:1.5rem; border-radius:14px;">
                <h4 style="font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.4rem; margin-bottom:0.75rem;">
                    <i class="fas fa-trophy" style="color:var(--warning);"></i> Başarı Rozetlerim
                </h4>
                <div style="display:flex; gap:0.6rem; overflow-x:auto; padding-bottom:0.3rem;">
                    ${renderBadgesList(rootUser)}
                </div>
            </div>

            <div class="dashboard-grid">
                ${chaptersData.map(c => {
                    if (c.isLocked) {
                        return `
                            <div class="glass-panel chapter-card locked" id="chapter-${c.index}">
                                <div class="chapter-number">${c.index + 1 < 10 ? '0' + (c.index + 1) : c.index + 1}</div>
                                <div class="chapter-content">
                                    <div class="chapter-status">
                                        <i class="fas fa-lock"></i> Kilitli
                                    </div>
                                    <h3>${c.title}</h3>
                                    <p style="color: var(--text-secondary); font-size: 0.8rem;">Kelime: ${c.range} (${c.totalCount} Adet)</p>
                                </div>
                            </div>
                        `;
                    }
                    
                    const isFullyDone = c.percent === 100;
                    const statusText = isFullyDone 
                        ? `<span class="chapter-status completed"><i class="fas fa-check-circle"></i> Tamamlandı</span>` 
                        : `<span class="chapter-status active"><i class="fas fa-play-circle"></i> Aktif (${c.completedCount}/${c.totalCount})</span>`;
                    
                    return `
                        <div class="glass-panel chapter-card" id="chapter-${c.index}" onclick="selectStudyModeOverlay(${c.index})">
                            <div class="chapter-number">${c.index + 1 < 10 ? '0' + (c.index + 1) : c.index + 1}</div>
                            <div class="chapter-content">
                                ${statusText}
                                <h3>${c.title}</h3>
                                <p style="color: var(--text-secondary); font-size: 0.8rem;">Kelime: ${c.range} (${c.totalCount} Adet)</p>
                                <div class="chapter-progress-bar">
                                    <div class="chapter-progress-fill" style="width: ${c.percent}%;"></div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- UNKNOWN & FAVORITE WORDS PRATIK HUB -->
            <div class="glass-panel practice-section-card animate-slide" style="margin-top:1.5rem; border-radius: 14px;">
                <div class="practice-info">
                    <h3>
                        <i class="fas fa-toolbox" style="color: var(--secondary);"></i> 
                        Kelime Pratik & Çalışma Yeri
                        <span class="practice-count-badge" style="background: var(--danger); color: white; margin-left: 0.5rem; font-size:0.75rem; padding: 0.2rem 0.5rem; border-radius:12px;">${unknownCount} Zor Kelime</span>
                        ${rootUser.favorites.length > 0 ? `<span class="practice-count-badge" style="background: var(--warning); color: white; margin-left: 0.3rem; font-size:0.75rem; padding: 0.2rem 0.5rem; border-radius:12px;">${rootUser.favorites.length} Favori</span>` : ''}
                    </h3>
                    <p style="color: var(--text-secondary); font-size:0.85rem; margin-bottom: 0; margin-top:0.2rem;">
                        Zorlandığınız kelimeler buraya birikir. 8 farklı aktivite türü ile pekiştirip kutuyu temizleyin.
                    </p>
                </div>
                <div>
                    <button class="btn btn-primary" onclick="openPracticeHub()" ${(unknownCount === 0 && rootUser.favorites.length === 0) ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} style="min-height:38px; font-size:0.85rem;">
                        Aktivitelere Başla <i class="fas fa-bolt"></i>
                    </button>
                </div>
            </div>

            <!-- DAILY SPACED REPETITION SCREEN LINK -->
            ${renderDailyReviewTeaser(rootUser)}

            <!-- GENERAL UTILITY ROW -->
            <div style="display:flex; flex-wrap:wrap; gap:0.6rem; margin-top:1.5rem;">
                <button class="btn btn-secondary" onclick="renderProgressSummary()" style="flex:1; min-width:130px; min-height: 38px; font-size:0.8rem; padding:0.4rem 0.8rem;">
                    <i class="fas fa-chart-pie" style="color:var(--primary);"></i> İlerleme Özeti
                </button>
                <button class="btn btn-danger" onclick="resetProgress()" style="flex:1; min-width:130px; min-height: 38px; font-size:0.8rem; padding:0.4rem 0.8rem;">
                    <i class="fas fa-trash-alt"></i> Sıfırla
                </button>
            </div>
        </div>
    `;
}

// MOTIVATIONAL BADGES EVALUATOR
const APP_BADGES = [
    { code: "first_step", title: "İlk Adım", desc: "1 kelime çalıştın", icon: "🌱" },
    { code: "chapter_king", title: "Bölüm Fatihi", desc: "1 bölümü bitirdin", icon: "🦁" },
    { code: "level_king", title: "Seviye Ustası", desc: "Tüm seviyeyi bitirdin", icon: "🏆" },
    { code: "streak_3", title: "Çalışkan", desc: "3 günlük çalışma serisi", icon: "🔥" },
    { code: "perfect_score", title: "Kusursuz", desc: "Bir testi 100% çözdün", icon: "⭐" },
    { code: "studious", title: "Kelime Kurdu", desc: "1 saatten fazla çalıştın", icon: "📖" }
];

function isBadgeEarned(user, badgeCode) {
    if (!user) return false;
    let earnedWords = 0;
    
    // Calculate total answered words
    Object.keys(user.levels).forEach(lvl => {
        const progress = user.levels[lvl].progress || {};
        Object.keys(progress).forEach(ch => {
            earnedWords += Object.keys(progress[ch] || {}).length;
        });
    });

    if (badgeCode === "first_step") {
        return earnedWords >= 1;
    }
    if (badgeCode === "chapter_king") {
        let finished = false;
        Object.keys(user.levels).forEach(lvl => {
            const progress = user.levels[lvl].progress || {};
            const chapters = getChaptersForLevel(lvl);
            chapters.forEach(ch => {
                if (Object.keys(progress[ch.index] || {}).length >= ch.count) {
                    finished = true;
                }
            });
        });
        return finished;
    }
    if (badgeCode === "level_king") {
        return isLevelCompleted(user, 'a1') || isLevelCompleted(user, 'a2') || isLevelCompleted(user, 'b1') || isLevelCompleted(user, 'b2');
    }
    if (badgeCode === "streak_3") {
        return (user.streak || 0) >= 3;
    }
    if (badgeCode === "perfect_score") {
        return user.perfectQuizzesEarned > 0;
    }
    if (badgeCode === "studious") {
        return (user.totalStudyTime || 0) >= 3600;
    }
    return false;
}

function renderBadgesList(user) {
    return APP_BADGES.map(b => {
        const earned = isBadgeEarned(user, b.code);
        return `
            <div style="flex:0 0 auto; display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.02); border:1px solid ${earned ? 'rgba(245,158,11,0.25)' : 'var(--border-color)'}; padding:0.4rem 0.8rem; border-radius:10px; width:110px; opacity:${earned ? '1' : '0.4'};">
                <span style="font-size:1.4rem; margin-bottom:0.15rem;">${b.icon}</span>
                <span style="font-size:0.75rem; font-weight:700; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; width:100%; text-align:center;">${b.title}</span>
                <span style="font-size:0.6rem; color:var(--text-secondary); text-align:center; display:block; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; width:100%;">${b.desc}</span>
            </div>
        `;
    }).join('');
}

// SPACES FOR ALL ROZETLER IN AN ARTIFACT
function openBadgesPanel() {
    const container = document.getElementById('app');
    const user = AppState.getUserData();
    
    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-slide" style="flex-grow:1;">
            <div style="margin-bottom:1.5rem;">
                <span class="back-btn" onclick="renderApp()"><i class="fas fa-chevron-left"></i> Panele Dön</span>
                <h1 style="margin-top:0.5rem;"><i class="fas fa-trophy" style="color:var(--warning);"></i> Kazandığım Rozetler</h1>
                <p class="subtitle">Çalıştıkça rozet kilitlerini açıp başarını kanıtla!</p>
            </div>
            
            <div class="badges-container">
                ${APP_BADGES.map(b => {
                    const earned = isBadgeEarned(user, b.code);
                    return `
                        <div class="badge-card ${earned ? 'earned' : 'locked'}">
                            <span class="badge-icon">${b.icon}</span>
                            <div class="badge-title">${b.title}</div>
                            <div class="badge-desc">${b.desc}</div>
                            ${earned 
                                ? `<span style="font-size:0.6rem; font-weight:700; color:var(--warning); background:rgba(245,158,11,0.08); padding:0.15rem 0.4rem; border-radius:4px; margin-top:0.4rem; border:1px solid rgba(245,158,11,0.15);">KAZANILDI</span>` 
                                : `<span style="font-size:0.6rem; font-weight:600; color:var(--text-secondary); background:rgba(255,255,255,0.02); padding:0.15rem 0.4rem; border-radius:4px; margin-top:0.4rem; border:1px solid var(--border-color);"><i class="fas fa-lock"></i> Kilitli</span>`
                            }
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// DAILY SPACED REPETITION TEASER BOX
function renderDailyReviewTeaser(user) {
    // Collect all unknown & not_sure words
    let reviewWordsCount = 0;
    Object.keys(user.levels).forEach(lvl => {
        const lvData = user.levels[lvl];
        const progress = lvData.progress || {};
        
        Object.keys(progress).forEach(ch => {
            Object.keys(progress[ch]).forEach(wId => {
                const s = progress[ch][wId];
                if (s === 'unknown' || s === 'not_sure') {
                    reviewWordsCount++;
                }
            });
        });
    });

    if (reviewWordsCount === 0) return '';

    return `
        <div class="glass-panel animate-slide" style="margin-top:1.2rem; background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(245, 158, 11, 0.05) 100%); border:1px solid rgba(239, 68, 68, 0.15); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; padding: 1.25rem; border-radius: 14px;">
            <div style="flex:1;">
                <h4 style="font-size:1.05rem; display:flex; align-items:center; gap:0.4rem; margin:0 0 0.2rem 0;">
                    <i class="fas fa-calendar-check" style="color:var(--danger);"></i> Günlük Tekrar Planı
                </h4>
                <p style="color:var(--text-secondary); font-size:0.85rem; margin:0;">
                    Hafızanı taze tutmak için sistem yanlış yaptığın veya emin olmadığın <strong>${reviewWordsCount}</strong> kelimeyi seçti.
                </p>
            </div>
            <button class="btn btn-danger" onclick="openDailyReview()" style="min-height:36px; padding:0.4rem 0.8rem; font-size:0.85rem; background:var(--danger);">
                Tekrara Başla <i class="fas fa-sync"></i>
            </button>
        </div>
    `;
}

// OPEN DAILY REVIEW SCREEN
let dailyReviewIndex = 0;
let dailyReviewWords = [];
let dailyReviewFlipped = false;
let isDailyReviewSession = false;

function openDailyReview() {
    const container = document.getElementById('app');
    const user = AppState.getUserData();
    
    // Compile list of words
    dailyReviewWords = [];
    Object.keys(user.levels).forEach(lvl => {
        const lvData = user.levels[lvl];
        const progress = lvData.progress || {};
        const allWords = LEVELS_CONFIG[lvl].words();
        
        Object.keys(progress).forEach(ch => {
            Object.keys(progress[ch]).forEach(wId => {
                const s = progress[ch][wId];
                if (s === 'unknown' || s === 'not_sure') {
                    const wordObj = allWords.find(w => w.id == wId);
                    if (wordObj) {
                        dailyReviewWords.push({
                            ...wordObj,
                            level: lvl,
                            chapter: ch
                        });
                    }
                }
            });
        });
    });

    if (dailyReviewWords.length === 0) {
        showToast("Tekrar edilecek kelimeniz kalmadı! 🎉", "success");
        renderApp();
        return;
    }

    dailyReviewIndex = 0;
    dailyReviewFlipped = false;
    renderDailyReviewHub();
}

function renderDailyReviewHub() {
    const container = document.getElementById('app');
    
    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header">
                <div>
                    <span class="back-btn" onclick="renderApp()"><i class="fas fa-chevron-left"></i> Panele Dön</span>
                    <h2 style="margin-top: 0.5rem;"><i class="fas fa-sync" style="color:var(--danger);"></i> Günlük Tekrar Planı</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 0; font-size:0.85rem;">Tekrar Edilecek Kelimeler (${dailyReviewWords.length} Kelime)</p>
                </div>
            </div>

            <div class="glass-panel" style="padding: 2rem; border-radius:14px; text-align:center;">
                <p style="color: var(--text-secondary); margin-bottom: 2rem; font-size:0.95rem;">
                    Hafızanı taze tutmak için sistem öğrenmekte zorlandığın veya emin olmadığın <strong>${dailyReviewWords.length}</strong> kelimeyi seçti. Çalışmak istediğin yöntemi seçerek başla:
                </p>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1.25rem;">
                    <div class="glass-panel practice-card animate-fade" onclick="startDailyReviewGame('flashcard')" style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:1.5rem; text-align:center; transition:var(--transition);">
                        <div class="practice-icon"><i class="fas fa-clone" style="color:var(--primary); font-size:2rem;"></i></div>
                        <h4 style="margin:0; font-size:1.05rem; color:var(--text-primary);">Kart Tekrarı</h4>
                        <p style="color:var(--text-secondary); font-size:0.75rem; margin:0; line-height:1.4;">Klasik flashcard yöntemiyle kelimeleri ve anlamlarını incele.</p>
                    </div>

                    <div class="glass-panel practice-card animate-fade" onclick="startDailyReviewGame('choice_en_tr')" style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:1.5rem; text-align:center; transition:var(--transition);">
                        <div class="practice-icon"><i class="fas fa-list-ul" style="color:var(--secondary); font-size:2rem;"></i></div>
                        <h4 style="margin:0; font-size:1.05rem; color:var(--text-primary);">Çoktan Seçmeli Test</h4>
                        <p style="color:var(--text-secondary); font-size:0.75rem; margin:0; line-height:1.4;">Kelimeleri çoktan seçmeli testlerle eğlenerek pratik yap.</p>
                    </div>

                    <div class="glass-panel practice-card animate-fade" onclick="startDailyReviewGame('fill_blank')" style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:1.5rem; text-align:center; transition:var(--transition);">
                        <div class="practice-icon"><i class="fas fa-keyboard" style="color:var(--success); font-size:2rem;"></i></div>
                        <h4 style="margin:0; font-size:1.05rem; color:var(--text-primary);">Boşluk Doldurma</h4>
                        <p style="color:var(--text-secondary); font-size:0.75rem; margin:0; line-height:1.4;">Örnek cümlelerdeki boşlukları uygun kelimelerle doldur.</p>
                    </div>

                    <div class="glass-panel practice-card animate-fade" onclick="startDailyReviewGame('matching')" style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:1.5rem; text-align:center; transition:var(--transition);">
                        <div class="practice-icon"><i class="fas fa-cubes" style="color:var(--warning); font-size:2rem;"></i></div>
                        <h4 style="margin:0; font-size:1.05rem; color:var(--text-primary);">Kelime Eşleştirme</h4>
                        <p style="color:var(--text-secondary); font-size:0.75rem; margin:0; line-height:1.4;">İngilizce kelimeleri Türkçe karşılıklarıyla eşleştir.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function startDailyReviewGame(mode) {
    isDailyReviewSession = true;
    activePracticeMode = mode;
    
    // Sort review words randomly for the practice session
    const targetWords = [...dailyReviewWords];
    targetWords.sort(() => Math.random() - 0.5);
    
    // Limit to max 10 to keep sessions consumable
    const sessionWords = targetWords.slice(0, 10);
    
    if (mode === 'flashcard') {
        dailyReviewIndex = 0;
        dailyReviewWords = sessionWords;
        dailyReviewFlipped = false;
        renderDailyReviewScreen();
    } else {
        practiceSessionData = {
            words: sessionWords,
            currentIndex: 0,
            correctCount: 0,
            incorrectCount: 0,
            options: [],
            mixedType: 'choice_en_tr'
        };
        initPracticeQuestion();
    }
}

function renderDailyReviewScreen() {
    const container = document.getElementById('app');
    const data = dailyReviewWords[dailyReviewIndex];
    
    setTimeout(() => {
        const card = document.getElementById('daily-review-flashcard');
        if (card) {
            card.addEventListener('click', () => {
                card.classList.toggle('flipped');
                dailyReviewFlipped = !dailyReviewFlipped;
            });
        }
    }, 50);

    const percent = Math.round((dailyReviewIndex / dailyReviewWords.length) * 100);

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header">
                <div>
                    <span class="back-btn" onclick="openDailyReview()"><i class="fas fa-chevron-left"></i> Günlük Tekrara Dön</span>
                    <h2 style="margin-top: 0.5rem;"><i class="fas fa-sync" style="color:var(--danger);"></i> Günlük Tekrar Planı</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 0; font-size:0.85rem;">Tekrar Edilen Kelimeler listesi</p>
                </div>
            </div>

            <div class="glass-panel" style="padding: 2rem;">
                <div class="flashcard-area">
                    <div class="study-progress" style="width:100%; max-width:420px;">
                        <div class="study-progress-text">
                            <span>Tekrar İlerlemesi: ${dailyReviewIndex} / ${dailyReviewWords.length}</span>
                            <span>${percent}%</span>
                        </div>
                        <div class="chapter-progress-bar">
                            <div class="chapter-progress-fill" style="width: ${percent}%; background:var(--danger);"></div>
                        </div>
                    </div>

                    <div class="flashcard-wrapper">
                        <div class="flashcard ${dailyReviewFlipped ? 'flipped' : ''}" id="daily-review-flashcard">
                            <div class="flashcard-face flashcard-front">
                                <button class="speaker-btn" onclick="event.stopPropagation(); speakWord('${data.en}')" title="Seslendir">
                                    <i class="fas fa-volume-up"></i>
                                </button>
                                <span class="flashcard-hint"><i class="fas fa-info-circle"></i> İngilizce (Detay ve Anlam için Tıkla)</span>
                                <div style="font-size:2.2rem; font-weight:700;">${data.en}</div>
                                <div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic; margin-top:0.3rem;">${data.phonetic || ''}</div>
                            </div>
                            <div class="flashcard-face flashcard-back">
                                <button class="speaker-btn" onclick="event.stopPropagation(); speakTurkish('${data.tr.replace(/'/g, "\\'")}')" title="Seslendir">
                                    <i class="fas fa-volume-up"></i>
                                </button>
                                <span class="flashcard-hint"><i class="fas fa-language"></i> Türkçe Anlamı</span>
                                <div style="font-size:2.2rem; font-weight:700; color:var(--secondary);">${data.tr}</div>
                                <div style="font-size:0.8rem; color:var(--text-secondary); max-width:280px; margin-top:0.6rem; text-align:center; font-style:italic;">
                                    "${data.example || ''}"<br>
                                    <span style="color:var(--secondary); opacity:0.8;">(${data.exampleTr || ''})</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flashcard-actions">
                        <button class="btn btn-secondary" onclick="markDailyReviewWord('not_sure')" style="flex: 1; border-color:var(--warning);">
                            <i class="fas fa-question-circle" style="color:var(--warning);"></i> Hala Emin Değilim
                        </button>
                        <button class="btn btn-success" onclick="markDailyReviewWord('known')" style="flex: 1;">
                            <i class="fas fa-check-circle"></i> Artık Biliyorum!
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function markDailyReviewWord(status) {
    const word = dailyReviewWords[dailyReviewIndex];
    const user = AppState.getUserData();
    
    // Update word progress in native level data
    if (user.levels[word.level]) {
        if (!user.levels[word.level].progress[word.chapter]) {
            user.levels[word.level].progress[word.chapter] = {};
        }
        
        user.levels[word.level].progress[word.chapter][word.id] = status;
        
        if (status === 'known') {
            user.levels[word.level].unknownWords = user.levels[word.level].unknownWords.filter(id => id != word.id);
            showToast("Harika! Kelime öğrenilenlere eklendi.", "success");
        } else {
            showToast("Kelime tekrar edilmek üzere not edildi.", "info");
        }
        AppState.save();
    }

    dailyReviewIndex++;
    dailyReviewFlipped = false;
    
    if (dailyReviewIndex >= dailyReviewWords.length) {
        showToast("Tebrikler! Günlük tekrar çalışmanız bitti. 🎉", "success");
        triggerConfettiEffect();
        setTimeout(() => {
            renderApp();
        }, 1800);
    } else {
        renderDailyReviewScreen();
    }
}

// ─── PROGRESS SUMMARY PAGE ───────────────────────────────────────────────────
function renderProgressSummary() {
    const container = document.getElementById('app');
    const user = AppState.getUserData();
    const levels = [
        { code: 'a1', label: 'A1 Seviyesi', words: A1_WORDS },
        { code: 'a2', label: 'A2 Seviyesi', words: A2_WORDS },
        { code: 'b1', label: 'B1 Seviyesi', words: B1_WORDS },
        { code: 'b2', label: 'B2 Seviyesi', words: B2_WORDS },
    ];

    const levelCards = levels.map(lv => {
        const lvData = user.levels[lv.code] || { progress: {}, unknownWords: [], unlockedChapters: [0] };
        const unlocked = isLevelUnlocked(user, lv.code);
        const chapters = getChaptersForLevel(lv.code);
        let totalAnswered = 0;
        let totalKnown = 0;
        let totalUnknown = 0;
        let totalNotSure = 0;
        
        for (let c = 0; c < chapters.length; c++) {
            const cp = lvData.progress[c] || {};
            Object.values(cp).forEach(s => {
                totalAnswered++;
                if (s === 'known') totalKnown++;
                else if (s === 'unknown') totalUnknown++;
                else if (s === 'not_sure') totalNotSure++;
            });
        }
        const total = lv.words.length;
        const pct = Math.round((totalAnswered / total) * 100);
        const isActive = user.currentLevel === lv.code;
        const isCompleted = isLevelCompleted(user, lv.code);

        const barColor = isCompleted ? 'var(--success)' : 'var(--primary)';
        const badgeHTML = isCompleted
            ? `<span style="font-size:0.7rem; background:var(--success); color:white; padding:0.15rem 0.4rem; border-radius:5px; font-weight:700;">TAMAMLANDI ✓</span>`
            : isActive
                ? `<span style="font-size:0.7rem; background:var(--primary); color:white; padding:0.15rem 0.4rem; border-radius:5px; font-weight:700;">AKTİF</span>`
                : !unlocked
                    ? `<span style="font-size:0.7rem; background:var(--danger); color:white; padding:0.15rem 0.4rem; border-radius:5px; font-weight:700;">KİLİTLİ 🔒</span>`
                    : '';

        return `
            <div class="glass-panel animate-fade" style="padding:1.2rem; border-radius: 12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.6rem;">
                    <div>
                        <h3 style="margin:0 0 0.2rem 0; font-size:1rem;">${lv.label} ${badgeHTML}</h3>
                        <p style="margin:0; color:var(--text-secondary); font-size:0.75rem;">Toplam: ${totalAnswered} / ${total} kelime çalışıldı</p>
                    </div>
                    <span style="font-size:1.3rem; font-weight:800; color:${barColor};">${pct}%</span>
                </div>
                <div style="background:rgba(255,255,255,0.05); border-radius:8px; height:8px; overflow:hidden; border:1px solid var(--border-color); margin-bottom:0.6rem;">
                    <div style="width:${pct}%; height:100%; background:${barColor}; transition:width 0.4s ease;"></div>
                </div>
                <div style="display:flex; gap:0.8rem; flex-wrap:wrap; font-size:0.75rem; color:var(--text-secondary);">
                    <span><i class="fas fa-check-circle" style="color:var(--success);"></i> Biliyorum: <strong>${totalKnown}</strong></span>
                    <span><i class="fas fa-times-circle" style="color:var(--danger);"></i> Bilmiyorum: <strong>${totalUnknown}</strong></span>
                    <span><i class="fas fa-question-circle" style="color:var(--warning);"></i> Emin Değil: <strong>${totalNotSure}</strong></span>
                    <span><i class="fas fa-box" style="color:var(--secondary);"></i> Zor Kelimelerim: <strong>${lvData.unknownWords.length}</strong></span>
                </div>
            </div>
        `;
    }).join('');

    // Overall stats calculations
    let grandTotal = 0, grandAnswered = 0;
    levels.forEach(lv => {
        grandTotal += lv.words.length;
        const lvData = user.levels[lv.code] || { progress: {} };
        const chapters = getChaptersForLevel(lv.code);
        for (let c = 0; c < chapters.length; c++) {
            grandAnswered += Object.keys(lvData.progress[c] || {}).length;
        }
    });
    const grandPct = Math.round((grandAnswered / grandTotal) * 100);

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-slide" style="flex-grow:1;">
            <div style="margin-bottom:1.5rem;">
                <span class="back-btn" onclick="renderApp()"><i class="fas fa-chevron-left"></i> Panele Dön</span>
                <h1 style="margin-top:0.5rem;"><i class="fas fa-chart-pie" style="color:var(--primary);"></i> Genel İlerleme Raporu</h1>
                <p class="subtitle">Tüm seviyelerdeki kelime tamamlama durumunuz</p>
            </div>

            <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem; text-align:center; border-radius: 14px;">
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.3rem;">Genel Öğrenim Oranı (${grandAnswered} / ${grandTotal} Kelime)</p>
                <div style="font-size:2.5rem; font-weight:800; color:var(--primary); margin-bottom:0.6rem;">${grandPct}%</div>
                <div style="background:rgba(255,255,255,0.05); border-radius:10px; height:12px; overflow:hidden; border:1px solid var(--border-color);">
                    <div style="width:${grandPct}%; height:100%; background:linear-gradient(90deg, var(--primary), var(--secondary)); transition:width 0.5s ease;"></div>
                </div>
            </div>

            <!-- PER-LEVEL DETAILS -->
            <div style="display:flex; flex-direction:column; gap:1rem;">
                ${levelCards}
            </div>

            <div style="display:flex; gap:0.6rem; margin-top:1.5rem; flex-wrap:wrap;">
                <button class="btn btn-danger" onclick="resetProgress()" style="flex:1; min-width:130px; font-size:0.85rem;">
                    <i class="fas fa-trash-alt"></i> Tüm İlerlemeyi Sıfırla
                </button>
            </div>
        </div>
    `;
}

// PROGRESS RESET
function resetProgress() {
    const confirmed = confirm(
        "⚠️ Dikkat!\n\nSeçili seviyedeki tüm çalışma verileriniz ve ilerlemeniz kalıcı olarak sıfırlanacaktır.\n" +
        "Bu işlem geri alınamaz! Sıfırlamak istiyor musunuz?"
    );
    if (!confirmed) return;

    const user = AppState.getUserData();
    const lvl = user.currentLevel || 'a1';
    user.levels[lvl] = {
        progress: {},
        unknownWords: [],
        unlockedChapters: [0]
    };
    AppState.save();
    showToast(`${lvl.toUpperCase()} seviyesi verileri sıfırlandı.`, "info");
    renderApp();
}

// EXPORT TO JSON
function exportProgress() {
    const user = AppState.getUserData();
    const exportData = {
        exportedAt: new Date().toISOString(),
        username: AppState.currentUser,
        currentLevel: user.currentLevel,
        levels: user.levels
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kelime-ustasi-${AppState.currentUser}-yedek.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Verileriniz başarıyla yedeklendi!", "success");
}

// IMPORT FROM JSON
function importProgress(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.levels || !data.username) {
                showToast("Geçersiz yedek dosyası yapısı!", "error");
                return;
            }
            const user = AppState.getUserData();
            user.levels = data.levels;
            if (data.currentLevel) user.currentLevel = data.currentLevel;
            AppState.save();
            showToast("Yedek başarıyla içe aktarıldı! 🎉", "success");
            renderApp();
        } catch {
            showToast("Dosya okunamadı veya bozuk!", "error");
        }
    };
    reader.readAsText(file);
}

// OPEN CHAPTER STUDY SELECTOR OVERLAY
let currentChapter = null;
let currentStudyMode = 'sequential'; // 'sequential' | 'bulk'
let currentWordIndex = 0;
let currentWordFlipped = false;
let bulkSearchQuery = '';
let bulkFilter = 'all'; // 'all' | 'known' | 'unknown' | 'not_sure'

function selectStudyModeOverlay(chapterIdx) {
    currentChapter = chapterIdx;
    
    // Check if modal overlays exist in DOM, else inject
    let overlay = document.getElementById('study-selector-modal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'study-selector-modal';
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h3><i class="fas fa-graduation-cap" style="color:var(--primary);"></i> Çalışma Modu Seçimi</h3>
                <button class="modal-close-btn" onclick="closeStudySelectorOverlay()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex; flex-direction:column; gap:0.8rem;">
                <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:0.4rem;">Lütfen bu bölüme nasıl çalışmak istediğinizi seçin. Zihniniz hangisine daha yatkınsa o modu tercih edebilirsiniz!</p>
                
                <div class="exercise-type-btn" onclick="confirmStudyMode('sequential')">
                    <span style="font-size:1.4rem;">🎴</span>
                    <div>
                        <div style="font-weight:700;">Sıralı Öğrenme Modu (Kartlar)</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">Kelimeler tek tek kartlar halinde gösterilir, sağa-sola kaydırarak detaylı odaklanırsınız.</div>
                    </div>
                </div>

                <div class="exercise-type-btn" onclick="confirmStudyMode('bulk')">
                    <span style="font-size:1.4rem;">📋</span>
                    <div>
                        <div style="font-weight:700;">Toplu Liste Görünümü</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">Bölümdeki tüm kelimeleri bir tablo halinde görerek serbestçe gezinir, arama ve filtreleme yaparsınız.</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    overlay.style.display = 'flex';
}

function closeStudySelectorOverlay() {
    const overlay = document.getElementById('study-selector-modal');
    if (overlay) overlay.style.display = 'none';
}

function confirmStudyMode(mode) {
    closeStudySelectorOverlay();
    currentStudyMode = mode;
    currentWordIndex = 0;
    currentWordFlipped = false;
    bulkSearchQuery = '';
    bulkFilter = 'all';
    renderStudyScreen();
}

function renderStudyScreen() {
    const container = document.getElementById('app');
    const chapters = getChaptersForLevel(AppState.getUserData().currentLevel);
    const chapter = chapters[currentChapter];
    
    const levelWords = getActiveLevelWords();
    const chapterWords = levelWords.slice(chapter.start, chapter.end);
    const userData = getActiveLevelData();
    const progress = userData.progress[currentChapter] || {};
    
    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header">
                <div>
                    <span class="back-btn" onclick="renderApp()"><i class="fas fa-chevron-left"></i> Panele Dön</span>
                    <h2 style="margin-top: 0.5rem;">${currentChapter + 1}. Bölüm Çalışması</h2>
                    <p style="color: var(--text-secondary); font-size:0.85rem; margin-bottom: 0;">Kelime Aralığı: ${chapter.range}</p>
                </div>
                <div class="mode-selector">
                    <div class="mode-tab ${currentStudyMode === 'sequential' ? 'active' : ''}" onclick="switchStudyMode('sequential')">
                        <i class="fas fa-clone"></i> Sırayla (Kartlar)
                    </div>
                    <div class="mode-tab ${currentStudyMode === 'bulk' ? 'active' : ''}" onclick="switchStudyMode('bulk')">
                        <i class="fas fa-list"></i> Toplu Liste
                    </div>
                </div>
            </div>

            <div class="glass-panel" style="padding: 1.5rem; position: relative; border-radius:14px;">
                ${currentStudyMode === 'sequential' 
                    ? getSequentialHTML(chapterWords, progress) 
                    : getBulkHTML(chapterWords, progress)
                }
            </div>
        </div>
    `;
}

function switchStudyMode(mode) {
    currentStudyMode = mode;
    currentWordIndex = 0;
    currentWordFlipped = false;
    renderStudyScreen();
}

// SEQUENTIAL FLASHCARDS GENERATOR
function getSequentialHTML(words, progress) {
    let activeIdx = currentWordIndex;
    
    const word = words[activeIdx];
    const isAnswered = progress[word.id] !== undefined;
    const answerType = progress[word.id];
    
    const totalCount = words.length;
    const answeredCount = Object.keys(progress).length;
    const percent = Math.round((answeredCount / totalCount) * 100);

    const isFlipped = currentWordFlipped || answerType === 'not_sure';
    const user = AppState.getUserData();
    const isFav = user.favorites.includes(word.id);

    // Dynamic Card Flipping listener setup
    setTimeout(() => {
        const card = document.getElementById('study-flashcard');
        if (card) {
            card.addEventListener('click', () => {
                card.classList.toggle('flipped');
                currentWordFlipped = !currentWordFlipped;
            });
        }
    }, 50);

    let actionButtonsHTML = '';
    if (answerType === 'not_sure') {
        actionButtonsHTML = `
            <button class="btn btn-danger" onclick="markSequential(${word.id}, 'unknown')" style="flex: 1; min-height: 44px; font-size: 0.85rem; padding: 0.5rem;">
                <i class="fas fa-times-circle"></i> Bilmiyorum'a Kaydet
            </button>
            <button class="btn btn-success" onclick="markSequential(${word.id}, 'known')" style="flex: 1; min-height: 44px; font-size: 0.85rem; padding: 0.5rem;">
                <i class="fas fa-check-circle"></i> Biliyorum'a Kaydet
            </button>
            <button class="btn btn-primary" onclick="navigateSequential(1)" style="flex: 1; min-height: 44px; font-size: 0.85rem; padding: 0.5rem;" ${activeIdx === totalCount - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
                Sonrakine Geç <i class="fas fa-arrow-right"></i>
            </button>
        `;
    } else {
        actionButtonsHTML = `
            <button class="btn btn-danger" onclick="markSequential(${word.id}, 'unknown')" style="flex: 1; min-height: 44px; font-size: 0.85rem; padding: 0.5rem; background: var(--danger);">
                <i class="fas fa-times-circle"></i> Bilmiyorum (Kırmızı)
            </button>
            <button class="btn btn-warning" onclick="markSequential(${word.id}, 'not_sure')" style="flex: 1; min-height: 44px; font-size: 0.85rem; padding: 0.5rem; color: white; background: var(--warning);">
                <i class="fas fa-question-circle"></i> Emin Değilim (Sarı)
            </button>
            <button class="btn btn-success" onclick="markSequential(${word.id}, 'known')" style="flex: 1; min-height: 44px; font-size: 0.85rem; padding: 0.5rem; background: var(--success);">
                <i class="fas fa-check-circle"></i> Biliyorum (Yeşil)
            </button>
        `;
    }

    return `
        <div class="flashcard-area">
            <div class="study-progress" style="width:100%; max-width:420px;">
                <div class="study-progress-text">
                    <span>Bölüm İlerlemesi: ${answeredCount} / ${totalCount} Tamamlandı</span>
                    <span>${percent}%</span>
                </div>
                <div class="chapter-progress-bar">
                    <div class="chapter-progress-fill" style="width: ${percent}%;"></div>
                </div>
            </div>

            <div class="flashcard-wrapper">
                <div class="flashcard ${isFlipped ? 'flipped' : ''}" id="study-flashcard">
                    
                    <!-- FRONT CARD -->
                    <div class="flashcard-face flashcard-front">
                        <button class="speaker-btn" onclick="event.stopPropagation(); speakWord('${word.en}')" title="Seslendir">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <button class="speaker-btn" onclick="event.stopPropagation(); toggleFavorite(${word.id})" title="Favori Ekle/Çıkar" style="right: auto; left: 1rem; color: ${isFav ? 'var(--warning)' : 'var(--text-secondary)'};">
                            <i class="${isFav ? 'fas fa-star' : 'far fa-star'}"></i>
                        </button>
                        
                        <span class="flashcard-hint"><i class="fas fa-info-circle"></i> İngilizce (Detaylar için tıklayın)</span>
                        <div style="font-size: 3.5rem; margin-bottom: 0.8rem; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.15)); animation: float 3s ease-in-out infinite;">${word.icon}</div>
                        <div class="flashcard-word">${word.en}</div>
                        <div style="font-size:0.9rem; color:var(--text-secondary); font-style:italic;">${word.phonetic || ''}</div>
                    </div>
                    
                    <!-- BACK CARD -->
                    <div class="flashcard-face flashcard-back">
                        <button class="speaker-btn" onclick="event.stopPropagation(); speakTurkish('${word.tr.replace(/'/g, "\\'")}')" title="Seslendir">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <button class="speaker-btn" onclick="event.stopPropagation(); toggleFavorite(${word.id})" title="Favori Ekle/Çıkar" style="right: auto; left: 1rem; color: ${isFav ? 'var(--warning)' : 'var(--text-secondary)'};">
                            <i class="${isFav ? 'fas fa-star' : 'far fa-star'}"></i>
                        </button>
                        
                        <span class="flashcard-hint"><i class="fas fa-language"></i> Türkçe Karşılığı</span>
                        <div style="font-size: 3.5rem; margin-bottom: 0.8rem; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.15));">${word.icon}</div>
                        <div class="flashcard-word" style="color: var(--secondary);">${word.tr}</div>
                        
                        <div style="font-size: 0.8rem; color:var(--text-secondary); text-align:center; max-width:320px; margin-top:0.8rem; line-height:1.4; border-top:1px solid var(--border-color); padding-top:0.8rem;">
                            <strong style="color:var(--text-primary);">Örnek Cümle:</strong><br>
                            "${word.example}"<br>
                            <span style="color:var(--secondary); font-style:italic;">(${word.exampleTr})</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flashcard-actions">
                ${actionButtonsHTML}
            </div>

            <div style="display: flex; gap: 1rem; width: 100%; max-width: 420px; justify-content: space-between; margin-top: 1rem;">
                <button class="btn btn-secondary" onclick="navigateSequential(-1)" ${activeIdx === 0 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} style="min-height:36px; padding:0.4rem 0.8rem; font-size:0.85rem;">
                    <i class="fas fa-arrow-left"></i> Önceki
                </button>
                <span style="align-self: center; font-weight: 700; color: var(--text-secondary); font-size:0.85rem;">Kelime ${activeIdx + 1} / ${totalCount}</span>
                <button class="btn btn-secondary" onclick="navigateSequential(1)" ${activeIdx === totalCount - 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''} style="min-height:36px; padding:0.4rem 0.8rem; font-size:0.85rem;">
                    Sonraki <i class="fas fa-arrow-right"></i>
                </button>
            </div>
            
            <p style="color: var(--text-secondary); font-size: 0.75rem; text-align: center; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.3rem;" class="hide-mobile">
                <i class="fas fa-keyboard"></i> Klavye Kısayolları: [Boşluk]: Kartı Çevir | [←/→]: Gezin | [1]: Bilmiyorum | [2]: Emin Değilim | [3]: Biliyorum | [V]: Seslendir
            </p>
        </div>
    `;
}

function navigateSequential(direction) {
    const chapters = getChaptersForLevel(AppState.getUserData().currentLevel);
    const chapter = chapters[currentChapter];
    
    currentWordIndex += direction;
    if (currentWordIndex < 0) currentWordIndex = 0;
    if (currentWordIndex >= chapter.count) currentWordIndex = chapter.count - 1;
    
    currentWordFlipped = false;
    renderStudyScreen();
}

function markSequential(wordId, status) {
    const userData = getActiveLevelData();
    if (!userData.progress[currentChapter]) {
        userData.progress[currentChapter] = {};
    }
    
    userData.progress[currentChapter][wordId] = status;

    // Manage unknownWords box storage
    if (status === 'unknown') {
        if (!userData.unknownWords.includes(wordId)) {
            userData.unknownWords.push(wordId);
        }
    } else {
        userData.unknownWords = userData.unknownWords.filter(id => id != wordId);
    }
    
    AppState.save();

    if (status === 'known') {
        showToast("Biliyorum (Yeşil) olarak işaretlendi!", "success");
    } else if (status === 'unknown') {
        showToast("Bilmiyorum (Kırmızı) kutusuna kaydedildi!", "warning");
    } else if (status === 'not_sure') {
        showToast("Anlamı açıldı, detayları inceleyebilirsiniz.", "info");
        currentWordFlipped = true;
    }
    
    // Check chapter completion status
    checkChapterCompletion();

    // Auto-advance
    if (status !== 'not_sure') {
        const chapters = getChaptersForLevel(AppState.getUserData().currentLevel);
        const chapter = chapters[currentChapter];
        if (currentWordIndex < chapter.count - 1) {
            setTimeout(() => {
                navigateSequential(1);
            }, 300);
        } else {
            renderStudyScreen();
        }
    } else {
        renderStudyScreen();
    }
}

// BULK LIST MODE GENERATOR
function getBulkHTML(words, progress) {
    const totalCount = words.length;
    
    let knownCount = 0;
    let unknownCount = 0;
    let notSureCount = 0;
    
    words.forEach(w => {
        const s = progress[w.id];
        if (s === 'known') knownCount++;
        else if (s === 'unknown') unknownCount++;
        else if (s === 'not_sure') notSureCount++;
    });

    // Query Search & Filtering engine
    const filteredWords = words.filter((w) => {
        const s = progress[w.id];
        const enVal = w.en.toLowerCase();
        const trVal = w.tr.toLowerCase();
        const q = bulkSearchQuery.toLowerCase().trim();
        const matchesSearch = enVal.includes(q) || trVal.includes(q);
        
        if (!matchesSearch) return false;

        if (bulkFilter === 'known') return s === 'known';
        if (bulkFilter === 'unknown') return s === 'unknown';
        if (bulkFilter === 'not_sure') return s === 'not_sure';
        
        return true;
    });

    const percent = Math.round(((knownCount + unknownCount + notSureCount) / totalCount) * 100);

    return `
        <div>
            <!-- Filters Panel -->
            <div style="background: rgba(255,255,255,0.02); border:1px solid var(--border-color); padding: 0.85rem; border-radius: 12px; margin-bottom: 1rem; display:flex; flex-direction:column; gap: 0.6rem;">
                <div style="display:flex; gap: 0.5rem; align-items:center; background: rgba(0, 0, 0, 0.2); border:1px solid var(--border-color); border-radius: 8px; padding: 0.4rem 0.8rem;">
                    <i class="fas fa-search" style="color: var(--text-secondary); font-size:0.85rem;"></i>
                    <input type="text" placeholder="Kelime ara..." oninput="onBulkSearchChange(this.value)" value="${bulkSearchQuery}" style="background:none; border:none; color:var(--text-primary); width:100%; font-size:0.85rem; outline:none;">
                    ${bulkSearchQuery ? `<i class="fas fa-times-circle" style="color: var(--text-secondary); cursor:pointer;" onclick="clearBulkSearch()"></i>` : ''}
                </div>
                
                <div style="display:flex; gap: 0.4rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary" style="flex:1; min-height:32px; padding:0.3rem 0.6rem; font-size:0.75rem; border-radius:6px; ${bulkFilter === 'all' ? 'background:var(--primary); color:white; border-color:var(--primary);' : ''}" onclick="onBulkFilterChange('all')">
                        Hepsi (${totalCount})
                    </button>
                    <button class="btn btn-secondary" style="flex:1; min-height:32px; padding:0.3rem 0.6rem; font-size:0.75rem; border-radius:6px; ${bulkFilter === 'known' ? 'background:var(--success); color:white; border-color:var(--success);' : ''}" onclick="onBulkFilterChange('known')">
                        Yeşil (${knownCount})
                    </button>
                    <button class="btn btn-secondary" style="flex:1; min-height:32px; padding:0.3rem 0.6rem; font-size:0.75rem; border-radius:6px; ${bulkFilter === 'unknown' ? 'background:var(--danger); color:white; border-color:var(--danger);' : ''}" onclick="onBulkFilterChange('unknown')">
                        Kırmızı (${unknownCount})
                    </button>
                    <button class="btn btn-secondary" style="flex:1; min-height:32px; padding:0.3rem 0.6rem; font-size:0.75rem; border-radius:6px; ${bulkFilter === 'not_sure' ? 'background:var(--warning); color:white; border-color:var(--warning);' : ''}" onclick="onBulkFilterChange('not_sure')">
                        Sarı (${notSureCount})
                    </button>
                </div>
            </div>

            <div class="study-progress" style="max-width: 100%; margin-bottom: 1.2rem;">
                <div class="study-progress-text">
                    <span>Tamamlanan: ${knownCount + unknownCount + notSureCount} / ${totalCount}</span>
                    <span>${percent}%</span>
                </div>
                <div class="chapter-progress-bar">
                    <div class="chapter-progress-fill" style="width: ${percent}%;"></div>
                </div>
            </div>

            <!-- List View Rows -->
            <div class="words-grid" style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.2rem;">
                ${filteredWords.length === 0 
                    ? `<div style="text-align:center; padding: 2.5rem 1rem; color: var(--text-secondary); background: rgba(255,255,255,0.01); border-radius:12px; border: 1px dashed var(--border-color);">
                         <i class="fas fa-search-minus" style="font-size: 1.8rem; margin-bottom: 0.6rem; color: var(--text-secondary); opacity: 0.6;"></i>
                         <p style="font-size:0.85rem; margin:0;">Arama sonucunda kelime bulunamadı.</p>
                       </div>`
                    : filteredWords.map((w) => {
                        const status = progress[w.id];
                        const isKnown = status === 'known';
                        const isUnknown = status === 'unknown';
                        const isNotSure = status === 'not_sure';
                        
                        let bgStyle = '';
                        let borderStyle = '';
                        let labelText = 'İşlenmedi';
                        let labelColor = 'var(--text-secondary)';
                        
                        if (isKnown) {
                            borderStyle = 'border-color: var(--success);';
                            bgStyle = 'background: rgba(16, 185, 129, 0.04);';
                            labelText = 'Biliyorum';
                            labelColor = 'var(--success)';
                        } else if (isUnknown) {
                            borderStyle = 'border-color: var(--danger);';
                            bgStyle = 'background: rgba(239, 68, 68, 0.04);';
                            labelText = 'Bilmiyorum';
                            labelColor = 'var(--danger)';
                        } else if (isNotSure) {
                            borderStyle = 'border-color: var(--warning);';
                            bgStyle = 'background: rgba(245, 158, 11, 0.04);';
                            labelText = 'Emin Değilim';
                            labelColor = 'var(--warning)';
                        }

                        const originalIdx = words.findIndex(x => x.id === w.id);

                        return `
                            <div class="word-row-card list-view-row" style="${bgStyle} ${borderStyle} display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.85rem; border-radius: 10px; border: 1px solid var(--border-color);" onclick="openWordDetailModal(${w.id})">
                                <div class="word-row-info" style="display: flex; flex-direction: column; gap: 0.1rem; flex:1;">
                                    <div style="display:flex; align-items:center; gap: 0.4rem;">
                                        <span style="font-size: 0.7rem; color: var(--text-secondary); font-weight:600;">#${originalIdx + 1 + (currentChapter * 100)}</span>
                                        <button onclick="event.stopPropagation(); speakWord('${w.en}')" title="Seslendir" style="background:none; border:none; color:var(--secondary); cursor:pointer; font-size:0.8rem; padding:0; display: inline-flex; align-items: center; justify-content: center; min-height:24px; min-width:24px;">
                                            <i class="fas fa-volume-up"></i>
                                        </button>
                                        <span style="font-size:0.65rem; color:${labelColor}; font-weight:700; background:rgba(255,255,255,0.02); padding:0.1rem 0.35rem; border-radius:4px; border:1px solid ${labelColor}33;">
                                            ${labelText}
                                        </span>
                                    </div>
                                    <div style="display:flex; align-items:baseline; gap:0.5rem; flex-wrap:wrap;">
                                        <span style="font-size:1.1rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">${w.icon}</span>
                                        <h4 style="margin: 0; font-size: 1rem; font-weight: 700; color:var(--text-primary);">${w.en}</h4>
                                        <span style="font-size:0.75rem; color:var(--text-secondary);">${w.phonetic || ''}</span>
                                    </div>
                                    <p style="color: var(--secondary); font-weight:600; font-size: 0.85rem; margin: 0.15rem 0 0 0;">${w.tr}</p>
                                </div>
                                <div class="word-row-actions" style="display: flex; align-items: center; gap: 0.3rem;" onclick="event.stopPropagation();">
                                    <button class="word-row-btn dont-know ${isUnknown ? 'active' : ''}" style="width:32px; height:32px; border-radius:6px; font-size:0.75rem; display:flex; align-items:center; justify-content:center; border: 1px solid var(--border-color); background:none; color:var(--text-secondary); cursor:pointer; transition:var(--transition); ${isUnknown ? 'background:var(--danger) !important; border-color:var(--danger) !important; color:white !important;' : ''}" onclick="markBulk(${w.id}, 'unknown')" title="Bilmiyorum (Kırmızı)">
                                        <i class="fas fa-times"></i>
                                    </button>
                                    <button class="word-row-btn not-sure ${isNotSure ? 'active' : ''}" style="width:32px; height:32px; border-radius:6px; font-size:0.75rem; display:flex; align-items:center; justify-content:center; border: 1px solid var(--border-color); background:none; color:var(--text-secondary); cursor:pointer; transition:var(--transition); ${isNotSure ? 'background:var(--warning) !important; border-color:var(--warning) !important; color:white !important;' : ''}" onclick="markBulk(${w.id}, 'not_sure')" title="Emin Değilim (Sarı)">
                                        <i class="fas fa-question"></i>
                                    </button>
                                    <button class="word-row-btn know ${isKnown ? 'active' : ''}" style="width:32px; height:32px; border-radius:6px; font-size:0.75rem; display:flex; align-items:center; justify-content:center; border: 1px solid var(--border-color); background:none; color:var(--text-secondary); cursor:pointer; transition:var(--transition); ${isKnown ? 'background:var(--success) !important; border-color:var(--success) !important; color:white !important;' : ''}" onclick="markBulk(${w.id}, 'known')" title="Biliyorum (Yeşil)">
                                        <i class="fas fa-check"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>

            <div class="bulk-footer" style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color); display:flex; flex-direction:column; gap: 0.6rem; align-items:center; text-align:center;">
                <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 0;">
                    Satırlara tıklayarak detaylı kartları açabilir, örnek cümlelere ve telaffuza ulaşabilirsiniz.
                </p>
                <button class="btn btn-primary" onclick="renderApp()" style="width: 100%; max-width: 280px; min-height:36px; font-size:0.85rem;">
                    Bölümden Çık / Panele Dön <i class="fas fa-check-double"></i>
                </button>
            </div>
        </div>
    `;
}

function onBulkSearchChange(val) {
    bulkSearchQuery = val;
    renderStudyScreen();
}

function clearBulkSearch() {
    bulkSearchQuery = '';
    renderStudyScreen();
}

function onBulkFilterChange(filter) {
    bulkFilter = filter;
    renderStudyScreen();
}

function markBulk(wordId, status) {
    const userData = getActiveLevelData();
    if (!userData.progress[currentChapter]) {
        userData.progress[currentChapter] = {};
    }

    userData.progress[currentChapter][wordId] = status;

    if (status === 'unknown') {
        if (!userData.unknownWords.includes(wordId)) {
            userData.unknownWords.push(wordId);
        }
    } else {
        userData.unknownWords = userData.unknownWords.filter(id => id != wordId);
    }

    AppState.save();
    
    // Immediate CSS updates to bypass full UI redraw
    const card = document.getElementById(`word-card-${wordId}`);
    if (card) {
        card.style.transition = "all 0.3s ease";
        if (status === 'known') {
            card.style.borderColor = "var(--success)";
            card.style.background = "rgba(16, 185, 129, 0.05)";
        } else if (status === 'unknown') {
            card.style.borderColor = "var(--danger)";
            card.style.background = "rgba(239, 68, 68, 0.05)";
        } else if (status === 'not_sure') {
            card.style.borderColor = "var(--warning)";
            card.style.background = "rgba(245, 158, 11, 0.05)";
        }
    }

    checkChapterCompletion();
    showToast("Öğrenme durumu güncellendi.", "success");
    
    // Re-render study screen to ensure correct totals and filters
    renderStudyScreen();
}

function checkChapterCompletion() {
    const userData = getActiveLevelData();
    const chapters = getChaptersForLevel(AppState.getUserData().currentLevel);
    const chapter = chapters[currentChapter];
    
    const progress = userData.progress[currentChapter] || {};
    const answeredCount = Object.keys(progress).length;

    if (answeredCount >= chapter.count) {
        const user = AppState.getUserData();
        if (user && AppState.currentUser !== 'admin') {
            const levelCode = user.currentLevel;
            const levelName = LEVELS_CONFIG[levelCode]?.name || levelCode.toUpperCase();
            const logText = `${levelName} seviyesinin ${currentChapter + 1}. Bölümünü tamamladı. 🎉`;
            
            const alreadyLogged = user.activityLogs && user.activityLogs.some(log => log.type === 'chapter_complete' && log.text === logText);
            if (!alreadyLogged) {
                logStudentActivity('chapter_complete', logText);
            }
        }
        
        const nextChapter = currentChapter + 1;
        if (nextChapter < chapters.length && !userData.unlockedChapters.includes(nextChapter)) {
            userData.unlockedChapters.push(nextChapter);
            AppState.save();
            
            triggerConfettiEffect();
            showToast(`Mükemmel! Bölüm ${currentChapter + 1} bitti. Yeni bölüm kilidi açıldı! 🎉`, "success");
        }
    }
}

// WORD DETAIL MODAL WINDOW
function openWordDetailModal(wordId) {
    const levelWords = getActiveLevelWords();
    const word = levelWords.find(w => w.id == wordId);
    if (!word) return;

    const user = AppState.getUserData();
    const levelData = getActiveLevelData();
    
    // Status check
    let status = 'none';
    for (let c=0; c<8; c++) {
        if (levelData.progress[c] && levelData.progress[c][wordId]) {
            status = levelData.progress[c][wordId];
            break;
        }
    }
    
    const isFav = user.favorites.includes(wordId);

    let overlay = document.getElementById('word-detail-modal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'word-detail-modal';
        document.body.appendChild(overlay);
    }

    let statusText = 'Çalışılmadı';
    let statusColor = 'var(--text-secondary)';
    if (status === 'known') { statusText = 'Biliyorum (Yeşil)'; statusColor = 'var(--success)'; }
    else if (status === 'unknown') { statusText = 'Bilmiyorum (Kırmızı)'; statusColor = 'var(--danger)'; }
    else if (status === 'not_sure') { statusText = 'Emin Değilim (Sarı)'; statusColor = 'var(--warning)'; }

    overlay.innerHTML = `
        <div class="modal-container animate-slide">
            <div class="modal-header">
                <h3>Kelime Detay Bilgisi</h3>
                <button class="modal-close-btn" onclick="closeWordDetailModal()">&times;</button>
            </div>
            <div class="modal-body" style="display:flex; flex-direction:column; gap:0.85rem;">
                
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h2 style="font-size:1.8rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:0.6rem; margin:0;">
                            <span style="font-size:1.8rem; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.15));">${word.icon}</span>
                            ${word.en}
                            <button onclick="speakWord('${word.en}')" title="Seslendir" style="background:none; border:none; color:var(--secondary); cursor:pointer; font-size:1.1rem; display:inline-flex;">
                                <i class="fas fa-volume-up"></i>
                            </button>
                        </h2>
                        <span style="font-size:0.85rem; color:var(--text-secondary); font-style:italic;">${word.phonetic || ''}</span>
                    </div>
                    <button class="btn btn-secondary" onclick="toggleModalFavorite(${word.id})" style="border-radius:50%; width:40px; height:40px; min-height:40px; padding:0; display:flex; align-items:center; justify-content:center; color:${isFav ? 'var(--warning)' : 'var(--text-secondary)'};">
                        <i class="${isFav ? 'fas fa-star' : 'far fa-star'}" style="font-size:1.1rem;"></i>
                    </button>
                </div>

                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:0.85rem; border-radius:10px;">
                    <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; font-weight:600; margin-bottom:0.2rem;">Türkçe Anlamı</div>
                    <div style="font-size:1.2rem; font-weight:700; color:var(--secondary);">${word.tr}</div>
                </div>

                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:0.85rem; border-radius:10px;">
                    <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; font-weight:600; margin-bottom:0.3rem;">Örnek Cümle Analizi</div>
                    <div style="font-size:0.85rem; color:var(--text-primary); line-height:1.4;">"${word.example}"</div>
                    <div style="font-size:0.8rem; color:var(--secondary); font-style:italic; margin-top:0.2rem;">"${word.exampleTr}"</div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:0.75rem;">
                    <span style="font-size:0.8rem; color:var(--text-secondary);">Durum: <strong style="color:${statusColor};">${statusText}</strong></span>
                </div>
                
                <div style="display:flex; gap:0.4rem; justify-content:stretch; margin-top:0.2rem;">
                    <button class="btn btn-danger" onclick="updateModalWordStatus(${word.id}, 'unknown')" style="flex:1; min-height:36px; padding:0.4rem; font-size:0.75rem; background:var(--danger);">Bilmiyorum</button>
                    <button class="btn btn-warning" onclick="updateModalWordStatus(${word.id}, 'not_sure')" style="flex:1; min-height:36px; padding:0.4rem; font-size:0.75rem; color:white; background:var(--warning);">Emin Değilim</button>
                    <button class="btn btn-success" onclick="updateModalWordStatus(${word.id}, 'known')" style="flex:1; min-height:36px; padding:0.4rem; font-size:0.75rem; background:var(--success);">Biliyorum</button>
                </div>
            </div>
        </div>
    `;
    overlay.style.display = 'flex';
}

function closeWordDetailModal() {
    const el = document.getElementById('word-detail-modal');
    if (el) el.style.display = 'none';
}

function toggleModalFavorite(wordId) {
    toggleFavorite(wordId);
    // Refresh modal
    openWordDetailModal(wordId);
}

function updateModalWordStatus(wordId, status) {
    const user = AppState.getUserData();
    const lvl = user.currentLevel || 'a1';
    const words = getActiveLevelWords();
    const wordIdx = words.findIndex(w => w.id == wordId);
    
    // Find chapter index relatively
    const chapterIdx = wordIdx !== -1 ? Math.floor(wordIdx / 100) : 0;
    
    const levelData = user.levels[lvl];
    if (!levelData.progress[chapterIdx]) {
        levelData.progress[chapterIdx] = {};
    }
    
    levelData.progress[chapterIdx][wordId] = status;
    
    if (status === 'unknown') {
        if (!levelData.unknownWords.includes(wordId)) {
            levelData.unknownWords.push(wordId);
        }
    } else {
        levelData.unknownWords = levelData.unknownWords.filter(id => id != wordId);
    }
    
    AppState.save();
    showToast("Durum başarıyla güncellendi.", "success");
    
    // Refresh modal and main study screen
    openWordDetailModal(wordId);
    
    // If study screen is active behind modal, sync it
    if (currentChapter !== null) {
        renderStudyScreen();
    }
}

// TOGGLE FAVORITE KEY FOR USER
function toggleFavorite(wordId) {
    const user = AppState.getUserData();
    if (!user) return;
    
    const idx = user.favorites.indexOf(wordId);
    if (idx === -1) {
        user.favorites.push(wordId);
        showToast("Favori kelimelere eklendi! ⭐", "success");
    } else {
        user.favorites.splice(idx, 1);
        showToast("Favori kelimelerden çıkarıldı.", "info");
    }
    AppState.save();
    
    // Re-sync standard cards/views
    if (currentStudyMode === 'sequential' && currentChapter !== null) {
        renderStudyScreen();
    }
}

// PRACTICE HUB (BİLMEDİKLERİM & ETKİNLİK SİSTEMİ)
function openPracticeHub() {
    if (isDailyReviewSession) {
        openDailyReview();
        return;
    }
    const container = document.getElementById('app');
    const userData = getActiveLevelData();
    const user = AppState.getUserData();
    const unknownCount = userData.unknownWords.length;
    const favoritesCount = user.favorites.length;

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-slide" style="flex-grow: 1;">
            <div style="margin-bottom: 1.5rem;">
                <span class="back-btn" onclick="renderApp()"><i class="fas fa-chevron-left"></i> Panele Dön</span>
                <h1 style="margin-top: 0.5rem;"><i class="fas fa-toolbox" style="color: var(--primary);"></i> Pratik & Aktivite Yeri</h1>
                <p class="subtitle">Bilinmeyenler listenizde <strong>${unknownCount}</strong> kelime, Favorilerinizde <strong>${favoritesCount}</strong> kelime bulunmaktadır.</p>
            </div>

            <!-- CHOOSE STUDYING TARGET SET -->
            <div class="glass-panel" style="padding:1rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:1.2rem; flex-wrap:wrap; border-radius:12px;">
                <span style="font-weight:700; font-size:0.85rem; color:var(--text-secondary);">Pratik Yapılacak Havuz:</span>
                <div style="display:flex; gap:0.4rem;">
                    <button class="btn btn-secondary" id="target-pool-unknowns" onclick="switchPracticePool('unknowns')" style="min-height:32px; font-size:0.75rem; padding:0.3rem 0.6rem; background:var(--primary); border-color:var(--primary); color:white;">
                        Zor Kelimelerim (${unknownCount})
                    </button>
                    <button class="btn btn-secondary" id="target-pool-favorites" onclick="switchPracticePool('favorites')" style="min-height:32px; font-size:0.75rem; padding:0.3rem 0.6rem;" ${favoritesCount === 0 ? 'disabled style="opacity:0.3;"' : ''}>
                        Yalnızca Favorilerim (${favoritesCount})
                    </button>
                </div>
            </div>

            <!-- CHOOSE 8 GAME MODES -->
            <div class="practice-hub" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
                
                <div class="glass-panel practice-card animate-fade" onclick="startPracticeMode('flashcard')">
                    <div class="practice-icon"><i class="fas fa-clone" style="color:var(--primary);"></i></div>
                    <h4>1. Kelime Kartları</h4>
                    <p>Zor kelimeleri kartlarla hızlıca gözden geçirin.</p>
                </div>

                <div class="glass-panel practice-card animate-fade" onclick="startPracticeMode('choice_en_tr')">
                    <div class="practice-icon"><i class="fas fa-list-ul" style="color:var(--secondary);"></i></div>
                    <h4>2. Seçmeli: İngilizce → Türkçe</h4>
                    <p>İngilizce kelimenin doğru Türkçe karşılığını seçin.</p>
                </div>

                <div class="glass-panel practice-card animate-fade" onclick="startPracticeMode('choice_tr_en')">
                    <div class="practice-icon"><i class="fas fa-font" style="color:var(--success);"></i></div>
                    <h4>3. Seçmeli: Türkçe → İngilizce</h4>
                    <p>Türkçe kelimenin doğru İngilizce karşılığını seçin.</p>
                </div>

                <div class="glass-panel practice-card animate-fade" onclick="startPracticeMode('fill_blank')">
                    <div class="practice-icon"><i class="fas fa-keyboard" style="color:var(--warning);"></i></div>
                    <h4>4. Boşluk Doldurma (Yazma)</h4>
                    <p>Türkçe karşılığı verilen kelimeyi İngilizce klavyeyle yazın.</p>
                </div>

                <div class="glass-panel practice-card animate-fade" onclick="startPracticeMode('true_false')">
                    <div class="practice-icon"><i class="fas fa-adjust" style="color:var(--danger);"></i></div>
                    <h4>5. Doğru / Yanlış Testi</h4>
                    <p>Önerilen Türkçe kelime anlamının doğruluğunu onaylayın.</p>
                </div>

                <div class="glass-panel practice-card animate-fade" onclick="startPracticeMode('listen_write')">
                    <div class="practice-icon"><i class="fas fa-headphones" style="color:var(--primary);"></i></div>
                    <h4>6. Dinle & Yaz Etkinliği</h4>
                    <p>Kelimelerin okunuşunu dinleyip İngilizcesini yazın.</p>
                </div>

                <div class="glass-panel practice-card animate-fade" onclick="startPracticeMode('anagram')">
                    <div class="practice-icon"><i class="fas fa-cubes" style="color:var(--secondary);"></i></div>
                    <h4>7. Karışık Harfler</h4>
                    <p>Harfleri doğru sıralayarak İngilizce kelimeyi türetin.</p>
                </div>

                <div class="glass-panel practice-card animate-fade" onclick="startPracticeMode('matching')">
                    <div class="practice-icon"><i class="fas fa-columns" style="color:var(--success);"></i></div>
                    <h4>8. Kelime Eşleştirme</h4>
                    <p>Zor kelimeleri sütunlar halinde birbirleriyle eşleyin.</p>
                </div>
            </div>

            <!-- MIXED PLAY ROW -->
            <div class="glass-panel practice-section-card animate-fade" style="margin-top:1.5rem; border-color:var(--warning); background:linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(99,102,241,0.08) 100%);">
                <div>
                    <h3 style="margin:0;"><i class="fas fa-dice" style="color:var(--warning);"></i> Karışık Pratik Modu (Karma)</h3>
                    <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:0.2rem;">Yukarıdaki tüm test türlerini rastgele harmanlayarak kelimeleri kusursuzca pekiştirin.</p>
                </div>
                <button class="btn btn-warning" onclick="startPracticeMode('mixed')" style="min-height:38px; color:white;">
                    Karışık Pratiği Başlat <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    `;
}

let activePracticePool = 'unknowns'; // 'unknowns' | 'favorites'
function switchPracticePool(pool) {
    activePracticePool = pool;
    const btnUnk = document.getElementById('target-pool-unknowns');
    const btnFav = document.getElementById('target-pool-favorites');
    
    if (pool === 'unknowns') {
        btnUnk.style.background = 'var(--primary)';
        btnUnk.style.borderColor = 'var(--primary)';
        btnUnk.style.color = 'white';
        if (btnFav) {
            btnFav.style.background = 'rgba(255,255,255,0.05)';
            btnFav.style.borderColor = 'var(--border-color)';
            btnFav.style.color = 'var(--text-primary)';
        }
    } else {
        btnFav.style.background = 'var(--primary)';
        btnFav.style.borderColor = 'var(--primary)';
        btnFav.style.color = 'white';
        if (btnUnk) {
            btnUnk.style.background = 'rgba(255,255,255,0.05)';
            btnUnk.style.borderColor = 'var(--border-color)';
            btnUnk.style.color = 'var(--text-primary)';
        }
    }
}

// CORE ACTIVITIES IMPLEMENTATIONS
let activePracticeMode = null;
let practiceSessionData = {};

function startPracticeMode(mode) {
    isDailyReviewSession = false;
    activePracticeMode = mode;
    const userData = getActiveLevelData();
    const user = AppState.getUserData();
    const levelWords = getActiveLevelWords();
    
    let targetWords = [];
    if (activePracticePool === 'unknowns') {
        targetWords = levelWords.filter(w => userData.unknownWords.includes(w.id));
    } else {
        // Starred favorites pool
        targetWords = levelWords.filter(w => user.favorites.includes(w.id));
    }

    if (targetWords.length === 0) {
        showToast("Seçilen pratik havuzunda kelimeniz bulunamadı!", "warning");
        openPracticeHub();
        return;
    }

    // Prepare quiz list: limit to max 10 for standard practice sessions
    targetWords.sort(() => Math.random() - 0.5);
    const sessionWords = targetWords.slice(0, 10);

    practiceSessionData = {
        words: sessionWords,
        currentIndex: 0,
        correctCount: 0,
        incorrectCount: 0,
        options: [],
        mixedType: 'choice_en_tr' // tracking sub-mode for mixed mode
    };

    initPracticeQuestion();
}

function initPracticeQuestion() {
    const data = practiceSessionData;
    if (data.currentIndex >= data.words.length) {
        // Badge evaluation for perfect test scores
        if (data.correctCount === data.words.length && data.words.length >= 5) {
            const user = AppState.getUserData();
            if (!user.perfectQuizzesEarned) user.perfectQuizzesEarned = 0;
            user.perfectQuizzesEarned++;
            AppState.save();
        }
        renderPracticeFinish();
        return;
    }

    // Determine current mode
    let currentMode = activePracticeMode;
    if (activePracticeMode === 'mixed') {
        const types = ['choice_en_tr', 'choice_tr_en', 'fill_blank', 'true_false', 'listen_write', 'anagram'];
        currentMode = types[Math.floor(Math.random() * types.length)];
        practiceSessionData.mixedType = currentMode;
    }

    if (currentMode === 'flashcard') {
        renderPracticeFlashcard();
    } else if (currentMode === 'choice_en_tr') {
        initChoiceQuestion(true); // English -> Turkish
    } else if (currentMode === 'choice_tr_en') {
        initChoiceQuestion(false); // Turkish -> English
    } else if (currentMode === 'fill_blank') {
        renderPracticeFillBlank();
    } else if (currentMode === 'true_false') {
        initTrueFalseQuestion();
    } else if (currentMode === 'listen_write') {
        renderPracticeListenWrite();
    } else if (currentMode === 'anagram') {
        initAnagramQuestion();
    } else if (currentMode === 'matching') {
        initMatchingGame();
    }
}

// 1. PRACTICE FLASHCARD
function renderPracticeFlashcard() {
    const container = document.getElementById('app');
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    
    setTimeout(() => {
        const card = document.getElementById('practice-flashcard');
        if (card) {
            card.addEventListener('click', () => {
                card.classList.toggle('flipped');
            });
        }
    }, 50);

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header">
                <div>
                    <span class="back-btn" onclick="openPracticeHub()"><i class="fas fa-chevron-left"></i> Pratik Hub'a Dön</span>
                    <h2 style="margin-top: 0.5rem;">Kelime Kartları Pratiği</h2>
                </div>
            </div>

            <div class="glass-panel" style="padding: 2rem;">
                <div class="flashcard-area">
                    <span style="font-weight:700; color: var(--text-secondary); font-size:0.85rem;">Kart ${data.currentIndex + 1} / ${data.words.length}</span>
                    
                    <div class="flashcard-wrapper">
                        <div class="flashcard" id="practice-flashcard">
                            <div class="flashcard-face flashcard-front">
                                <button class="speaker-btn" onclick="event.stopPropagation(); speakWord('${word.en}')" title="Seslendir">
                                    <i class="fas fa-volume-up"></i>
                                </button>
                                <span class="flashcard-hint"><i class="fas fa-info-circle"></i> İngilizce (Öğrenmek için tıkla)</span>
                                <div style="font-size: 3.5rem; margin-bottom: 0.8rem; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.15)); animation: float 3s ease-in-out infinite;">${word.icon}</div>
                                <div class="flashcard-word">${word.en}</div>
                                <div style="font-size:0.85rem; color:var(--text-secondary);">${word.phonetic || ''}</div>
                            </div>
                            <div class="flashcard-face flashcard-back">
                                <button class="speaker-btn" onclick="event.stopPropagation(); speakTurkish('${word.tr.replace(/'/g, "\\'")}')" title="Seslendir">
                                    <i class="fas fa-volume-up"></i>
                                </button>
                                <span class="flashcard-hint"><i class="fas fa-language"></i> Türkçe Karşılığı</span>
                                <div style="font-size: 3.5rem; margin-bottom: 0.8rem; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.15));">${word.icon}</div>
                                <div class="flashcard-word" style="color: var(--secondary);">${word.tr}</div>
                                <div style="font-size:0.75rem; color:var(--text-secondary); text-align:center; max-width:280px; margin-top:0.4rem; font-style:italic;">
                                    "${word.example}"<br>
                                    <span style="color:var(--secondary);">(${word.exampleTr})</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flashcard-actions">
                        <button class="btn btn-secondary" onclick="nextPracticeFlashcard(false)" style="flex: 1; border-color:var(--warning);">
                            <i class="fas fa-history"></i> Hala Öğrenemedim
                        </button>
                        <button class="btn btn-success" onclick="nextPracticeFlashcard(true)" style="flex: 1;">
                            <i class="fas fa-check-double"></i> Zor Kelimelerden Çıkar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function nextPracticeFlashcard(learned) {
    const userData = getActiveLevelData();
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    const levelWords = getActiveLevelWords();

    if (learned) {
        data.correctCount++;
        
        // Remove from unknownWords list
        userData.unknownWords = userData.unknownWords.filter(id => id != word.id);
        
        // Mark known in chapter progress relatively
        const wordIdx = levelWords.findIndex(w => w.id === word.id);
        const chapterIdx = wordIdx !== -1 ? Math.floor(wordIdx / 100) : 0;
        if (!userData.progress[chapterIdx]) userData.progress[chapterIdx] = {};
        userData.progress[chapterIdx][word.id] = 'known';
        
        AppState.save();
        showToast("Harika! Kelimeyi başardınız ve zor kutudan çıkartıldı 🎉", "success");
    } else {
        data.incorrectCount++;
    }

    data.currentIndex++;
    initPracticeQuestion();
}

// 2 & 3. CHOICE QUESTIONS (EN->TR & TR->EN)
function initChoiceQuestion(isEnToTr) {
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    const levelWords = getActiveLevelWords();
    
    const correctAns = isEnToTr ? word.tr : word.en;
    const options = [correctAns];
    
    // Distractors
    while(options.length < Math.min(4, levelWords.length)) {
        const randomWord = levelWords[Math.floor(Math.random() * levelWords.length)];
        const dist = isEnToTr ? randomWord.tr : randomWord.en;
        if (!options.includes(dist)) {
            options.push(dist);
        }
    }

    options.sort(() => Math.random() - 0.5);
    data.options = options;

    renderPracticeChoice(isEnToTr);
}

function renderPracticeChoice(isEnToTr) {
    const container = document.getElementById('app');
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];

    const questionText = isEnToTr 
        ? `"${word.en}" kelimesinin Türkçe karşılığı hangisidir?` 
        : `"${word.tr}" anlamındaki İngilizce kelime hangisidir?`;

    const displayWord = isEnToTr ? word.en : word.tr;

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header">
                <div>
                    <span class="back-btn" onclick="openPracticeHub()"><i class="fas fa-chevron-left"></i> Pratik Hub'a Dön</span>
                    <h2 style="margin-top: 0.5rem;">Çoktan Seçmeli Test</h2>
                </div>
            </div>

            <div class="glass-panel exercise-container" style="max-width:520px; margin: 0 auto; border-radius:14px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.8rem; font-weight:600;">
                    <span>Soru ${data.currentIndex + 1} / ${data.words.length}</span>
                    <span>Doğru: ${data.correctCount} | Yanlış: ${data.incorrectCount}</span>
                </div>

                <div class="question-box" style="text-align:center;">
                    <p style="color: var(--text-secondary); font-weight:500; font-size:0.9rem;">${questionText}</p>
                    <div class="question-word" style="font-size:2.2rem; font-weight:800; color:var(--text-primary); margin-top:0.4rem; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                        ${displayWord}
                        ${isEnToTr ? `
                            <button onclick="speakWord('${word.en}')" title="Seslendir" style="background:none; border:none; color:var(--secondary); cursor:pointer; font-size:1.1rem; display:inline-flex;">
                                <i class="fas fa-volume-up"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="options-grid" style="display:grid; grid-template-columns:1fr; gap:0.6rem; margin-top:1.5rem;">
                    ${data.options.map(opt => `
                        <button class="option-btn" style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); color:var(--text-primary); padding:0.75rem 1rem; border-radius:10px; text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-weight:600; font-size:0.9rem; transition:var(--transition);" onclick="checkChoiceAnswer(this, '${opt.replace(/'/g, "\\'")}', ${isEnToTr})">
                            <span>${opt}</span>
                            <i class="fas fa-chevron-right" style="opacity: 0.4;"></i>
                        </button>
                    `).join('')}
                </div>

                <div id="choice-next-btn-container" style="display:none; text-align:center; margin-top:1.25rem;">
                    <button class="btn btn-primary" onclick="nextPracticeQuestion()" style="width:100%; min-height:38px; font-size:0.85rem;">
                        Sonraki Soru <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function checkChoiceAnswer(btn, selection, isEnToTr) {
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    const correctAns = isEnToTr ? word.tr : word.en;
    const isCorrect = selection === correctAns;

    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => {
        b.disabled = true;
        b.style.pointerEvents = "none";
        
        const text = b.querySelector('span').innerText.trim();
        if (text === correctAns) {
            b.style.borderColor = "var(--success)";
            b.style.background = "rgba(16, 185, 129, 0.08)";
            b.querySelector('i').className = "fas fa-check-circle";
            b.querySelector('i').style.color = "var(--success)";
            b.querySelector('i').style.opacity = "1";
        }
    });

    if (isCorrect) {
        data.correctCount++;
        word.answeredCorrectly = true;
        showToast("Harika! Doğru cevap.", "success");
    } else {
        data.incorrectCount++;
        word.answeredCorrectly = false;
        btn.style.borderColor = "var(--danger)";
        btn.style.background = "rgba(239, 68, 68, 0.08)";
        btn.querySelector('i').className = "fas fa-times-circle";
        btn.querySelector('i').style.color = "var(--danger)";
        btn.querySelector('i').style.opacity = "1";
        showToast("Maalesef yanlış cevap.", "error");
    }

    document.getElementById('choice-next-btn-container').style.display = "block";
}

// 4. FILL IN THE BLANK
function renderPracticeFillBlank() {
    const container = document.getElementById('app');
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header">
                <div>
                    <span class="back-btn" onclick="openPracticeHub()"><i class="fas fa-chevron-left"></i> Pratik Hub'a Dön</span>
                    <h2 style="margin-top: 0.5rem;">Boşluk Doldurma</h2>
                </div>
            </div>

            <div class="glass-panel exercise-container" style="max-width:520px; margin: 0 auto; border-radius:14px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.8rem; font-weight:600;">
                    <span>Kelime ${data.currentIndex + 1} / ${data.words.length}</span>
                    <span>Doğru: ${data.correctCount} | Yanlış: ${data.incorrectCount}</span>
                </div>

                <div class="question-box" style="text-align:center;">
                    <p style="color: var(--text-secondary); font-weight:500; font-size:0.9rem;">Verilen Türkçe karşılığın İngilizce kelimesini tam olarak yazın:</p>
                    <div class="question-word" style="font-size:2.2rem; font-weight:800; color:var(--primary); margin-top:0.4rem;">${word.tr}</div>
                </div>

                <form id="fill-blank-form" onsubmit="checkFillBlankAnswer(event)" style="margin-top:1.5rem;">
                    <div class="input-group" style="margin-bottom: 1rem;">
                        <input type="text" id="blank-input" class="input-field" placeholder="İngilizce karşılığı yazın..." autocomplete="off" required style="text-align:center; font-size:1.1rem; font-weight:700;">
                    </div>

                    <div style="display:flex; gap: 0.6rem;">
                        <button type="submit" id="blank-submit" class="btn btn-primary" style="flex:1; min-height:38px; font-size:0.85rem;">
                            Cevabı Kontrol Et <i class="fas fa-question-circle"></i>
                        </button>
                        <button type="button" id="blank-next" class="btn btn-secondary" onclick="nextPracticeQuestion()" style="display:none; flex:1; min-height:38px; font-size:0.85rem; background:var(--primary); color:white; border-color:var(--primary);">
                            Sonraki Soru <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </form>

                <div id="blank-feedback" style="margin-top: 1rem; text-align:center; font-weight:700; display:none; font-size:0.95rem;"></div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const input = document.getElementById('blank-input');
        if (input) input.focus();
    }, 100);
}

function checkFillBlankAnswer(e) {
    e.preventDefault();
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    
    const input = document.getElementById('blank-input');
    const submitBtn = document.getElementById('blank-submit');
    const nextBtn = document.getElementById('blank-next');
    const feedback = document.getElementById('blank-feedback');
    
    const userVal = input.value.trim().toLowerCase();
    const correctVal = word.en.trim().toLowerCase();

    input.disabled = true;
    submitBtn.style.display = "none";
    nextBtn.style.display = "block";
    feedback.style.display = "block";

    if (userVal === correctVal) {
        data.correctCount++;
        word.answeredCorrectly = true;
        feedback.innerHTML = `<span style="color: var(--success);"><i class="fas fa-check-circle"></i> Doğru! Müthiş iş.</span>`;
        input.style.borderColor = "var(--success)";
        input.style.background = "rgba(16, 185, 129, 0.05)";
        showToast("Tebrikler! Doğru cevap.", "success");
    } else {
        data.incorrectCount++;
        word.answeredCorrectly = false;
        feedback.innerHTML = `<span style="color: var(--danger);"><i class="fas fa-times-circle"></i> Yanlış! Doğru cevap: <strong style="color:var(--text-primary); text-decoration:underline;">${word.en}</strong></span>`;
        input.style.borderColor = "var(--danger)";
        input.style.background = "rgba(239, 68, 68, 0.05)";
        showToast("Maalesef yanlış cevap.", "error");
    }
}

// 5. TRUE / FALSE QUESTIONS
function initTrueFalseQuestion() {
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    const levelWords = getActiveLevelWords();
    
    // 50% probability of showing correct vs incorrect matching
    const displayCorrect = Math.random() > 0.5;
    let proposedTranslation = word.tr;
    
    if (!displayCorrect) {
        let attempts = 0;
        while (attempts < 10) {
            const rand = levelWords[Math.floor(Math.random() * levelWords.length)];
            if (rand.tr !== word.tr) {
                proposedTranslation = rand.tr;
                break;
            }
            attempts++;
        }
    }

    practiceSessionData.proposedTranslation = proposedTranslation;
    practiceSessionData.isCorrectProposal = displayCorrect;

    renderPracticeTrueFalse();
}

function renderPracticeTrueFalse() {
    const container = document.getElementById('app');
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header">
                <div>
                    <span class="back-btn" onclick="openPracticeHub()"><i class="fas fa-chevron-left"></i> Pratik Hub'a Dön</span>
                    <h2 style="margin-top: 0.5rem;">Doğru / Yanlış Testi</h2>
                </div>
            </div>

            <div class="glass-panel exercise-container" style="max-width:520px; margin: 0 auto; border-radius:14px; text-align:center;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 1.25rem; color: var(--text-secondary); font-size: 0.8rem; font-weight:600;">
                    <span>Kelime ${data.currentIndex + 1} / ${data.words.length}</span>
                    <span>Doğru: ${data.correctCount} | Yanlış: ${data.incorrectCount}</span>
                </div>

                <div class="question-box">
                    <p style="color: var(--text-secondary); font-weight:500; font-size:0.9rem;">Aşağıdaki kelime-anlam eşleşmesi doğru mudur?</p>
                    
                    <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:1.25rem; margin-bottom:1.5rem;">
                        <span style="font-size:2.4rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                            ${word.en}
                            <button onclick="speakWord('${word.en}')" title="Seslendir" style="background:none; border:none; color:var(--secondary); cursor:pointer; font-size:1.1rem; display:inline-flex;">
                                <i class="fas fa-volume-up"></i>
                            </button>
                        </span>
                        <i class="fas fa-equals" style="color:var(--text-secondary); font-size:1rem; opacity:0.6;"></i>
                        <span style="font-size:2rem; font-weight:800; color:var(--secondary);">${data.proposedTranslation}</span>
                    </div>
                </div>

                <div style="display:flex; gap:0.8rem; justify-content:stretch;" id="tf-buttons-container">
                    <button class="btn btn-danger" onclick="checkTrueFalseAnswer(false)" style="flex:1; min-height:44px; font-size:0.9rem; background:var(--danger); display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                        <i class="fas fa-times-circle" style="font-size:1.1rem;"></i> YANLIŞ
                    </button>
                    <button class="btn btn-success" onclick="checkTrueFalseAnswer(true)" style="flex:1; min-height:44px; font-size:0.9rem; background:var(--success); display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                        <i class="fas fa-check-circle" style="font-size:1.1rem;"></i> DOĞRU
                    </button>
                </div>

                <div id="tf-feedback-container" style="display:none; margin-top:1.25rem;">
                    <div id="tf-feedback-text" style="font-weight:700; font-size:1rem; margin-bottom:1rem;"></div>
                    <button class="btn btn-primary" onclick="nextPracticeQuestion()" style="width:100%; min-height:38px; font-size:0.85rem;">
                        Sonraki Soru <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function checkTrueFalseAnswer(userDecision) {
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    const isCorrect = userDecision === data.isCorrectProposal;
    
    const feedback = document.getElementById('tf-feedback-text');
    const btns = document.getElementById('tf-buttons-container');
    const nextPanel = document.getElementById('tf-feedback-container');

    btns.style.display = "none";
    nextPanel.style.display = "block";

    if (isCorrect) {
        data.correctCount++;
        word.answeredCorrectly = true;
        feedback.innerHTML = `<span style="color:var(--success);"><i class="fas fa-check-circle"></i> Doğru! Harika akıl yürütme.</span>`;
        showToast("Tebrikler! Doğru tahmin.", "success");
    } else {
        data.incorrectCount++;
        word.answeredCorrectly = false;
        feedback.innerHTML = `<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Yanlış! Eşleşme aslında ${data.isCorrectProposal ? 'DOĞRU' : 'YANLIŞ'} idi.</span>`;
        showToast("Maalesef yanlış tahmin.", "error");
    }
}

// 6. LISTEN & WRITE ETKİNLİĞİ
function renderPracticeListenWrite() {
    const container = document.getElementById('app');
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];

    // Trigger initial audio voice read
    setTimeout(() => {
        speakWord(word.en);
    }, 400);

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header">
                <div>
                    <span class="back-btn" onclick="openPracticeHub()"><i class="fas fa-chevron-left"></i> Pratik Hub'a Dön</span>
                    <h2 style="margin-top: 0.5rem;">Dinle & Yaz Etkinliği</h2>
                </div>
            </div>

            <div class="glass-panel exercise-container" style="max-width:520px; margin: 0 auto; border-radius:14px; text-align:center;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.8rem; font-weight:600;">
                    <span>Kelime ${data.currentIndex + 1} / ${data.words.length}</span>
                    <span>Doğru: ${data.correctCount} | Yanlış: ${data.incorrectCount}</span>
                </div>

                <div class="question-box">
                    <p style="color: var(--text-secondary); font-weight:500; font-size:0.9rem;">Hoparlör butonuna basıp kelimeyi dinleyin ve doğru şekilde yazın:</p>
                    
                    <button class="speaker-btn" onclick="speakWord('${word.en}')" style="position:static; margin:1.5rem auto; width:70px; height:70px; font-size:2rem; background:rgba(99,102,241,0.15); border-color:var(--primary);">
                        <i class="fas fa-volume-up" style="color:var(--primary);"></i>
                    </button>
                    
                    <span style="font-size:0.8rem; color:var(--text-secondary); display:block; margin-top:-0.5rem;">Anlamı: <strong>${word.tr}</strong></span>
                </div>

                <form id="listen-write-form" onsubmit="checkListenWriteAnswer(event)" style="margin-top:1.5rem;">
                    <div class="input-group" style="margin-bottom: 1rem;">
                        <input type="text" id="listen-input" class="input-field" placeholder="Duyduğunuz kelimeyi buraya yazın" autocomplete="off" required style="text-align:center; font-size:1.1rem; font-weight:700;">
                    </div>

                    <div style="display:flex; gap: 0.6rem;">
                        <button type="submit" id="listen-submit" class="btn btn-primary" style="flex:1; min-height:38px; font-size:0.85rem;">
                            Cevabı Kontrol Et <i class="fas fa-question-circle"></i>
                        </button>
                        <button type="button" id="listen-next" class="btn btn-secondary" onclick="nextPracticeQuestion()" style="display:none; flex:1; min-height:38px; font-size:0.85rem; background:var(--primary); color:white; border-color:var(--primary);">
                            Sonraki Soru <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                </form>

                <div id="listen-feedback" style="margin-top: 1rem; text-align:center; font-weight:700; display:none; font-size:0.95rem;"></div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const input = document.getElementById('listen-input');
        if (input) input.focus();
    }, 100);
}

function checkListenWriteAnswer(e) {
    e.preventDefault();
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    
    const input = document.getElementById('listen-input');
    const submitBtn = document.getElementById('listen-submit');
    const nextBtn = document.getElementById('listen-next');
    const feedback = document.getElementById('listen-feedback');
    
    const userVal = input.value.trim().toLowerCase();
    const correctVal = word.en.trim().toLowerCase();

    input.disabled = true;
    submitBtn.style.display = "none";
    nextBtn.style.display = "block";
    feedback.style.display = "block";

    if (userVal === correctVal) {
        data.correctCount++;
        word.answeredCorrectly = true;
        feedback.innerHTML = `<span style="color: var(--success);"><i class="fas fa-check-circle"></i> Doğru! Harika kulaklar.</span>`;
        input.style.borderColor = "var(--success)";
        input.style.background = "rgba(16, 185, 129, 0.05)";
        showToast("Tebrikler! Doğru cevap.", "success");
    } else {
        data.incorrectCount++;
        word.answeredCorrectly = false;
        feedback.innerHTML = `<span style="color: var(--danger);"><i class="fas fa-times-circle"></i> Yanlış! Doğru yazılışı: <strong style="color:var(--text-primary); text-decoration:underline;">${word.en}</strong></span>`;
        input.style.borderColor = "var(--danger)";
        input.style.background = "rgba(239, 68, 68, 0.05)";
        showToast("Maalesef yanlış yazılış.", "error");
    }
}

// 7. ANAGRAM (KARIŞIK HARFLER)
let anagramLetters = [];
let anagramAnswer = [];

function initAnagramQuestion() {
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    
    const letters = word.en.toLowerCase().split('');
    // Scramble letters until they don't match original English spelling exactly
    let scrambled = [...letters];
    let attempts = 0;
    while(attempts < 10) {
        scrambled.sort(() => Math.random() - 0.5);
        if (scrambled.join('') !== word.en.toLowerCase()) break;
        attempts++;
    }

    anagramLetters = scrambled.map((char, index) => ({ id: index, char: char, used: false }));
    anagramAnswer = [];

    renderPracticeAnagram();
}

function renderPracticeAnagram() {
    const container = document.getElementById('app');
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header">
                <div>
                    <span class="back-btn" onclick="openPracticeHub()"><i class="fas fa-chevron-left"></i> Pratik Hub'a Dön</span>
                    <h2 style="margin-top: 0.5rem;">Karışık Harfler</h2>
                </div>
            </div>

            <div class="glass-panel exercise-container" style="max-width:520px; margin: 0 auto; border-radius:14px; text-align:center;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 1.25rem; color: var(--text-secondary); font-size: 0.8rem; font-weight:600;">
                    <span>Kelime ${data.currentIndex + 1} / ${data.words.length}</span>
                    <span>Doğru: ${data.correctCount} | Yanlış: ${data.incorrectCount}</span>
                </div>

                <div class="question-box">
                    <p style="color: var(--text-secondary); font-weight:500; font-size:0.9rem;">Harflere tıklayarak İngilizce kelimeyi oluşturun:</p>
                    <div style="font-size:1.3rem; font-weight:700; color:var(--primary); margin-top:0.4rem; margin-bottom:1.5rem;">Anlamı: ${word.tr}</div>
                </div>

                <!-- Answer Slots -->
                <div class="anagram-answer-container" id="anagram-slots">
                    ${word.en.split('').map((c, i) => {
                        const filledChar = anagramAnswer[i] !== undefined ? anagramAnswer[i].char : '';
                        return `<div class="anagram-slot" id="slot-${i}">${filledChar}</div>`;
                    }).join('')}
                </div>

                <!-- Interactive Letter Tiles -->
                <div class="scrambled-letters-container" id="anagram-tiles">
                    ${anagramLetters.map(t => {
                        return `<div class="letter-tile ${t.used ? 'used' : ''}" onclick="clickAnagramTile(${t.id})" id="tile-${t.id}">${t.char}</div>`;
                    }).join('')}
                </div>

                <div style="display:flex; gap:0.6rem; justify-content:stretch; margin-top:1.5rem;">
                    <button class="btn btn-secondary" onclick="resetAnagramAnswer()" style="flex:1; min-height:36px; font-size:0.8rem; padding:0.4rem 0.8rem;">
                        <i class="fas fa-trash"></i> Temizle
                    </button>
                    <button class="btn btn-primary" onclick="submitAnagramAnswer()" style="flex:2; min-height:36px; font-size:0.85rem; padding:0.4rem 0.8rem;" id="anagram-submit-btn">
                        Cevabı Gönder <i class="fas fa-paper-plane"></i>
                    </button>
                    <button class="btn btn-primary" onclick="nextPracticeQuestion()" style="display:none; flex:2; min-height:36px; font-size:0.85rem; padding:0.4rem 0.8rem; background:var(--primary); border-color:var(--primary);" id="anagram-next-btn">
                        Sonraki Soru <i class="fas fa-arrow-right"></i>
                    </button>
                </div>

                <div id="anagram-feedback" style="margin-top: 1rem; text-align:center; font-weight:700; display:none; font-size:0.95rem;"></div>
            </div>
        </div>
    `;
}

function clickAnagramTile(tileId) {
    const tile = anagramLetters.find(t => t.id === tileId);
    if (!tile || tile.used) return;

    const word = practiceSessionData.words[practiceSessionData.currentIndex];
    
    // Check if slots are full
    if (anagramAnswer.length >= word.en.length) return;

    tile.used = true;
    anagramAnswer.push(tile);

    // Render Slots & tiles locally
    const slotIdx = anagramAnswer.length - 1;
    const slotEl = document.getElementById(`slot-${slotIdx}`);
    if (slotEl) {
        slotEl.innerText = tile.char;
        slotEl.style.color = "var(--secondary)";
    }
    
    const tileEl = document.getElementById(`tile-${tileId}`);
    if (tileEl) tileEl.classList.add('used');
}

function resetAnagramAnswer() {
    anagramLetters.forEach(t => t.used = false);
    anagramAnswer = [];
    
    // Re-render
    renderPracticeAnagram();
}

function submitAnagramAnswer() {
    const data = practiceSessionData;
    const word = data.words[data.currentIndex];
    
    const submittedVal = anagramAnswer.map(t => t.char).join('').toLowerCase();
    const correctVal = word.en.toLowerCase();
    
    const feedback = document.getElementById('anagram-feedback');
    const submitBtn = document.getElementById('anagram-submit-btn');
    const nextBtn = document.getElementById('anagram-next-btn');
    const tilesEl = document.getElementById('anagram-tiles');

    if (submittedVal.length < correctVal.length) {
        showToast("Lütfen tüm harfleri sıralayın!", "warning");
        return;
    }

    tilesEl.style.pointerEvents = "none";
    tilesEl.style.opacity = "0.5";
    submitBtn.style.display = "none";
    nextBtn.style.display = "block";
    feedback.style.display = "block";

    if (submittedVal === correctVal) {
        data.correctCount++;
        word.answeredCorrectly = true;
        feedback.innerHTML = `<span style="color:var(--success);"><i class="fas fa-check-circle"></i> Doğru! Harfleri kusursuzca yerleştirdin.</span>`;
        showToast("Tebrikler! Doğru cevap.", "success");
    } else {
        data.incorrectCount++;
        word.answeredCorrectly = false;
        feedback.innerHTML = `<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Yanlış! Doğru sıralama: <strong style="color:var(--text-primary); text-decoration:underline;">${word.en}</strong></span>`;
        showToast("Maalesef yanlış sıralama.", "error");
    }
}

// 8. KELİME EŞLEŞTİRME OYUNU
let matchingSelected = null;
let matchingMatchedCount = 0;

function initMatchingGame() {
    const data = practiceSessionData;
    
    if (data.timerInterval) {
        clearInterval(data.timerInterval);
    }
    
    // Pick 5 words at random from our session set
    const count = Math.min(5, data.words.length);
    const gameWords = [...data.words].sort(() => Math.random() - 0.5).slice(0, count);

    // Separate English and Turkish lists, shuffle both
    const englishCards = gameWords.map(w => ({ id: w.id, text: w.en, type: 'en' }));
    const turkishCards = gameWords.map(w => ({ id: w.id, text: w.tr, type: 'tr' }));

    englishCards.sort(() => Math.random() - 0.5);
    turkishCards.sort(() => Math.random() - 0.5);

    practiceSessionData.gameWords = gameWords;
    practiceSessionData.enCards = englishCards;
    practiceSessionData.trCards = turkishCards;
    practiceSessionData.startTime = Date.now();
    practiceSessionData.mistakes = 0;
    
    matchingSelected = null;
    matchingMatchedCount = 0;

    renderPracticeMatching();
    practiceSessionData.timerInterval = setInterval(updateMatchingTimer, 1000);
}

function updateMatchingTimer() {
    const data = practiceSessionData;
    if (!data.startTime) return;
    const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const el = document.getElementById('matching-timer');
    if (el) {
        el.innerText = `${m}:${s}`;
    }
}

function leaveMatchingGame() {
    if (practiceSessionData.timerInterval) {
        clearInterval(practiceSessionData.timerInterval);
    }
    if (isDailyReviewSession) {
        // If completed matching game successfully, mark all game words as known!
        if (matchingMatchedCount === practiceSessionData.gameWords.length) {
            const user = AppState.getUserData();
            practiceSessionData.gameWords.forEach(word => {
                if (user.levels[word.level]) {
                    if (!user.levels[word.level].progress[word.chapter]) {
                        user.levels[word.level].progress[word.chapter] = {};
                    }
                    user.levels[word.level].progress[word.chapter][word.id] = 'known';
                    user.levels[word.level].unknownWords = user.levels[word.level].unknownWords.filter(id => id != word.id);
                }
            });
            AppState.save();
            showToast("Kelime eşleştirmeleri tamamlandı ve bilinenlere eklendi! 🎉", "success");
        }
        openDailyReview();
    } else {
        openPracticeHub();
    }
}

function renderPracticeMatching() {
    const container = document.getElementById('app');
    const data = practiceSessionData;

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-fade" style="flex-grow: 1;">
            <div class="study-header" style="flex-wrap: wrap; gap: 0.5rem;">
                <div>
                    <span class="back-btn" onclick="leaveMatchingGame()"><i class="fas fa-chevron-left"></i> Pratik Hub'a Dön</span>
                    <h2 style="margin-top: 0.3rem;">Kelime Eşleştirme Oyunu</h2>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-left: auto;">
                    <div style="background: rgba(255,255,255,0.05); padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.85rem; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-clock" style="color: var(--secondary);"></i> <span id="matching-timer">00:00</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.85rem; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 0.3rem;">
                        <i class="fas fa-heart" style="color: var(--danger);"></i> <span id="matching-lives">3 / 3 Can</span>
                    </div>
                </div>
            </div>

            <div class="glass-panel" style="padding: 1.5rem; border-radius:14px;">
                <p style="color: var(--text-secondary); text-align:center; margin-bottom: 1.5rem; font-size:0.85rem;">
                    Sol taraftaki İngilizce kelimeleri sağ taraftaki Türkçe anlamlarıyla doğru eşleştirin.
                </p>

                <div class="matching-game">
                    <div class="match-column" id="en-column">
                        ${data.enCards.map(c => `
                            <div class="match-item" id="card-en-${c.id}" onclick="clickMatchCard(${c.id}, 'en')">
                                ${c.text}
                            </div>
                        `).join('')}
                    </div>

                    <div class="match-column" id="tr-column">
                        ${data.trCards.map(c => `
                            <div class="match-item" id="card-tr-${c.id}" onclick="clickMatchCard(${c.id}, 'tr')">
                                ${c.text}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div id="matching-controls" style="display:none; text-align:center; margin-top:2rem;">
                    <h3 style="color: var(--success); margin-bottom: 1rem;"><i class="fas fa-star"></i> Eşleştirme Tamamlandı!</h3>
                    <div style="display:flex; justify-content:center; gap:1rem; margin-bottom: 1.5rem;">
                        <button class="btn btn-secondary" onclick="leaveMatchingGame()">
                            Menüye Dön
                        </button>
                        <button class="btn btn-primary" onclick="initMatchingGame()">
                            Yeni Oyun Oyna <i class="fas fa-redo"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function clickMatchCard(id, type) {
    const data = practiceSessionData;
    const cardEl = document.getElementById(`card-${type}-${id}`);
    
    if (cardEl.classList.contains('matched') || cardEl.classList.contains('wrong')) return;

    if (!matchingSelected) {
        matchingSelected = { id, type, el: cardEl };
        cardEl.classList.add('selected');
    } else {
        if (matchingSelected.type === type) {
            // Re-selection
            matchingSelected.el.classList.remove('selected');
            matchingSelected = { id, type, el: cardEl };
            cardEl.classList.add('selected');
        } else {
            const firstCard = matchingSelected.el;
            const secondCard = cardEl;
            
            if (matchingSelected.id === id) {
                // Correct match!
                firstCard.classList.remove('selected');
                firstCard.classList.add('matched');
                secondCard.classList.add('matched');
                
                showToast("Harika! Doğru eşleştirme.", "success");
                matchingMatchedCount++;
                
                // Add points/correct
                data.correctCount++;
                
                if (matchingMatchedCount === data.gameWords.length) {
                    clearInterval(data.timerInterval);
                    triggerConfettiEffect();
                    document.getElementById('matching-controls').style.display = "block";
                    
                    const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
                    const user = AppState.getUserData();
                    if (user && AppState.currentUser !== 'admin') {
                        if (!user.matchingHighscore || elapsed < user.matchingHighscore) {
                            user.matchingHighscore = elapsed;
                            showToast(`Yeni Eşleştirme Rekoru: ${elapsed} saniye! 🏆`, "info");
                            logStudentActivity('highscore', `Kelime Eşleştirme modunda ${elapsed} saniye ile yeni rekor kırdı! 🏆`);
                        } else {
                            logStudentActivity('quiz_complete', `Kelime Eşleştirme oyununu ${elapsed} saniyede tamamladı.`);
                        }
                        AppState.save();
                    }
                }
            } else {
                // Incorrect match
                firstCard.classList.remove('selected');
                firstCard.classList.add('wrong', 'shake');
                secondCard.classList.add('wrong', 'shake');
                
                data.mistakes++;
                data.incorrectCount++;
                const remainingLives = 3 - data.mistakes;
                
                const livesEl = document.getElementById('matching-lives');
                if (livesEl) {
                    livesEl.innerText = `${remainingLives} / 3 Can`;
                }

                showToast("Yanlış eşleşme! Can kaybettin.", "error");
                
                if (data.mistakes >= 3) {
                    clearInterval(data.timerInterval);
                    setTimeout(() => {
                        renderMatchingGameOver();
                    }, 600);
                } else {
                    setTimeout(() => {
                        firstCard.classList.remove('wrong', 'shake');
                        secondCard.classList.remove('wrong', 'shake');
                    }, 800);
                }
            }
            matchingSelected = null;
        }
    }
}

function renderMatchingGameOver() {
    const container = document.getElementById('app');
    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="glass-panel animate-slide" style="max-width: 500px; margin: 0 auto; text-align:center; padding: 3rem 2rem; border-radius:14px;">
            <i class="fas fa-heart-broken" style="font-size: 4rem; color: var(--danger); margin-bottom: 1.5rem; display:inline-block;"></i>
            <h2>Canların Tükendi!</h2>
            <p style="color: var(--text-secondary); margin-top:0.5rem; margin-bottom: 2rem;">
                3 hata yaptığınız için kelime eşleştirme oyunu bitti. Tekrar denemek ister misiniz?
            </p>
            <div style="display:flex; gap: 1rem;">
                <button class="btn btn-secondary" onclick="leaveMatchingGame()" style="flex:1;">
                    Pratik Menüsü
                </button>
                <button class="btn btn-primary" onclick="initMatchingGame()" style="flex:1;">
                    Tekrar Dene <i class="fas fa-redo"></i>
                </button>
            </div>
        </div>
    `;
}

// GENERAL ACTIVITIES FINISH SCREEN
function nextPracticeQuestion() {
    practiceSessionData.currentIndex++;
    initPracticeQuestion();
}

function renderPracticeFinish() {
    const container = document.getElementById('app');
    const data = practiceSessionData;

    // Log quiz results and update statistics
    const user = AppState.getUserData();
    if (user && AppState.currentUser !== 'admin') {
        const correct = data.correctCount || 0;
        const incorrect = data.incorrectCount || 0;
        const total = correct + incorrect;
        const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        if (!user.quizStats) {
            user.quizStats = { history: [], avgScore: 0 };
        }
        
        // Map mode name to user-friendly label
        let modeLabel = activePracticeMode || 'Pratik Sınav';
        if (modeLabel === 'choice_en_tr') modeLabel = 'Çoktan Seçmeli (En-Tr)';
        else if (modeLabel === 'choice_tr_en') modeLabel = 'Çoktan Seçmeli (Tr-En)';
        else if (modeLabel === 'fill_blank') modeLabel = 'Boşluk Doldurma';
        else if (modeLabel === 'true_false') modeLabel = 'Doğru mu Yanlış mı';
        else if (modeLabel === 'listen_write') modeLabel = 'Dinleme & Yazma';
        else if (modeLabel === 'anagram') modeLabel = 'Kelime Kurmaca';
        else if (modeLabel === 'mixed') modeLabel = 'Karışık Egzersiz';
        
        user.quizStats.history.unshift({
            date: new Date().toISOString(),
            correct: correct,
            incorrect: incorrect,
            scorePct: scorePct,
            mode: modeLabel
        });
        
        if (user.quizStats.history.length > 20) {
            user.quizStats.history = user.quizStats.history.slice(0, 20);
        }
        
        const sumPct = user.quizStats.history.reduce((sum, h) => sum + h.scorePct, 0);
        user.quizStats.avgScore = Math.round(sumPct / user.quizStats.history.length);
        
        logStudentActivity('quiz_complete', `"${modeLabel}" pratik testini tamamladı: ${correct} Doğru, ${incorrect} Yanlış (%${scorePct})`);
        AppState.save();
    }

    if (isDailyReviewSession) {
        // Save progress for correctly answered words in the daily review session!
        const user = AppState.getUserData();
        data.words.forEach(word => {
            if (word.answeredCorrectly) {
                if (user.levels[word.level]) {
                    if (!user.levels[word.level].progress[word.chapter]) {
                        user.levels[word.level].progress[word.chapter] = {};
                    }
                    user.levels[word.level].progress[word.chapter][word.id] = 'known';
                    user.levels[word.level].unknownWords = user.levels[word.level].unknownWords.filter(id => id != word.id);
                }
            }
        });
        AppState.save();
    }

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="glass-panel animate-slide" style="max-width: 520px; margin: 0 auto; text-align:center; padding: 2.5rem 1.5rem; border-radius:14px;">
            <i class="fas fa-trophy" style="font-size: 4rem; color: var(--warning); margin-bottom: 1.25rem; display:inline-block; animation: splashPulse 1.5s infinite;"></i>
            <h2>${isDailyReviewSession ? 'Günlük Tekrar Tamamlandı! 🎉' : 'Tebrikler! Seans Bitti'}</h2>
            <p style="color: var(--text-secondary); margin-top:0.5rem; margin-bottom: 2rem; font-size:0.9rem;">
                ${isDailyReviewSession 
                    ? 'Günlük tekrar çalışmasını başarıyla tamamladınız. Doğru bildiğiniz kelimeler öğrenilenler listenize taşınmıştır.' 
                    : 'Bu çalışma seansını başarıyla tamamladınız. Skor tablonuz aşağıdadır:'}
            </p>

            <div style="display:flex; justify-content:space-around; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); padding: 1.25rem; border-radius:14px; margin-bottom: 2rem;">
                <div>
                    <h3 style="color: var(--success); font-size:2.2rem; font-weight:800;">${data.correctCount}</h3>
                    <p style="color: var(--text-secondary); font-size:0.85rem; font-weight:600;">Doğru</p>
                </div>
                <div style="border-left: 1px solid var(--border-color);"></div>
                <div>
                    <h3 style="color: var(--danger); font-size:2.2rem; font-weight:800;">${data.incorrectCount}</h3>
                    <p style="color: var(--text-secondary); font-size:0.85rem; font-weight:600;">Yanlış</p>
                </div>
            </div>

            <div style="display:flex; gap: 0.8rem;">
                ${isDailyReviewSession ? `
                    <button class="btn btn-primary" onclick="openDailyReview()" style="width:100%; min-height:38px;">
                        Tekrar Planına Dön <i class="fas fa-sync"></i>
                    </button>
                ` : `
                    <button class="btn btn-secondary" onclick="openPracticeHub()" style="flex:1; min-height:38px;">
                        <i class="fas fa-redo"></i> Tekrar Pratik Yap
                    </button>
                    <button class="btn btn-primary" onclick="renderApp()" style="flex:1; min-height:38px;">
                        Ana Sayfa <i class="fas fa-home"></i>
                    </button>
                `}
            </div>
        </div>
    `;
    triggerConfettiEffect();
}

// CONFETTI SCREEN CELEBRATION DYNAMIC EMITTER
function triggerConfettiEffect() {
    let overlay = document.getElementById('confetti-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'confetti-overlay';
        overlay.id = 'confetti-overlay';
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = '';
    const colors = ['#6366f1', '#38bdf8', '#10b981', '#f59e0b', '#ef4444', '#a78bfa'];
    
    // Spawn 60 colorful falling particles
    for (let i = 0; i < 60; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.animationDelay = `${Math.random() * 1.5}s`;
        particle.style.animationDuration = `${2 + Math.random() * 2}s`;
        particle.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        overlay.appendChild(particle);
    }

    setTimeout(() => {
        if (overlay) overlay.innerHTML = '';
    }, 4500);
}

// ─── ADMIN / TEACHER PORTAL ──────────────────────────────────────────────────
function renderTeacherPanel(container) {
    AppState.load();
    
    // Default class filter if not set
    if (!AppState.hasOwnProperty('teacherSelectedClass')) {
        AppState.teacherSelectedClass = 'all';
    }
    const selectedClass = AppState.teacherSelectedClass;
    
    // Gather all students in system
    const allUsers = Object.keys(AppState.data.users).filter(u => u !== 'admin');
    
    const studentsData = allUsers.map(username => {
        const uData = AppState.data.users[username];
        
        // Calculate percentages per level
        const levelPercents = {};
        let grandTotalWords = 0;
        let grandAnsweredWords = 0;

        Object.keys(LEVELS_CONFIG).forEach(lvl => {
            const total = LEVELS_CONFIG[lvl].totalWords;
            grandTotalWords += total;
            
            const lvlProgress = uData.levels[lvl]?.progress || {};
            let answered = 0;
            Object.keys(lvlProgress).forEach(ch => {
                answered += Object.keys(lvlProgress[ch] || {}).length;
            });
            grandAnsweredWords += answered;
            levelPercents[lvl] = Math.round((answered / total) * 100);
        });

        const overallPct = Math.round((grandAnsweredWords / grandTotalWords) * 100);

        return {
            username: username,
            class: uData.class || '9/A',
            streak: uData.streak || 0,
            studyTime: uData.totalStudyTime || 0,
            lastLogin: uData.lastStudyDate || 'Hiç girmedi',
            levels: levelPercents,
            overall: overallPct,
            answered: grandAnsweredWords,
            total: grandTotalWords
        };
    });

    // 1. Filter students by class
    const filteredStudents = studentsData.filter(st => {
        if (selectedClass === 'all') return true;
        return st.class === selectedClass;
    });

    // 2. Class-based group analytics/comparison
    const classes = ['9/A', '9/B', '9/C'];
    const classStats = classes.map(cls => {
        const classStudents = studentsData.filter(st => st.class === cls);
        const avgOverall = classStudents.length > 0
            ? Math.round(classStudents.reduce((sum, st) => sum + st.overall, 0) / classStudents.length)
            : 0;
        const totalStudy = classStudents.reduce((sum, st) => sum + st.studyTime, 0);
        const avgStudyHours = classStudents.length > 0 ? (totalStudy / (classStudents.length * 3600)).toFixed(1) : '0.0';
        return { name: cls, avgProgress: avgOverall, avgStudy: avgStudyHours, count: classStudents.length };
    });

    // 3. Analytics calculations: hardest words (compile all students incorrect counts)
    const hardestWordsMap = {};
    allUsers.forEach(username => {
        const uData = AppState.data.users[username];
        Object.keys(uData.levels).forEach(lvl => {
            const unknowns = uData.levels[lvl].unknownWords || [];
            const allWords = LEVELS_CONFIG[lvl].words();
            unknowns.forEach(wId => {
                const wObj = allWords.find(w => w.id == wId);
                if (wObj) {
                    if (!hardestWordsMap[wObj.en]) {
                        hardestWordsMap[wObj.en] = { tr: wObj.tr, count: 0 };
                    }
                    hardestWordsMap[wObj.en].count++;
                }
            });
        });
    });

    const sortedHardestWords = Object.keys(hardestWordsMap)
        .map(en => ({ en: en, tr: hardestWordsMap[en].tr, count: hardestWordsMap[en].count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // 4. Rankings leaderboard (global school leaderboard)
    const topStudents = [...studentsData].sort((a, b) => b.answered - a.answered).slice(0, 3);

    // 5. Overall Level Completion Rates
    const avgA1 = Math.round(studentsData.reduce((acc, curr) => acc + curr.levels.a1, 0) / (studentsData.length || 1));
    const avgA2 = Math.round(studentsData.reduce((acc, curr) => acc + curr.levels.a2, 0) / (studentsData.length || 1));
    const avgB1 = Math.round(studentsData.reduce((acc, curr) => acc + curr.levels.b1, 0) / (studentsData.length || 1));
    const avgB2 = Math.round(studentsData.reduce((acc, curr) => acc + curr.levels.b2, 0) / (studentsData.length || 1));

    container.innerHTML = `
        ${getHeaderHTML()}
        <div class="animate-slide" style="flex-grow: 1;">
            <div style="margin-bottom: 2rem;">
                <h1 style="font-size:1.8rem; margin:0;"><i class="fas fa-chalkboard-teacher" style="color:var(--primary);"></i> Öğretmen Takip & Performans Analiz Paneli</h1>
                <p class="subtitle" style="margin:0;">Sınıf gruplarını (9/A, 9/B, 9/C) filtreleyin, detaylı öğrenci istatistiklerini inceleyin ve rapor indirin.</p>
            </div>

            <!-- OVERALL ANALYTICS GRID PANEL -->
            <div class="teacher-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
                
                <!-- LEVEL SUCCESS RATES BAR CHART -->
                <div class="glass-panel" style="padding:1.25rem; border-radius:14px;">
                    <h3 style="font-size:1.05rem; display:flex; align-items:center; gap:0.4rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin:0 0 1rem 0;">
                        <i class="fas fa-chart-bar" style="color:var(--primary);"></i> Ortalama Seviye Başarı Oranları
                    </h3>
                    <div class="teacher-mini-chart" style="display:flex; justify-content:space-around; align-items:flex-end; height:120px; padding-bottom:1rem;">
                        <div class="teacher-chart-bar-container" style="display:flex; flex-direction:column; align-items:center; flex:1;">
                            <div class="teacher-chart-bar" style="height: ${avgA1}px; width:24px; background:var(--primary); border-radius:4px 4px 0 0; position:relative; min-height:4px;" data-value="%${avgA1}"></div>
                            <span class="teacher-chart-label" style="font-size:0.75rem; margin-top:0.4rem; font-weight:600;">A1</span>
                        </div>
                        <div class="teacher-chart-bar-container" style="display:flex; flex-direction:column; align-items:center; flex:1;">
                            <div class="teacher-chart-bar" style="height: ${avgA2}px; width:24px; background:var(--primary); border-radius:4px 4px 0 0; position:relative; min-height:4px;" data-value="%${avgA2}"></div>
                            <span class="teacher-chart-label" style="font-size:0.75rem; margin-top:0.4rem; font-weight:600;">A2</span>
                        </div>
                        <div class="teacher-chart-bar-container" style="display:flex; flex-direction:column; align-items:center; flex:1;">
                            <div class="teacher-chart-bar" style="height: ${avgB1}px; width:24px; background:var(--primary); border-radius:4px 4px 0 0; position:relative; min-height:4px;" data-value="%${avgB1}"></div>
                            <span class="teacher-chart-label" style="font-size:0.75rem; margin-top:0.4rem; font-weight:600;">B1</span>
                        </div>
                        <div class="teacher-chart-bar-container" style="display:flex; flex-direction:column; align-items:center; flex:1;">
                            <div class="teacher-chart-bar" style="height: ${avgB2}px; width:24px; background:var(--primary); border-radius:4px 4px 0 0; position:relative; min-height:4px;" data-value="%${avgB2}"></div>
                            <span class="teacher-chart-label" style="font-size:0.75rem; margin-top:0.4rem; font-weight:600;">B2</span>
                        </div>
                    </div>
                </div>

                <!-- CLASS SUCCESS COMPARISON BAR CHART -->
                <div class="glass-panel" style="padding:1.25rem; border-radius:14px;">
                    <h3 style="font-size:1.05rem; display:flex; align-items:center; gap:0.4rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin:0 0 1rem 0;">
                        <i class="fas fa-school" style="color:var(--secondary);"></i> Sınıf İlerleme Karşılaştırması
                    </h3>
                    <div class="teacher-mini-chart" style="display:flex; justify-content:space-around; align-items:flex-end; height:120px; padding-bottom:1rem;">
                        ${classStats.map(cls => `
                            <div class="teacher-chart-bar-container" style="display:flex; flex-direction:column; align-items:center; flex:1;">
                                <div class="teacher-chart-bar" style="height: ${cls.avgProgress}px; width:24px; background:var(--secondary); border-radius:4px 4px 0 0; position:relative; min-height:4px;" data-value="%${cls.avgProgress}"></div>
                                <span class="teacher-chart-label" style="font-size:0.75rem; margin-top:0.4rem; font-weight:600; text-align:center;">${cls.name}<br><small style="color:var(--text-secondary); font-size:0.65rem;">(${cls.count} Öğr)</small></span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- HARDEST WORDS OVERALL -->
                <div class="glass-panel" style="padding:1.25rem; border-radius:14px;">
                    <h3 style="font-size:1.05rem; display:flex; align-items:center; gap:0.4rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem; margin:0 0 0.5rem 0;">
                        <i class="fas fa-exclamation-triangle" style="color:var(--danger);"></i> En Çok Zorlanılan Kelimeler
                    </h3>
                    <div style="margin-top:0.75rem; display:flex; flex-direction:column; gap:0.5rem; text-align:left;">
                        ${sortedHardestWords.length === 0 
                            ? `<div style="text-align:center; color:var(--text-secondary); font-size:0.8rem; padding: 1rem;">Henüz hata istatistiği bulunmamaktadır.</div>` 
                            : sortedHardestWords.map(w => `
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; border-bottom:1px dashed var(--border-color); padding-bottom:0.25rem;">
                                    <div>
                                        <strong style="color:var(--text-primary);">${w.en}</strong> 
                                        <span style="color:var(--text-secondary);">(${w.tr})</span>
                                    </div>
                                    <span style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:var(--danger); font-size:0.7rem; font-weight:700; padding:0.15rem 0.35rem; border-radius:4px;">
                                        ${w.count} Öğrenci
                                    </span>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>

            </div>

            <!-- CLASS FILTER TAB BAR -->
            <div class="class-filter-bar" style="margin-bottom:1rem; display:flex; gap:0.4rem; background:rgba(255,255,255,0.02); padding:0.3rem; border-radius:10px; border:1px solid var(--border-color); width:fit-content;">
                <button class="class-filter-btn ${selectedClass === 'all' ? 'active' : ''}" onclick="filterTeacherClass('all')">Tüm Sınıflar</button>
                <button class="class-filter-btn ${selectedClass === '9/A' ? 'active' : ''}" onclick="filterTeacherClass('9/A')">9/A Sınıfı</button>
                <button class="class-filter-btn ${selectedClass === '9/B' ? 'active' : ''}" onclick="filterTeacherClass('9/B')">9/B Sınıfı</button>
                <button class="class-filter-btn ${selectedClass === '9/C' ? 'active' : ''}" onclick="filterTeacherClass('9/C')">9/C Sınıfı</button>
            </div>

            <!-- STUDENTS LIST TRACKING TABLE -->
            <div class="glass-panel" style="padding:1.5rem; border-radius:14px; margin-bottom: 2rem;">
                <h3 style="font-size:1.1rem; display:flex; align-items:center; gap:0.4rem; margin:0 0 1rem 0;">
                    <i class="fas fa-users" style="color:var(--primary);"></i> Öğrenci İlerleme Listesi (${selectedClass === 'all' ? 'Tüm Okul' : selectedClass + ' Grubu'})
                </h3>
                
                <div class="student-table-container">
                    <table class="student-table">
                        <thead>
                            <tr>
                                <th>Sınıf</th>
                                <th>Kullanıcı Adı</th>
                                <th>Genel Başarı</th>
                                <th>A1 Seviye</th>
                                <th>A2 Seviye</th>
                                <th>B1 Seviye</th>
                                <th>B2 Seviye</th>
                                <th>Seri (Streak)</th>
                                <th>Süre</th>
                                <th>Son Giriş</th>
                                <th>İncele</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredStudents.map(st => {
                                const hours = (st.studyTime / 3600).toFixed(1);
                                const classBadgeColorClass = st.class === '9/A' ? 'c9a' : (st.class === '9/B' ? 'c9b' : 'c9c');
                                return `
                                    <tr>
                                        <td>
                                            <span class="class-badge ${classBadgeColorClass}">${st.class}</span>
                                        </td>
                                        <td><strong>${st.username.toUpperCase()}</strong></td>
                                        <td>
                                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                                <div style="background:rgba(255,255,255,0.05); width:60px; height:6px; border-radius:10px; overflow:hidden; border:1px solid var(--border-color);">
                                                    <div style="width:${st.overall}%; height:100%; background:var(--primary);"></div>
                                                </div>
                                                <span style="font-weight:700;">%${st.overall}</span>
                                            </div>
                                        </td>
                                        <td><span style="color:var(--success); font-weight:600;">%${st.levels.a1}</span></td>
                                        <td><span style="color:var(--success); font-weight:600;">%${st.levels.a2}</span></td>
                                        <td><span style="color:var(--success); font-weight:600;">%${st.levels.b1}</span></td>
                                        <td><span style="color:var(--success); font-weight:600;">%${st.levels.b2}</span></td>
                                        <td><i class="fas fa-fire" style="color:var(--warning);"></i> <strong>${st.streak} Gün</strong></td>
                                        <td>${hours} saat</td>
                                        <td><span style="font-size:0.75rem; color:var(--text-secondary);">${st.lastLogin}</span></td>
                                        <td>
                                            <button class="btn btn-secondary" onclick="openStudentDetailsModal('${st.username}')" style="padding:0.25rem 0.6rem; font-size:0.75rem; min-height:28px; display:inline-flex; align-items:center; gap:0.3rem;">
                                                <i class="fas fa-chart-line"></i> Analiz
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- TEACHER ACTIONS GRID -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                
                <!-- NEW STUDENT FORM -->
                <div class="glass-panel" style="padding:1.5rem; border-radius:14px;">
                    <h3 style="font-size:1.1rem; display:flex; align-items:center; gap:0.4rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; margin:0 0 1rem 0;">
                        <i class="fas fa-user-plus" style="color:var(--primary);"></i> Yeni Öğrenci Kayıt Et
                    </h3>
                    <form id="new-student-form" onsubmit="handleTeacherRegisterStudent(event)" style="display:flex; flex-direction:column; gap:0.75rem;">
                        <div style="display:flex; gap:0.75rem;">
                            <div style="flex:1;">
                                <label style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; display:block; margin-bottom:0.25rem;">Kullanıcı Adı</label>
                                <input type="text" id="new-student-username" required style="width:100%; padding:0.45rem 0.75rem; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); border-radius:8px; color:white; font-size:0.85rem;" placeholder="örn: ogrenci9">
                            </div>
                            <div style="flex:1;">
                                <label style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; display:block; margin-bottom:0.25rem;">Şifre</label>
                                <input type="password" id="new-student-password" required style="width:100%; padding:0.45rem 0.75rem; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); border-radius:8px; color:white; font-size:0.85rem;" placeholder="şifre">
                            </div>
                        </div>
                        <div>
                            <label style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; display:block; margin-bottom:0.25rem;">Sınıf Seçimi</label>
                            <select id="new-student-class" required style="width:100%; padding:0.45rem 0.75rem; background:rgba(15, 23, 42, 0.9); border:1px solid var(--border-color); border-radius:8px; color:white; font-size:0.85rem; font-family:inherit;">
                                <option value="9/A">9/A Sınıfı</option>
                                <option value="9/B">9/B Sınıfı</option>
                                <option value="9/C">9/C Sınıfı</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top:0.5rem; min-height:36px;">
                            <i class="fas fa-save"></i> Öğrenci Hesabı Oluştur
                        </button>
                    </form>
                </div>
                
                <!-- DATA EXPORT & BACKUPS -->
                <div class="glass-panel" style="padding:1.5rem; border-radius:14px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <h3 style="font-size:1.1rem; display:flex; align-items:center; gap:0.4rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; margin:0 0 1rem 0;">
                            <i class="fas fa-file-download" style="color:var(--secondary);"></i> Raporlama ve Veri İndirme
                        </h3>
                        <p style="color:var(--text-secondary); font-size:0.85rem; line-height:1.4; margin-bottom:1rem;">
                            Öğrencilerin tüm ilerlemelerini Excel uyumlu CSV formatında indirebilir ya da komple sistem yedeğini JSON olarak yedekleyebilirsiniz.
                        </p>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.6rem;">
                        <button class="btn btn-secondary" onclick="exportTeacherCSV()" style="min-height:36px; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                            <i class="fas fa-file-csv" style="color:#10b981; font-size:1.1rem;"></i> Öğrenci Performans CSV Raporunu İndir
                        </button>
                        <button class="btn btn-secondary" onclick="exportTeacherJSONBackup()" style="min-height:36px; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                            <i class="fas fa-file-code" style="color:var(--primary); font-size:1.1rem;"></i> Tüm Sistem Veri Yedek JSON İndir
                        </button>
                    </div>
                </div>
                
            </div>
        </div>
    `;
}

// Global functions for Teacher panel interactions
function filterTeacherClass(cls) {
    AppState.teacherSelectedClass = cls;
    renderTeacherPanel(document.getElementById('app'));
}

function openStudentDetailsModal(username) {
    const student = AppState.data.users[username];
    if (!student) return;
    
    // Ensure all statistics arrays exist
    if (!student.studyTimeByMode) {
        student.studyTimeByMode = { sequential: 0, matching: 0, test: 0, fill_blank: 0 };
    }
    if (!student.quizStats) {
        student.quizStats = { history: [], avgScore: 0 };
    }
    if (!student.activityLogs) {
        student.activityLogs = [];
    }
    if (student.teacherNotes === undefined) {
        student.teacherNotes = '';
    }
    
    let overlay = document.getElementById('student-details-modal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'student-details-modal';
        document.body.appendChild(overlay);
    }
    
    overlay.dataset.username = username;
    overlay.dataset.activeTab = 'stats';
    
    renderStudentModalContent(overlay, username, 'stats');
    overlay.style.display = 'flex';
}

function renderStudentModalContent(overlay, username, activeTab) {
    const student = AppState.data.users[username];
    const uClass = student.class || '9/A';
    const classBadgeColorClass = uClass === '9/A' ? 'c9a' : (uClass === '9/B' ? 'c9b' : 'c9c');
    
    overlay.dataset.activeTab = activeTab;
    
    // Calculate total time by mode
    const modes = student.studyTimeByMode || { sequential: 0, matching: 0, test: 0, fill_blank: 0 };
    const totalModeTime = Object.values(modes).reduce((sum, v) => sum + v, 0) || 1;
    
    const sequentialPct = Math.round(((modes.sequential || 0) / totalModeTime) * 100);
    const matchingPct = Math.round(((modes.matching || 0) / totalModeTime) * 100);
    const testPct = Math.round(((modes.test || 0) / totalModeTime) * 100);
    const fillBlankPct = Math.round(((modes.fill_blank || 0) / totalModeTime) * 100);
    
    // Format total study hours
    const totalHours = ((student.totalStudyTime || 0) / 3600).toFixed(1);
    
    let tabContentHTML = '';
    
    if (activeTab === 'stats') {
        tabContentHTML = `
            <div style="display:flex; flex-direction:column; gap:1.25rem;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div class="glass-panel" style="padding:1rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                        <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Eşleştirme Rekoru</span>
                        <h2 style="margin:0.25rem 0 0 0; color:var(--warning); font-size:1.6rem; font-weight:800;">
                            <i class="fas fa-stopwatch"></i> ${student.matchingHighscore ? student.matchingHighscore + ' sn' : 'Yok'}
                        </h2>
                    </div>
                    <div class="glass-panel" style="padding:1rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                        <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Ort. Sınav Başarısı</span>
                        <h2 style="margin:0.25rem 0 0 0; color:var(--success); font-size:1.6rem; font-weight:800;">
                            <i class="fas fa-percentage"></i> ${student.quizStats?.avgScore || 0}
                        </h2>
                    </div>
                </div>
                
                <div>
                    <h4 style="margin:0 0 0.8rem 0; font-size:0.9rem; display:flex; align-items:center; gap:0.4rem; text-align:left;">
                        <i class="fas fa-chart-pie" style="color:var(--primary);"></i> Çalışma Modları Dağılımı
                    </h4>
                    <div style="display:flex; flex-direction:column; gap:0.8rem; text-align:left;">
                        <!-- Sequential -->
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                                <span style="font-weight:600; color:var(--text-primary);"><i class="fas fa-clone" style="color:var(--primary); width:16px;"></i> Sıralı Öğrenme</span>
                                <span style="color:var(--text-secondary); font-weight:700;">%${sequentialPct} (${((modes.sequential || 0)/60).toFixed(0)} dk)</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px; overflow:hidden; border:1px solid var(--border-color);">
                                <div style="width:${sequentialPct}%; height:100%; background:var(--primary);"></div>
                            </div>
                        </div>
                        
                        <!-- Matching -->
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                                <span style="font-weight:600; color:var(--text-primary);"><i class="fas fa-cubes" style="color:var(--warning); width:16px;"></i> Eşleştirme Oyunu</span>
                                <span style="color:var(--text-secondary); font-weight:700;">%${matchingPct} (${((modes.matching || 0)/60).toFixed(0)} dk)</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px; overflow:hidden; border:1px solid var(--border-color);">
                                <div style="width:${matchingPct}%; height:100%; background:var(--warning);"></div>
                            </div>
                        </div>
                        
                        <!-- Test -->
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                                <span style="font-weight:600; color:var(--text-primary);"><i class="fas fa-tasks" style="color:var(--success); width:16px;"></i> Pratik Testler</span>
                                <span style="color:var(--text-secondary); font-weight:700;">%${testPct} (${((modes.test || 0)/60).toFixed(0)} dk)</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px; overflow:hidden; border:1px solid var(--border-color);">
                                <div style="width:${testPct}%; height:100%; background:var(--success);"></div>
                            </div>
                        </div>
                        
                        <!-- Fill Blank -->
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                                <span style="font-weight:600; color:var(--text-primary);"><i class="fas fa-pen-fancy" style="color:var(--secondary); width:16px;"></i> Boşluk Doldurma</span>
                                <span style="color:var(--text-secondary); font-weight:700;">%${fillBlankPct} (${((modes.fill_blank || 0)/60).toFixed(0)} dk)</span>
                            </div>
                            <div style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px; overflow:hidden; border:1px solid var(--border-color);">
                                <div style="width:${fillBlankPct}%; height:100%; background:var(--secondary);"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (activeTab === 'quizzes') {
        const quizHistory = student.quizStats?.history || [];
        if (quizHistory.length === 0) {
            tabContentHTML = `<div style="text-align:center; color:var(--text-secondary); font-size:0.85rem; padding:2.5rem;">Henüz pratik sınav kaydı bulunmamaktadır.</div>`;
        } else {
            tabContentHTML = `
                <div class="student-table-container" style="max-height: 250px; overflow-y: auto;">
                    <table class="student-table" style="font-size:0.8rem;">
                        <thead>
                            <tr>
                                <th>Tarih</th>
                                <th>Egzersiz Türü</th>
                                <th>Doğru/Yanlış</th>
                                <th>Başarı</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${quizHistory.map(qh => {
                                const qDate = new Date(qh.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                                let scoreColor = 'var(--danger)';
                                if (qh.scorePct >= 85) scoreColor = 'var(--success)';
                                else if (qh.scorePct >= 60) scoreColor = 'var(--warning)';
                                
                                return `
                                    <tr>
                                        <td>${qDate}</td>
                                        <td><span style="font-weight:600;">${qh.mode}</span></td>
                                        <td>${qh.correct} D - ${qh.incorrect} Y</td>
                                        <td><strong style="color:${scoreColor};">%${qh.scorePct}</strong></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } else if (activeTab === 'timeline') {
        const timelineLogs = student.activityLogs || [];
        if (timelineLogs.length === 0) {
            tabContentHTML = `<div style="text-align:center; color:var(--text-secondary); font-size:0.85rem; padding:2.5rem;">Henüz kaydedilmiş bir aktivite bulunmamaktadır.</div>`;
        } else {
            tabContentHTML = `
                <div class="timeline-feed" style="max-height: 250px; overflow-y: auto; padding-left: 0.5rem; text-align: left;">
                    ${timelineLogs.map(log => {
                        const lDate = new Date(log.date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                        const dotClass = log.type || 'login';
                        
                        return `
                            <div class="timeline-item" style="display:flex; gap:0.75rem; margin-bottom:0.8rem; position:relative; align-items:flex-start;">
                                <div class="timeline-dot ${dotClass}" style="width:12px; height:12px; border-radius:50%; margin-top:4px; flex-shrink:0; background:var(--primary);"></div>
                                <div style="display:flex; flex-direction:column; gap:0.1rem;">
                                    <span style="font-size:0.72rem; color:var(--text-secondary);">${lDate}</span>
                                    <span style="font-size:0.82rem; color:var(--text-primary); font-weight:500;">
                                        ${log.text}
                                    </span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    } else if (activeTab === 'notes') {
        const notes = student.teacherNotes || '';
        tabContentHTML = `
            <div style="text-align:left;">
                <label style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; display:block; margin-bottom:0.4rem;">Öğrenci Özel Notu (Gelişim & Takip Raporu)</label>
                <textarea id="teacher-notes-input" class="teacher-notes-editor" placeholder="Öğrenci hakkında özel gelişim notları yazın... (Sadece siz görebilirsiniz)">${notes}</textarea>
                <div style="display:flex; justify-content:flex-end;">
                    <button class="btn btn-primary" onclick="saveStudentTeacherNotes('${username}')" style="min-height:36px; padding:0 1.25rem;">
                        <i class="fas fa-save"></i> Notu Kaydet
                    </button>
                </div>
            </div>
        `;
    }
    
    overlay.innerHTML = `
        <div class="modal-container animate-slide" style="max-width: 550px; width: 95%;">
            <div class="modal-header" style="align-items: flex-start;">
                <div>
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                        <span class="class-badge ${classBadgeColorClass}">${uClass}</span>
                        <h3 style="margin:0; font-size:1.25rem; color:white;">${username.toUpperCase()}</h3>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.75rem; margin:0; text-align:left;">
                        Toplam Çalışma: <strong>${totalHours} saat</strong> | Günlük Seri: <strong>${student.streak} gün</strong>
                    </p>
                </div>
                <button class="modal-close-btn" onclick="closeStudentDetailsModal()">&times;</button>
            </div>
            
            <!-- Modal Tabs Nav -->
            <div class="modal-tabs">
                <button class="modal-tab-btn ${activeTab === 'stats' ? 'active' : ''}" onclick="switchStudentModalTab('stats')">
                    <i class="fas fa-chart-line"></i> İlerleme
                </button>
                <button class="modal-tab-btn ${activeTab === 'quizzes' ? 'active' : ''}" onclick="switchStudentModalTab('quizzes')">
                    <i class="fas fa-file-alt"></i> Sınavlar
                </button>
                <button class="modal-tab-btn ${activeTab === 'timeline' ? 'active' : ''}" onclick="switchStudentModalTab('timeline')">
                    <i class="fas fa-history"></i> Günlük
                </button>
                <button class="modal-tab-btn ${activeTab === 'notes' ? 'active' : ''}" onclick="switchStudentModalTab('notes')">
                    <i class="fas fa-comment-medical"></i> Notlar
                </button>
            </div>
            
            <div class="modal-body" style="padding-top:1.25rem; min-height:180px;">
                ${tabContentHTML}
            </div>
        </div>
    `;
}

function closeStudentDetailsModal() {
    const overlay = document.getElementById('student-details-modal');
    if (overlay) overlay.style.display = 'none';
}

function switchStudentModalTab(tabName) {
    const overlay = document.getElementById('student-details-modal');
    if (!overlay) return;
    const username = overlay.dataset.username;
    renderStudentModalContent(overlay, username, tabName);
}

function saveStudentTeacherNotes(username) {
    const textInput = document.getElementById('teacher-notes-input');
    if (!textInput) return;
    
    AppState.load();
    const notes = textInput.value;
    if (AppState.data.users[username]) {
        AppState.data.users[username].teacherNotes = notes;
        AppState.save();
        showToast("Öğretmen notu başarıyla kaydedildi! 📝", "success");
        renderTeacherPanel(document.getElementById('app'));
    }
}

function handleTeacherRegisterStudent(e) {
    e.preventDefault();
    const usernameEl = document.getElementById('new-student-username');
    const passwordEl = document.getElementById('new-student-password');
    const classEl = document.getElementById('new-student-class');
    
    if (!usernameEl || !passwordEl || !classEl) return;
    
    const username = usernameEl.value.trim().toLowerCase();
    const password = passwordEl.value;
    const studentClass = classEl.value;
    
    if (!username) {
        showToast("Lütfen geçerli bir kullanıcı adı girin.", "warning");
        return;
    }
    
    AppState.load();
    if (AppState.PREDEFINED_USERS[username] || AppState.data.users[username]) {
        showToast("Bu kullanıcı adı zaten sistemde kayıtlı!", "error");
        return;
    }
    
    // Register student
    AppState.PREDEFINED_USERS[username] = password;
    AppState.data.users[username] = {
        password: password,
        class: studentClass,
        streak: 0,
        totalStudyTime: 0,
        lastStudyDate: "",
        currentLevel: "a1",
        perfectQuizzesEarned: 0,
        matchingHighscore: null,
        teacherNotes: "",
        favorites: [],
        notifications: [
            { id: 1, text: "Kelime Ustası'na Hoş Geldin! 🎉 Seviyeleri tamamlayarak yeni rozetler kazan.", read: false }
        ],
        levels: {
            a1: { unlockedChapters: [0], progress: {}, unknownWords: [] },
            a2: { unlockedChapters: [0], progress: {}, unknownWords: [] },
            b1: { unlockedChapters: [0], progress: {}, unknownWords: [] },
            b2: { unlockedChapters: [0], progress: {}, unknownWords: [] }
        },
        studyTimeByMode: { sequential: 0, matching: 0, test: 0, fill_blank: 0 },
        quizStats: { history: [], avgScore: 0 },
        activityLogs: []
    };
    
    AppState.save();
    showToast(`Öğrenci ${username.toUpperCase()} başarıyla ${studentClass} sınıfına kayıt edildi! 🎓`, "success");
    
    // Reset form
    usernameEl.value = '';
    passwordEl.value = '';
    
    // Re-render teacher panel
    renderTeacherPanel(document.getElementById('app'));
}

function exportTeacherCSV() {
    AppState.load();
    const allUsers = Object.keys(AppState.data.users).filter(u => u !== 'admin');
    
    // CSV Header with UTF-8 BOM
    let csvContent = "\uFEFFSınıf,Kullanıcı Adı,Genel Başarı %,A1 %,A2 %,B1 %,B2 %,Seri (Gün),Süre (Dk),Son Giriş\n";
    
    allUsers.forEach(username => {
        const uData = AppState.data.users[username];
        const uClass = uData.class || '9/A';
        const streak = uData.streak || 0;
        const minutes = Math.round((uData.totalStudyTime || 0) / 60);
        const lastLogin = uData.lastStudyDate || 'Hiç girmedi';
        
        const levelPercents = {};
        let grandTotalWords = 0;
        let grandAnsweredWords = 0;

        Object.keys(LEVELS_CONFIG).forEach(lvl => {
            const total = LEVELS_CONFIG[lvl].totalWords;
            grandTotalWords += total;
            
            const lvlProgress = uData.levels[lvl]?.progress || {};
            let answered = 0;
            Object.keys(lvlProgress).forEach(ch => {
                answered += Object.keys(lvlProgress[ch] || {}).length;
            });
            grandAnsweredWords += answered;
            levelPercents[lvl] = Math.round((answered / total) * 100);
        });

        const overallPct = Math.round((grandAnsweredWords / grandTotalWords) * 100);
        
        csvContent += `"${uClass}","${username.toUpperCase()}",${overallPct},${levelPercents.a1},${levelPercents.a2},${levelPercents.b1},${levelPercents.b2},${streak},${minutes},"${lastLogin}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `ogrenci_performans_raporu_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Raporu başarıyla indirildi! 📊", "success");
}

function exportTeacherJSONBackup() {
    AppState.load();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AppState.data, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `kelime_ustasi_yedek_${new Date().toISOString().slice(0, 10)}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Tüm Sistem Yedek JSON indirildi! 💾", "success");
}

// ─── SPEECH SYNTHESIS ASSISTANT ──────────────────────────────────────────────
function speakWord(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.82;
        window.speechSynthesis.speak(utterance);
    } else {
        showToast("Tarayıcınız seslendirmeyi desteklemiyor.", "error");
    }
}

function speakTurkish(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'tr-TR';
        utterance.rate = 0.88;
        window.speechSynthesis.speak(utterance);
    } else {
        showToast("Tarayıcınız seslendirmeyi desteklemiyor.", "error");
    }
}

// GLOBAL KEYBOARD SHORTCUTS FOR SEQUENTIAL LEARNING
window.addEventListener('keydown', (e) => {
    if (currentChapter === null || currentStudyMode !== 'sequential') return;
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    const chapters = getChaptersForLevel(AppState.getUserData().currentLevel);
    const chapter = chapters[currentChapter];
    const levelWords = getActiveLevelWords();
    const chapterWords = levelWords.slice(chapter.start, chapter.end);
    
    if (currentWordIndex < 0 || currentWordIndex >= chapterWords.length) return;
    const word = chapterWords[currentWordIndex];

    if (e.code === 'Space') {
        e.preventDefault();
        const card = document.getElementById('study-flashcard');
        if (card) {
            card.classList.toggle('flipped');
            currentWordFlipped = !currentWordFlipped;
        }
    } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        navigateSequential(-1);
    } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        navigateSequential(1);
    } else if (e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        markSequential(word.id, 'unknown');
    } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        markSequential(word.id, 'not_sure');
    } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        markSequential(word.id, 'known');
    } else if (e.code === 'KeyV' || e.code === 'KeyS') {
        e.preventDefault();
        speakWord(word.en);
    }
});

// INITIALIZE PREDEFINED STUDENTS MOCK DATABASES
// Chronological student activity circular logger
function logStudentActivity(type, text) {
    const user = AppState.getUserData();
    if (!user || AppState.currentUser === 'admin') return;
    
    if (!user.activityLogs) {
        user.activityLogs = [];
    }
    
    user.activityLogs.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        type: type, // 'login', 'chapter_complete', 'quiz_complete', 'highscore'
        text: text
    });
    
    // Prune logs to max 30 entries to avoid localStorage memory inflation
    if (user.activityLogs.length > 30) {
        user.activityLogs = user.activityLogs.slice(0, 30);
    }
}

// INITIALIZE PREDEFINED STUDENTS MOCK DATABASES WITH DETAILED SCHEMAS
function ensureMockDataInitialized() {
    const predefined = {
        "ogrenci1": { password: "123", class: "9/A", streak: 5, totalStudyTime: 5400, lastStudyDate: new Date().toISOString().slice(0,10), currentLevel: "a2", perfectQuizzes: 1, matchingHighscore: 18, teacherNotes: "Düzenli ders tekrarı yapıyor, pratik hızı gayet iyi.", studyTimeByMode: { sequential: 3200, matching: 1200, test: 600, fill_blank: 400 } },
        "ogrenci2": { password: "123", class: "9/B", streak: 12, totalStudyTime: 18600, lastStudyDate: new Date(Date.now() - 86400000).toISOString().slice(0,10), currentLevel: "b1", perfectQuizzes: 3, matchingHighscore: 15, teacherNotes: "Sınıfın en aktifi. B1 seviyesine geçti ve mükemmel performans gösteriyor.", studyTimeByMode: { sequential: 10000, matching: 4500, test: 2500, fill_blank: 1600 } },
        "ogrenci3": { password: "123", class: "9/C", streak: 1, totalStudyTime: 1200, lastStudyDate: new Date(Date.now() - 3*86400000).toISOString().slice(0,10), currentLevel: "a1", perfectQuizzes: 0, matchingHighscore: 35, teacherNotes: "Biraz daha gayret etmeli. Kelime kartı çalışmalarını artırması önerilir.", studyTimeByMode: { sequential: 800, matching: 200, test: 200, fill_blank: 0 } },
        "ogrenci4": { password: "123", class: "9/A", streak: 0, totalStudyTime: 0, lastStudyDate: "", currentLevel: "a1", perfectQuizzes: 0, matchingHighscore: null, teacherNotes: "", studyTimeByMode: { sequential: 0, matching: 0, test: 0, fill_blank: 0 } },
        "ogrenci5": { password: "123", class: "9/B", streak: 3, totalStudyTime: 6200, lastStudyDate: new Date().toISOString().slice(0,10), currentLevel: "a1", perfectQuizzes: 0, matchingHighscore: 22, teacherNotes: "A1 seviyesinde ilerlemesi istikrarlı.", studyTimeByMode: { sequential: 4000, matching: 1000, test: 800, fill_blank: 400 } },
        "ogrenci6": { password: "123", class: "9/C", streak: 2, totalStudyTime: 4800, lastStudyDate: new Date().toISOString().slice(0,10), currentLevel: "a2", perfectQuizzes: 0, matchingHighscore: 28, teacherNotes: "Genel performansı ortalama, kelime eşleştirme oyunlarını seviyor.", studyTimeByMode: { sequential: 3000, matching: 800, test: 600, fill_blank: 400 } },
        "ogrenci7": { password: "123", class: "9/A", streak: 8, totalStudyTime: 12400, lastStudyDate: new Date(Date.now() - 86400000).toISOString().slice(0,10), currentLevel: "b1", perfectQuizzes: 2, matchingHighscore: 20, teacherNotes: "Çok başarılı ve hırslı bir öğrenci. B1 seviyesini de yakında tamamlar.", studyTimeByMode: { sequential: 8000, matching: 2200, test: 1400, fill_blank: 800 } },
        "ogrenci8": { password: "123", class: "9/C", streak: 4, totalStudyTime: 3900, lastStudyDate: new Date().toISOString().slice(0,10), currentLevel: "a1", perfectQuizzes: 0, matchingHighscore: 25, teacherNotes: "İlerleyişi iyi gidiyor.", studyTimeByMode: { sequential: 2500, matching: 800, test: 400, fill_blank: 200 } }
    };
    
    Object.keys(predefined).forEach(username => {
        if (!AppState.data.users[username]) {
            const mock = predefined[username];
            AppState.data.users[username] = {
                password: mock.password,
                class: mock.class,
                streak: mock.streak,
                totalStudyTime: mock.totalStudyTime,
                lastStudyDate: mock.lastStudyDate,
                currentLevel: mock.currentLevel,
                perfectQuizzesEarned: mock.perfectQuizzes,
                matchingHighscore: mock.matchingHighscore,
                teacherNotes: mock.teacherNotes,
                favorites: [1, 5, 10],
                notifications: [
                    { id: 1, text: "Kelime Ustası'na hoş geldin! 🚀", read: true },
                    { id: 2, text: "Günlük çalışmayı tamamlayarak serini koru! 🔥", read: false }
                ],
                levels: {
                    a1: { unlockedChapters: [0], progress: {}, unknownWords: [] },
                    a2: { unlockedChapters: [0], progress: {}, unknownWords: [] },
                    b1: { unlockedChapters: [0], progress: {}, unknownWords: [] },
                    b2: { unlockedChapters: [0], progress: {}, unknownWords: [] }
                },
                studyTimeByMode: mock.studyTimeByMode,
                quizStats: {
                    history: [],
                    avgScore: 0
                },
                activityLogs: []
            };
            
            const user = AppState.data.users[username];
            
            // Helper to fill progress
            const generateProgress = (lvl, upToChapter, isFullyComplete) => {
                const startOffset = lvl === 'a1' ? 1 : (lvl === 'a2' ? 1001 : (lvl === 'b1' ? 2001 : 3001));
                const unlocked = [];
                for (let c = 0; c <= upToChapter; c++) {
                    unlocked.push(c);
                    user.levels[lvl].progress[c] = {};
                    const chapterSize = (c === 7 && lvl === 'b1') ? 90 : 100; // standard 100, B1 has 890 total
                    for (let w = 0; w < chapterSize; w++) {
                        const wordId = w + startOffset + (c * 100);
                        if (isFullyComplete) {
                            user.levels[lvl].progress[c][wordId] = (Math.random() > 0.08) ? 'known' : 'unknown';
                            if (user.levels[lvl].progress[c][wordId] === 'unknown') {
                                user.levels[lvl].unknownWords.push(wordId);
                            }
                        } else {
                            if (Math.random() > 0.3) {
                                user.levels[lvl].progress[c][wordId] = (Math.random() > 0.4) ? 'known' : 'not_sure';
                            }
                        }
                    }
                }
                user.levels[lvl].unlockedChapters = unlocked;
            };
            
            // Generate progress
            if (username === "ogrenci1") {
                generateProgress('a1', 7, true);
                generateProgress('a2', 2, false);
            } else if (username === "ogrenci2") {
                generateProgress('a1', 7, true);
                generateProgress('a2', 7, true);
                generateProgress('b1', 1, false);
            } else if (username === "ogrenci3") {
                generateProgress('a1', 0, false);
            } else if (username === "ogrenci5") {
                generateProgress('a1', 4, false);
            } else if (username === "ogrenci6") {
                generateProgress('a1', 7, true);
                generateProgress('a2', 0, false);
            } else if (username === "ogrenci7") {
                generateProgress('a1', 7, true);
                generateProgress('a2', 7, true);
                generateProgress('b1', 2, false);
            } else if (username === "ogrenci8") {
                generateProgress('a1', 3, false);
            }
            
            // Generate some realistic exam history and activity logs for visual wow
            if (mock.totalStudyTime > 0) {
                const quizTypes = ['Test', 'TrueFalse', 'FillBlank', 'Anagram'];
                const randScore1 = Math.round(70 + Math.random() * 30);
                const randScore2 = Math.round(60 + Math.random() * 40);
                
                user.quizStats.history = [
                    {
                        date: new Date(Date.now() - 3600000).toISOString(),
                        correct: Math.round(randScore1/10),
                        incorrect: 10 - Math.round(randScore1/10),
                        scorePct: randScore1,
                        mode: quizTypes[Math.floor(Math.random() * quizTypes.length)]
                    },
                    {
                        date: new Date(Date.now() - 86400000).toISOString(),
                        correct: Math.round(randScore2/10),
                        incorrect: 10 - Math.round(randScore2/10),
                        scorePct: randScore2,
                        mode: quizTypes[Math.floor(Math.random() * quizTypes.length)]
                    }
                ];
                user.quizStats.avgScore = Math.round((randScore1 + randScore2) / 2);
                
                user.activityLogs = [
                    { id: Date.now() - 10000, date: new Date(Date.now() - 10000).toISOString(), type: 'login', text: 'Sisteme giriş yaptı.' },
                    { id: Date.now() - 3600000, date: new Date(Date.now() - 3600000).toISOString(), type: 'quiz_complete', text: `"${user.quizStats.history[0].mode}" pratik testini tamamladı: ${user.quizStats.history[0].correct} Doğru, ${user.quizStats.history[0].incorrect} Yanlış (%${randScore1})` }
                ];
                
                if (username === "ogrenci1" || username === "ogrenci2" || username === "ogrenci7") {
                    user.activityLogs.push({
                        id: Date.now() - 172800000,
                        date: new Date(Date.now() - 172800000).toISOString(),
                        type: 'chapter_complete',
                        text: 'A1 Seviyesi seviyesinin 8. Bölümünü tamamladı. 🎉'
                    });
                }
                
                if (mock.matchingHighscore) {
                    user.activityLogs.push({
                        id: Date.now() - 86400000,
                        date: new Date(Date.now() - 86400000).toISOString(),
                        type: 'highscore',
                        text: `Kelime Eşleştirme modunda ${mock.matchingHighscore} saniye ile yeni rekor kırdı! 🏆`
                    });
                }
            }
        }
    });
    
    // Make sure data saves
    localStorage.setItem('vocab_app_data', JSON.stringify(AppState.data));
}

// WINDOW LOAD BINDING
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
    }
    
    // Start active study duration timer if user already logged in
    AppState.load();
    if (AppState.currentUser) {
        AppState.startStudyTimer();
    }
    
    renderApp();
});
