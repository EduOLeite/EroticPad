// Configuração Supabase
const SUPABASE_URL = "https://xkggqzzzuvrcpwtrbatm.supabase.co";
const SUPABASE_KEY = "sb_publishable_TtSVvv-5iVjARmijuAdhzg_8SYxuDnT";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let historiaAtual = "";
let todasHistorias = [];
let leitorAtual = null;
let perfilLeitor = null;
let modoAuth = 'login'; // 'login', 'register', 'forgot'
let planoSelecionado = 'vip30';
let primeiroCapituloCarregado = null;
let abaBibliotecaAtual = 'lendo';

// Chave PIX para pagamentos manuais sem taxa
const MINHA_CHAVE_PIX = "69992752883";

// -------------------------------------------------------------
// INICIALIZAÇÃO E FLUXO DE REDEFINIÇÃO DE SENHA
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    carregarHistorias();
    
    // Escuta em tempo real mudanças de autenticação (Login, Logout, Token)
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            abrirModalResetSenha();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            leitorAtual = session?.user || null;
            if (leitorAtual) await carregarPerfilLeitor(leitorAtual.id);
            atualizarNavbarUser();
        } else if (event === 'SIGNED_OUT') {
            leitorAtual = null;
            perfilLeitor = null;
            atualizarNavbarUser();
        }
    });

    // Checa se o link do e-mail veio com token de recuperação na URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('type') === 'recovery') {
        abrirModalResetSenha();
    } else {
        await verificarSessaoLeitor();
    }

    // Fechar dropdown de perfil ao clicar fora
    document.addEventListener('click', (e) => {
        const container = document.getElementById('dropdown-container');
        if (container && !container.contains(e.target)) {
            fecharDropdown();
        }
    });
});

function abrirModalResetSenha() {
    const modalReset = document.getElementById('modal-reset-password');
    if (modalReset) {
        modalReset.classList.remove('hidden');
        const errElem = document.getElementById('reset-error-msg');
        if (errElem) errElem.style.display = 'none';
    }
}

async function salvarNovaSenha() {
    const newPassword = document.getElementById('new-password-input').value;
    const errElem = document.getElementById('reset-error-msg');
    if (errElem) errElem.style.display = 'none';

    if (!newPassword || newPassword.length < 6) {
        if (errElem) {
            errElem.innerText = "A senha precisa ter no mínimo 6 caracteres!";
            errElem.style.display = 'block';
        } else {
            alert("A senha precisa ter no mínimo 6 caracteres!");
        }
        return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
        if (errElem) {
            errElem.innerText = "Erro ao atualizar senha: " + error.message;
            errElem.style.display = 'block';
        } else {
            alert("Erro ao atualizar senha: " + error.message);
        }
    } else {
        alert("🎉 Senha alterada com sucesso! Faça login com a sua nova senha.");
        await supabaseClient.auth.signOut();
        document.getElementById('modal-reset-password').classList.add('hidden');
        window.history.replaceState({}, document.title, window.location.pathname);
        abrirModalAuth();
        alternarAbaAuth('login');
    }
}

// -------------------------------------------------------------
// SESSÃO E AUTENTICAÇÃO
// -------------------------------------------------------------

async function verificarSessaoLeitor() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        leitorAtual = session.user;
        await carregarPerfilLeitor(leitorAtual.id);
    } else {
        leitorAtual = null;
        perfilLeitor = null;
    }
    atualizarNavbarUser();
}

async function carregarPerfilLeitor(userId) {
    const { data } = await supabaseClient
        .from('perfis_leitores')
        .select('*')
        .eq('id', userId)
        .single();

    if (data) {
        perfilLeitor = data;
    }
}

function checarSeEhVip() {
    if (!perfilLeitor) return false;
    if (perfilLeitor.eh_vip) return true;

    if (perfilLeitor.subscription_until) {
        const dataExpiracao = new Date(perfilLeitor.subscription_until);
        const agora = new Date();
        return dataExpiracao > agora;
    }

    return false;
}

