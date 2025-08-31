// ===================================================================
// TREXO ENGINEERING & CONSTRUCTION - COMPLETE FRONTEND
// ===================================================================

// Global variables
let currentLanguage = 'en';
let currentUser = null;
let dashboardData = null;
let liveChatSocket = null;

// Language translations
const translations = {
    en: {
        company_name: "TREXO ENGINEERING & CONSTRUCTION",
        welcome: "Welcome",
        home: "Home",
        about: "About",
        services: "Services",
        projects: "Projects",
        certificates: "Certificates",
        contact: "Contact",
        get_quote: "Get Quote",
        login: "Login",
        logout: "Logout",
        admin: "Admin",
        dashboard: "Dashboard",
        hero_title: "Building Tomorrow, Today",
        hero_subtitle: "Your trusted partner for innovative engineering solutions and top-quality construction services worldwide",
        get_started: "Get Started",
        view_projects: "View Projects",
        our_services: "Our Services",
        why_choose_us: "Why Choose Us",
        our_projects: "Our Projects",
        contact_us: "Contact Us",
        live_support: "Live Support",
        call_now: "Call Now",
        email_us: "Email Us",
        name: "Name",
        email: "Email",
        phone: "Phone",
        company: "Company",
        message: "Message",
        send_message: "Send Message",
        project_type: "Project Type",
        budget_range: "Budget Range",
        timeline: "Timeline",
        description: "Description",
        submit_quote: "Submit Quote Request",
        payment_gateway: "Payment Gateway",
        amount: "Amount",
        card_number: "Card Number",
        expiry_date: "Expiry Date",
        cvv: "CVV",
        cardholder_name: "Cardholder Name",
        pay_now: "Pay Now"
    },
    es: {
        company_name: "TREXO INGENIERÍA Y CONSTRUCCIÓN",
        welcome: "Bienvenido",
        home: "Inicio",
        about: "Acerca de",
        services: "Servicios",
        projects: "Proyectos", 
        certificates: "Certificados",
        contact: "Contacto",
        get_quote: "Obtener Cotización",
        login: "Iniciar Sesión",
        logout: "Cerrar Sesión",
        admin: "Administrador",
        dashboard: "Panel",
        hero_title: "Construyendo el Mañana, Hoy",
        hero_subtitle: "Su socio de confianza para soluciones de ingeniería innovadoras y servicios de construcción de alta calidad en todo el mundo",
        get_started: "Comenzar",
        view_projects: "Ver Proyectos",
        our_services: "Nuestros Servicios",
        why_choose_us: "Por Qué Elegirnos",
        our_projects: "Nuestros Proyectos",
        contact_us: "Contáctanos",
        live_support: "Soporte en Vivo",
        call_now: "Llamar Ahora",
        email_us: "Envíanos un Email",
        name: "Nombre",
        email: "Correo Electrónico",
        phone: "Teléfono",
        company: "Empresa",
        message: "Mensaje",
        send_message: "Enviar Mensaje",
        project_type: "Tipo de Proyecto",
        budget_range: "Rango de Presupuesto",
        timeline: "Cronograma",
        description: "Descripción",
        submit_quote: "Enviar Solicitud de Cotización",
        payment_gateway: "Pasarela de Pago",
        amount: "Cantidad",
        card_number: "Número de Tarjeta",
        expiry_date: "Fecha de Expiración",
        cvv: "CVV",
        cardholder_name: "Nombre del Titular",
        pay_now: "Pagar Ahora"
    },
    fr: {
        company_name: "TREXO INGÉNIERIE ET CONSTRUCTION",
        welcome: "Bienvenue",
        home: "Accueil",
        about: "À Propos",
        services: "Services",
        projects: "Projets",
        certificates: "Certificats",
        contact: "Contact",
        get_quote: "Obtenir un Devis",
        login: "Connexion",
        logout: "Déconnexion",
        admin: "Administrateur",
        dashboard: "Tableau de Bord",
        hero_title: "Construire Demain, Aujourd'hui",
        hero_subtitle: "Votre partenaire de confiance pour des solutions d'ingénierie innovantes et des services de construction de qualité supérieure dans le monde entier",
        get_started: "Commencer",
        view_projects: "Voir les Projets"
    }
};

