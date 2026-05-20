import { db, ref, set, get, child, serverTimestamp } from './firebase.js';

// DOM Elements
const screens = {
    intro: document.getElementById('intro-screen'),
    login: document.getElementById('login-screen'),
    wish: document.getElementById('wish-screen'),
    countdown: document.getElementById('countdown-screen')
};

// Buttons
const enterBtn = document.getElementById('enter-btn');
const loginForm = document.getElementById('login-form');
const makeWishBtn = document.getElementById('make-wish-btn');
const muteBtn = document.getElementById('mute-btn');
const toggleAuthMode = document.getElementById('toggle-auth-mode');
const nameGroup = document.getElementById('name-group');

// Audio
const bgAudio = document.getElementById('bg-audio');
const tickAudio = document.getElementById('tick-audio');
const chimeAudio = document.getElementById('chime-audio');
let isMuted = false;

// State
let countdownInterval;
let currentUser = null;
const COUNTDOWN_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms
let isLoginMode = false;

// === UI & TRANSITIONS ===
function switchScreen(from, to) {
    from.classList.remove('active');
    setTimeout(() => {
        from.classList.add('hidden');
        to.classList.remove('hidden');
        // Small delay to ensure display:block applies before opacity transition
        setTimeout(() => {
            to.classList.add('active');
        }, 50);
    }, 2000); // Wait for fade out
}

function playChime() {
    if (!isMuted) {
        chimeAudio.currentTime = 0;
        chimeAudio.play().catch(e => console.log('Audio play blocked', e));
    }
}

// === EVENT LISTENERS ===

// Enter button
enterBtn.addEventListener('click', () => {
    playChime();
    if (!isMuted) {
        bgAudio.volume = 0.5;
        bgAudio.play().catch(e => console.log('Audio play blocked', e));
    }
    
    // Check local storage to see where to go
    const savedUser = localStorage.getItem('girigo_user');
    if (savedUser) {
        currentUser = { uid: savedUser };
        checkUserWishData(savedUser).catch(e => {
            console.error(e);
            localStorage.removeItem('girigo_user');
            switchScreen(screens.intro, screens.login);
        });
    } else {
        switchScreen(screens.intro, screens.login);
    }
});

// Toggle Auth Mode
toggleAuthMode.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        nameGroup.classList.add('hidden');
        toggleAuthMode.innerText = "New soul? Forge a pact.";
        document.querySelector('#login-btn .btn-text').innerText = "Log In";
    } else {
        nameGroup.classList.remove('hidden');
        toggleAuthMode.innerText = "Already have a pact? Log in.";
        document.querySelector('#login-btn .btn-text').innerText = "Proceed";
    }
});

// Mute toggle
muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    bgAudio.muted = isMuted;
    tickAudio.muted = isMuted;
    chimeAudio.muted = isMuted;
    
    const volIcon = document.getElementById('vol-icon');
    if (isMuted) {
        volIcon.innerHTML = `<path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
    } else {
        volIcon.innerHTML = `<path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
    }
});

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const emailError = document.getElementById('email-error');
    const authError = document.getElementById('auth-error');
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const loader = loginBtn.querySelector('.loader');
    
    emailError.innerText = '';
    authError.innerText = '';
    
    if (!email.endsWith('@gmail.com')) {
        emailError.innerText = 'Must be a valid @gmail.com address.';
        return;
    }
    
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');
    loginBtn.disabled = true;
    
    try {
        const userId = email.toLowerCase();
        
        if (isLoginMode) {
            const snapshot = await get(child(ref(db), `users/${userId}`));
            if (!snapshot.exists()) {
                throw new Error("Soul not found. Forge a pact first.");
            }
            const userData = snapshot.val();
            if (userData.password !== password) {
                throw new Error("Incorrect password.");
            }
            currentUser = { uid: userId, email: email, name: userData.name };
            
            // Update last login
            userData.lastLogin = serverTimestamp();
            await set(ref(db, `users/${userId}`), userData);
        } else {
            const snapshot = await get(child(ref(db), `users/${userId}`));
            if (snapshot.exists()) {
                throw new Error("This soul has already forged a pact. Log in instead.");
            }
            if (!name) {
                throw new Error("Name is required to forge a pact.");
            }
            currentUser = { uid: userId, email: email, name: name };
            
            // Save new user metadata
            await set(ref(db, `users/${userId}`), {
                name: name,
                email: email,
                password: password,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });
        }
        
        localStorage.setItem('girigo_user', userId);
        
        playChime();
        // Check if user already made a wish
        await checkUserWishData(userId);
        
    } catch (error) {
        authError.innerText = error.message;
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
        loginBtn.disabled = false;
    }
});