function abrirModalAuth() {
    alternarAbaAuth('login');
    document.getElementById('modal-auth').classList.remove('hidden');
}

function fecharModalAuth() {
    document.getElementById('modal-auth').classList.add('hidden');
}

function alternarAbaAuth(modo) {
    modoAuth = modo;
    const errMsg = document.getElementById('auth-error-msg');
    if (errMsg) errMsg.style.display = 'none';

    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const groupPassword = document.getElementById('group-password');
    const btnAction = document.getElementById('btn-auth-action');
    const linkForgot = document.getElementById('link-forgot-password');
    const linkBackLogin = document.getElementById('link-back-login');

    if (modo === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        groupPassword.style.display = 'block';
        btnAction.innerText = 'Entrar';
        linkForgot.classList.remove('hidden');
        linkBackLogin.classList.add('hidden');
    } else if (modo === 'register') {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        groupPassword.style.display = 'block';
        btnAction.innerText = 'Criar Conta';
        linkForgot.classList.add('hidden');
        linkBackLogin.classList.add('hidden');
    } else if (modo === 'forgot') {
        tabLogin.classList.remove('active');
        tabRegister.classList.remove('active');
        groupPassword.style.display = 'none';
        btnAction.innerText = 'Enviar E-mail de Recuperação';
        linkForgot.classList.add('hidden');
        linkBackLogin.classList.remove('hidden');
    }
}

async function executarAuthLeitor() {
    const email = document.getElementById('reader-email').value.trim();
    const password = document.getElementById('reader-password').value;
    const errElem = document.getElementById('auth-error-msg');
    errElem.style.display = 'none';

    if (!email) {
        errElem.innerText = "Informe o e-mail!";
        errElem.style.display = 'block';
        return;
    }

    if (modoAuth === 'login') {
        if (!password) {
            errElem.innerText = "Digite sua senha!";
            errElem.style.display = 'block';
            return;
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            errElem.innerText = "❌ E-mail ou senha inválidos!";
            errElem.style.display = 'block';
        } else {
            fecharModalAuth();
            await verificarSessaoLeitor();
        }

    } else if (modoAuth === 'register') {
        if (!password || password.length < 6) {
            errElem.innerText = "A senha deve ter pelo menos 6 caracteres!";
            errElem.style.display = 'block';
            return;
        }

        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        
        if (error) {
            errElem.innerText = "Erro ao cadastrar: " + error.message;
            errElem.style.display = 'block';
        } else {
            alert("✨ Conta criada com sucesso! Verifique seu e-mail para confirmar a conta ou faça login.");
            alternarAbaAuth('login');
        }

    } else if (modoAuth === 'forgot') {
        const redirectToUrl = window.location.origin + window.location.pathname;

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: redirectToUrl
        });

        if (error) {
            errElem.innerText = "Erro ao solicitar recuperação: " + error.message;
            errElem.style.display = 'block';
        } else {
            alert("📧 Enviamos um e-mail com o link para redefinir sua senha!");
            alternarAbaAuth('login');
        }
    }
}

async function fazerLogoutLeitor(e) {
    if (e) e.stopPropagation();
    try {
        fecharDropdown();
        leitorAtual = null;
        perfilLeitor = null;

        const { error } = await supabaseClient.auth.signOut();
        if (error) console.warn("Aviso ao deslogar no Supabase:", error.message);

        atualizarNavbarUser();

        const profileView = document.getElementById('view-profile');
        if (profileView && !profileView.classList.contains('hidden')) {
            mostrarHome();
        }
    } catch (erro) {
        console.error("Erro no logout:", erro);
        alert("Erro ao sair da conta.");
    }
}

// -------------------------------------------------------------
// NAVBAR & PERFIL
// -------------------------------------------------------------