// ===================================================================
// LANGUAGE SWITCHING FUNCTIONALITY
// ===================================================================

function changeLanguage(lang) {
    currentLanguage = lang;
    
    // Update all elements with data-translate attribute
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });
    
    // Update placeholders
    const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
    placeholderElements.forEach(element => {
        const key = element.getAttribute('data-translate-placeholder');
        if (translations[lang] && translations[lang][key]) {
            element.setAttribute('placeholder', translations[lang][key]);
        }
    });
    
    // Update language selector
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.value = lang;
    }
    
    // Store preference
    localStorage.setItem('preferredLanguage', lang);
    
    showAlert('success', `Language changed to ${lang.toUpperCase()}`);
}

// ===================================================================
// LIVE SUPPORT FUNCTIONALITY
// ===================================================================

let liveChatOpen = false;
let supportMessages = [];

function initializeLiveSupport() {
    // Create live support button
    const supportButton = document.createElement('div');
    supportButton.id = 'liveSupportButton';
    supportButton.innerHTML = `
        <div class="support-button" onclick="toggleLiveSupport()">
            <i class="fas fa-comments"></i>
            <span class="support-text" data-translate="live_support">Live Support</span>
        </div>
    `;
    
    supportButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        cursor: pointer;
    `;
    
    const supportButtonStyle = document.createElement('style');
    supportButtonStyle.textContent = `
        .support-button {
            background: linear-gradient(135deg, #2c5aa0 0%, #1a4480 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 50px;
            box-shadow: 0 4px 20px rgba(44, 90, 160, 0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            transition: all 0.3s ease;
            animation: pulse 2s infinite;
        }
        
        .support-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 25px rgba(44, 90, 160, 0.4);
        }
        
        @keyframes pulse {
            0% { box-shadow: 0 4px 20px rgba(44, 90, 160, 0.3); }
            50% { box-shadow: 0 4px 30px rgba(44, 90, 160, 0.5); }
            100% { box-shadow: 0 4px 20px rgba(44, 90, 160, 0.3); }
        }
        
        .support-text {
            font-size: 14px;
        }
        
        @media (max-width: 768px) {
            .support-text {
                display: none;
            }
            .support-button {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                justify-content: center;
                padding: 0;
            }
        }
    `;
    
    document.head.appendChild(supportButtonStyle);
    document.body.appendChild(supportButton);
    
    createLiveChatWidget();
}

function createLiveChatWidget() {
    const chatWidget = document.createElement('div');
    chatWidget.id = 'liveChatWidget';
    chatWidget.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        width: 350px;
        height: 450px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        z-index: 1001;
        display: none;
        flex-direction: column;
        overflow: hidden;
    `;
    
    chatWidget.innerHTML = `
        <div class="chat-header">
            <div class="chat-title">
                <i class="fas fa-headset"></i>
                <span data-translate="live_support">Live Support</span>
                <div class="chat-status">
                    <div class="status-dot"></div>
                    <span>Online</span>
                </div>
            </div>
            <button class="chat-close" onclick="toggleLiveSupport()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="chat-messages" id="chatMessages">
            <div class="welcome-message">
                <div class="bot-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <p>Hello! 👋 Welcome to Trexo Engineering. How can I help you today?</p>
                    <div class="quick-actions">
                        <button onclick="quickMessage('I need a quote')">Get Quote</button>
                        <button onclick="quickMessage('Project inquiry')">Project Info</button>
                        <button onclick="quickMessage('Support needed')">Technical Support</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="chat-input">
            <input type="text" id="chatMessageInput" placeholder="Type your message..." 
                   onkeypress="if(event.key==='Enter') sendChatMessage()">
            <button onclick="sendChatMessage()">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    `;
    
    const chatStyle = document.createElement('style');
    chatStyle.textContent = `
        .chat-header {
            background: linear-gradient(135deg, #2c5aa0 0%, #1a4480 100%);
            color: white;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .chat-title {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
        }
        
        .chat-status {
            display: flex;
            align-items: center;
            gap: 5px;
            margin-left: auto;
            margin-right: 10px;
            font-size: 12px;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            background: #4ade80;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        .chat-close {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 5px;
            border-radius: 3px;
        }
        
        .chat-close:hover {
            background: rgba(255,255,255,0.1);
        }
        
        .chat-messages {
            flex: 1;
            padding: 15px;
            overflow-y: auto;
            background: #f8fafc;
        }
        
        .welcome-message, .chat-message {
            margin-bottom: 15px;
            display: flex;
            gap: 10px;
        }
        
        .bot-avatar, .user-avatar {
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
        }
        
        .bot-avatar {
            background: #2c5aa0;
            color: white;
        }
        
        .user-avatar {
            background: #64748b;
            color: white;
        }
        
        .message-content {
            flex: 1;
            background: white;
            padding: 10px 15px;
            border-radius: 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .user-message .message-content {
            background: #2c5aa0;
            color: white;
            margin-left: auto;
            margin-right: 0;
        }
        
        .user-message {
            flex-direction: row-reverse;
        }
        
        .quick-actions {
            margin-top: 10px;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .quick-actions button {
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.3s ease;
        }
        
        .quick-actions button:hover {
            background: #2c5aa0;
            color: white;
            border-color: #2c5aa0;
        }
        
        .chat-input {
            padding: 15px;
            background: white;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 10px;
        }
        
        .chat-input input {
            flex: 1;
            padding: 10px 15px;
            border: 1px solid #e2e8f0;
            border-radius: 25px;
            outline: none;
        }
        
        .chat-input input:focus {
            border-color: #2c5aa0;
        }
        
        .chat-input button {
            background: #2c5aa0;
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .chat-input button:hover {
            background: #1a4480;
        }
        
        @media (max-width: 768px) {
            #liveChatWidget {
                width: calc(100vw - 40px);
                height: 400px;
                bottom: 90px;
                right: 20px;
                left: 20px;
            }
        }
    `;
    
    document.head.appendChild(chatStyle);
    document.body.appendChild(chatWidget);
}

function toggleLiveSupport() {
    const widget = document.getElementById('liveChatWidget');
    if (!widget) return;
    
    liveChatOpen = !liveChatOpen;
    widget.style.display = liveChatOpen ? 'flex' : 'none';
    
    if (liveChatOpen) {
        document.getElementById('chatMessageInput').focus();
    }
}

function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addChatMessage(message, 'user');
    input.value = '';
    
    // Simulate bot response
    setTimeout(() => {
        const botResponse = generateBotResponse(message);
        addChatMessage(botResponse, 'bot');
    }, 1000);
}

