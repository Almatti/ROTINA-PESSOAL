/* ========================================================================
   Minha Rotina 360° - SCRIPT PRINCIPAL
   Sistema completo de organização pessoal TDAH Friendly
   ======================================================================== */

// ===== SISTEMA DE ARMAZENAMENTO =====
const Storage = {
    get: (key, defaultValue = []) => {
        try {
            return JSON.parse(localStorage.getItem(key)) || defaultValue;
        } catch {
            return defaultValue;
        }
    },
    set: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// Chaves para todos os tipos de dados
const DATA_KEYS = {
    TASKS: 'minhaRotina_tasks',
    EVENTS: 'minhaRotina_events',
    MEDS: 'minhaRotina_medications',
    HEALTH: 'minhaRotina_health',
    STUDY: 'minhaRotina_study',
    WORKOUT: 'minhaRotina_workout',
    PROJECTS: 'minhaRotina_projects',
    CHORES: 'minhaRotina_chores',
    LISTS: 'minhaRotina_lists',
    FINANCE: 'minhaRotina_finance',
    DEVOTIONAL: 'minhaRotina_devotional',
    CONFIG: 'minhaRotina_config'
};

// ===== INICIALIZAÇÃO DA APLICAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('Minha Rotina 360° - Inicializando...');
    
    // Inicializar navegação
    initNavigation();
    
    // Inicializar todos os sistemas
    initTaskSystem();
    initEventSystem();
    initMedicationSystem();
    initPomodoro();
    initHealthSystem();
    initCalendarSystem();
    initFinanceSystem();
    initConfigSystem();
    
    // Renderizar dados iniciais
    renderTodayTasks();
    renderAllTasks();
    renderTodayEvents();
    renderAllEvents();
    renderTodayMeds();
    renderAllMeds();
    renderHealthMetrics();
    renderFinanceData();
    
    // Configurar data de hoje
    updateTodayDate();
    
    // Configurar busca global
    initGlobalSearch();
    
    // Configurar modais
    initModals();
    
    // Mostrar toast de boas-vindas
    setTimeout(() => {
        showToast('Bem-vinda ao Minha Rotina 360°! 🌟', 'ok');
    }, 1000);
});

// ===== SISTEMA DE NAVEGAÇÃO =====
function initNavigation() {
    const navLinks = document.querySelectorAll('[data-link]');
    const pages = document.querySelectorAll('.page');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenuToggleOpen = document.getElementById('mobileMenuToggleOpen');
    const sidebar = document.getElementById('sidebar');
    
    function showPage(route) {
        pages.forEach(page => {
            const isActive = page.dataset.route === route;
            page.setAttribute('aria-hidden', !isActive);
            if (isActive) {
                page.style.display = 'block';
                // Disparar evento personalizado para carregamento tardio
                page.dispatchEvent(new CustomEvent('pageShow', { detail: { route } }));
            } else {
                page.style.display = 'none';
            }
        });
        
        navLinks.forEach(link => {
            link.setAttribute('aria-current', link.dataset.route === route ? 'page' : 'false');
        });
        
        // Atualizar título da página
        const titleEl = document.querySelector(`[data-route="${route}"] h1`);
        if (titleEl) {
            document.title = `${titleEl.textContent} — Minha Rotina 360°`;
        }
        
        // Fechar menu mobile ao navegar
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
        }
    }
    
    // Rota inicial
    const initialRoute = window.location.hash.slice(2) || 'hoje';
    showPage(initialRoute);
    
    // Ouvinte de hashchange
    window.addEventListener('hashchange', () => {
        const route = window.location.hash.slice(2) || 'hoje';
        showPage(route);
    });
    
    // Ouvinte de clique nos links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = link.dataset.route;
            window.location.hash = `#/${route}`;
        });
    });
    
    // Menu mobile
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
        });
    }
    
    if (mobileMenuToggleOpen) {
        mobileMenuToggleOpen.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
        });
    }
    
    // Fechar menu ao clicar fora
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !mobileMenuToggleOpen.contains(e.target)) {
            sidebar.classList.remove('mobile-open');
        }
    });
    
    // Botão de tema
    const themeBtn = document.querySelector('[data-action="toggle-theme"]');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const newTheme = isDark ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            showToast(`Tema ${newTheme === 'dark' ? 'escuro' : 'claro'} ativado`, 'ok');
        });
        
        // Aplicar tema salvo
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    // Botão de modo foco
    const focusBtn = document.querySelector('[data-action="focus-mode"]');
    if (focusBtn) {
        focusBtn.addEventListener('click', () => {
            const isActive = focusBtn.getAttribute('aria-pressed') === 'true';
            focusBtn.setAttribute('aria-pressed', !isActive);
            document.body.classList.toggle('focus-mode', !isActive);
            showToast(`Modo foco ${!isActive ? 'ativado' : 'desativado'}`, !isActive ? 'ok' : 'warn');
        });
    }
    
    // Botão de modo leitura
    const readingBtn = document.querySelector('[data-action="reading-mode"]');
    if (readingBtn) {
        readingBtn.addEventListener('click', () => {
            const isActive = readingBtn.getAttribute('aria-pressed') === 'true';
            readingBtn.setAttribute('aria-pressed', !isActive);
            document.body.classList.toggle('reading-mode', !isActive);
            showToast(`Modo leitura ${!isActive ? 'ativado' : 'desativado'}`, !isActive ? 'ok' : 'warn');
        });
    }
}

