// Configuração Supabase
const SUPABASE_URL = "https://xkggqzzzuvrcpwtrbatm.supabase.co";
const SUPABASE_KEY = "sb_publishable_TtSVvv-5iVjARmijuAdhzg_8SYxuDnT";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// SEU E-MAIL DE ADMINISTRADOR (Apenas este e-mail/admin vera a Caixa de Entrada)
const EMAIL_ADMIN = "eduardo.leite.dev@gmail.com"; // <-- Se necessário, ajuste para seu e-mail exato do Supabase

let obraAtualObjeto = null; // Guarda o objeto completo da obra atual
let historiaAtual = "";
let todasHistorias = [];
let leitorAtual = null;
let perfilLeitor = null;
let modoAuth = 'login'; // 'login', 'register', 'forgot'
let planoSelecionado = 'vip30';
let primeiroCapituloCarregado = null;
let tipoConteudoAtual = 'livro'; // 'livro' ou 'conto'

// Chave PIX para pagamentos manuais
const MINHA_CHAVE_PIX = "69992752883";

// -------------------------------------------------------------
// INICIALIZAÇÃO E FLUXO DE REDEFINIÇÃO DE SENHA
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    carregarHistorias();
    
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

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('type') === 'recovery') {
        abrirModalResetSenha();
    } else {
        await verificarSessaoLeitor();
    }

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

function checarSeEhAdmin() {
    if (!leitorAtual) return false;
    if (leitorAtual.email === EMAIL_ADMIN) return true;
    if (perfilLeitor && perfilLeitor.eh_admin) return true;
    return false;
}