function atualizarNavbarUser() {
    const navArea = document.getElementById('nav-user-area');
    if (!navArea) return;
    
    if (leitorAtual) {
        const ehVip = checarSeEhVip();
        const badgeClass = ehVip ? 'badge-vip' : 'badge-free';
        const badgeText = ehVip ? 'VIP' : 'GRÁTIS';
        
        const nomeExibicao = (perfilLeitor && perfilLeitor.nome) ? perfilLeitor.nome : leitorAtual.email.split('@')[0];
        const inicial = nomeExibicao.charAt(0).toUpperCase();

        navArea.innerHTML = `
            ${!ehVip ? '<button class="btn-vip-nav" onclick="abrirModalVIP()">Seja VIP 🔥</button>' : ''}
            
            <div class="user-dropdown-container" id="dropdown-container">
                <div class="user-profile-btn" onclick="toggleDropdown(event)">
                    <div class="user-avatar">${inicial}</div>
                    <span class="user-name">${nomeExibicao}</span>
                    <span style="font-size:0.7rem; color:#aaa;">▾</span>
                </div>

                <div id="user-dropdown" class="dropdown-menu hidden">
                    <button class="dropdown-item" onclick="abrirPerfil()">
                        <span>👤</span>
                        <span>Meu Perfil</span>
                        <span class="user-badge ${badgeClass}">${badgeText}</span>
                    </button>
                    <button class="dropdown-item" onclick="abrirBiblioteca()">
                        <span>📚</span>
                        <span>Minha Biblioteca</span>
                    </button>
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item" onclick="fazerLogoutLeitor(event)" style="color:#ff3b69;">
                        <span>🚪</span>
                        <span>Sair</span>
                    </button>
                </div>
            </div>
        `;
    } else {
        navArea.innerHTML = `
            <button id="btn-open-auth" class="btn-back" style="margin:0;" onclick="abrirModalAuth()">Entrar / Cadastrar</button>
            <button class="btn-vip-nav" onclick="abrirModalVIP()">Seja VIP 🔥</button>
        `;
    }
}

function toggleDropdown(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('user-dropdown');
    if (menu) menu.classList.toggle('hidden');
}

function fecharDropdown() {
    const menu = document.getElementById('user-dropdown');
    if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
}