// ===== SISTEMA DE TAREFAS =====
function initTaskSystem() {
    const taskForm = document.getElementById('formTask');
    if (taskForm) {
        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(taskForm);
            const task = {
                id: Date.now(),
                title: formData.get('title'),
                notes: formData.get('notes'),
                due: formData.get('due'),
                priority: formData.get('priority'),
                project: formData.get('project'),
                completed: false,
                createdAt: new Date().toISOString()
            };
            
            const tasks = Storage.get(DATA_KEYS.TASKS);
            tasks.push(task);
            Storage.set(DATA_KEYS.TASKS, tasks);
            
            taskForm.closest('dialog').close();
            taskForm.reset();
            showToast('✓ Tarefa adicionada!', 'ok');
            renderTodayTasks();
            renderAllTasks();
        });
    }
    
    // Configurar filtro de tarefas
    const taskFilter = document.getElementById('taskFilter');
    if (taskFilter) {
        taskFilter.addEventListener('change', function() {
            renderAllTasks(this.value);
        });
    }
}

function renderTodayTasks() {
    const todayTasksEl = document.getElementById('todayTasks');
    if (!todayTasksEl) return;
    
    const tasks = Storage.get(DATA_KEYS.TASKS);
    const today = new Date().toDateString();
    
    const todayTasks = tasks.filter(task => 
        task.due && new Date(task.due).toDateString() === today && !task.completed
    );
    
    todayTasksEl.innerHTML = todayTasks.length ? todayTasks.map(task => `
        <div class="item">
            <div class="item-content">
                <div class="item-title">${task.title}</div>
                ${task.notes ? `<div class="item-subtitle">${task.notes}</div>` : ''}
                <div class="tag ${task.priority}">${getPriorityText(task.priority)}</div>
            </div>
            <div class="item-actions">
                <button class="btn" onclick="completeTask(${task.id})" title="Concluir">✓</button>
                <button class="btn bad" onclick="deleteTask(${task.id})" title="Excluir">✕</button>
            </div>
        </div>
    `).join('') : '<div class="muted">Nenhuma tarefa para hoje. 🎉</div>';
}