function addChatMessage(message, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    const avatar = sender === 'user' ? 
        '<div class="user-avatar"><i class="fas fa-user"></i></div>' :
        '<div class="bot-avatar"><i class="fas fa-robot"></i></div>';
    
    messageDiv.innerHTML = `
        ${avatar}
        <div class="message-content">
            <p>${message}</p>
            <small>${new Date().toLocaleTimeString()}</small>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    supportMessages.push({ message, sender, timestamp: new Date().toISOString() });
}

function quickMessage(message) {
    const input = document.getElementById('chatMessageInput');
    input.value = message;
    sendChatMessage();
}

function generateBotResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('quote') || message.includes('price') || message.includes('cost')) {
        return "I'd be happy to help you get a quote! You can click the 'Get Quote' button on our website, or I can transfer you to our sales team. What type of project are you planning?";
    } else if (message.includes('project') || message.includes('construction') || message.includes('engineering')) {
        return "We specialize in various construction and engineering projects including residential, commercial, and industrial developments. Would you like to know more about a specific type of project?";
    } else if (message.includes('contact') || message.includes('phone') || message.includes('email')) {
        return `You can reach us at ${translations[currentLanguage]?.phone || '(555) 123-4567'} or email us at info@trexo.com. Our support team is available 24/7!`;
    } else if (message.includes('payment') || message.includes('pay')) {
        return "We accept various payment methods including credit cards, bank transfers, and cryptocurrency. You can make payments through our secure payment portal. Would you like me to guide you through the process?";
    } else if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        return "Hello! Welcome to Trexo Engineering & Construction. I'm here to help you with any questions about our services, projects, or to get you connected with the right team member.";
    } else {
        return "Thank you for your message! Our support team will get back to you shortly. In the meantime, you can explore our services or request a quote. Is there anything specific I can help you with?";
    }
}

// ===================================================================
// QUOTE REQUEST FUNCTIONALITY
// ===================================================================

function openQuoteModal() {
    let modal = document.getElementById('quoteModal');
    
    if (!modal) {
        modal = createQuoteModal();
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeQuoteModal() {
    const modal = document.getElementById('quoteModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function createQuoteModal() {
    const modal = document.createElement('div');
    modal.id = 'quoteModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
        <div class="quote-modal-content">
            <div class="quote-header">
                <h2><i class="fas fa-calculator"></i> <span data-translate="get_quote">Get Quote</span></h2>
                <button class="close-btn" onclick="closeQuoteModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="quoteForm" class="quote-form" onsubmit="submitQuoteRequest(event)">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="quoteName" data-translate="name">Name</label>
                        <input type="text" id="quoteName" name="name" required 
                               data-translate-placeholder="name">
                    </div>
                    
                    <div class="form-group">
                        <label for="quoteEmail" data-translate="email">Email</label>
                        <input type="email" id="quoteEmail" name="email" required 
                               data-translate-placeholder="email">
                    </div>
                    
                    <div class="form-group">
                        <label for="quotePhone" data-translate="phone">Phone</label>
                        <input type="tel" id="quotePhone" name="phone" required 
                               data-translate-placeholder="phone">
                    </div>
                    
                    <div class="form-group">
                        <label for="quoteCompany" data-translate="company">Company</label>
                        <input type="text" id="quoteCompany" name="company" 
                               data-translate-placeholder="company">
                    </div>
                    
                    <div class="form-group">
                        <label for="projectType" data-translate="project_type">Project Type</label>
                        <select id="projectType" name="projectType" required>
                            <option value="">Select Project Type</option>
                            <option value="residential">Residential Construction</option>
                            <option value="commercial">Commercial Building</option>
                            <option value="industrial">Industrial Facility</option>
                            <option value="infrastructure">Infrastructure</option>
                            <option value="renovation">Renovation</option>
                            <option value="engineering">Engineering Consultation</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="budget" data-translate="budget_range">Budget Range</label>
                        <select id="budget" name="budget" required>
                            <option value="">Select Budget Range</option>
                            <option value="under-100k">Under $100,000</option>
                            <option value="100k-500k">$100,000 - $500,000</option>
                            <option value="500k-1m">$500,000 - $1,000,000</option>
                            <option value="1m-5m">$1,000,000 - $5,000,000</option>
                            <option value="above-5m">Above $5,000,000</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="timeline" data-translate="timeline">Timeline</label>
                        <select id="timeline" name="timeline" required>
                            <option value="">Select Timeline</option>
                            <option value="asap">ASAP</option>
                            <option value="1-3-months">1-3 Months</option>
                            <option value="3-6-months">3-6 Months</option>
                            <option value="6-12-months">6-12 Months</option>
                            <option value="above-1-year">Above 1 Year</option>
                        </select>
                    </div>
                    
                    <div class="form-group full-width">
                        <label for="quoteDescription" data-translate="description">Project Description</label>
                        <textarea id="quoteDescription" name="description" rows="4" required 
                                  data-translate-placeholder="description"></textarea>
                    </div>
                    
                    <div class="form-group full-width">
                        <label for="quoteDocuments">Project Documents (Optional)</label>
                        <input type="file" id="quoteDocuments" name="documents" multiple 
                               accept=".pdf,.doc,.docx,.jpg,.jpeg,.png">
                        <small>Upload plans, drawings, or reference documents (Max 5 files, 5MB each)</small>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" onclick="closeQuoteModal()" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-paper-plane"></i>
                        <span data-translate="submit_quote">Submit Quote Request</span>
                    </button>
                </div>
            </form>
        </div>
    `;
    
    // Add modal styles
    const modalStyle = document.createElement('style');
    modalStyle.textContent = `
        .quote-modal-content {
            background: white;
            border-radius: 10px;
            max-width: 600px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .quote-header {
            background: linear-gradient(135deg, #2c5aa0 0%, #1a4480 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 10px 10px 0 0;
        }
        
        .quote-header h2 {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 5px;
            border-radius: 3px;
        }
        
        .close-btn:hover {
            background: rgba(255,255,255,0.1);
        }
        
        .quote-form {
            padding: 20px;
        }
        
        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
        }
        
        .form-group.full-width {
            grid-column: 1 / -1;
        }
        
        .form-group label {
            margin-bottom: 5px;
            font-weight: 600;
            color: #374151;
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 5px;
            font-size: 14px;
            transition: border-color 0.3s ease;
        }
        
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: #2c5aa0;
            box-shadow: 0 0 0 3px rgba(44, 90, 160, 0.1);
        }
        
        .form-group small {
            margin-top: 5px;
            color: #6b7280;
            font-size: 12px;
        }
        
        .form-actions {
            margin-top: 20px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        
        .btn-primary, .btn-secondary {
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        }
        
        .btn-primary {
            background: #2c5aa0;
            color: white;
        }
        
        .btn-primary:hover {
            background: #1a4480;
            transform: translateY(-1px);
        }
        
        .btn-secondary {
            background: #6b7280;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #4b5563;
        }
        
        @media (max-width: 768px) {
            .form-grid {
                grid-template-columns: 1fr;
            }
            
            .quote-modal-content {
                width: 95%;
                margin: 10px;
            }
            
            .form-actions {
                flex-direction: column;
            }
        }
    `;
    
    document.head.appendChild(modalStyle);
    
    return modal;
}