function abrirPerfil() {
    fecharDropdown();
    
    if (!leitorAtual) {
        alert("🔒 Faça login para ver seu perfil.");
        abrirModalAuth();
        return;
    }

    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-profile').classList.remove('hidden');

    const nomeExibicao = perfilLeitor && perfilLeitor.nome ? perfilLeitor.nome : leitorAtual.email.split('@')[0];
    const inicial = nomeExibicao.charAt(0).toUpperCase();
    const ehVip = checarSeEhVip();

    document.getElementById('profile-avatar-large').innerText = inicial;
    document.getElementById('profile-display-name').innerText = nomeExibicao;
    document.getElementById('profile-email').innerText = leitorAtual.email;
    document.getElementById('profile-input-name').value = perfilLeitor && perfilLeitor.nome ? perfilLeitor.nome : '';

    const badgeContainer = document.getElementById('profile-badge-container');
    badgeContainer.innerHTML = ehVip 
        ? `<span class="user-badge badge-vip">VIP 🔥</span>` 
        : `<span class="user-badge badge-free">GRÁTIS</span>`;

    const subBox = document.getElementById('profile-subscription-box');
    if (ehVip) {
        let textExpiracao = "Assinatura Ilimitada";
        if (perfilLeitor && perfilLeitor.subscription_until) {
            const dataFim = new Date(perfilLeitor.subscription_until).toLocaleDateString('pt-BR');
            textExpiracao = `Válida até ${dataFim}`;
        }

        subBox.className = "subscription-box sub-vip-box";
        subBox.innerHTML = `
            <div>
                <h4 style="color: #ff3b69; margin: 0 0 6px 0;">Sua Assinatura VIP está Ativa! 🔥</h4>
                <p style="font-size: 0.9rem; color: #ccc; margin: 0;">${textExpiracao}</p>
            </div>
        `;
    } else {
        subBox.className = "subscription-box";
        subBox.innerHTML = `
            <div class="sub-free-box">
                <div>
                    <h4 style="margin: 0 0 6px 0;">Plano Gratuito</h4>
                    <p style="font-size: 0.85rem; color: #aaa; margin: 0;">Assine o VIP para liberar todos os capítulos bloqueados imediatamente!</p>
                </div>
                <button class="btn-vip" onclick="abrirModalVIP()" style="width: auto; padding: 8px 18px; font-size: 0.9rem;">Virar VIP Agora 🔥</button>
            </div>
        `;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function salvarPerfilLeitor(event) {
    event.preventDefault();
    if (!leitorAtual) return;

    const novoNome = document.getElementById('profile-input-name').value.trim();

    if (!novoNome) {
        alert("Por favor, informe um nome válido!");
        return;
    }

    const { error } = await supabaseClient
        .from('perfis_leitores')
        .update({ nome: novoNome })
        .eq('id', leitorAtual.id);

    if (error) {
        alert("Erro ao atualizar perfil: " + error.message);
    } else {
        alert("✨ Perfil atualizado com sucesso!");
        await carregarPerfilLeitor(leitorAtual.id);
        atualizarNavbarUser();
        abrirPerfil();
    }
}

// -------------------------------------------------------------
// MODAL VIP & PIX
// -------------------------------------------------------------

function abrirModalVIP() {
    if (!leitorAtual) {
        alert("🔒 Faça login para assinar o VIP e liberar o acesso!");
        abrirModalAuth();
        return;
    }
    document.getElementById('modal-vip').classList.remove('hidden');
}

function fecharModalVIP() {
    document.getElementById('modal-vip').classList.add('hidden');
}

function selecionarPlano(planoId, elemento) {
    planoSelecionado = planoId;

    document.querySelectorAll(".plan-card").forEach(card => {
        card.classList.remove("selected");
    });

    elemento.classList.add("selected");
}

function copiarPix() {
    navigator.clipboard.writeText(MINHA_CHAVE_PIX);
    alert("📋 Chave Pix copiada com sucesso! Cole no aplicativo do seu banco.");
}

function confirmarPagamentoPix() {
    alert("✨ Obrigado! Assim que confirmarmos o seu Pix, seu acesso VIP será liberado!");
    fecharModalVIP();
}

// -------------------------------------------------------------
// HISTÓRIAS & LEITURA
// -------------------------------------------------------------

function mostrarHome() {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-home').classList.remove('hidden');

    carregarHistorias();
}

function abrirHistoria(historia) {
    historiaAtual = historia.titulo;
    
    // ... (o código que já estava aí preenchendo a capa, título, sinopse, etc) ...

    // Coloque ela aqui no final:
    verificarStatusAtualBiblioteca(historia.titulo);

    
    const capaImg = historia.capa_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=500&q=80';
    document.getElementById('detail-cover').src = capaImg;
    document.getElementById('detail-title').innerText = historia.titulo;
    document.getElementById('detail-author').innerText = `Por ${historia.autor}`;
    document.getElementById('detail-category').innerText = historia.categoria;
    document.getElementById('detail-synopsis').innerText = historia.sinopse;

    alternarAbaDetalhes('synopsis');

    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-details').classList.remove('hidden');

    carregarCapitulosDaHistoria(historia.titulo);
}

function alternarAbaDetalhes(aba) {
    const btnSyn = document.getElementById('tab-btn-synopsis');
    const btnCap = document.getElementById('tab-btn-chapters');
    const contentSyn = document.getElementById('tab-content-synopsis');
    const contentCap = document.getElementById('tab-content-chapters');

    if (aba === 'synopsis') {
        btnSyn.classList.add('active');
        btnCap.classList.remove('active');
        contentSyn.classList.remove('hidden');
        contentCap.classList.add('hidden');
    } else {
        btnCap.classList.add('active');
        btnSyn.classList.remove('active');
        contentCap.classList.remove('hidden');
        contentSyn.classList.add('hidden');
    }
}

function voltarParaDetalhes() {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-details').classList.remove('hidden');
}

async function carregarHistorias() {
    const container = document.getElementById('stories-container');
    if (!container) return;
    
    container.innerHTML = "<p style='color: var(--text-secondary);'>Carregando histórias...</p>";

    const { data, error } = await supabaseClient
        .from('historias')
        .select('*')
        .order('id', { ascending: false });

    if (error || !data || data.length === 0) {
        container.innerHTML = "<p style='color: var(--text-secondary);'>Nenhuma história cadastrada ainda.</p>";
        return;
    }

    todasHistorias = data;
    renderizarCardsHistorias(todasHistorias);
}

function renderizarCardsHistorias(lista) {
    const container = document.getElementById('stories-container');
    container.innerHTML = "";

    lista.forEach(historia => {
        const capaImg = historia.capa_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=500&q=80';
        
        const card = document.createElement('div');
        card.className = 'story-card';
        card.onclick = () => abrirHistoria(historia);

        card.innerHTML = `
            <div class="card-cover" style="background-image: url('${capaImg}');">
                <span class="tag">${historia.categoria}</span>
            </div>
            <div class="card-info">
                <h3>${historia.titulo}</h3>
                <p class="author">Por ${historia.autor}</p>
                <div class="card-footer">
                    <span>📖 Capítulos</span>
                    <span class="free-badge">Capítulos 1 e 2 Grátis</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function filtrarCategoria(categoria) {
    document.querySelectorAll('.categories-bar .chip').forEach(btn => {
        if (btn.innerText === categoria) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (categoria === 'Todos') {
        renderizarCardsHistorias(todasHistorias);
    } else {
        const filtradas = todasHistorias.filter(h => h.categoria === categoria);
        renderizarCardsHistorias(filtradas);
    }
}

async function carregarCapitulosDaHistoria(tituloHistoria) {
    const listaContainer = document.querySelector('.chapters-list');
    listaContainer.innerHTML = "<p style='color: var(--text-secondary);'>Carregando capítulos...</p>";

    const { data: capitulos, error } = await supabaseClient
        .from('capitulos')
        .select('*')
        .order('capitulo_numero', { ascending: true })
        .eq('historia_titulo', tituloHistoria);

    if (error || !capitulos || capitulos.length === 0) {
        listaContainer.innerHTML = "<p style='color: var(--text-secondary);'>Nenum capítulo publicado ainda para esta história.</p>";
        primeiroCapituloCarregado = null;
        return;
    }

    primeiroCapituloCarregado = capitulos[0];
    listaContainer.innerHTML = "";

    capitulos.forEach(cap => {
        const ehBloqueado = cap.capitulo_numero > 2;

        const item = document.createElement('div');
        item.className = `chapter-item ${ehBloqueado ? 'locked' : ''}`;
        item.onclick = () => abrirLeitorCapitulo(cap);

        item.innerHTML = `
            <div>
                <strong>Capítulo ${cap.capitulo_numero}</strong>
                <p>${cap.capitulo_titulo}</p>
            </div>
            <span class="status ${ehBloqueado ? 'vip' : 'free'}">
                ${ehBloqueado ? '🔒 Exclusivo VIP' : 'Gratuito'}
            </span>
        `;
        listaContainer.appendChild(item);
    });
}

function iniciarLeituraPrimeiroCap() {
    if (primeiroCapituloCarregado) {
        abrirLeitorCapitulo(primeiroCapituloCarregado);
    } else {
        alert("Ainda não há capítulos para este livro!");
    }
}

function abrirLeitorCapitulo(capitulo) {
    if (!capitulo) {
        alert("Erro: Dados do capítulo não encontrados.");
        return;
    }

    // 1. Esconde todas as telas
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

    // 2. Exibe o leitor
    const readerView = document.getElementById('view-reader');
    if (readerView) {
        readerView.classList.remove('hidden');
    } else {
        alert("⚠️ Não foi encontrada a tag id='view-reader' no seu HTML!");
        return;
    }

    // 3. Preenche o título e conteúdo
    const titleElem = document.getElementById('reader-chapter-title');
    const textElem = document.getElementById('reader-text');
    const paywallElem = document.getElementById('paywall');

    if (titleElem) titleElem.innerText = `Capítulo ${capitulo.capitulo_numero}: ${capitulo.capitulo_titulo || ''}`;

    let conteudos = capitulo.conteudo || "";
    let paragrafos = conteudos
        .split(/\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (paragrafos.length > 0 && paragrafos[0].toLowerCase().startsWith("capítulo")) {
        paragrafos.shift();
    }

    const ehVip = checarSeEhVip();
    const ehCapituloBloqueado = capitulo.capitulo_numero > 2;

    if (textElem) {
        if (ehCapituloBloqueado && !ehVip) {
            const previa = paragrafos.slice(0, 2).map(p => `<p>${p}</p>`).join('');
            textElem.innerHTML = previa;
            if (paywallElem) paywallElem.classList.remove('hidden');
        } else {
            textElem.innerHTML = paragrafos.map(p => `<p>${p}</p>`).join('');
            if (paywallElem) paywallElem.classList.add('hidden');
            
            // Salva o histórico na biblioteca_leitor
            salvarProgressoBiblioteca(capitulo.historia_titulo, capitulo.capitulo_numero);
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------
// NAVEGAÇÃO DA BIBLIOTECA
// -------------------------------------------------------------

function abrirBiblioteca() {
    fecharDropdown();
    
    if (!leitorAtual) {
        alert("🔒 Faça login para acessar sua biblioteca!");
        abrirModalAuth();
        return;
    }

    // Esconde todas as visões ativas
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

    // Exibe a biblioteca
    const libraryView = document.getElementById('view-library');
    if (libraryView) {
        libraryView.classList.remove('hidden');
        carregarBiblioteca(abaBibliotecaAtual);
    } else {
        alert("⚠️ Erro: Não foi encontrada a tag <section id='view-library'> no seu index.html!");
    }
}

function filtrarBiblioteca(status) {
    abaBibliotecaAtual = status;

    document.querySelectorAll('.tabs-biblioteca .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const btnAtivo = document.getElementById(`tab-bib-${status}`);
    if (btnAtivo) btnAtivo.classList.add('active');

    carregarBiblioteca(status);
}

async function carregarBiblioteca(status) {
    const grid = document.getElementById('grid-livros');
    if (!grid) return;

    if (!leitorAtual) {
        grid.innerHTML = "<p style='color: var(--text-secondary);'>Faça login para ver seus livros.</p>";
        return;
    }

    grid.innerHTML = "<p style='color: var(--text-secondary);'>Carregando livros...</p>";

    const { data: itens, error } = await supabaseClient
        .from('biblioteca_leitor')
        .select('*')
        .eq('user_id', leitorAtual.id)
        .eq('status', status);

    if (error || !itens || itens.length === 0) {
        grid.innerHTML = `<p style='color: var(--text-secondary);'>Nenhum livro em "${status.replace('_', ' ')}".</p>`;
        return;
    }

    grid.innerHTML = "";

    for (const item of itens) {
        const historia = (typeof todasHistorias !== 'undefined') 
            ? todasHistorias.find(h => h.titulo === item.historia_titulo) 
            : null;

        const capa = item.capa_url || historia?.capa_url || 'https://via.placeholder.com/200x260?text=Sem+Capa';
        const autor = item.autor || historia?.autor || 'Autor desconhecido';
        const numCap = item.ultimo_capitulo_numero || item.capitulo_numero || 1;

        const card = document.createElement('div');
        card.className = 'card-livro';

        card.innerHTML = `
            <img src="${capa}" alt="${item.historia_titulo}">
            <h3>${item.historia_titulo}</h3>
            <p>Por ${autor}</p>
            <p style="color: var(--accent-red); font-weight: 600; margin-top: 4px;">Parado no Cap. ${numCap}</p>
            
            <div class="barra-progresso">
                <div class="progresso-fill" style="width: ${item.progresso_porcentagem || 0}%;"></div>
            </div>

            <button class="btn-continuar" onclick="continuarLeituraBiblioteca('${item.historia_titulo}', ${numCap})">
                📖 Continuar Lendo
            </button>
        `;

        grid.appendChild(card);
    }
}

async function salvarProgressoBiblioteca(tituloHistoria, numCapitulo) {
    if (!leitorAtual) return;

    try {
        const { data: existente } = await supabaseClient
            .from('biblioteca_leitor')
            .select('*')
            .eq('user_id', leitorAtual.id)
            .eq('historia_titulo', tituloHistoria)
            .maybeSingle();

        if (existente) {
            await supabaseClient
                .from('biblioteca_leitor')
                .update({
                    ultimo_capitulo_numero: numCapitulo,
                    updated_at: new Date()
                })
                .eq('id', existente.id);
        } else {
            await supabaseClient
                .from('biblioteca_leitor')
                .insert([{
                    user_id: leitorAtual.id,
                    historia_titulo: tituloHistoria,
                    ultimo_capitulo_numero: numCapitulo,
                    status: 'lendo'
                }]);
        }
    } catch (e) {
        console.warn("Aviso ao salvar progresso na biblioteca:", e);
    }
}

async function continuarLeituraBiblioteca(tituloHistoria, numCapitulo) {
    const { data: cap } = await supabaseClient
        .from('capitulos')
        .select('*')
        .eq('historia_titulo', tituloHistoria)
        .eq('capitulo_numero', numCapitulo)
        .maybeSingle();

    if (cap) {
        abrirLeitorCapitulo(cap);
    } else {
        alert("Não foi possível carregar este capítulo.");
    }
}

// Verifica e destaca o botão do status atual do livro
async function verificarStatusAtualBiblioteca(tituloHistoria) {
    document.querySelectorAll('.btn-action-status').forEach(btn => btn.classList.remove('active-status'));

    if (!leitorAtual) return;

    const { data: item } = await supabaseClient
        .from('biblioteca_leitor')
        .select('status')
        .eq('user_id', leitorAtual.id)
        .eq('historia_titulo', tituloHistoria)
        .maybeSingle();

    if (item && item.status) {
        const btnAtivo = document.getElementById(`btn-status-${item.status}`);
        if (btnAtivo) btnAtivo.classList.add('active-status');
    }
}

// Salva, altera ou remove o status no Supabase ao clicar
async function alterarStatusBiblioteca(novoStatus) {
    if (!leitorAtual) {
        alert("🔒 Faça login para salvar livros na sua biblioteca!");
        abrirModalAuth();
        return;
    }

    if (!historiaAtual) return;

    const btnAlvo = document.getElementById(`btn-status-${novoStatus}`);
    const jaEstavaAtivo = btnAlvo?.classList.contains('active-status');

    try {
        if (jaEstavaAtivo) {
            await supabaseClient
                .from('biblioteca_leitor')
                .delete()
                .eq('user_id', leitorAtual.id)
                .eq('historia_titulo', historiaAtual);

            btnAlvo.classList.remove('active-status');
        } else {
            const { data: existente } = await supabaseClient
                .from('biblioteca_leitor')
                .select('*')
                .eq('user_id', leitorAtual.id)
                .eq('historia_titulo', historiaAtual)
                .maybeSingle();

            if (existente) {
                await supabaseClient
                    .from('biblioteca_leitor')
                    .update({ status: novoStatus, updated_at: new Date() })
                    .eq('id', existente.id);
            } else {
                await supabaseClient
                    .from('biblioteca_leitor')
                    .insert([{
                        user_id: leitorAtual.id,
                        historia_titulo: historiaAtual,
                        ultimo_capitulo_numero: 1,
                        status: novoStatus
                    }]);
            }

            document.querySelectorAll('.btn-action-status').forEach(btn => btn.classList.remove('active-status'));
            if (btnAlvo) btnAtivo.classList.add('active-status');
        }
    } catch (err) {
        console.error("Erro ao alterar status:", err);
    }
}