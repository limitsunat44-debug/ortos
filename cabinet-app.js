// Личный кабинет - исправленная версия без демо режима
class PersonalCabinet {
    constructor() {
        this.currentUser = null;
        this.sentSMSCodes = new Map();
        this.cooldownTimers = new Map();
        
        // Плейсхолдеры для разных стран
        this.placeholders = {
            '+7': '9001234567',
            '+43': '6641234567',
            '+998': '901234567',
            '+992': '901234567'
        };
        
        // Конфигурация OsonSMS API
        this.smsConfig = {
            url: 'https://api.osonsms.com/sendsms_v1.php',
            login: 'ortosalon.tj',
            sender: 'OrtosalonTj',
            hash: 'c908aeb36c62699337e59e6d78aeeeaa'
        };
        
        this.init();
    }

    init() {
        console.log('🚀 Инициализация приложения');
        setTimeout(() => {
            this.setupEventListeners();
            this.updatePhonePlaceholder();
            this.validatePhoneInput();
            this.loadActiveSession();
        }, 100);
    }

    setupEventListeners() {
        console.log('⚙️ Настройка обработчиков событий');
        
        // Выбор кода страны
        const countrySelect = document.getElementById('countrySelect');
        if (countrySelect) {
            countrySelect.addEventListener('change', () => this.updatePhonePlaceholder());
            console.log('✅ Обработчик dropdown установлен');
        }
        
        // Основная кнопка проверки номера
        const phoneSubmitBtn = document.getElementById('phoneSubmitBtn');
        if (phoneSubmitBtn) {
            phoneSubmitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🔘 Нажата кнопка проверки номера');
                this.handlePhoneSubmit();
            });
            console.log('✅ Обработчик кнопки проверки установлен');
        }

        // Валидация ввода телефона
        const phoneInput = document.getElementById('phoneInput');
        if (phoneInput) {
            phoneInput.addEventListener('input', () => this.validatePhoneInput());
            phoneInput.addEventListener('keypress', (e) => {
                // Разрешаем только цифры
                if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter'].includes(e.key)) {
                    e.preventDefault();
                }
                if (e.key === 'Enter' && !phoneSubmitBtn.disabled) {
                    e.preventDefault();
                    this.handlePhoneSubmit();
                }
            });
            console.log('✅ Обработчики поля телефона установлены');
        }

        // Кнопки назад
        const backFromReg = document.getElementById('backFromRegistration');
        const backFromLogin = document.getElementById('backFromLogin');
        
        if (backFromReg) backFromReg.addEventListener('click', () => this.showScreen('phoneScreen'));
        if (backFromLogin) backFromLogin.addEventListener('click', () => this.showScreen('phoneScreen'));

        // SMS кнопки и ввод
        const sendCodeRegBtn = document.getElementById('sendCodeRegBtn');
        const sendCodeLoginBtn = document.getElementById('sendCodeLoginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        const smsCodeReg = document.getElementById('smsCodeReg');
        const smsCodeLogin = document.getElementById('smsCodeLogin');
        const nameInput = document.getElementById('nameInput');
        
        if (sendCodeRegBtn) sendCodeRegBtn.addEventListener('click', () => this.sendSMSCode('registration'));
        if (sendCodeLoginBtn) sendCodeLoginBtn.addEventListener('click', () => this.sendSMSCode('login'));
        if (registerBtn) registerBtn.addEventListener('click', () => this.handleRegistration());
        if (loginBtn) loginBtn.addEventListener('click', () => this.handleLogin());
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.handleLogout());

        if (smsCodeReg) smsCodeReg.addEventListener('input', () => this.validateRegistrationForm());
        if (smsCodeLogin) smsCodeLogin.addEventListener('input', () => this.validateLoginForm());
        if (nameInput) nameInput.addEventListener('input', () => this.validateRegistrationForm());
        
        console.log('✅ Все обработчики событий установлены');
    }

    updatePhonePlaceholder() {
        const countrySelect = document.getElementById('countrySelect');
        const phoneInput = document.getElementById('phoneInput');
        
        if (countrySelect && phoneInput) {
            const selectedCode = countrySelect.value;
            const placeholder = this.placeholders[selectedCode] || 'Введите номер';
            
            phoneInput.placeholder = placeholder;
            console.log('🌐 Обновлен placeholder для:', selectedCode, '→', placeholder);
            
            // Пересчитываем валидацию при смене страны
            this.validatePhoneInput();
        }
    }

    validatePhoneInput() {
        const phoneInput = document.getElementById('phoneInput');
        const phoneSubmitBtn = document.getElementById('phoneSubmitBtn');
        const phoneError = document.getElementById('phoneError');
        
        if (!phoneInput || !phoneSubmitBtn || !phoneError) return false;
        
        const phone = phoneInput.value.replace(/\D/g, ''); // Только цифры
        console.log('🔍 Проверка номера:', phone, 'Длина:', phone.length);
        
        // Проверяем минимальную длину (6 цифр)
        if (phone.length < 6) {
            this.showError('phoneError', `Введите минимум 6 цифр (введено: ${phone.length})`);
            phoneSubmitBtn.disabled = true;
            return false;
        }
        
        // Всё в порядке
        this.hideError('phoneError');
        phoneSubmitBtn.disabled = false;
        console.log('✅ Номер прошёл валидацию');
        return true;
    }

    handlePhoneSubmit() {
        console.log('🔘 handlePhoneSubmit вызван');
        
        if (!this.validatePhoneInput()) {
            console.log('❌ Номер не прошёл валидацию');
            return;
        }
        
        const phoneInput = document.getElementById('phoneInput');
        const countrySelect = document.getElementById('countrySelect');
        
        const phone = countrySelect.value + phoneInput.value.replace(/\D/g, '');
        this.currentPhone = phone;
        
        console.log('📞 Проверка международного номера:', phone);
        
        // Проверяем, есть ли пользователь с таким номером
        const existingUser = this.findUserByPhone(phone);
        
        if (existingUser) {
            console.log('👤 Найден существующий пользователь:', existingUser.name);
            this.showLoginScreen(phone, existingUser);
        } else {
            console.log('🆕 Новый пользователь');
            this.showRegistrationScreen(phone);
        }
    }

    async sendSMSCode(type) {
        if (!this.currentPhone) {
            console.error('❌ Номер не определён');
            return;
        }
        
        if (this.cooldownTimers.has(this.currentPhone)) {
            console.log('⏳ Cooldown активен для', this.currentPhone);
            return;
        }
        
        console.log('📱 Отправка SMS на международный номер:', this.currentPhone);
        
        try {
            const code = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
            console.log('🔑 Сгенерирован код:', code);
            
            const result = await this.sendSMSViaAPI(this.currentPhone, code);
            
            if (result.success) {
                this.sentSMSCodes.set(this.currentPhone, {
                    code: code,
                    expires: Date.now() + (5 * 60 * 1000)
                });
                
                console.log('✅ SMS успешно отправлена');
                this.showSMSStatus(this.currentPhone, true, type);
                this.startCooldown(this.currentPhone);
                
            } else {
                console.error('❌ Ошибка отправки SMS:', result.error);
                this.showSMSStatus(this.currentPhone, false, type, result.error);
            }
            
        } catch (error) {
            console.error('❌ Ошибка при отправке SMS:', error);
            this.showSMSStatus(this.currentPhone, false, type, 'Ошибка сети');
        }
    }

    async sendSMSViaAPI(phone, code) {
        try {
            const txnId = Date.now().toString();
            const phoneNumber = phone.replace('+', '');
            const message = `Код подтверждения для входа в международный личный кабинет: ${code}`;
            
            const hashString = `${txnId};${this.smsConfig.login};${this.smsConfig.sender};${phoneNumber};${this.smsConfig.hash}`;
            const strHash = await this.generateSHA256Hash(hashString);
            
            const params = new URLSearchParams({
                from: this.smsConfig.sender,
                phone_number: phoneNumber,
                msg: message,
                login: this.smsConfig.login,
                str_hash: strHash,
                txn_id: txnId
            });
            
            const apiUrl = `${this.smsConfig.url}?${params.toString()}`;
            console.log('🚀 Отправляем GET запрос к OsonSMS API');
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            console.log('📞 HTTP статус:', response.status);
            
            if (response.status === 201) {
                return { success: true };
            } else {
                return { success: false, error: `Ошибка API (${response.status})` };
            }
            
        } catch (error) {
            return { success: false, error: 'Ошибка сети' };
        }
    }

    async generateSHA256Hash(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    findUserByPhone(phone) {
        try {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            return users.find(u => u.phone === phone);
        } catch (error) {
            return null;
        }
    }

    validateRegistrationForm() {
        const nameInput = document.getElementById('nameInput');
        const smsCodeReg = document.getElementById('smsCodeReg');
        const registerBtn = document.getElementById('registerBtn');
        
        if (!nameInput || !smsCodeReg || !registerBtn) return false;
        
        const name = nameInput.value.trim();
        const code = smsCodeReg.value.replace(/\D/g, '');
        
        const isValid = name.length >= 2 && code.length === 6;
        registerBtn.disabled = !isValid;
        return isValid;
    }

    validateLoginForm() {
        const smsCodeLogin = document.getElementById('smsCodeLogin');
        const loginBtn = document.getElementById('loginBtn');
        
        if (!smsCodeLogin || !loginBtn) return false;
        
        const code = smsCodeLogin.value.replace(/\D/g, '');
        const isValid = code.length === 6;
        loginBtn.disabled = !isValid;
        return isValid;
    }

    handleRegistration() {
        if (!this.validateRegistrationForm()) return;
        if (!this.currentPhone) return;
        
        const nameInput = document.getElementById('nameInput');
        const smsCodeReg = document.getElementById('smsCodeReg');
        
        const name = nameInput.value.trim();
        const enteredCode = parseInt(smsCodeReg.value.replace(/\D/g, ''));
        
        console.log('📝 Попытка регистрации с кодом:', enteredCode);
        
        const smsData = this.sentSMSCodes.get(this.currentPhone);
        if (!smsData || enteredCode !== smsData.code) {
            this.showError('regError', 'Неверный код подтверждения');
            return;
        }
        
        if (Date.now() > smsData.expires) {
            this.showError('regError', 'Код истек. Получите новый код');
            return;
        }
        
        const ean13Code = this.generateEAN13();
        const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
        
        const newUser = {
            name: name,
            phone: this.currentPhone,
            ean13: ean13Code,
            registrationDate: now,
            lastLoginDate: now
        };
        
        console.log('💾 Сохраняем нового международного пользователя:', newUser);
        
        this.saveUserToStorage(newUser);
        this.currentUser = newUser;
        this.setActiveSession(newUser);
        this.showCabinet();
    }

    handleLogin() {
        if (!this.validateLoginForm()) return;
        if (!this.currentPhone) return;
        
        const smsCodeLogin = document.getElementById('smsCodeLogin');
        const enteredCode = parseInt(smsCodeLogin.value.replace(/\D/g, ''));
        
        console.log('🔑 Попытка входа с кодом:', enteredCode);
        
        const smsData = this.sentSMSCodes.get(this.currentPhone);
        if (!smsData || enteredCode !== smsData.code) {
            this.showError('loginError', 'Неверный код подтверждения');
            return;
        }
        
        if (Date.now() > smsData.expires) {
            this.showError('loginError', 'Код истек. Получите новый код');
            return;
        }
        
        const existingUser = this.findUserByPhone(this.currentPhone);
        if (existingUser) {
            existingUser.lastLoginDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
            this.updateUserInStorage(existingUser);
            
            this.currentUser = existingUser;
            this.setActiveSession(existingUser);
            this.showCabinet();
        } else {
            this.showError('loginError', 'Пользователь не найден');
        }
    }

    showLoginScreen(phone, user) {
        console.log('🚪 Показ экрана входа для', user.name);
        
        const loginUserInfo = document.getElementById('loginUserInfo');
        const loginPhoneDisplay = document.getElementById('loginPhoneDisplay');
        
        if (loginUserInfo) {
            loginUserInfo.textContent = `Добро пожаловать обратно, ${user.name}!`;
        }
        if (loginPhoneDisplay) {
            loginPhoneDisplay.textContent = phone;
        }
        
        this.showScreen('loginScreen');
    }

    showRegistrationScreen(phone) {
        console.log('📝 Показ экрана регистрации для', phone);
        
        const regPhoneDisplay = document.getElementById('regPhoneDisplay');
        if (regPhoneDisplay) {
            regPhoneDisplay.textContent = phone;
        }
        
        this.showScreen('registrationScreen');
    }

    generateEAN13() {
        const prefix = '999';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        const code12 = prefix + timestamp + random;
        const checkDigit = this.calculateEAN13CheckDigit(code12);
        
        return code12 + checkDigit;
    }

    calculateEAN13CheckDigit(code12) {
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            const digit = parseInt(code12[i]);
            sum += (i % 2 === 0) ? digit : digit * 3;
        }
        const remainder = sum % 10;
        return remainder === 0 ? '0' : (10 - remainder).toString();
    }

    saveUserToStorage(user) {
        try {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            users.push(user);
            localStorage.setItem('users', JSON.stringify(users));
            console.log('✅ Международный пользователь сохранён. Всего:', users.length);
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }
    }

    updateUserInStorage(updatedUser) {
        try {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const index = users.findIndex(u => u.phone === updatedUser.phone);
            if (index !== -1) {
                users[index] = updatedUser;
                localStorage.setItem('users', JSON.stringify(users));
                console.log('✅ Международный пользователь обновлён');
            }
        } catch (error) {
            console.error('Ошибка обновления:', error);
        }
    }

    setActiveSession(user) {
        try {
            localStorage.setItem('activeSession', JSON.stringify(user));
        } catch (error) {
            console.error('Ошибка сохранения сессии:', error);
        }
    }

    loadActiveSession() {
        try {
            const activeSession = localStorage.getItem('activeSession');
            if (activeSession) {
                const user = JSON.parse(activeSession);
                this.currentUser = user;
                console.log('✅ Загружена активная международная сессия:', user.name);
                this.showCabinet();
            }
        } catch (error) {
            console.error('Ошибка загрузки сессии:', error);
            localStorage.removeItem('activeSession');
        }
    }

    showCabinet() {
        console.log('🏠 Показ международного личного кабинета для:', this.currentUser.name);
        
        const userName = document.getElementById('userName');
        const userPhone = document.getElementById('userPhone');
        const ean13Code = document.getElementById('ean13Code');
        const regDate = document.getElementById('regDate');
        const lastLogin = document.getElementById('lastLogin');
        
        if (userName) userName.textContent = this.currentUser.name;
        if (userPhone) userPhone.textContent = this.currentUser.phone;
        if (ean13Code) ean13Code.textContent = this.currentUser.ean13;
        if (regDate) regDate.textContent = this.currentUser.registrationDate;
        if (lastLogin) lastLogin.textContent = this.currentUser.lastLoginDate;
        
        this.generateBarcode(this.currentUser.ean13);
        this.showScreen('cabinetScreen');
    }

    generateBarcode(ean13) {
        const canvas = document.getElementById('barcodeCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const barWidth = 2;
        const barHeight = 60;
        const startX = 10;
        const startY = 10;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const pattern = this.getSimpleEAN13Pattern(ean13);
        
        ctx.fillStyle = '#000000';
        let x = startX;
        
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === '1') {
                ctx.fillRect(x, startY, barWidth, barHeight);
            }
            x += barWidth;
        }
        
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        const digitX = startX + (pattern.length * barWidth) / 2;
        ctx.fillText(ean13, digitX, startY + barHeight + 15);
    }

    getSimpleEAN13Pattern(ean13) {
        let pattern = '101';
        
        for (let i = 1; i <= 6; i++) {
            pattern += this.getDigitPattern(ean13[i], 'left');
        }
        
        pattern += '01010';
        
        for (let i = 7; i <= 12; i++) {
            pattern += this.getDigitPattern(ean13[i], 'right');
        }
        
        pattern += '101';
        return pattern;
    }

    getDigitPattern(digit, side) {
        const leftPatterns = {
            '0': '0001101', '1': '0011001', '2': '0010011', '3': '0111101', '4': '0100011',
            '5': '0110001', '6': '0101111', '7': '0111011', '8': '0110111', '9': '0001011'
        };
        
        const rightPatterns = {
            '0': '1110010', '1': '1100110', '2': '1101100', '3': '1000010', '4': '1011100',
            '5': '1001110', '6': '1010000', '7': '1000100', '8': '1001000', '9': '1110100'
        };
        
        return side === 'left' ? leftPatterns[digit] : rightPatterns[digit];
    }

    handleLogout() {
        localStorage.removeItem('activeSession');
        this.currentUser = null;
        this.currentPhone = null;
        this.showScreen('phoneScreen');
        
        // Очистка полей
        const phoneInput = document.getElementById('phoneInput');
        const countrySelect = document.getElementById('countrySelect');
        if (phoneInput) phoneInput.value = '';
        if (countrySelect) countrySelect.selectedIndex = 0;
        this.updatePhonePlaceholder();
        this.validatePhoneInput();
    }

    startCooldown(phone) {
        console.log(`⏳ Запуск cooldown для ${phone}`);
        const timer = setTimeout(() => {
            this.cooldownTimers.delete(phone);
            console.log(`✅ Cooldown завершён для ${phone}`);
        }, 60000);
        
        this.cooldownTimers.set(phone, timer);
    }

    showSMSStatus(phone, success, type, error = null) {
        const statusElement = document.getElementById(type === 'registration' ? 'regSmsStatus' : 'loginSmsStatus');
        if (!statusElement) return;
        
        if (success) {
            statusElement.innerHTML = `<div class="status-success">✅ SMS отправлена на ${phone}</div>`;
        } else {
            statusElement.innerHTML = `<div class="status-error">❌ Ошибка: ${error}</div>`;
        }
        statusElement.classList.remove('hidden');
    }

    showScreen(screenId) {
        console.log('📺 Переход на экран:', screenId);
        
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        } else {
            console.error(`❌ Экран ${screenId} не найден`);
        }
    }

    showError(errorId, message) {
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    hideError(errorId) {
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }
}

// Инициализация международного приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('🌍 DOM загружен, инициализируем международное приложение...');
    new PersonalCabinet();
});