async function submitQuoteRequest(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    submitBtn.disabled = true;
    
    try {
        const formData = new FormData(form);
        
        const response = await fetch('/api/quote', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', `Quote request submitted successfully! Ticket ID: ${result.ticketId}`);
            closeQuoteModal();
            form.reset();
        } else {
            throw new Error(result.error || 'Failed to submit quote request');
        }
    } catch (error) {
        console.error('Quote submission error:', error);
        showAlert('error', error.message || 'Failed to submit quote request. Please try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// ===================================================================
// PAYMENT GATEWAY FUNCTIONALITY
// ===================================================================

function openPaymentModal() {
    let modal = document.getElementById('paymentModal');
    
    if (!modal) {
        modal = createPaymentModal();
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function createPaymentModal() {
    const modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
        <div class="payment-modal-content">
            <div class="payment-header">
                <h2><i class="fas fa-credit-card"></i> <span data-translate="payment_gateway">Payment Gateway</span></h2>
                <button class="close-btn" onclick="closePaymentModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="payment-tabs">
                <button class="tab-btn active" onclick="switchPaymentTab('card')">
                    <i class="fas fa-credit-card"></i> Credit Card
                </button>
                <button class="tab-btn" onclick="switchPaymentTab('crypto')">
                    <i class="fab fa-bitcoin"></i> Cryptocurrency
                </button>
                <button class="tab-btn" onclick="switchPaymentTab('bank')">
                    <i class="fas fa-university"></i> Bank Transfer
                </button>
            </div>
            
            <form id="paymentForm" class="payment-form" onsubmit="processPayment(event)">
                <!-- Credit Card Tab -->
                <div id="cardTab" class="payment-tab active">
                    <div class="card-preview">
                        <div class="credit-card">
                            <div class="card-number" id="cardPreview">**** **** **** ****</div>
                            <div class="card-details">
                                <div class="card-holder" id="holderPreview">CARDHOLDER NAME</div>
                                <div class="card-expiry" id="expiryPreview">MM/YY</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="amount" data-translate="amount">Amount ($)</label>
                        <input type="number" id="amount" name="amount" required step="0.01" min="1" 
                               placeholder="0.00" onchange="updatePaymentSummary()">
                    </div>
                    
                    <div class="form-group">
                        <label for="cardNumber" data-translate="card_number">Card Number</label>
                        <input type="text" id="cardNumber" name="cardNumber" required 
                               placeholder="1234 5678 9012 3456" maxlength="19"
                               oninput="formatCardNumber(this); updateCardPreview()">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="expiryDate" data-translate="expiry_date">Expiry Date</label>
                            <input type="text" id="expiryDate" name="expiryDate" required 
                                   placeholder="MM/YY" maxlength="5"
                                   oninput="formatExpiryDate(this); updateCardPreview()">
                        </div>
                        
                        <div class="form-group">
                            <label for="cvv" data-translate="cvv">CVV</label>
                            <input type="text" id="cvv" name="cvv" required 
                                   placeholder="123" maxlength="4">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="cardName" data-translate="cardholder_name">Cardholder Name</label>
                        <input type="text" id="cardName" name="cardName" required 
                               placeholder="John Doe" oninput="updateCardPreview()">
                    </div>
                </div>
                
                <!-- Crypto Tab -->
                <div id="cryptoTab" class="payment-tab">
                    <div class="crypto-options">
                        <div class="crypto-option" onclick="selectCrypto('bitcoin')">
                            <i class="fab fa-bitcoin"></i>
                            <span>Bitcoin (BTC)</span>
                        </div>
                        <div class="crypto-option" onclick="selectCrypto('ethereum')">
                            <i class="fab fa-ethereum"></i>
                            <span>Ethereum (ETH)</span>
                        </div>
                        <div class="crypto-option" onclick="selectCrypto('usdt')">
                            <i class="fas fa-coins"></i>
                            <span>USDT</span>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="cryptoAmount">Amount ($)</label>
                        <input type="number" id="cryptoAmount" name="amount" required step="0.01" min="1" 
                               placeholder="0.00">
                    </div>
                    
                    <div class="crypto-info" id="cryptoInfo" style="display: none;">
                        <p>You will be redirected to complete your cryptocurrency payment.</p>
                    </div>
                </div>
                
                <!-- Bank Transfer Tab -->
                <div id="bankTab" class="payment-tab">
                    <div class="bank-info">
                        <h4>Bank Transfer Details</h4>
                        <div class="bank-details">
                            <p><strong>Account Name:</strong> Trexo Engineering & Construction</p>
                            <p><strong>Account Number:</strong> 1234567890</p>
                            <p><strong>Routing Number:</strong> 987654321</p>
                            <p><strong>Bank:</strong> First National Bank</p>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="bankAmount">Amount ($)</label>
                        <input type="number" id="bankAmount" name="amount" required step="0.01" min="1" 
                               placeholder="0.00">
                    </div>
                    
                    <div class="form-group">
                        <label for="reference">Reference Number (from your bank)</label>
                        <input type="text" id="reference" name="reference" required 
                               placeholder="Enter transfer reference">
                    </div>
                </div>
                
                <div class="payment-summary" id="paymentSummary">
                    <div class="summary-row">
                        <span>Subtotal:</span>
                        <span id="subtotal">$0.00</span>
                    </div>
                    <div class="summary-row">
                        <span>Processing Fee:</span>
                        <span id="processingFee">$0.00</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total:</span>
                        <span id="total">$0.00</span>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" onclick="closePaymentModal()" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">
                        <i class="fas fa-lock"></i>
                        <span data-translate="pay_now">Pay Now</span>
                    </button>
                </div>
            </form>
        </div>
    `;
    
    // Add payment modal styles
    const paymentStyle = document.createElement('style');
    paymentStyle.textContent = `
        .payment-modal-content {
            background: white;
            border-radius: 10px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .payment-header {
            background: linear-gradient(135deg, #2c5aa0 0%, #1a4480 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 10px 10px 0 0;
        }
        
        .payment-tabs {
            display: flex;
            background: #f1f5f9;
        }
        
        .tab-btn {
            flex: 1;
            padding: 15px;
            border: none;
            background: transparent;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .tab-btn.active {
            background: white;
            color: #2c5aa0;
            border-bottom: 2px solid #2c5aa0;
        }
        
        .payment-tab {
            display: none;
            padding: 20px;
        }
        
        .payment-tab.active {
            display: block;
        }
        
        .card-preview {
            margin-bottom: 20px;
        }
        
        .credit-card {
            background: linear-gradient(135deg, #2c5aa0 0%, #1a4480 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .card-number {
            font-size: 18px;
            font-family: 'Courier New', monospace;
            margin-bottom: 20px;
            letter-spacing: 2px;
        }
        
        .card-details {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
        }
        
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        
        .crypto-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .crypto-option {
            padding: 15px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .crypto-option:hover,
        .crypto-option.selected {
            border-color: #2c5aa0;
            background: #f0f6ff;
        }
        
        .bank-info {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .bank-details p {
            margin: 5px 0;
            font-size: 14px;
        }
        
        .payment-summary {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        
        .summary-row.total {
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            font-weight: bold;
            font-size: 18px;
        }
        
        @media (max-width: 768px) {
            .form-row {
                grid-template-columns: 1fr;
            }
            
            .crypto-options {
                grid-template-columns: 1fr;
            }
        }
    `;
    
    document.head.appendChild(paymentStyle);
    
    return modal;
}

function switchPaymentTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.payment-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(tab + 'Tab').classList.add('active');
    event.target.closest('.tab-btn').classList.add('active');
}

function formatCardNumber(input) {
    let value = input.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    input.value = formattedValue;
}

function formatExpiryDate(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    input.value = value;
}

function updateCardPreview() {
    const cardNumber = document.getElementById('cardNumber').value || '**** **** **** ****';
    const cardHolder = document.getElementById('cardName').value.toUpperCase() || 'CARDHOLDER NAME';
    const expiry = document.getElementById('expiryDate').value || 'MM/YY';
    
    document.getElementById('cardPreview').textContent = cardNumber;
    document.getElementById('holderPreview').textContent = cardHolder;
    document.getElementById('expiryPreview').textContent = expiry;
}

function updatePaymentSummary() {
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    const processingFee = amount * 0.029; // 2.9% processing fee
    const total = amount + processingFee;
    
    document.getElementById('subtotal').textContent = `$${amount.toFixed(2)}`;
    document.getElementById('processingFee').textContent = `$${processingFee.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

function selectCrypto(crypto) {
    document.querySelectorAll('.crypto-option').forEach(opt => opt.classList.remove('selected'));
    event.target.closest('.crypto-option').classList.add('selected');
    document.getElementById('cryptoInfo').style.display = 'block';
}

async function processPayment(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    submitBtn.disabled = true;
    
    try {
        const formData = new FormData(form);
        const paymentData = Object.fromEntries(formData.entries());
        
        // Add payment method
        const activeTab = document.querySelector('.payment-tab.active').id;
        paymentData.paymentMethod = activeTab.replace('Tab', '');
        
        const response = await fetch('/api/payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', `Payment submitted successfully! Transaction ID: ${result.transactionId}`);
            closePaymentModal();
            form.reset();
            updateCardPreview();
            updatePaymentSummary();
        } else {
            throw new Error(result.error || 'Payment processing failed');
        }
    } catch (error) {
        console.error('Payment error:', error);
        showAlert('error', error.message || 'Payment processing failed. Please try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// ===================================================================
// CONTACT FORM FUNCTIONALITY
// ===================================================================

async function submitContactForm(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;
    
    try {
        const formData = new FormData(form);
        
        const response = await fetch('/api/contact', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', `Message sent successfully! Ticket ID: ${result.ticketId}`);
            form.reset();
        } else {
            throw new Error(result.error || 'Failed to send message');
        }
    } catch (error) {
        console.error('Contact form error:', error);
        showAlert('error', error.message || 'Failed to send message. Please try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// ===================================================================
// ALERT SYSTEM
// ===================================================================

function showAlert(type, message, duration = 5000) {
    try {
        // Remove existing alerts of the same type
        const existingAlerts = document.querySelectorAll(`.alert-${type}`);
        existingAlerts.forEach(alert => {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        });

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        const colors = {
            success: '#16a34a',
            error: '#ef4444', 
            warning: '#f39c12',
            info: '#2c5aa0'
        };

        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            line-height: 1.4;
            animation: slideInRight 0.3s ease-out;
        `;

        alertDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">${icons[type] || icons.info}</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; color: white; cursor: pointer; margin-left: auto; font-size: 18px;">×</button>
            </div>
        `;

        // Add animation styles if not already present
        if (!document.querySelector('#alert-animations')) {
            const style = document.createElement('style');
            style.id = 'alert-animations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(alertDiv);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.style.animation = 'slideOutRight 0.3s ease-in forwards';
                    setTimeout(() => {
                        if (alertDiv.parentNode) {
                            alertDiv.parentNode.removeChild(alertDiv);
                        }
                    }, 300);
                }
            }, duration);
        }
    } catch (error) {
        console.error('ShowAlert Error:', error);
        alert(`${type.toUpperCase()}: ${message}`);
    }
}

// ===================================================================
// INITIALIZATION
// ===================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏗️ TREXO ENGINEERING & CONSTRUCTION');
    console.log('📋 Frontend.js loaded successfully');
    
    // Load saved language preference
    const savedLanguage = localStorage.getItem('preferredLanguage') || 'en';
    changeLanguage(savedLanguage);
    
    // Initialize live support
    initializeLiveSupport();
    
    // Initialize language selector
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.value = savedLanguage;
        languageSelect.addEventListener('change', function() {
            changeLanguage(this.value);
        });
    }
    
    // Initialize contact form if present
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', submitContactForm);
    }
    
    // Add click outside to close modals
    window.addEventListener('click', function(event) {
        const quoteModal = document.getElementById('quoteModal');
        const paymentModal = document.getElementById('paymentModal');
        
        if (event.target === quoteModal) {
            closeQuoteModal();
        }
        if (event.target === paymentModal) {
            closePaymentModal();
        }
    });
    
    console.log('✅ All features initialized successfully!');
});

// ===================================================================
// GLOBAL FUNCTIONS (for HTML onclick events)
// ===================================================================

window.changeLanguage = changeLanguage;
window.openQuoteModal = openQuoteModal;
window.closeQuoteModal = closeQuoteModal;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.toggleLiveSupport = toggleLiveSupport;
window.sendChatMessage = sendChatMessage;
window.quickMessage = quickMessage;
window.showAlert = showAlert;
window.submitQuoteRequest = submitQuoteRequest;
window.submitContactForm = submitContactForm;
window.processPayment = processPayment;
window.switchPaymentTab = switchPaymentTab;
window.formatCardNumber = formatCardNumber;
window.formatExpiryDate = formatExpiryDate;
window.updateCardPreview = updateCardPreview;
window.updatePaymentSummary = updatePaymentSummary;
window.selectCrypto = selectCrypto;