function renderAllTasks(filter = 'all') {
    const taskListEl = document.getElementById('taskList');
    const taskDoneEl = document.getElementById('taskDone');
    if (!taskListEl || !taskDoneEl) return;
    
    let tasks = Storage.get(DATA_KEYS.TASKS);
    
    // Aplicar filtro
    if (filter !== 'all') {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        tasks = tasks.filter(task => {
            if (filter === 'today') {
                return task.due && new Date(task.due).toDateString() === today.toDateString();
            } else if (filter === 'overdue') {
                return task.due && new Date(task.due) < today && !task.completed;
            } else if (filter === 'next24') {
                const taskDate = new Date(task.due);
                return task.due && taskDate >= today && taskDate <= tomorrow;
            } else {
                return task.project === filter;
            }
        });
    }
    
    const pending = tasks.filter(task => !task.completed);
    const completed = tasks.filter(task => task.completed);
    
    taskListEl.innerHTML = pending.length ? pending.map(task => `
        <div class="item">
            <div class="item-content">
                <div class="item-title">${task.title}</div>
                ${task.due ? `<div class="item-subtitle">📅 ${formatDate(task.due)}</div>` : ''}
                ${task.notes ? `<div class="item-subtitle">${task.notes}</div>` : ''}
                <div class="tag ${task.priority}">${getPriorityText(task.priority)}</div>
            </div>
            <div class="item-actions">
                <button class="btn" onclick="completeTask(${task.id})" title="Concluir">✓</button>
                <button class="btn bad" onclick="deleteTask(${task.id})" title="Excluir">✕</button>
            </div>
        </div>
    `).join('') : '<div class="muted">Todas as tarefas concluídas! 🎊</div>';
    
    taskDoneEl.innerHTML = completed.length ? completed.slice(-10).map(task => `
        <div class="item" style="opacity:0.7;">
            <div class="item-content">
                <div class="item-title" style="text-decoration:line-through;">${task.title}</div>
                <div class="item-subtitle">✅ Concluída em ${formatDateTime(task.completedAt)}</div>
            </div>
            <div class="item-actions">
                <button class="btn bad" onclick="deleteTask(${task.id})" title="Excluir">✕</button>
            </div>
        </div>
    `).join('') : '<div class="muted">Nenhuma tarefa concluída ainda.</div>';
}

function completeTask(taskId) {
    const tasks = Storage.get(DATA_KEYS.TASKS);
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex !== -1) {
        tasks[taskIndex].completed = true;
        tasks[taskIndex].completedAt = new Date().toISOString();
        Storage.set(DATA_KEYS.TASKS, tasks);
        showToast('Tarefa concluída! 🎉', 'ok');
        renderTodayTasks();
        renderAllTasks();
    }
}

function deleteTask(taskId) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    
    const tasks = Storage.get(DATA_KEYS.TASKS);
    const filtered = tasks.filter(task => task.id !== taskId);
    Storage.set(DATA_KEYS.TASKS, filtered);
    showToast('Tarefa excluída', 'warn');
    renderTodayTasks();
    renderAllTasks();
}

// ===== SISTEMA DE COMPROMISSOS =====
function initEventSystem() {
    const eventForm = document.getElementById('formEvent');
    if (eventForm) {
        eventForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(eventForm);
            const event = {
                id: Date.now(),
                title: formData.get('title'),
                location: formData.get('location'),
                start: formData.get('start'),
                end: formData.get('end'),
                reminders: formData.get('reminders') ? formData.get('reminders').split(',').map(r => r.trim()) : [],
                createdAt: new Date().toISOString()
            };
            
            const events = Storage.get(DATA_KEYS.EVENTS);
            events.push(event);
            Storage.set(DATA_KEYS.EVENTS, events);
            
            eventForm.closest('dialog').close();
            eventForm.reset();
            showToast('📅 Compromisso agendado!', 'ok');
            renderTodayEvents();
            renderAllEvents();
            renderCalendar(); // Atualizar calendário
        });
    }
    
    // Configurar busca de eventos
    const eventSearch = document.getElementById('eventSearch');
    if (eventSearch) {
        eventSearch.addEventListener('input', function(e) {
            filterEvents(e.target.value);
        });
    }
}

