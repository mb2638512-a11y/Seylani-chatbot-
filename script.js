/* ============================================
   Seylani AI Assistant — Core Logic + API + Voice
   ============================================ */

(function () {
    'use strict';

    // ─── Config ───
    let API_KEY = localStorage.getItem('nexus_api_key') || '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';
    const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const SYSTEM_PROMPT = `You are Seylani AI Assistant, a brilliant, friendly, and enthusiastic AI assistant built for a hackathon. You help with coding, debugging, project ideas, tech stack advice, presentations, and general knowledge. You respond in the SAME EXACT LANGUAGE the user writes in. If they write in Roman Urdu (e.g. "kyese ho bhai"), you MUST reply purely in Roman Urdu. If Urdu text, respond in Urdu text. If Spanish, Spanish. Always be helpful, use emojis to be engaging, and format responses with markdown. Keep responses concise but thorough.`;

    // ─── DOM References ───
    const $ = (s) => document.querySelector(s);
    const chatMessages = $('#chatMessages');
    const chatInput = $('#chatInput');
    const sendBtn = $('#sendBtn');
    const welcomeScreen = $('#welcomeScreen');
    const typingIndicator = $('#typingIndicator');
    const sidebar = $('#sidebar');
    const sidebarOverlay = $('#sidebarOverlay');
    const menuBtn = $('#menuBtn');
    const sidebarCloseBtn = $('#sidebarCloseBtn');
    const newChatBtn = $('#newChatBtn');
    const chatHistory = $('#chatHistory');
    const clearAllBtn = $('#clearAllBtn');
    const emojiBtn = $('#emojiBtn');
    const emojiPicker = $('#emojiPicker');
    const emojiGrid = $('#emojiGrid');
    const suggestionChips = $('#suggestionChips');
    const bgParticles = $('#bgParticles');
    const modelSelect = $('#modelSelect');
    const voiceBtn = $('#voiceBtn');
    const voiceOutputToggle = $('#voiceOutputToggle');
    const voiceModal = $('#voiceModal');
    const voiceModalClose = $('#voiceModalClose');
    const settingsBtn = $('#voiceSettingsBtn');
    const voiceSelect = $('#voiceSelect');
    const speechRateInput = $('#speechRate');
    const rateValue = $('#rateValue');
    const autoReadToggle = $('#autoReadToggle');
    const apiKeyInput = $('#apiKeyInput');
    const statusText = $('#statusText');
    const themeToggleBtn = $('#themeToggleBtn');
    const themeIcon = $('#themeIcon');

    // Attachments DOM
    const attachBtn = $('#attachBtn');
    const attachmentsPreview = $('#attachmentsPreview');
    const fileInput = $('#fileInput');
    const folderInput = $('#folderInput');

    // Video Call DOM
    const startCallBtn = $('#startCallBtn');
    const videoOverlay = $('#videoOverlay');
    const localVideo = $('#localVideo');
    const aiAura = $('#aiAura');
    const switchCameraBtn = $('#switchCameraBtn');
    const screenShareBtn = $('#screenShareBtn');
    const callMicBtn = $('#callMicBtn');
    const endCallBtn = $('#endCallBtn');

    // ─── State ───
    let conversations = JSON.parse(localStorage.getItem('nexus_conversations') || '{}');
    let activeConversationId = localStorage.getItem('nexus_active_id') || null;
    let isTyping = false;
    let isRecording = false;
    let recognition = null;
    let voiceOutputEnabled = JSON.parse(localStorage.getItem('nexus_voice_output') || 'false');
    let autoRead = JSON.parse(localStorage.getItem('nexus_auto_read') || 'false');
    let speechRate = parseFloat(localStorage.getItem('nexus_speech_rate') || '1');
    let selectedVoice = localStorage.getItem('nexus_voice') || '';
    let currentTheme = localStorage.getItem('nexus_theme') || 'dark';

    // Video Call State
    let currentStream = null;
    let cameraMode = 'user'; // 'user' or 'environment'
    let isVideoCallActive = false;

    // Attachments State
    let pendingAttachments = []; // { name, type, data, isImage }

    // ─── Emoji Data ───
    const emojis = [
        '😀', '😂', '🤣', '😍', '🥰', '😎', '🤩', '🥳',
        '😇', '🤔', '🤗', '🫡', '😏', '😅', '🙃', '😜',
        '👍', '👏', '🙌', '💪', '🔥', '⭐', '💡', '🎯',
        '🚀', '💻', '🤖', '🧠', '⚡', '✨', '🎉', '❤️',
        '💜', '💙', '💚', '🧡', '📝', '📌', '🔗', '👀',
        '🥇', '🏆', '🎓', '📚', '🧪', '🔬', '🎮', '🕹️',
        '🌍', '🌈', '☀️', '🌙', '🍕', '🍔', '☕', '🧃',
        '🐱', '🐶', '🦄', '🐝', '🌸', '🌺', '🍀', '🎵',
        '😢', '😤', '🥺', '😈', '💀', '👻', '🎃', '🤝',
        '✅', '❌', '⚠️', '💯', '🆒', '🔑', '💎', '🪄',
    ];

    // ─── Initialize Voice Recognition ───
    function initVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            voiceBtn.title = 'Voice not supported in this browser';
            voiceBtn.style.opacity = '0.3';
            return;
        }
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = ''; // auto-detect

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            chatInput.value = transcript;
            updateSendButton();
            autoResizeTextarea();
        };

        recognition.onend = () => {
            isRecording = false;
            voiceBtn.classList.remove('recording');
            // Auto-send if we got text
            if (chatInput.value.trim()) {
                sendMessage();
            }
        };

        recognition.onerror = (e) => {
            isRecording = false;
            voiceBtn.classList.remove('recording');
            if (e.error !== 'no-speech') {
                console.error('Speech recognition error:', e.error);
            }
        };
    }

    function toggleVoiceRecording() {
        if (!recognition) return;
        if (isRecording) {
            recognition.stop();
        } else {
            chatInput.value = '';
            recognition.start();
            isRecording = true;
            voiceBtn.classList.add('recording');
        }
    }

    // ─── Voice Output (Text-to-Speech) ───
    function speakText(text) {
        if (!voiceOutputEnabled && !autoRead) return;
        // Clean markdown for speech
        const clean = text
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/```[\s\S]*?```/g, ' code block ')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/^[#>•\-\d.]+\s?/gm, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = speechRate;

        // Find the selected voice
        const voices = speechSynthesis.getVoices();
        if (selectedVoice) {
            const found = voices.find(v => v.name === selectedVoice);
            if (found) utterance.voice = found;
        }

        // Animate AI Aura during video call
        utterance.onstart = () => {
            if (aiAura) aiAura.classList.add('active');
        };
        utterance.onend = () => {
            if (aiAura) aiAura.classList.remove('active');
            // Auto restart listening if in video call for continuous hands-free chat
            if (isVideoCallActive && !isRecording) toggleVoiceRecording();
        };
        utterance.onerror = () => {
            if (aiAura) aiAura.classList.remove('active');
        };

        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    }

    function loadVoices() {
        const voices = speechSynthesis.getVoices();
        voiceSelect.innerHTML = '';
        if (voices.length === 0) {
            voiceSelect.innerHTML = '<option value="">Default</option>';
            return;
        }
        voices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.name;
            opt.textContent = `${v.name} (${v.lang})`;
            if (v.name === selectedVoice) opt.selected = true;
            voiceSelect.appendChild(opt);
        });
    }

    // ─── Static Model List (100+ Models) ───
    const STATIC_MODELS = [
        // OpenAI Models
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', category: 'OpenAI' },
        { id: 'openai/gpt-4', name: 'GPT-4', category: 'OpenAI' },
        { id: 'openai/gpt-4o', name: 'GPT-4o', category: 'OpenAI' },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', category: 'OpenAI' },
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', category: 'OpenAI' },
        { id: 'openai/gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K', category: 'OpenAI' },
        { id: 'openai/o1-preview', name: 'O1 Preview', category: 'OpenAI' },
        { id: 'openai/o1-mini', name: 'O1 Mini', category: 'OpenAI' },
        { id: 'openai/chatgpt-4o-latest', name: 'ChatGPT-4o Latest', category: 'OpenAI' },

        // Anthropic Claude Models
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', category: 'Anthropic' },
        { id: 'anthropic/claude-3.5-sonnet:beta', name: 'Claude 3.5 Sonnet Beta', category: 'Anthropic' },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', category: 'Anthropic' },
        { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', category: 'Anthropic' },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', category: 'Anthropic' },
        { id: 'anthropic/claude-2.1', name: 'Claude 2.1', category: 'Anthropic' },
        { id: 'anthropic/claude-2', name: 'Claude 2', category: 'Anthropic' },
        { id: 'anthropic/claude-instant-1', name: 'Claude Instant', category: 'Anthropic' },

        // Meta Llama Models
        { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', category: 'Meta' },
        { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', category: 'Meta' },
        { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', category: 'Meta' },
        { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', category: 'Meta' },
        { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', category: 'Meta' },
        { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', category: 'Meta' },
        { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B', category: 'Meta' },
        { id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B', category: 'Meta' },
        { id: 'meta-llama/llama-2-13b-chat', name: 'Llama 2 13B', category: 'Meta' },
        { id: 'meta-llama/codellama-70b-instruct', name: 'Code Llama 70B', category: 'Meta' },
        { id: 'meta-llama/codellama-34b-instruct', name: 'Code Llama 34B', category: 'Meta' },

        // Mistral AI Models
        { id: 'mistralai/mistral-large', name: 'Mistral Large', category: 'Mistral' },
        { id: 'mistralai/mistral-medium', name: 'Mistral Medium', category: 'Mistral' },
        { id: 'mistralai/mistral-small', name: 'Mistral Small', category: 'Mistral' },
        { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', category: 'Mistral' },
        { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', category: 'Mistral' },
        { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', category: 'Mistral' },
        { id: 'mistralai/codestral-latest', name: 'Codestral', category: 'Mistral' },
        { id: 'mistralai/pixtral-12b', name: 'Pixtral 12B', category: 'Mistral' },
        { id: 'mistralai/ministral-8b', name: 'Ministral 8B', category: 'Mistral' },
        { id: 'mistralai/ministral-3b', name: 'Ministral 3B', category: 'Mistral' },

        // Google Models
        { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', category: 'Google' },
        { id: 'google/gemini-pro', name: 'Gemini Pro', category: 'Google' },
        { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', category: 'Google' },
        { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', category: 'Google' },
        { id: 'google/palm-2-chat-bison', name: 'PaLM 2 Chat', category: 'Google' },
        { id: 'google/palm-2-codechat-bison', name: 'PaLM 2 Code Chat', category: 'Google' },
        { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', category: 'Google' },
        { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', category: 'Google' },
        { id: 'google/gemma-7b-it', name: 'Gemma 7B', category: 'Google' },

        // Cohere Models
        { id: 'cohere/command-r-plus', name: 'Command R+', category: 'Cohere' },
        { id: 'cohere/command-r', name: 'Command R', category: 'Cohere' },
        { id: 'cohere/command', name: 'Command', category: 'Cohere' },
        { id: 'cohere/command-light', name: 'Command Light', category: 'Cohere' },
        { id: 'cohere/command-nightly', name: 'Command Nightly', category: 'Cohere' },

        // Perplexity Models
        { id: 'perplexity/llama-3.1-sonar-huge-128k-online', name: 'Sonar Huge 128K Online', category: 'Perplexity' },
        { id: 'perplexity/llama-3.1-sonar-large-128k-online', name: 'Sonar Large 128K Online', category: 'Perplexity' },
        { id: 'perplexity/llama-3.1-sonar-small-128k-online', name: 'Sonar Small 128K Online', category: 'Perplexity' },

        // DeepSeek Models
        { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', category: 'DeepSeek' },
        { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', category: 'DeepSeek' },
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', category: 'DeepSeek' },

        // Qwen Models
        { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', category: 'Qwen' },
        { id: 'qwen/qwen-2.5-7b-instruct', name: 'Qwen 2.5 7B', category: 'Qwen' },
        { id: 'qwen/qwen-2-72b-instruct', name: 'Qwen 2 72B', category: 'Qwen' },
        { id: 'qwen/qwen-2-7b-instruct', name: 'Qwen 2 7B', category: 'Qwen' },
        { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', category: 'Qwen' },
        { id: 'qwen/qwq-32b-preview', name: 'QwQ 32B Preview', category: 'Qwen' },
        { id: 'qwen/qwen-2-vl-7b-instruct', name: 'Qwen 2 VL 7B', category: 'Qwen' },

        // NVIDIA Models
        { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', category: 'NVIDIA' },
        { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B', category: 'NVIDIA' },

        // X.AI Models
        { id: 'x-ai/grok-beta', name: 'Grok Beta', category: 'X.AI' },
        { id: 'x-ai/grok-vision-beta', name: 'Grok Vision Beta', category: 'X.AI' },
        { id: 'x-ai/grok-2-1212', name: 'Grok 2', category: 'X.AI' },

        // AI21 Models
        { id: 'ai21/jamba-1-5-large', name: 'Jamba 1.5 Large', category: 'AI21' },
        { id: 'ai21/jamba-1-5-mini', name: 'Jamba 1.5 Mini', category: 'AI21' },
        { id: 'ai21/jamba-instruct', name: 'Jamba Instruct', category: 'AI21' },

        // 01.AI Models
        { id: '01-ai/yi-large', name: 'Yi Large', category: '01.AI' },
        { id: '01-ai/yi-large-turbo', name: 'Yi Large Turbo', category: '01.AI' },
        { id: '01-ai/yi-1.5-34b-chat', name: 'Yi 1.5 34B', category: '01.AI' },
        { id: '01-ai/yi-1.5-9b-chat', name: 'Yi 1.5 9B', category: '01.AI' },

        // Microsoft Models
        { id: 'microsoft/wizardlm-2-8x22b', name: 'WizardLM 2 8x22B', category: 'Microsoft' },
        { id: 'microsoft/wizardlm-2-7b', name: 'WizardLM 2 7B', category: 'Microsoft' },
        { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium 128K', category: 'Microsoft' },
        { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini 128K', category: 'Microsoft' },
        { id: 'microsoft/phi-3.5-mini-128k-instruct', name: 'Phi-3.5 Mini 128K', category: 'Microsoft' },

        // Databricks Models
        { id: 'databricks/dbrx-instruct', name: 'DBRX Instruct', category: 'Databricks' },

        // Nous Research Models
        { id: 'nousresearch/hermes-3-llama-3.1-405b', name: 'Hermes 3 405B', category: 'Nous Research' },
        { id: 'nousresearch/hermes-3-llama-3.1-70b', name: 'Hermes 3 70B', category: 'Nous Research' },
        { id: 'nousresearch/nous-capybara-34b', name: 'Nous Capybara 34B', category: 'Nous Research' },
        { id: 'nousresearch/nous-hermes-2-mixtral-8x7b-dpo', name: 'Hermes 2 Mixtral DPO', category: 'Nous Research' },

        // Cognitive Computations
        { id: 'cognitivecomputations/dolphin-mixtral-8x7b', name: 'Dolphin Mixtral 8x7B', category: 'Cognitive' },
        { id: 'cognitivecomputations/dolphin-mixtral-8x22b', name: 'Dolphin Mixtral 8x22B', category: 'Cognitive' },
        { id: 'cognitivecomputations/dolphin-llama-3-70b', name: 'Dolphin Llama 3 70B', category: 'Cognitive' },

        // Teknium Models
        { id: 'teknium/openhermes-2.5-mistral-7b', name: 'OpenHermes 2.5 Mistral', category: 'Teknium' },

        // Intel Models
        { id: 'intel/neural-chat-7b', name: 'Neural Chat 7B', category: 'Intel' },

        // Together AI Models
        { id: 'togethercomputer/stripedhyena-nous-7b', name: 'StripedHyena Nous 7B', category: 'Together' },

        // Phind Models
        { id: 'phind/phind-codellama-34b', name: 'Phind CodeLlama 34B', category: 'Phind' },

        // WizardLM Models
        { id: 'wizardlm/wizardlm-13b', name: 'WizardLM 13B', category: 'WizardLM' },

        // OpenChat Models
        { id: 'openchat/openchat-7b', name: 'OpenChat 7B', category: 'OpenChat' },
        { id: 'openchat/openchat-8b', name: 'OpenChat 8B', category: 'OpenChat' },

        // Pygmalion Models
        { id: 'pygmalionai/mythalion-13b', name: 'Mythalion 13B', category: 'Pygmalion' },

        // Undi95 Models
        { id: 'undi95/toppy-m-7b', name: 'Toppy M 7B', category: 'Undi95' },
        { id: 'undi95/remm-slerp-l2-13b', name: 'ReMM SLERP L2 13B', category: 'Undi95' },

        // Gryphe Models
        { id: 'gryphe/mythomax-l2-13b', name: 'MythoMax L2 13B', category: 'Gryphe' },
        { id: 'gryphe/mythomist-7b', name: 'MythoMist 7B', category: 'Gryphe' },

        // Sao10K Models
        { id: 'sao10k/fimbulvetr-11b-v2', name: 'Fimbulvetr 11B v2', category: 'Sao10K' },

        // Neversleep Models
        { id: 'neversleep/noromaid-mixtral-8x7b-instruct', name: 'Noromaid Mixtral 8x7B', category: 'Neversleep' },
        { id: 'neversleep/llama-3-lumimaid-70b', name: 'Lumimaid 70B', category: 'Neversleep' },

        // Inflection Models
        { id: 'inflection/inflection-3-pi', name: 'Inflection 3 Pi', category: 'Inflection' },
        { id: 'inflection/inflection-3-productivity', name: 'Inflection 3 Productivity', category: 'Inflection' },

        // Lizpreciatior Models
        { id: 'lizpreciatior/lzlv-70b-fp16-hf', name: 'LZLV 70B', category: 'Lizpreciatior' },

        // AllenAI Models
        { id: 'allenai/olmo-7b-instruct', name: 'OLMo 7B', category: 'AllenAI' },
        { id: 'allenai/olmo-2-1124-13b-instruct', name: 'OLMo 2 13B', category: 'AllenAI' },

        // Snowflake Models
        { id: 'snowflake/snowflake-arctic-instruct', name: 'Arctic Instruct', category: 'Snowflake' },

        // SambaNova Models
        { id: 'sao10k/samba-1.1-70b', name: 'Samba 1.1 70B', category: 'SambaNova' },
    ];

    // ─── Dynamic Model Fetching ───
    async function fetchFreeModels() {
        console.log('DEBUG: fetchFreeModels() called');
        const modelLoading = $('#modelLoading');
        console.log('DEBUG: modelLoading element:', modelLoading);
        console.log('DEBUG: modelSelect element:', modelSelect);

        // Add static models first, grouped by category
        const categories = [...new Set(STATIC_MODELS.map(m => m.category))];
        categories.forEach(category => {
            const group = document.createElement('optgroup');
            group.label = `📦 ${category}`;
            STATIC_MODELS.filter(m => m.category === category).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                group.appendChild(opt);
            });
            modelSelect.appendChild(group);
        });

        console.log('DEBUG: Static models added, total:', STATIC_MODELS.length);

        try {
            console.log('DEBUG: Fetching free models from API...');
            // Models endpoint does not require API key, removed Authorization to prevent 401 errors from breaking UI
            const res = await fetch('https://openrouter.ai/api/v1/models');
            console.log('DEBUG: API response status:', res.status);
            if (!res.ok) throw new Error('Failed to fetch models');
            const data = await res.json();
            console.log('DEBUG: Received models data, count:', data.data?.length);

            // Filter free models (prompt price = 0)
            const freeModels = data.data
                .filter(m => m.pricing && parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0)
                .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
                .slice(0, 100);

            console.log('DEBUG: Free models filtered, count:', freeModels.length);

            if (freeModels.length > 0) {
                const group = document.createElement('optgroup');
                group.label = '🆓 Free Models (Dynamic)';
                freeModels.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    // Clean up model name
                    const name = (m.name || m.id).replace(/ \(free\)/i, '');
                    opt.textContent = name;
                    group.appendChild(opt);
                });
                modelSelect.appendChild(group);
                console.log('DEBUG: Models added to dropdown, total options:', modelSelect.options.length);
            }

            if (modelLoading) modelLoading.style.display = 'none';
        } catch (err) {
            console.error('DEBUG: Error fetching models:', err);
            if (modelLoading) modelLoading.textContent = 'Models loaded';
        }
    }

    // ─── Background Particles ───
    function createParticles() {
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            const size = Math.random() * 4 + 2;
            const colors = ['#a855f7', '#06b6d4', '#8b5cf6', '#22d3ee', '#7c3aed'];
            particle.style.cssText = `
                width: ${size}px; height: ${size}px;
                left: ${Math.random() * 100}%;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                animation-duration: ${Math.random() * 15 + 10}s;
                animation-delay: ${Math.random() * 10}s;
            `;
            bgParticles.appendChild(particle);
        }
    }

    // ─── Emoji Picker ───
    function initEmojiPicker() {
        emojis.forEach(emoji => {
            const item = document.createElement('button');
            item.classList.add('emoji-item');
            item.textContent = emoji;
            item.addEventListener('click', () => {
                chatInput.value += emoji;
                chatInput.focus();
                toggleEmojiPicker(false);
                updateSendButton();
            });
            emojiGrid.appendChild(item);
        });
    }

    function toggleEmojiPicker(show) {
        emojiPicker.classList.toggle('visible', show !== undefined ? show : !emojiPicker.classList.contains('visible'));
    }

    // ─── Conversation Management ───
    function generateId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function createNewConversation() {
        const id = generateId();
        conversations[id] = { id, title: 'New Chat', messages: [], apiMessages: [], createdAt: Date.now() };
        activeConversationId = id;
        saveState();
        renderChatHistory();
        clearMessages();
        showWelcomeScreen(true);
        chatInput.focus();
    }

    function getActiveConversation() {
        if (!activeConversationId || !conversations[activeConversationId]) {
            createNewConversation();
        }
        return conversations[activeConversationId];
    }

    function switchConversation(id) {
        if (!conversations[id]) return;
        activeConversationId = id;
        saveState();
        renderChatHistory();
        renderMessages(conversations[id].messages);
        closeSidebar();
    }

    function deleteConversation(id, e) {
        e.stopPropagation();
        delete conversations[id];
        if (activeConversationId === id) {
            const keys = Object.keys(conversations);
            keys.length > 0 ? switchConversation(keys[keys.length - 1]) : createNewConversation();
        }
        saveState();
        renderChatHistory();
    }

    function clearAllConversations() {
        if (!confirm('Clear all chat history? This cannot be undone.')) return;
        conversations = {};
        localStorage.removeItem('nexus_conversations');
        localStorage.removeItem('nexus_active_id');
        createNewConversation();
    }

    function saveState() {
        localStorage.setItem('nexus_conversations', JSON.stringify(conversations));
        localStorage.setItem('nexus_active_id', activeConversationId);
    }

    // ─── Render Chat History ───
    function renderChatHistory() {
        chatHistory.innerHTML = '';
        const sorted = Object.values(conversations).sort((a, b) => b.createdAt - a.createdAt);
        if (sorted.length === 0) {
            chatHistory.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.8rem;text-align:center;">No conversations yet</div>';
            return;
        }
        sorted.forEach(conv => {
            const item = document.createElement('div');
            item.classList.add('chat-history-item');
            if (conv.id === activeConversationId) item.classList.add('active');
            item.innerHTML = `
                <svg class="item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                <span class="item-text">${escapeHtml(conv.title)}</span>
                <button class="delete-chat-btn" aria-label="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            `;
            item.addEventListener('click', () => switchConversation(conv.id));
            item.querySelector('.delete-chat-btn').addEventListener('click', (e) => deleteConversation(conv.id, e));
            chatHistory.appendChild(item);
        });
    }

    // ─── Render Messages ───
    function renderMessages(messages) {
        clearMessages();
        if (!messages || messages.length === 0) { showWelcomeScreen(true); return; }
        showWelcomeScreen(false);
        messages.forEach(msg => appendMessageDOM(msg.role, msg.content, msg.time, false));
        scrollToBottom();
    }

    function clearMessages() {
        chatMessages.querySelectorAll('.message').forEach(m => m.remove());
    }

    function showWelcomeScreen(show) {
        if (welcomeScreen) welcomeScreen.style.display = show ? 'flex' : 'none';
    }

    function appendMessageDOM(role, content, time, animate = true) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', role);
        if (!animate) msgDiv.style.animation = 'none';

        const avatarContent = role === 'bot'
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'
            : '👤';

        msgDiv.innerHTML = `
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-content">
                <div class="message-bubble">${formatMessage(content)}</div>
                <span class="message-time">${time}</span>
            </div>
        `;
        chatMessages.appendChild(msgDiv);
        if (animate) scrollToBottom();
    }

    // ─── Format Message ───
    function formatMessage(text) {
        let html = escapeHtml(text);
        html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent-start);padding-left:12px;margin:8px 0;color:var(--text-secondary);font-style:italic;">$1</blockquote>');
        html = html.replace(/^[•\-] (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ─── Sidebar Functions ───
    function openSidebar() {
        const sidebar = $('#sidebar');
        const sidebarOverlay = $('#sidebarOverlay');
        if (sidebar) sidebar.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.classList.add('visible');
    }

    function closeSidebar() {
        const sidebar = $('#sidebar');
        const sidebarOverlay = $('#sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
    }

    // ─── Textarea Auto-Resize ───
    function autoResizeTextarea() {
        const chatInput = $('#chatInput');
        if (chatInput) {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
        }
    }

    // ─── OpenRouter API Call ───
    async function callOpenRouterAPI(conv) {
        const model = modelSelect.value;
        const apiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...(conv.apiMessages || [])
        ];

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'Seylani AI Assistant'
            },
            body: JSON.stringify({
                model: model,
                messages: apiMessages,
                max_tokens: 2048,
                temperature: 0.7,
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error ${response.status}: ${err}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // ─── Send Message ───
    async function sendMessage(text) {
        let message = (text || chatInput.value).trim();
        if ((!message && pendingAttachments.length === 0) || isTyping) return;

        const conv = getActiveConversation();
        showWelcomeScreen(false);

        if (conv.messages.length === 0 && message) {
            conv.title = message.length > 35 ? message.slice(0, 35) + '...' : message;
        } else if (conv.messages.length === 0 && pendingAttachments.length > 0) {
            conv.title = "File Analysis";
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Build API Content Payload (supports vision + text)
        let apiContent = [];
        let uiContent = message;

        if (pendingAttachments.length > 0) {
            let filesText = "";
            let imageBlocks = [];
            let uiImagesHTML = "";

            pendingAttachments.forEach(att => {
                if (att.isImage) {
                    imageBlocks.push({ type: "image_url", image_url: { url: att.data } });
                    uiImagesHTML += `<img src="${att.data}" style="max-width: 200px; border-radius: 8px; margin-top: 5px; display: block;" alt="attachment">`;
                } else {
                    filesText += `\n\n--- Start of File: ${att.name} ---\n${att.data}\n--- End of File ---`;
                }
            });

            if (filesText) {
                message += filesText; // Append file text to prompt
            }

            if (imageBlocks.length > 0) {
                apiContent.push({ type: "text", text: message || "Analyze these images." });
                apiContent = apiContent.concat(imageBlocks);
                uiContent += uiImagesHTML;
            } else {
                apiContent = message;
            }
        } else {
            apiContent = message;
        }

        // Add user message to state
        conv.messages.push({ role: 'user', content: uiContent, time: timeStr });
        if (!conv.apiMessages) conv.apiMessages = [];
        conv.apiMessages.push({ role: 'user', content: apiContent });

        appendMessageDOM('user', uiContent, timeStr);

        chatInput.value = '';
        chatInput.style.height = 'auto';
        pendingAttachments = [];
        renderAttachmentPreview();
        updateSendButton();
        saveState();
        renderChatHistory();

        // Show typing
        showTyping(true);
        statusText.textContent = 'Thinking...';

        try {
            const response = await callOpenRouterAPI(conv);
            showTyping(false);
            statusText.textContent = 'Online — AI Powered';

            const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            conv.messages.push({ role: 'bot', content: response, time: botTime });
            conv.apiMessages.push({ role: 'assistant', content: response });

            // Keep API context manageable (last 20 messages)
            if (conv.apiMessages.length > 20) {
                conv.apiMessages = conv.apiMessages.slice(-20);
            }

            appendMessageDOM('bot', response, botTime);
            saveState();

            // Auto-read response aloud
            if (autoRead || voiceOutputEnabled) {
                speakText(response);
            }
        } catch (error) {
            showTyping(false);
            statusText.textContent = 'Online — AI Powered';
            const errMsg = `⚠️ Sorry, I encountered an error: ${error.message}\n\nPlease try again or switch to a different model.`;
            const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            conv.messages.push({ role: 'bot', content: errMsg, time: botTime });
            appendMessageDOM('bot', errMsg, botTime);
            saveState();
        }
    }

    // ─── Typing Indicator ───
    function showTyping(show) {
        isTyping = show;
        typingIndicator.classList.toggle('visible', show);
        if (show) scrollToBottom();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => { chatMessages.scrollTop = chatMessages.scrollHeight; });
    }

    function updateSendButton() {
        const hasInput = chatInput.value.trim().length > 0 || pendingAttachments.length > 0;
        sendBtn.classList.toggle('active', hasInput);
        sendBtn.disabled = !hasInput;
    }

    // ─── File Attachment Logic ───
    attachBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
    });

    const attachFolderBtn = $('#attachFolderBtn');
    if (attachFolderBtn) {
        attachFolderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            folderInput.click();
        });
    }

    fileInput.addEventListener('change', handleFiles);
    folderInput.addEventListener('change', handleFiles);

    function handleFiles(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
            const isImage = file.type.startsWith('image/');
            const reader = new FileReader();
            reader.onload = (evt) => {
                pendingAttachments.push({
                    name: file.name,
                    type: file.type,
                    data: evt.target.result,
                    isImage: isImage
                });
                renderAttachmentPreview();
                updateSendButton();
            };

            if (isImage) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file); // assuming text readable like code, txt, log
            }
        });
        e.target.value = ''; // reset
    }

    function renderAttachmentPreview() {
        attachmentsPreview.innerHTML = '';
        pendingAttachments.forEach((att, index) => {
            const item = document.createElement('div');
            item.className = 'attachment-item';

            if (att.isImage) {
                item.innerHTML = `<img src="${att.data}" alt="preview">`;
            } else {
                item.innerHTML = `<span class="file-icon">📄</span><span style="position:absolute; bottom:2px; font-size:8px; color:#aaa; overflow:hidden; white-space:nowrap; max-width:100%; text-overflow:ellipsis; padding:0 2px;">${att.name}</span>`;
            }

            const rmBtn = document.createElement('button');
            rmBtn.className = 'attachment-remove';
            rmBtn.innerHTML = '×';
            rmBtn.onclick = () => {
                pendingAttachments.splice(index, 1);
                renderAttachmentPreview();
                updateSendButton();
            };
            item.appendChild(rmBtn);
            attachmentsPreview.appendChild(item);
        });
    }

    // ─── Event Listeners ───
    sendBtn.addEventListener('click', () => sendMessage());

    chatInput.addEventListener('input', () => { updateSendButton(); autoResizeTextarea(); });
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    menuBtn.addEventListener('click', openSidebar);
    sidebarCloseBtn.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);
    newChatBtn.addEventListener('click', createNewConversation);
    clearAllBtn.addEventListener('click', clearAllConversations);

    emojiBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleEmojiPicker(); });
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) toggleEmojiPicker(false);
    });

    suggestionChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (chip) { const msg = chip.getAttribute('data-message'); if (msg) sendMessage(msg); }
    });

    // Voice input
    voiceBtn.addEventListener('click', toggleVoiceRecording);

    // Voice output toggle
    voiceOutputToggle.addEventListener('click', () => {
        voiceOutputEnabled = !voiceOutputEnabled;
        voiceOutputToggle.classList.toggle('voice-active', voiceOutputEnabled);
        localStorage.setItem('nexus_voice_output', JSON.stringify(voiceOutputEnabled));
        if (!voiceOutputEnabled) speechSynthesis.cancel();
    });

    // Voice settings modal
    if (settingsBtn) settingsBtn.addEventListener('click', () => { voiceModal.classList.add('visible'); closeSidebar(); });
    voiceModalClose.addEventListener('click', () => voiceModal.classList.remove('visible'));
    voiceModal.addEventListener('click', (e) => { if (e.target === voiceModal) voiceModal.classList.remove('visible'); });

    voiceSelect.addEventListener('change', () => {
        selectedVoice = voiceSelect.value;
        localStorage.setItem('nexus_voice', selectedVoice);
    });

    speechRateInput.addEventListener('input', () => {
        speechRate = parseFloat(speechRateInput.value);
        rateValue.textContent = speechRate.toFixed(1) + 'x';
        localStorage.setItem('nexus_speech_rate', speechRate);
    });

    autoReadToggle.addEventListener('change', () => {
        autoRead = autoReadToggle.checked;
        localStorage.setItem('nexus_auto_read', JSON.stringify(autoRead));
    });

    // API Key settings
    if (apiKeyInput) {
        apiKeyInput.value = localStorage.getItem('nexus_api_key') || '';
        apiKeyInput.addEventListener('input', () => {
            const val = apiKeyInput.value.trim();
            if (val) {
                localStorage.setItem('nexus_api_key', val);
                API_KEY = val;
            } else {
                localStorage.removeItem('nexus_api_key');
                API_KEY = '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';
            }
        });
    }

    // Model change
    modelSelect.addEventListener('change', () => {
        const selected = modelSelect.options[modelSelect.selectedIndex].text;
        statusText.textContent = `Online — ${selected}`;
    });

    // Theme toggle
    themeToggleBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('nexus_theme', currentTheme);
        updateThemeIcon();
    });

    function updateThemeIcon() {
        if (!themeIcon) return;
        if (currentTheme === 'light') {
            themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
        } else {
            themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
        }
    }

    // ─── Video Call Logic ───
    async function startVideoCall() {
        try {
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: cameraMode },
                audio: false // audio handled by Web Speech API separately
            });
            localVideo.srcObject = currentStream;
            videoOverlay.classList.add('visible');
            isVideoCallActive = true;
            localVideo.classList.toggle('mirror', cameraMode === 'user');
            if (recognition && !isRecording) toggleVoiceRecording(); // auto start listening
            callMicBtn.classList.toggle('active', isRecording);
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Camera access denied or unavailable.');
        }
    }

    function stopVideoCall() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        localVideo.srcObject = null;
        videoOverlay.classList.remove('visible');
        isVideoCallActive = false;
        if (isRecording) toggleVoiceRecording(); // stop listening
    }

    async function switchCamera() {
        if (!isVideoCallActive) return;
        cameraMode = cameraMode === 'user' ? 'environment' : 'user';
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        await startVideoCall();
    }

    async function shareScreen() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
            currentStream = screenStream;
            localVideo.srcObject = currentStream;
            localVideo.classList.remove('mirror'); // don't mirror screen

            // Listen for stop sharing from browser UI
            screenStream.getVideoTracks()[0].onended = () => {
                startVideoCall(); // fallback to webcam
            };
        } catch (err) {
            console.error('Error sharing screen:', err);
        }
    }

    // Video Call Event Listeners
    startCallBtn.addEventListener('click', startVideoCall);
    endCallBtn.addEventListener('click', stopVideoCall);
    switchCameraBtn.addEventListener('click', switchCamera);
    screenShareBtn.addEventListener('click', shareScreen);

    callMicBtn.addEventListener('click', () => {
        toggleVoiceRecording();
        callMicBtn.classList.toggle('active', isRecording);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeSidebar(); toggleEmojiPicker(false); voiceModal.classList.remove('visible'); }
    });

    // ─── Initialize ───
    function init() {
        console.log('=== DEBUG: init() started ===');
        console.log('DEBUG: DOM elements check:', {
            chatMessages: !!chatMessages,
            chatInput: !!chatInput,
            sendBtn: !!sendBtn,
            modelSelect: !!modelSelect,
            menuBtn: !!menuBtn,
            sidebar: !!sidebar
        });
        createParticles();
        initEmojiPicker();
        initVoiceRecognition();
        console.log('DEBUG: About to call fetchFreeModels()');
        fetchFreeModels();

        // Restore theme
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeIcon();

        // Load voices
        loadVoices();
        speechSynthesis.addEventListener('voiceschanged', loadVoices);

        // Restore settings
        speechRateInput.value = speechRate;
        rateValue.textContent = speechRate.toFixed(1) + 'x';
        autoReadToggle.checked = autoRead;
        if (voiceOutputEnabled) voiceOutputToggle.classList.add('voice-active');

        // Load conversations
        if (activeConversationId && conversations[activeConversationId]) {
            renderMessages(conversations[activeConversationId].messages);
        } else {
            createNewConversation();
        }
        renderChatHistory();
        chatInput.focus();

        // Show current model
        const selected = modelSelect.options[modelSelect.selectedIndex].text;
        statusText.textContent = `Online — ${selected}`;
    }

    init();
})();