function checarSeEhVip() {
    if (!perfilLeitor) return false;
    if (perfilLeitor.eh_vip || perfilLeitor.eh_admin) return true;

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

        mostrarHome();
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
        const ehAdmin = checarSeEhAdmin();
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
                    ${ehAdmin ? `
                    <button class="dropdown-item" onclick="abrirCaixaEntrada()">
                        <span>📥</span>
                        <span>Caixa de Entrada</span>
                    </button>
                    ` : ''}
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
        let textExpiracao = "Assinatura Vitalícia / Ilimitada";
        
        if (perfilLeitor && perfilLeitor.subscription_until) {
            const dataFim = new Date(perfilLeitor.subscription_until);
            const agora = new Date();
            const diferencaMs = dataFim.getTime() - agora.getTime();
            const diasRestantes = Math.ceil(diferencaMs / (1000 * 3600 * 24));

            if (diasRestantes > 0) {
                const dataFormatada = dataFim.toLocaleDateString('pt-BR');
                textExpiracao = `⏳ <strong>${diasRestantes} ${diasRestantes === 1 ? 'dia restante' : 'dias restantes'}</strong> de VIP (Válida até ${dataFormatada})`;
            } else {
                textExpiracao = "Sua assinatura VIP expira hoje!";
            }
        }

        subBox.className = "subscription-box sub-vip-box";
        subBox.innerHTML = `
            <div>
                <h4 style="color: #ff3b69; margin: 0 0 6px 0; font-size: 1.1rem;">Sua Assinatura VIP está Ativa! 🔥</h4>
                <p style="font-size: 0.95rem; color: #eee; margin: 0;">${textExpiracao}</p>
            </div>
        `;
    } else {
        subBox.className = "subscription-box";
        subBox.innerHTML = `
            <div class="sub-free-box" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div>
                    <h4 style="margin: 0 0 6px 0;">Plano Gratuito</h4>
                    <p style="font-size: 0.85rem; color: #aaa; margin: 0;">Assine o VIP para liberar todos os capítulos e contos imediatamente!</p>
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
// CAIXA DE ENTRADA (PAINEL DO AUTOR / ADMIN)
// -------------------------------------------------------------

function abrirCaixaEntrada() {
    fecharDropdown();
    
    if (!checarSeEhAdmin()) {
        alert("🔒 Acesso restrito ao Autor.");
        return;
    }

    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const inboxView = document.getElementById('view-inbox');
    if (inboxView) inboxView.classList.remove('hidden');

    carregarCaixaEntradaAdmin();
}

async function carregarCaixaEntradaAdmin() {
    const listContainer = document.getElementById('inbox-comments-list');
    if (!listContainer) return;

    listContainer.innerHTML = "<p style='color: #888; text-align: center;'>Buscando comentários e mensagens...</p>";

    try {
        const { data: comentarios, error } = await supabaseClient
            .from('comentarios_obras')
            .select('*')
            .order('created_at', { ascending: false });

        if (error || !comentarios || comentarios.length === 0) {
            listContainer.innerHTML = "<p style='color: #888; text-align: center;'>Nenhum comentário recebido ainda.</p>";
            return;
        }

        listContainer.innerHTML = "";

        comentarios.forEach(c => {
            const dataObj = new Date(c.created_at);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' às ' + dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const card = document.createElement('div');
            card.style.cssText = "background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 15px; display: flex; flex-direction: column; gap: 8px;";

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #ff3b69; font-size: 0.95rem;">${c.nome_leitor || 'Leitor Anônimo'}</strong>
                        <span style="font-size: 0.8rem; color: #888; margin-left: 10px;">em <em style="color: #fff;">${c.historia_titulo}</em></span>
                    </div>
                    <span style="font-size: 0.75rem; color: #666;">${dataFormatada}</span>
                </div>
                <p style="color: #ddd; margin: 4px 0; font-size: 0.95rem; line-height: 1.4; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px;">
                    ${c.texto}
                </p>
                <div style="display: flex; gap: 10px; margin-top: 5px;">
                    <button onclick="prepararRespostaAdmin(${c.id}, '${c.historia_titulo}', '${c.nome_leitor}')" class="btn-back" style="margin:0; font-size: 0.8rem; padding: 4px 10px; color: #4caf50; border-color: rgba(76,175,80,0.3);">
                        💬 Responder
                    </button>
                    <button onclick="deletarComentarioAdmin(${c.id})" class="btn-back" style="margin:0; font-size: 0.8rem; padding: 4px 10px; color: #ff3b69; border-color: rgba(255,59,105,0.3);">
                        🗑️ Excluir
                    </button>
                </div>
                <div id="reply-box-${c.id}" class="hidden" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1);">
                    <textarea id="reply-input-${c.id}" placeholder="Escreva sua resposta oficial como Autor..." style="width: 100%; height: 60px; background: #222; color: #fff; border: 1px solid #444; border-radius: 6px; padding: 8px; resize: none; font-size: 0.85rem;"></textarea>
                    <button onclick="enviarRespostaAdmin(${c.id}, '${c.historia_titulo}')" class="btn-vip" style="margin-top: 6px; padding: 6px 12px; font-size: 0.8rem; width: auto;">Enviar Resposta ✨</button>
                </div>
            `;
            listContainer.appendChild(card);
        });

    } catch (err) {
        console.error("Erro na caixa de entrada:", err);
        listContainer.innerHTML = "<p style='color: #ff3b69; text-align: center;'>Erro ao carregar mensagens.</p>";
    }
}

function prepararRespostaAdmin(id, historia, leitor) {
    const replyBox = document.getElementById(`reply-box-${id}`);
    if (replyBox) replyBox.classList.toggle('hidden');
}

async function enviarRespostaAdmin(parentId, historiaTitulo) {
    const input = document.getElementById(`reply-input-${parentId}`);
    const texto = input ? input.value.trim() : "";

    if (!texto) {
        alert("Escreva uma resposta antes de enviar!");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('comentarios_obras')
            .insert([{
                user_id: leitorAtual.id,
                historia_titulo: historiaTitulo,
                nome_leitor: "👑 Autor",
                texto: texto,
                parent_id: parentId
            }]);

        if (error) throw error;

        alert("✨ Resposta enviada com sucesso!");
        carregarCaixaEntradaAdmin();

    } catch (err) {
        alert("Erro ao enviar resposta: " + err.message);
    }
}

