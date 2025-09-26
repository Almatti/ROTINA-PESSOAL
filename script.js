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
            </div>
        </div>
    `).join('') : '<div class="muted">Todas as tarefas concluídas! 🎊</div>';
    
    taskDoneEl.innerHTML = completed.length ? completed.slice(-10).map(task => `
        <div class="item" style="opacity:0.7;">
            <div class="item-content">
                <div class="item-title" style="text-decoration:line-through;">${task.title}</div>
                <div class="item-subtitle">✅ Concluída em ${formatDateTime(task.completedAt)}</div>
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
    const events = Storage.get(DATA_KEYS.EVENTS);
    const filtered = events.filter(event => event.id !== eventId);
    Storage.set(DATA_KEYS.EVENTS, filtered);
    showToast('Compromisso excluído', 'warn');
    renderTodayEvents();
    renderAllEvents();
    document.getElementById('eventDetail').innerHTML = '<div class="muted">Selecione um compromisso na lista.</div>';
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
        </div>
    `).join('') : '<div class="muted">Nenhuma medicação cadastrada.</div>';
}

function takeMedication(medId) {
    showToast('💊 Medicação registrada!', 'ok');
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
    
    updatePomodoroDisplay();
}

function startPomodoro() {
    if (pomodoroRunning) return;
    
    pomodoroRunning = true;
    pomodoroInterval = setInterval(() => {
        pomodoroTime--;
        updatePomodoroDisplay();
        
        if (pomodoroTime <= 0) {
            stopPomodoro();
            showToast('⏰ Tempo do Pomodoro acabou! Hora de uma pausa.', 'ok');
            // Tocaria um som aqui (se implementado)
        }
    }, 1000);
    
    showToast('🍅 Pomodoro iniciado! Foco total.', 'ok');
}

function stopPomodoro() {
    clearInterval(pomodoroInterval);
    pomodoroRunning = false;
    showToast('⏸️ Pomodoro pausado.', 'warn');
}

function resetPomodoro() {
    stopPomodoro();
    pomodoroTime = 25 * 60;
    updatePomodoroDisplay();
    showToast('🔄 Pomodoro reiniciado.', 'ok');
}

function updatePomodoroDisplay() {
    const display = document.getElementById('pomodoroStatus');
    if (display) {
        const minutes = Math.floor(pomodoroTime / 60);
        const seconds = pomodoroTime % 60;
        display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Mudar cor quando estiver nos últimos 5 minutos
        if (pomodoroTime <= 300) { // 5 minutos
            display.style.color = 'var(--warn)';
        } else {
            display.style.color = '';
        }
    }
}

// ===== SISTEMA DE CALENDÁRIO =====
let currentCalendarDate = new Date();

function initCalendarSystem() {
    // Configurar botões do calendário
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
    
    // Renderizar calendário inicial
    renderCalendar();
}

function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    const calLabelEl = document.getElementById('calLabel');
    if (!calendarEl || !calLabelEl) return;
    
    // Atualizar label do mês/ano
    calLabelEl.textContent = currentCalendarDate.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
    });
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Primeiro dia do mês
    const firstDay = new Date(year, month, 1);
    // Último dia do mês
    const lastDay = new Date(year, month + 1, 0);
    // Dia da semana do primeiro dia (0 = Domingo, 6 = Sábado)
    const firstDayOfWeek = firstDay.getDay();
    
    // Ajustar para segunda-feira como primeiro dia da semana
    const adjustedFirstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    let calendarHTML = '';
    
    // Cabeçalho dos dias da semana
    calendarHTML += '<div class="week">';
    ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].forEach(day => {
        calendarHTML += `<div class="day-header">${day}</div>`;
    });
    calendarHTML += '</div>';
    
    // Dias do mês
    calendarHTML += '<div class="week">';
    
    // Dias vazios no início
    for (let i = 0; i < adjustedFirstDayOfWeek; i++) {
        calendarHTML += '<div class="day empty"></div>';
    }
    
    // Dias do mês
    const today = new Date();
    const events = Storage.get(DATA_KEYS.EVENTS);
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const currentDate = new Date(year, month, day);
        const isToday = currentDate.toDateString() === today.toDateString();
        const dayEvents = events.filter(event => 
            event.start && new Date(event.start).toDateString() === currentDate.toDateString()
        );
        
        calendarHTML += `
            <div class="day ${isToday ? 'today' : ''}" onclick="showDayEvents(${year}, ${month}, ${day})">
                <div class="day-number">${day}</div>
                <div class="day-events">
                    ${dayEvents.slice(0, 2).map(event => `
                        <div class="event-item" title="${event.title}">
                            <span class="event-dot"></span>${event.title}
                        </div>
                    `).join('')}
                    ${dayEvents.length > 2 ? `<div class="event-more">+${dayEvents.length - 2} mais</div>` : ''}
                </div>
            </div>
        `;
        
        // Nova linha a cada 7 dias
        if ((adjustedFirstDayOfWeek + day) % 7 === 0 && day !== lastDay.getDate()) {
            calendarHTML += '</div><div class="week">';
        }
    }
    
    calendarHTML += '</div>';
    calendarEl.innerHTML = calendarHTML;
}

function showDayEvents(year, month, day) {
    const selectedDate = new Date(year, month, day);
    const events = Storage.get(DATA_KEYS.EVENTS);
    
    const dayEvents = events.filter(event => 
        event.start && new Date(event.start).toDateString() === selectedDate.toDateString()
    );
    
    const dayEventsEl = document.getElementById('dayEvents');
    if (dayEventsEl) {
        dayEventsEl.innerHTML = dayEvents.length ? dayEvents.map(event => `
            <div class="item">
                <div class="item-content">
                    <div class="item-title">${event.title}</div>
                    <div class="item-subtitle">🕒 ${formatTime(event.start)} - ${formatTime(event.end)}</div>
                    ${event.location ? `<div class="item-subtitle">📍 ${event.location}</div>` : ''}
                </div>
            </div>
        `).join('') : `<div class="muted">Nenhum evento para ${formatDate(selectedDate.toISOString())}</div>`;
    }
}

// ===== SISTEMA DE SAÚDE =====
function initHealthSystem() {
    const healthForm = document.getElementById('formHealth');
    if (healthForm) {
        healthForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(healthForm);
            const metric = {
                id: Date.now(),
                date: formData.get('date'),
                weight: formData.get('weight'),
                temp: formData.get('temp'),
                glucose: formData.get('glucose'),
                spo2: formData.get('spo2'),
                bpm: formData.get('bpm'),
                bp: formData.get('bp'),
                createdAt: new Date().toISOString()
            };
            
            const healthData = Storage.get(DATA_KEYS.HEALTH);
            healthData.push(metric);
            Storage.set(DATA_KEYS.HEALTH, healthData);
            
            healthForm.closest('dialog').close();
            healthForm.reset();
            showToast('❤️ Métrica de saúde salva!', 'ok');
            renderHealthMetrics();
        });
    }
}

function renderHealthMetrics() {
    const healthListEl = document.getElementById('healthList');
    if (!healthListEl) return;
    
    const metrics = Storage.get(DATA_KEYS.HEALTH).slice(-5); // Últimas 5 entradas
    
    healthListEl.innerHTML = metrics.length ? metrics.reverse().map(metric => `
        <div class="item">
            <div class="item-content">
                <div class="item-title">📊 Registro - ${formatDateTime(metric.date)}</div>
                <div class="item-subtitle">
                    ${metric.weight ? `⚖️ ${metric.weight}kg ` : ''}
                    ${metric.bpm ? `💓 ${metric.bpm}bpm ` : ''}
                    ${metric.glucose ? `🩸 ${metric.glucose}mg/dL ` : ''}
                    ${metric.spo2 ? `💨 ${metric.spo2}% SpO₂ ` : ''}
                </div>
            </div>
        </div>
    `).join('') : '<div class="muted">Nenhuma métrica registrada ainda.</div>';
}

// ===== SISTEMA FINANCEIRO =====
function initFinanceSystem() {
    const finForm = document.getElementById('formFin');
    if (finForm) {
        finForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(finForm);
            const transaction = {
                id: Date.now(),
                desc: formData.get('desc'),
                amount: parseFloat(formData.get('amount')),
                type: formData.get('type'),
                category: formData.get('category'),
                date: formData.get('date') || new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString()
            };
            
            const financeData = Storage.get(DATA_KEYS.FINANCE);
            financeData.push(transaction);
            Storage.set(DATA_KEYS.FINANCE, financeData);
            
            finForm.closest('dialog').close();
            finForm.reset();
            showToast('💸 Transação registrada!', 'ok');
            renderFinanceData();
            updateFinanceSummary();
        });
    }
    
    // Configurar filtro financeiro
    const finFilter = document.getElementById('finFilter');
    if (finFilter) {
        finFilter.addEventListener('change', function() {
            renderFinanceData(this.value);
            updateFinanceSummary(this.value);
        });
    }
}

function renderFinanceData(filter = 'month') {
    const finListEl = document.getElementById('finList');
    if (!finListEl) return;
    
    let transactions = Storage.get(DATA_KEYS.FINANCE);
    
    // Aplicar filtro
    if (filter !== 'all') {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        transactions = transactions.filter(transaction => {
            const transDate = new Date(transaction.date);
            
            if (filter === 'month') {
                return transDate >= firstDayOfMonth;
            } else if (filter === 'income') {
                return transaction.type === 'income';
            } else if (filter === 'expense') {
                return transaction.type === 'expense';
            }
            return true;
        });
    }
    
    // Ordenar por data (mais recente primeiro)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    finListEl.innerHTML = transactions.length ? transactions.map(trans => `
        <div class="item">
            <div class="item-content">
                <div class="item-title">${trans.desc}</div>
                <div class="item-subtitle">
                    📅 ${formatDate(trans.date)} | 
                    ${trans.type === 'income' ? '💚 Entrada' : '💔 Saída'} | 
                    ${trans.category}
                </div>
            </div>
            <div class="item-actions">
                <span class="${trans.type === 'income' ? 'ok' : 'bad'}">
                    R$ ${trans.amount.toFixed(2)}
                </span>
            </div>
        </div>
    `).join('') : '<div class="muted">Nenhuma transação registrada.</div>';
}

function updateFinanceSummary(filter = 'month') {
    const balanceEl = document.getElementById('finBalance');
    if (!balanceEl) return;
    
    let transactions = Storage.get(DATA_KEYS.FINANCE);
    
    // Aplicar filtro
    if (filter !== 'all') {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        transactions = transactions.filter(transaction => {
            const transDate = new Date(transaction.date);
            return transDate >= firstDayOfMonth;
        });
    }
    
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = income - expenses;
    
    balanceEl.textContent = `R$ ${balance.toFixed(2)}`;
    balanceEl.className = `kpi ${balance >= 0 ? 'ok' : 'bad'}`;
}

// ===== SISTEMA DE CONFIGURAÇÕES =====
function initConfigSystem() {
    // Carregar configurações salvas
    const config = Storage.get(DATA_KEYS.CONFIG, {
        focusMode: false,
        readingMode: false,
        notifications: true,
        sound: true,
        dayStart: 6,
        dayEnd: 22
    });
    
    // Aplicar configurações aos controles
    const prefFocus = document.getElementById('prefFocus');
    const prefReading = document.getElementById('prefReading');
    const prefNotif = document.getElementById('prefNotif');
    const prefSound = document.getElementById('prefSound');
    const prefStart = document.getElementById('prefStart');
    const prefEnd = document.getElementById('prefEnd');
    
    if (prefFocus) prefFocus.checked = config.focusMode;
    if (prefReading) prefReading.checked = config.readingMode;
    if (prefNotif) prefNotif.checked = config.notifications;
    if (prefSound) prefSound.checked = config.sound;
    if (prefStart) prefStart.value = config.dayStart;
    if (prefEnd) prefEnd.value = config.dayEnd;
    
    // Salvar configurações quando alteradas
    const configInputs = [prefFocus, prefReading, prefNotif, prefSound, prefStart, prefEnd];
    configInputs.forEach(input => {
        if (input) {
            input.addEventListener('change', saveConfig);
        }
    });
}

function saveConfig() {
    const config = {
        focusMode: document.getElementById('prefFocus').checked,
        readingMode: document.getElementById('prefReading').checked,
        notifications: document.getElementById('prefNotif').checked,
        sound: document.getElementById('prefSound').checked,
        dayStart: parseInt(document.getElementById('prefStart').value),
        dayEnd: parseInt(document.getElementById('prefEnd').value)
    };
    
    Storage.set(DATA_KEYS.CONFIG, config);
    showToast('⚙️ Configurações salvas!', 'ok');
}

// ===== FUNÇÕES UTILITÁRIAS =====
function initModals() {
    // Abertura de modais
    const modalTriggers = document.querySelectorAll('[data-open]');
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const modalId = trigger.getAttribute('data-open');
            const modal = document.getElementById(modalId);
            if (modal) modal.showModal();
        });
    });
    
    // Fechar modais com ESC ou clique fora
    const modals = document.querySelectorAll('dialog');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.close();
        });
        
        // Fechar com ESC
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') modal.close();
        });
    });
}

function initGlobalSearch() {
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            if (e.target.value.length > 2) {
                // Implementar busca global aqui
                showToast(`Buscando: "${e.target.value}"`, 'info');
            }
        });
    }
}

function updateTodayDate() {
    const today = new Date();
    document.getElementById('today-date').textContent = today.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getPriorityText(priority) {
    const priorities = {
        high: 'Alta',
        med: 'Média', 
        low: 'Baixa'
    };
    return priorities[priority] || priority;
}

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatTime(dateTimeString) {
    if (!dateTimeString) return '';
    return new Date(dateTimeString).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    return new Date(dateTimeString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toasts');
    if (container) {
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// ===== BACKUP E EXPORTAÇÃO =====
function exportData() {
    const data = {};
    Object.keys(DATA_KEYS).forEach(key => {
        data[DATA_KEYS[key]] = Storage.get(DATA_KEYS[key]);
    });
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minha-rotina-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📁 Backup exportado com sucesso!', 'ok');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            Object.keys(data).forEach(key => {
                Storage.set(key, data[key]);
            });
            showToast('📁 Dados importados com sucesso!', 'ok');
            // Recarregar a página para aplicar os dados
            setTimeout(() => location.reload(), 1000);
        } catch (error) {
            showToast('❌ Erro ao importar arquivo', 'bad');
            console.error('Erro na importação:', error);
        }
    };
    reader.readAsText(file);
}

// ===== INICIALIZAÇÃO DE EVENT LISTENERS ADICIONAIS =====
document.addEventListener('DOMContentLoaded', function() {
    // Backup e exportação
    const exportBtn = document.querySelector('[data-action="export-json"]');
    const importBtn = document.querySelector('[data-action="import-json"]');
    const importFile = document.getElementById('importFile');
    
    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn) importBtn.addEventListener('click', () => importFile.click());
    if (importFile) importFile.addEventListener('change', importData);
    
    // Adicionar dados de exemplo para demonstração
    setTimeout(() => {
        const tasks = Storage.get(DATA_KEYS.TASKS);
        if (tasks.length === 0) {
            const exampleTasks = [
                {
                    id: 1,
                    title: 'Revisar projeto TDAH',
                    due: new Date().toISOString().split('T')[0],
                    priority: 'high',
                    project: 'work',
                    completed: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 2,
                    title: 'Fazer exercícios físicos',
                    due: new Date().toISOString().split('T')[0],
                    priority: 'med',
                    project: 'personal',
                    completed: false,
                    createdAt: new Date().toISOString()
                }
            ];
            Storage.set(DATA_KEYS.TASKS, exampleTasks);
            renderTodayTasks();
            renderAllTasks();
        }
        
        // Inicializar dados financeiros
        renderFinanceData();
        updateFinanceSummary();
    }, 500);
});

// ===== EXPORTAÇÃO DE FUNÇÕES PARA USO GLOBAL =====
// (Necessário para onclick nos templates HTML)
window.completeTask = completeTask;
window.showEventDetail = showEventDetail;
window.deleteEvent = deleteEvent;
window.takeMedication = takeMedication;
window.exportData = exportData;