// Make Wish Button
makeWishBtn.addEventListener('click', async () => {
    const wishText = document.getElementById('wish-input').value.trim();
    if (!wishText) return;
    
    makeWishBtn.disabled = true;
    makeWishBtn.innerText = "Sealing fate...";
    
    // Violent shake effect
    document.body.classList.add('violent-shake-active');
    setTimeout(() => {
        document.body.classList.remove('violent-shake-active');
    }, 600);
    
    try {
        const startTime = Date.now();
        
        await set(ref(db, `wishes/${currentUser.uid}`), {
            wish: wishText,
            startTime: startTime,
            serverStartTime: serverTimestamp()
        });
        
        playChime();
        startCountdown(startTime);
        switchScreen(screens.wish, screens.countdown);
        
    } catch (error) {
        console.error("Error saving wish:", error);
        makeWishBtn.disabled = false;
        makeWishBtn.innerText = "Make The Wish";
    }
});


// === COUNTDOWN SYSTEM ===

async function checkUserWishData(uid) {
    try {
        const snapshot = await get(child(ref(db), `wishes/${uid}`));
        if (snapshot.exists()) {
            const data = snapshot.val();
            const startMs = data.startTime;
            
            // Go directly to countdown
            startCountdown(startMs);
            
            // Hide all, show countdown
            screens.intro.classList.add('hidden');
            screens.intro.classList.remove('active');
            screens.login.classList.add('hidden');
            screens.login.classList.remove('active');
            
            screens.countdown.classList.remove('hidden');
            setTimeout(() => { screens.countdown.classList.add('active'); }, 50);
            
        } else {
            // Go to wish page
            if (screens.login.classList.contains('active')) {
                switchScreen(screens.login, screens.wish);
            } else {
                screens.intro.classList.add('hidden');
                screens.intro.classList.remove('active');
                screens.wish.classList.remove('hidden');
                setTimeout(() => { screens.wish.classList.add('active'); }, 50);
            }
        }
    } catch (error) {
        console.error("Error checking wish data", error);
        throw error;
    }
}

function startCountdown(startTimeMs) {
    if (countdownInterval) clearInterval(countdownInterval);
    
    const updateTimer = () => {
        const now = Date.now();
        const elapsed = now - startTimeMs;
        let remaining = COUNTDOWN_DURATION - elapsed;
        
        if (remaining <= 0) {
            remaining = 0;
            clearInterval(countdownInterval);
            document.querySelector('.terror-title').innerText = "YOUR TIME IS UP";
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        document.getElementById('hours').innerText = hours.toString().padStart(2, '0');
        document.getElementById('minutes').innerText = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').innerText = seconds.toString().padStart(2, '0');
        
        // Progress bar
        const progressPercent = (remaining / COUNTDOWN_DURATION) * 100;
        document.getElementById('life-progress').style.width = `${progressPercent}%`;
        
        // Audio tick
        if (!isMuted && remaining > 0) {
            tickAudio.currentTime = 0;
            tickAudio.play().catch(e=>e);
        }
        
        // Occasional screen shake when time is low (< 1 hour)
        if (remaining > 0 && remaining < 60 * 60 * 1000 && Math.random() < 0.05) {
            document.body.style.transform = `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`;
            setTimeout(() => { document.body.style.transform = 'none'; }, 100);
        }
    };
    
    updateTimer(); // Initial call
    countdownInterval = setInterval(updateTimer, 1000);
}



// === TEXT DECRYPTION EFFECT ===
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
const titleEl = document.querySelector('.glitch-text');
const originalText = titleEl.getAttribute('data-text');

function decryptText(element, targetText) {
    let iterations = 0;
    const interval = setInterval(() => {
        element.innerText = targetText.split("")
            .map((letter, index) => {
                if (index < iterations) return targetText[index];
                return letters[Math.floor(Math.random() * letters.length)];
            })
            .join("");
        
        if (iterations >= targetText.length) {
            clearInterval(interval);
        }
        iterations += 1 / 3;
    }, 30);
}

window.addEventListener('load', () => {
    decryptText(titleEl, originalText);
});

// === PARTICLE SYSTEM (EMBERS) ===
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particlesArray = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + Math.random() * 200;
        this.size = Math.random() * 3 + 1;
        this.speedY = Math.random() * -2 - 0.5;
        this.speedX = Math.random() * 2 - 1;
        this.opacity = Math.random() * 0.8 + 0.1;
        this.color = Math.random() > 0.5 ? `rgba(255, 69, 0, ${this.opacity})` : `rgba(255, 0, 0, ${this.opacity})`;
    }
    update() {
        this.y += this.speedY;
        this.x += this.speedX;
        if (this.size > 0.1) this.size -= 0.01;
        if (this.y < 0 || this.size <= 0.1) {
            this.y = canvas.height + 10;
            this.x = Math.random() * canvas.width;
            this.size = Math.random() * 3 + 1;
            this.opacity = Math.random() * 0.8 + 0.1;
            this.color = Math.random() > 0.5 ? `rgba(255, 69, 0, ${this.opacity})` : `rgba(255, 0, 0, ${this.opacity})`;
        }
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'red';
    }
}

function initParticles() {
    for (let i = 0; i < 150; i++) {
        particlesArray.push(new Particle());
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
    }
    requestAnimationFrame(animateParticles);
}
initParticles();
animateParticles();