async function deletarComentarioAdmin(id) {
    if (!confirm("Tem certeza que deseja excluir este comentário permanentemente?")) return;

    try {
        const { error } = await supabaseClient
            .from('comentarios_obras')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("🗑️ Comentário excluído com sucesso!");
        carregarCaixaEntradaAdmin();

    } catch (err) {
        alert("Erro ao excluir comentário: " + err.message);
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
    obraAtualObjeto = historia;
    historiaAtual = historia.titulo;

    const capaImg = historia.capa_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=500&q=80';
    document.getElementById('detail-cover').src = capaImg;
    document.getElementById('detail-title').innerText = historia.titulo;
    document.getElementById('detail-author').innerText = `Por ${historia.autor}`;
    document.getElementById('detail-category').innerText = historia.categoria;
    document.getElementById('detail-synopsis').innerText = historia.sinopse;

    const navTabs = document.getElementById('container-tabs-nav');

    if (historia.tipo === 'conto') {
        if (navTabs) navTabs.classList.add('hidden');
        document.getElementById('tab-content-synopsis').classList.remove('hidden');
        document.getElementById('tab-content-chapters').classList.add('hidden');
        const contentComments = document.getElementById('tab-content-comments');
        if (contentComments) contentComments.classList.add('hidden');
    } else {
        if (navTabs) navTabs.classList.remove('hidden');
        alternarAbaDetalhes('synopsis');
        carregarCapitulosDaHistoria(historia.titulo);
    }

    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-details').classList.remove('hidden');
}

function alternarAbaDetalhes(aba) {
    const btnSyn = document.getElementById('tab-btn-synopsis');
    const btnCap = document.getElementById('tab-btn-chapters');
    const btnCom = document.getElementById('tab-btn-comments');
    
    const contentSyn = document.getElementById('tab-content-synopsis');
    const contentCap = document.getElementById('tab-content-chapters');
    const contentCom = document.getElementById('tab-content-comments');

    if (btnSyn) btnSyn.classList.remove('active');
    if (btnCap) btnCap.classList.remove('active');
    if (btnCom) btnCom.classList.remove('active');

    if (contentSyn) contentSyn.classList.add('hidden');
    if (contentCap) contentCap.classList.add('hidden');
    if (contentCom) contentCom.classList.add('hidden');

    if (aba === 'synopsis') {
        if (btnSyn) btnSyn.classList.add('active');
        if (contentSyn) contentSyn.classList.remove('hidden');
    } else if (aba === 'chapters') {
        if (btnCap) btnCap.classList.add('active');
        if (contentCap) contentCap.classList.remove('hidden');
    } else if (aba === 'comments') {
        if (btnCom) btnCom.classList.add('active');
        if (contentCom) {
            contentCom.classList.remove('hidden');
            carregarComentariosObra(historiaAtual);
        }
    }
}

function voltarParaDetalhes() {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-details').classList.remove('hidden');
}

function alternarTipoConteudo(tipo) {
    if (tipo === 'conto') {
        const ehVipOuAdmin = checarSeEhVip();
        if (!ehVipOuAdmin) {
            alert("🔒 A aba de Contos é exclusiva para assinantes VIP!");
            abrirModalVIP();
            return;
        }
    }

    tipoConteudoAtual = tipo;

    const btnLivros = document.getElementById('btn-livros');
    const btnContos = document.getElementById('btn-contos');

    if (btnLivros) btnLivros.classList.toggle('active', tipo === 'livro');
    if (btnContos) btnContos.classList.toggle('active', tipo === 'conto');

    carregarHistorias();
}

async function carregarHistorias() {
    const container = document.getElementById('stories-container');
    if (!container) return;
    
    container.innerHTML = "<p style='color: var(--text-secondary);'>Carregando conteúdo...</p>";

    const { data, error } = await supabaseClient
        .from('historias')
        .select('*')
        .eq('tipo', tipoConteudoAtual)
        .order('id', { ascending: false });

    if (error || !data || data.length === 0) {
        const tipoTexto = tipoConteudoAtual === 'conto' ? 'conto' : 'livro';
        container.innerHTML = `<p style='color: var(--text-secondary);'>Nenhum ${tipoTexto} cadastrado ainda.</p>`;
        todasHistorias = [];
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

        const badgeInfo = historia.tipo === 'conto' 
            ? '<span class="free-badge" style="background: rgba(255, 59, 105, 0.15); color: #ff3b69;">Exclusivo VIP 🔥</span>' 
            : '<span class="free-badge">Capítulos 1 e 2 Grátis</span>';

        const labelConteudo = historia.tipo === 'conto' ? '🔥 Conto' : '📖 Capítulos';

        card.innerHTML = `
            <div class="card-cover" style="background-image: url('${capaImg}');">
                <span class="tag">${historia.categoria}</span>
            </div>
            <div class="card-info">
                <h3>${historia.titulo}</h3>
                <p class="author">Por ${historia.autor}</p>
                <div class="card-footer">
                    <span>${labelConteudo}</span>
                    ${badgeInfo}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function filtrarCategoria(categoria) {
    document.querySelectorAll('.categories-bar .chip').forEach(btn => {
        if (btn.innerText.trim() === categoria) {
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
    if (!listaContainer) return;
    listaContainer.innerHTML = "<p style='color: var(--text-secondary);'>Carregando capítulos...</p>";

    const { data: capitulos, error } = await supabaseClient
        .from('capitulos')
        .select('*')
        .order('capitulo_numero', { ascending: true })
        .eq('historia_titulo', tituloHistoria);

    if (error || !capitulos || capitulos.length === 0) {
        listaContainer.innerHTML = "<p style='color: var(--text-secondary);'>Nenhum capítulo publicado ainda para esta história.</p>";
        primeiroCapituloCarregado = null;
        return;
    }

    primeiroCapituloCarregado = capitulos[0];
    listaContainer.innerHTML = "";

    const ehVipOuAdmin = checarSeEhVip();

    capitulos.forEach(cap => {
        const ehCapituloVip = cap.capitulo_numero > 2;

        let statusClass = 'free';
        let statusTexto = 'Gratuito';

        if (ehCapituloVip) {
            if (ehVipOuAdmin) {
                statusClass = 'vip-unlocked';
                statusTexto = '⭐ VIP Liberado';
            } else {
                statusClass = 'vip';
                statusTexto = '🔒 Exclusivo VIP';
            }
        }

        const item = document.createElement('div');
        item.className = `chapter-item ${(ehCapituloVip && !ehVipOuAdmin) ? 'locked' : ''}`;
        item.onclick = () => abrirLeitorCapitulo(cap);

        item.innerHTML = `
            <div>
                <strong>Capítulo ${cap.capitulo_numero}</strong>
                <p>${cap.capitulo_titulo}</p>
            </div>
            <span class="status ${statusClass}" style="${ehVipOuAdmin && ehCapituloVip ? 'color: #4caf50; font-weight: bold;' : ''}">
                ${statusTexto}
            </span>
        `;
        listaContainer.appendChild(item);
    });
}

function iniciarLeituraPrimeiroCap() {
    if (obraAtualObjeto && obraAtualObjeto.tipo === 'conto') {
        abrirLeitorConto(obraAtualObjeto);
        return;
    }

    if (primeiroCapituloCarregado) {
        abrirLeitorCapitulo(primeiroCapituloCarregado);
    } else {
        alert("Ainda não há capítulos para este livro!");
    }
}

function abrirLeitorConto(conto) {
    const ehVip = checarSeEhVip();

    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

    const readerView = document.getElementById('view-reader');
    if (readerView) readerView.classList.remove('hidden');

    const titleElem = document.getElementById('reader-chapter-title');
    const textElem = document.getElementById('reader-text');
    const paywallElem = document.getElementById('paywall');

    if (titleElem) titleElem.innerText = conto.titulo;

    let conteudos = conto.conteudo || "";
    let paragrafos = conteudos
        .split(/\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (textElem) {
        if (!ehVip) {
            const previa = paragrafos.slice(0, 2).map(p => `<p>${p}</p>`).join('');
            textElem.innerHTML = previa;
            if (paywallElem) paywallElem.classList.remove('hidden');
        } else {
            textElem.innerHTML = paragrafos.map(p => `<p>${p}</p>`).join('');
            if (paywallElem) paywallElem.classList.add('hidden');
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function abrirLeitorCapitulo(capitulo) {
    if (!capitulo) {
        alert("Erro: Dados do capítulo não encontrados.");
        return;
    }

    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));

    const readerView = document.getElementById('view-reader');
    if (readerView) {
        readerView.classList.remove('hidden');
    } else {
        alert("⚠️ Não foi encontrada a tag id='view-reader' no seu HTML!");
        return;
    }

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
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------
// SISTEMA DE COMENTÁRIOS DOS LEITORES (COM EMOTICONS)
// -------------------------------------------------------------

function inserirEmoji(emoji) {
    const input = document.getElementById('input-novo-comentario');
    if (input) {
        input.value += emoji;
        input.focus();
    }
}

async function carregarComentariosObra(tituloHistoria) {
    const container = document.getElementById('tab-content-comments');
    if (!container) return;

    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <h3 style="color: #fff; margin-bottom: 10px;">💬 O que os leitores estão achando</h3>
            
            <!-- Barra de Emoticons Rápidos -->
            <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                <button onclick="inserirEmoji('🔥')" style="background: #222; border: 1px solid #444; border-radius: 6px; padding: 4px 8px; cursor: pointer; color: #fff;">🔥</button>
                <button onclick="inserirEmoji('❤️')" style="background: #222; border: 1px solid #444; border-radius: 6px; padding: 4px 8px; cursor: pointer; color: #fff;">❤️</button>
                <button onclick="inserirEmoji('😈')" style="background: #222; border: 1px solid #444; border-radius: 6px; padding: 4px 8px; cursor: pointer; color: #fff;">😈</button>
                <button onclick="inserirEmoji('💦')" style="background: #222; border: 1px solid #444; border-radius: 6px; padding: 4px 8px; cursor: pointer; color: #fff;">💦</button>
                <button onclick="inserirEmoji('👀')" style="background: #222; border: 1px solid #444; border-radius: 6px; padding: 4px 8px; cursor: pointer; color: #fff;">👀</button>
                <button onclick="inserirEmoji('😱')" style="background: #222; border: 1px solid #444; border-radius: 6px; padding: 4px 8px; cursor: pointer; color: #fff;">😱</button>
                <button onclick="inserirEmoji('👏')" style="background: #222; border: 1px solid #444; border-radius: 6px; padding: 4px 8px; cursor: pointer; color: #fff;">👏</button>
            </div>

            <textarea id="input-novo-comentario" placeholder="Escreva seu comentário sobre esta obra..." style="width: 100%; height: 80px; background: #1a1a1e; color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; resize: none;"></textarea>
            <button onclick="enviarComentarioObra()" class="btn-vip" style="margin-top: 10px; padding: 8px 16px; font-size: 0.9rem;">Enviar Comentário 🚀</button>
        </div>
        <div id="lista-comentarios-container">
            <p style="color: var(--text-secondary);">Carregando comentários...</p>
        </div>
    `;

    try {
        const { data, error } = await supabaseClient
            .from('comentarios_obras')
            .select('*')
            .eq('historia_titulo', tituloHistoria)
            .order('created_at', { ascending: false });

        const listaDiv = document.getElementById('lista-comentarios-container');
        if (!listaDiv) return;

        if (error || !data || data.length === 0) {
            listaDiv.innerHTML = "<p style='color: var(--text-secondary);'>Nenhum comentário ainda. Seja o primeiro a comentar!</p>";
            return;
        }

        listaDiv.innerHTML = data.map(c => {
            const ehAutor = c.nome_leitor && c.nome_leitor.includes('Autor');
            const estiloCard = ehAutor 
                ? "background: rgba(255, 59, 105, 0.08); border: 1px solid rgba(255, 59, 105, 0.3);" 
                : "background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);";

            return `
                <div style="${estiloCard} border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                    <strong style="color: ${ehAutor ? '#ff3b69' : '#e0e0e0'}; font-size: 0.9rem;">
                        ${c.nome_leitor || 'Leitor Anônimo'}
                    </strong>
                    <p style="color: #ddd; margin: 6px 0 0 0; font-size: 0.95rem; line-height: 1.4;">${c.texto}</p>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Erro ao buscar comentários:", err);
    }
}

async function enviarComentarioObra() {
    if (!leitorAtual) {
        alert("🔒 Faça login para poder comentar!");
        abrirModalAuth();
        return;
    }

    const input = document.getElementById('input-novo-comentario');
    const texto = input ? input.value.trim() : "";

    if (!texto) {
        alert("Escreva alguma coisa antes de enviar!");
        return;
    }

    let nomeLeitor = (perfilLeitor && perfilLeitor.nome) ? perfilLeitor.nome : leitorAtual.email.split('@')[0];
    if (checarSeEhAdmin()) {
        nomeLeitor = "👑 Autor (" + nomeLeitor + ")";
    }

    try {
        const { error } = await supabaseClient
            .from('comentarios_obras')
            .insert([{
                user_id: leitorAtual.id,
                historia_titulo: historiaAtual,
                nome_leitor: nomeLeitor,
                texto: texto
            }]);

        if (error) throw error;

        input.value = "";
        alert("✨ Comentário enviado com sucesso!");
        carregarComentariosObra(historiaAtual);

    } catch (err) {
        alert("Erro ao enviar comentário: " + err.message);
    }
}

// -------------------------------------------------------------
// GERENCIAMENTO DE LEITORES (ADMIN.HTML)
// -------------------------------------------------------------

async function carregarLeitoresParaGerenciar() {
    const tbody = document.getElementById('admin-users-list');
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='3' style='padding:15px; color:#aaa;'>Buscando leitores...</td></tr>";

    const { data: leitores, error } = await supabaseClient
        .from('perfis_leitores')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !leitores || leitores.length === 0) {
        tbody.innerHTML = "<tr><td colspan='3' style='padding:15px; color:#aaa;'>Nenhum leitor encontrado.</td></tr>";
        return;
    }

    tbody.innerHTML = "";

    leitores.forEach(l => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";

        tr.innerHTML = `
            <td style="padding: 10px;">
                <strong>${l.nome || 'Sem Nome'}</strong><br>
                <small style="color:#aaa;">ID: ${l.id}</small>
            </td>
            <td style="padding: 10px; text-align: center;">
                <input type="checkbox" ${l.eh_vip ? 'checked' : ''} onchange="alterarPermissaoLeitor('${l.id}', 'eh_vip', this.checked)">
            </td>
            <td style="padding: 10px; text-align: center;">
                <input type="checkbox" ${l.eh_admin ? 'checked' : ''} onchange="alterarPermissaoLeitor('${l.id}', 'eh_admin', this.checked)">
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function alterarPermissaoLeitor(userId, campo, valor) {
    const payload = {};
    payload[campo] = valor;

    const { error } = await supabaseClient
        .from('perfis_leitores')
        .update(payload)
        .eq('id', userId);

    if (error) {
        alert("Erro ao alterar permissão: " + error.message);
        carregarLeitoresParaGerenciar();
    } else {
        console.log(`Permissão ${campo} atualizada para ${valor} no leitor ${userId}`);
    }
}