function renderTodayEvents() {
    const todayEventsEl = document.getElementById('todayEvents');
    if (!todayEventsEl) return;
    
    const events = Storage.get(DATA_KEYS.EVENTS);
    const today = new Date().toDateString();
    
    const todayEvents = events.filter(event => 
        event.start && new Date(event.start).toDateString() === today
    );
    
    todayEventsEl.innerHTML = todayEvents.length ? todayEvents.map(event => `
        <div class="item">
            <div class="item-content">
                <div class="item-title">${event.title}</div>
                <div class="item-subtitle">🕒 ${formatTime(event.start)} - ${formatTime(event.end)}</div>
                ${event.location ? `<div class="item-subtitle">📍 ${event.location}</div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn bad" onclick="deleteEvent(${event.id})" title="Excluir">✕</button>
            </div>
        </div>
    `).join('') : '<div class="muted">Nada marcado para hoje. 😊</div>';
}

function renderAllEvents() {
    const eventListEl = document.getElementById('eventList');
    if (!eventListEl) return;
    
    const events = Storage.get(DATA_KEYS.EVENTS).sort((a, b) => 
        new Date(a.start) - new Date(b.start)
    );
    
    eventListEl.innerHTML = events.length ? events.map(event => `
        <div class="item" onclick="showEventDetail(${event.id})" style="cursor:pointer;">
            <div class="item-content">
                <div class="item-title">${event.title}</div>
                <div class="item-subtitle">📅 ${formatDateTime(event.start)}</div>
                ${event.location ? `<div class="item-subtitle">📍 ${event.location}</div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn bad" onclick="deleteEvent(${event.id})" title="Excluir">✕</button>
            </div>
        </div>
    `).join('') : '<div class="muted">Nenhum compromisso agendado.</div>';
}

function filterEvents(searchTerm) {
    const events = Storage.get(DATA_KEYS.EVENTS);
    const filtered = events.filter(event => 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.location && event.location.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    const eventListEl = document.getElementById('eventList');
    if (eventListEl) {
        eventListEl.innerHTML = filtered.length ? filtered.map(event => `
            <div class="item" onclick="showEventDetail(${event.id})" style="cursor:pointer;">
                <div class="item-content">
                    <div class="item-title">${event.title}</div>
                    <div class="item-subtitle">📅 ${formatDateTime(event.start)}</div>
                    ${event.location ? `<div class="item-subtitle">📍 ${event.location}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn bad" onclick="deleteEvent(${event.id})" title="Excluir">✕</button>
                </div>
            </div>
        `).join('') : '<div class="muted">Nenhum compromisso encontrado.</div>';
    }
}

function showEventDetail(eventId) {
    const events = Storage.get(DATA_KEYS.EVENTS);
    const event = events.find(e => e.id === eventId);
    const detailEl = document.getElementById('eventDetail');
    
    if (event && detailEl) {
        detailEl.innerHTML = `
            <h3>${event.title}</h3>
            <p><strong>📅 Início:</strong> ${formatDateTime(event.start)}</p>
            <p><strong>⏰ Fim:</strong> ${formatDateTime(event.end)}</p>
            ${event.location ? `<p><strong>📍 Local:</strong> ${event.location}</p>` : ''}
            ${event.reminders.length ? `<p><strong>🔔 Lembretes:</strong> ${event.reminders.join(', ')} min antes</p>` : ''}
            <button class="btn bad" onclick="deleteEvent(${event.id})" style="margin-top:1rem;">Excluir Compromisso</button>
        `;
    }
}

function deleteEvent(eventId) {
    if (!confirm('Tem certeza que deseja excluir este compromisso?')) return;
    
    const events = Storage.get(DATA_KEYS.EVENTS);
    const filtered = events.filter(event => event.id !== eventId);
    Storage.set(DATA_KEYS.EVENTS, filtered);
    showToast('Compromisso excluído', 'warn');
    renderTodayEvents();
    renderAllEvents();
    document.getElementById('eventDetail').innerHTML = '<div class="muted">Selecione um compromisso na lista.</div>';
    renderCalendar();
}

// ===== SISTEMA DE MEDICAÇÕES =====
function initMedicationSystem() {
    const medForm = document.getElementById('formMed');
    if (medForm) {
        medForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(medForm);
            const medication = {
                id: Date.now(),
                name: formData.get('name'),
                dose: formData.get('dose'),
                times: formData.get('times') ? formData.get('times').split(',').map(t => t.trim()) : [],
                startDate: formData.get('startDate'),
                endDate: formData.get('endDate'),
                createdAt: new Date().toISOString()
            };
            
            const meds = Storage.get(DATA_KEYS.MEDS);
            meds.push(medication);
            Storage.set(DATA_KEYS.MEDS, meds);
            
            medForm.closest('dialog').close();
            medForm.reset();
            showToast('💊 Medicação adicionada!', 'ok');
            renderTodayMeds();
            renderAllMeds();
        });
    }
}

function renderTodayMeds() {
    const todayMedsEl = document.getElementById('todayMeds');
    if (!todayMedsEl) return;
    
    const meds = Storage.get(DATA_KEYS.MEDS);
    const today = new Date();
    
    // Adicionar medicação de exemplo (Ritalina) se não houver nenhuma
    if (meds.length === 0) {
        const exampleMed = {
            id: 1,
            name: 'Ritalina',
            dose: '10mg',
            times: ['08:00', '12:00', '16:00'],
            startDate: today.toISOString().split('T')[0],
            createdAt: today.toISOString()
        };
        meds.push(exampleMed);
        Storage.set(DATA_KEYS.MEDS, meds);
    }
    
    todayMedsEl.innerHTML = meds.map(med => `
        <div class="item">
            <div class="item-content">
                <div class="item-title">💊 ${med.name} - ${med.dose}</div>
                <div class="item-subtitle">⏰ Horários: ${med.times.join(', ')}</div>
            </div>
            <div class="item-actions">
                <button class="btn" onclick="takeMedication(${med.id})" title="Marcar como tomado">✓</button>
                <button class="btn bad" onclick="deleteMedication(${med.id})" title="Excluir">✕</button>
            </div>
        </div>
    `).join('');
}

function renderAllMeds() {
    const medListEl = document.getElementById('medList');
    if (!medListEl) return;
    
    const meds = Storage.get(DATA_KEYS.MEDS);
    medListEl.innerHTML = meds.length ? meds.map(med => `
        <div class="item">
            <div class="item-content">
                <div class="item-title">${med.name}</div>
                <div class="item-subtitle">💊 ${med.dose} | ⏰ ${med.times.join(', ')}</div>
                ${med.startDate ? `<div class="item-subtitle">📅 Início: ${formatDate(med.startDate)}</div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn bad" onclick="deleteMedication(${med.id})" title="Excluir">✕</button>
            </div>
        </div>
    `).join('') : '<div class="muted">Nenhuma medicação cadastrada.</div>';
}

function takeMedication(medId) {
    showToast('💊 Medicação registrada!', 'ok');
}

function deleteMedication(medId) {
    if (!confirm('Tem certeza que deseja excluir esta medicação?')) return;
    
    const meds = Storage.get(DATA_KEYS.MEDS);
    const filtered = meds.filter(med => med.id !== medId);
    Storage.set(DATA_KEYS.MEDS, filtered);
    showToast('Medicação excluída', 'warn');
    renderTodayMeds();
    renderAllMeds();
}

// ===== SISTEMA POMODORO =====
let pomodoroInterval;
let pomodoroTime = 25 * 60; // 25 minutos em segundos
let pomodoroRunning = false;

function initPomodoro() {
    const startBtn = document.querySelector('[data-action="pomodoro-start"]');
    const stopBtn = document.querySelector('[data-action="pomodoro-stop"]');
    const resetBtn = document.querySelector('[data-action="pomodoro-reset"]');
    
    if (startBtn) startBtn.addEventListener('click', startPomodoro);
    if (stopBtn) stopBtn.addEventListener('click', stopPomodoro);
    if (resetBtn) resetBtn.addEventListener('click', resetPomodoro);
}

function startPomodoro() {
    if (pomodoroRunning) return;
    
    pomodoroRunning = true;
    pomodoroInterval = setInterval(() => {
        pomodoroTime--;
        updatePomodoroDisplay();
        
        if (pomodoroTime <= 0) {
            stopPomodoro();
            showToast('🎉 Tempo do Pomodoro acabou! Hora de uma pausa.', 'ok');
            // Tocar som de notificação (se permitido)
            if (Notification.permission === 'granted') {
                new Notification('Pomodoro Concluído!', {
                    body: 'Hora de fazer uma pausa de 5 minutos.',
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>'
                });
            }
        }
    }, 1000);
    
    showToast('Pomodoro iniciado! 🎯', 'ok');
}

function stopPomodoro() {
    pomodoroRunning = false;
    clearInterval(pomodoroInterval);
    showToast('Pomodoro pausado', 'warn');
}

function resetPomodoro() {
    stopPomodoro();
    pomodoroTime = 25 * 60;
    updatePomodoroDisplay();
    showToast('Pomodoro resetado', 'info');
}

function updatePomodoroDisplay() {
    const display = document.getElementById('pomodoroStatus');
    if (display) {
        const minutes = Math.floor(pomodoroTime / 60);
        const seconds = pomodoroTime % 60;
        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// ===== SISTEMA DE SAÚDE =====
function initHealthSystem() {
    const healthForm = document.getElementById('formHealth');
    if (healthForm) {
        healthForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(healthForm);
            const healthMetric = {
                id: Date.now(),
                type: formData.get('type'),
                value: formData.get('value'),
                notes: formData.get('notes'),
                date: formData.get('date'),
                createdAt: new Date().toISOString()
            };
            
            const healthData = Storage.get(DATA_KEYS.HEALTH);
            healthData.push(healthMetric);
            Storage.set(DATA_KEYS.HEALTH, healthData);
            
            healthForm.closest('dialog').close();
            healthForm.reset();
            showToast('Métrica de saúde registrada!', 'ok');
            renderHealthMetrics();
        });
    }
}

function renderHealthMetrics() {
    const healthListEl = document.getElementById('healthList');
    if (!healthListEl) return;
    
    const healthData = Storage.get(DATA_KEYS.HEALTH).slice(-5); // Últimas 5 entradas
    
    healthListEl.innerHTML = healthData.length ? healthData.map(metric => `
        <div class="item">
            <div class="item-content">
                <div class="item-title">${getHealthMetricType(metric.type)}: ${metric.value}</div>
                <div class="item-subtitle">📅 ${formatDate(metric.date)}</div>
                ${metric.notes ? `<div class="item-subtitle">${metric.notes}</div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn bad" onclick="deleteHealthMetric(${metric.id})" title="Excluir">✕</button>
            </div>
        </div>
    `).join('') : '<div class="muted">Nenhuma métrica registrada ainda.</div>';
}

function deleteHealthMetric(metricId) {
    if (!confirm('Tem certeza que deseja excluir esta métrica?')) return;
    
    const healthData = Storage.get(DATA_KEYS.HEALTH);
    const filtered = healthData.filter(metric => metric.id !== metricId);
    Storage.set(DATA_KEYS.HEALTH, filtered);
    showToast('Métrica excluída', 'warn');
    renderHealthMetrics();
}

// ===== SISTEMA DE CALENDÁRIO =====
let currentCalendarDate = new Date();

function initCalendarSystem() {
    const prevBtn = document.querySelector('[data-action="cal-prev"]');
    const nextBtn = document.querySelector('[data-action="cal-next"]');
    const todayBtn = document.querySelector('[data-action="cal-today"]');
    
    if (prevBtn) prevBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });
    
    if (nextBtn) nextBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });
    
    if (todayBtn) todayBtn.addEventListener('click', () => {
        currentCalendarDate = new Date();
        renderCalendar();
    });
    
    renderCalendar();
}

function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    const calLabel = document.getElementById('calLabel');
    if (!calendarEl || !calLabel) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Atualizar label
    calLabel.textContent = currentCalendarDate.toLocaleDateString('pt-BR', { 
        month: 'long', 
        year: 'numeric' 
    }).replace(/^./, c => c.toUpperCase());
    
    // Obter primeiro dia do mês e último dia
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Obter eventos do mês
    const events = Storage.get(DATA_KEYS.EVENTS);
    const monthEvents = events.filter(event => {
        const eventDate = new Date(event.start);
        return eventDate.getMonth() === month && eventDate.getFullYear() === year;
    });
    
    let calendarHTML = '';
    let currentDate = new Date(startDate);
    
    // Gerar semanas
    for (let week = 0; week < 6; week++) {
        calendarHTML += '<div class="week">';
        
        for (let day = 0; day < 7; day++) {
            const dateString = currentDate.toISOString().split('T')[0];
            const isToday = currentDate.toDateString() === new Date().toDateString();
            const isCurrentMonth = currentDate.getMonth() === month;
            
            const dayEvents = monthEvents.filter(event => 
                new Date(event.start).toDateString() === currentDate.toDateString()
            );
            
            calendarHTML += `
                <div class="day ${isToday ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}" 
                     onclick="showDayEvents('${dateString}')">
                    <div class="day-number">${currentDate.getDate()}</div>
                    <div class="day-events">
                        ${dayEvents.slice(0, 3).map(event => `
                            <div class="event-item">
                                <span class="event-dot"></span>
                                ${event.title}
                            </div>
                        `).join('')}
                        ${dayEvents.length > 3 ? `<div class="muted">+${dayEvents.length - 3} mais</div>` : ''}
                    </div>
                </div>
            `;
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        calendarHTML += '</div>';
        
        // Parar se passarmos do último dia do mês
        if (currentDate > lastDay) break;
    }
    
    calendarEl.innerHTML = calendarHTML;
}

function showDayEvents(dateString) {
    const dayEventsEl = document.getElementById('dayEvents');
    if (!dayEventsEl) return;
    
    const events = Storage.get(DATA_KEYS.EVENTS);
    const dayEvents = events.filter(event => 
        new Date(event.start).toDateString() === new Date(dateString).toDateString()
    );
    
    dayEventsEl.innerHTML = dayEvents.length ? dayEvents.map(event => `
        <div class="item">
            <div class="item-content">
                <div class="item-title">${event.title}</div>
                <div class="item-subtitle">🕒 ${formatTime(event.start)} - ${formatTime(event.end)}</div>
                ${event.location ? `<div class="item-subtitle">📍 ${event.location}</div>` : ''}
            </div>
            <div class="item-actions">
                <button class="btn bad" onclick="deleteEvent(${event.id})" title="Excluir">✕</button>
            </div>
        </div>
    `).join('') : '<div class="muted">Nenhum evento para este dia.</div>';
}

// ===== SISTEMA FINANCEIRO =====
function initFinanceSystem() {
    const transactionForm = document.getElementById('formTransaction');
    if (transactionForm) {
        transactionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(transactionForm);
            const transaction = {
                id: Date.now(),
                description: formData.get('description'),
                amount: parseFloat(formData.get('amount')),
                type: formData.get('type'),
                category: formData.get('category'),
                date: formData.get('date'),
                createdAt: new Date().toISOString()
            };
            
            const transactions = Storage.get(DATA_KEYS.FINANCE);
            transactions.push(transaction);
            Storage.set(DATA_KEYS.FINANCE, transactions);
            
            transactionForm.closest('dialog').close();
            transactionForm.reset();
            showToast('Transação registrada!', 'ok');
            renderFinanceData();
        });
    }
    
    // Configurar filtro de transações
    const transactionFilter = document.getElementById('transactionFilter');
    if (transactionFilter) {
        transactionFilter.addEventListener('change', function() {
            renderFinanceData(this.value);
        });
    }
}

function renderFinanceData(filter = 'all') {
    const transactions = Storage.get(DATA_KEYS.FINANCE);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Calcular totais
    const monthlyIncome = transactions
        .filter(t => t.type === 'income' && 
                    new Date(t.date).getMonth() === currentMonth &&
                    new Date(t.date).getFullYear() === currentYear)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const monthlyExpenses = transactions
        .filter(t => t.type === 'expense' && 
                    new Date(t.date).getMonth() === currentMonth &&
                    new Date(t.date).getFullYear() === currentYear)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const currentBalance = monthlyIncome - monthlyExpenses;
    
    // Atualizar resumo
    document.getElementById('currentBalance').textContent = formatCurrency(currentBalance);
    document.getElementById('monthlyIncome').textContent = formatCurrency(monthlyIncome);
    document.getElementById('monthlyExpenses').textContent = formatCurrency(monthlyExpenses);
    
    // Filtrar transações
    let filteredTransactions = transactions;
    if (filter !== 'all') {
        filteredTransactions = transactions.filter(t => t.type === filter);
    }
    
    // Renderizar lista de transações
    const transactionListEl = document.getElementById('transactionList');
    if (transactionListEl) {
        transactionListEl.innerHTML = filteredTransactions.length ? filteredTransactions.slice(-10).reverse().map(transaction => `
            <div class="item">
                <div class="item-content">
                    <div class="item-title">${transaction.description}</div>
                    <div class="item-subtitle">
                        📅 ${formatDate(transaction.date)} • 
                        ${getTransactionCategory(transaction.category)} • 
                        <span class="${transaction.type === 'income' ? 'ok' : 'bad'}">
                            ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
                        </span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn bad" onclick="deleteTransaction(${transaction.id})" title="Excluir">✕</button>
                </div>
            </div>
        `).join('') : '<div class="muted">Nenhuma transação encontrada.</div>';
    }
}

function deleteTransaction(transactionId) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
    
    const transactions = Storage.get(DATA_KEYS.FINANCE);
    const filtered = transactions.filter(t => t.id !== transactionId);
    Storage.set(DATA_KEYS.FINANCE, filtered);
    showToast('Transação excluída', 'warn');
    renderFinanceData();
}

// ===== SISTEMA DE CONFIGURAÇÕES =====
function initConfigSystem() {
    // Configurações de notificação
    const notificationsCheckbox = document.getElementById('notificationsEnabled');
    if (notificationsCheckbox) {
        notificationsCheckbox.addEventListener('change', function() {
            if (this.checked && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        });
    }
    
    // Botão de exportar dados
    const exportBtn = document.querySelector('[data-action="export-data"]');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    // Botão de limpar dados
    const clearBtn = document.querySelector('[data-action="clear-data"]');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllData);
    }
}

function exportData() {
    const allData = {};
    Object.keys(DATA_KEYS).forEach(key => {
        allData[key] = Storage.get(DATA_KEYS[key]);
    });
    
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `minha-rotina-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showToast('Dados exportados com sucesso!', 'ok');
}

function clearAllData() {
    if (!confirm('ATENÇÃO: Esta ação irá apagar TODOS os seus dados. Tem certeza?')) return;
    
    Object.keys(DATA_KEYS).forEach(key => {
        localStorage.removeItem(DATA_KEYS[key]);
    });
    
    showToast('Todos os dados foram apagados.', 'warn');
    setTimeout(() => {
        location.reload();
    }, 2000);
}

// ===== FUNÇÕES UTILITÁRIAS =====
function initModals() {
    // Abrir modais
    document.querySelectorAll('[data-open]').forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-open');
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.showModal();
            }
        });
    });
    
    // Fechar modais
    document.querySelectorAll('[data-close]').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('dialog');
            if (modal) {
                modal.close();
            }
        });
    });
    
    // Fechar modal ao clicar fora
    document.querySelectorAll('dialog').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.close();
            }
        });
    });
}

function initGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            if (searchTerm.length < 2) return;
            
            // Buscar em tarefas, eventos, etc.
            const tasks = Storage.get(DATA_KEYS.TASKS);
            const events = Storage.get(DATA_KEYS.EVENTS);
            
            const results = [
                ...tasks.filter(t => t.title.toLowerCase().includes(searchTerm)),
                ...events.filter(e => e.title.toLowerCase().includes(searchTerm))
            ];
            
            // Aqui você pode implementar uma interface de resultados
            if (results.length > 0) {
                showToast(`Encontrados ${results.length} resultados para "${searchTerm}"`, 'info');
            }
        });
    }
}

function updateTodayDate() {
    const todayDateEl = document.getElementById('today-date');
    if (todayDateEl) {
        const today = new Date();
        todayDateEl.textContent = today.toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).replace(/^./, c => c.toUpperCase());
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatTime(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${formatDate(dateString)} às ${formatTime(dateString)}`;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(amount);
}

function getPriorityText(priority) {
    const priorities = {
        low: 'Baixa',
        medium: 'Média',
        high: 'Alta'
    };
    return priorities[priority] || priority;
}

function getHealthMetricType(type) {
    const types = {
        weight: 'Peso',
        glucose: 'Glicose',
        spo2: 'SpO2',
        bpm: 'BPM',
        pressure: 'Pressão'
    };
    return types[type] || type;
}

function getTransactionCategory(category) {
    const categories = {
        salary: 'Salário',
        food: 'Alimentação',
        transport: 'Transporte',
        health: 'Saúde',
        entertainment: 'Entretenimento',
        other: 'Outro'
    };
    return categories[category] || category;
}

// ===== SISTEMA DE NOTIFICAÇÕES (TOAST) =====
function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Remover toast após duração
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// ===== INICIALIZAÇÃO DE COMPONENTES ESPECÍFICOS =====
// Eventos de página para carregamento tardio
document.addEventListener('pageShow', function(e) {
    const route = e.detail.route;
    
    switch(route) {
        case 'financeiro':
            renderFinanceData();
            break;
        case 'planejador':
            renderCalendar();
            break;
        case 'saude':
            renderHealthMetrics();
            break;
    }
});

// ===== FUNÇÕES GLOBAIS PARA HTML =====
// Tornar funções disponíveis globalmente para onclick
window.completeTask = completeTask;
window.deleteTask = deleteTask;
window.showEventDetail = showEventDetail;
window.deleteEvent = deleteEvent;
window.takeMedication = takeMedication;
window.deleteMedication = deleteMedication;
window.deleteHealthMetric = deleteHealthMetric;
window.showDayEvents = showDayEvents;
window.deleteTransaction = deleteTransaction;
window.startPomodoro = startPomodoro;
window.stopPomodoro = stopPomodoro;
window.resetPomodoro = resetPomodoro;

// Inicializar Pomodoro display
updatePomodoroDisplay();

console.log('Minha Rotina 360° - Sistema carregado com sucesso!');