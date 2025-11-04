// === LOGIN COM GOOGLE (Firebase) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA5DVcPBD0rVIPb5wrT2lX33Tm2nL3Yuxg",
  authDomain: "painelestudos-aa3ce.firebaseapp.com",
  projectId: "painelestudos-aa3ce",
  storageBucket: "painelestudos-aa3ce.appspot.com",
  messagingSenderId: "345651228873",
  appId: "1:345651228873:web:d25d3fa527d726be009d18",
  measurementId: "G-2RE102BQVZ"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Botões do login
const btnSignIn = document.getElementById("btnSignIn");
const btnSignOut = document.getElementById("btnSignOut");

// Login com popup
btnSignIn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    alert(`Bem-vindo, ${user.displayName}!`);
    btnSignIn.style.display = "none";
    btnSignOut.style.display = "inline-block";
  } catch (error) {
    console.error("Erro no login:", error);
    alert("Erro no login: " + error.message);
  }
});

// Logout
btnSignOut.addEventListener("click", async () => {
  try {
    await signOut(auth);
    alert("Você saiu da conta!");
    btnSignOut.style.display = "none";
    btnSignIn.style.display = "inline-block";
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
});

// Monitora login automático
onAuthStateChanged(auth, (user) => {
  if (user) {
    btnSignIn.style.display = "none";
    btnSignOut.style.display = "inline-block";
    console.log("Usuário logado:", user.email);
  } else {
    btnSignIn.style.display = "inline-block";
    btnSignOut.style.display = "none";
  }
});



// === SEU CÓDIGO ORIGINAL ABAIXO (inalterado) ===
let startTime, timerInterval;
let totalSeconds = 0;
let points = parseInt(localStorage.getItem('pontos')) || 0;
let aulas = JSON.parse(localStorage.getItem('aulas')) || [];
let notas = JSON.parse(localStorage.getItem('notas')) || []; 
let estudoDiario = JSON.parse(localStorage.getItem('estudoDiario')) || {};
let chart;

// Elementos DOM
const display = document.getElementById('display');
const pointsEl = document.getElementById('points');
const totalTimeEl = document.getElementById('totalTime');
const ctx = document.getElementById('studyChart');

// === CRONÔMETRO ===
document.getElementById('start').addEventListener('click', () => {
    if (!timerInterval) {
        startTime = Date.now() - totalSeconds * 1000;
        timerInterval = setInterval(updateTimer, 1000);
    }
});

document.getElementById('stop').addEventListener('click', () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        // Lógica de recompensa e salvamento ao parar
        addPoints(Math.floor(totalSeconds / 60)); 
        salvarEstudoDiario(totalSeconds);
        adicionarTempoNaAulaAtual(totalSeconds);
        resetTimer();
    }
});

function updateTimer() {
    totalSeconds = Math.floor((Date.now() - startTime) / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    display.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    atualizarGraficoAoVivo(); 
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function resetTimer() {
    totalSeconds = 0;
    display.textContent = "00:00:00";
}

// === SALVAR AULAS ===
document.getElementById('save').addEventListener('click', () => {
    const aula = document.getElementById('aula').value.trim();
    const capitulo = document.getElementById('capitulo').value.trim();
    if (aula && capitulo) {
        aulas.push({ aula, capitulo, concluida: false, tempo: 0 });
        localStorage.setItem('aulas', JSON.stringify(aulas));
        renderAulas();
        document.getElementById('aula').value = '';
        document.getElementById('capitulo').value = '';
        resetTimer();
    } else {
        alert('Por favor, preencha o Número da aula e o Capítulo.');
    }
});

function renderAulas() {
    const list = document.getElementById('progressList');
    const filtro = document.getElementById('filter').value;
    list.innerHTML = '';
    
    // Filtra e inverte a ordem para mostrar as mais novas primeiro
    const aulasFiltradas = aulas.slice().reverse() 
        .filter(a => filtro === 'todas' ||
            (filtro === 'concluidas' && a.concluida) ||
            (filtro === 'pendentes' && !a.concluida));
            
    aulasFiltradas.forEach((a, i) => {
        // Encontra o índice original da aula no array 'aulas'
        // Isso é necessário para que as funções concluir/remover funcionem corretamente no array não invertido
        const indiceOriginal = aulas.length - 1 - aulas.findIndex(original => 
            original.aula === a.aula && original.capitulo === a.capitulo && original.tempo === a.tempo);

        const li = document.createElement('li');
        li.className = a.concluida ? 'completed' : '';
        li.innerHTML = `
            Aula ${a.aula} - Capítulo ${a.capitulo} <br>
            <small>Tempo: ${(a.tempo / 60).toFixed(1)} min</small>
            <div>
                <button onclick="concluirAula(${indiceOriginal})">${a.concluida ? '✔️' : 'Concluir'}</button>
                <button onclick="removerAula(${indiceOriginal})">🗑️</button>
            </div>
        `;
        list.appendChild(li);
    });
}

window.concluirAula = (i) => {
    // Garante que o índice é válido
    if (i >= 0 && i < aulas.length) {
        aulas[i].concluida = !aulas[i].concluida;
        localStorage.setItem('aulas', JSON.stringify(aulas));
        renderAulas();
    }
};

window.removerAula = (i) => {
    if (i >= 0 && i < aulas.length && confirm("Tem certeza que deseja remover esta aula?")) {
        aulas.splice(i, 1);
        localStorage.setItem('aulas', JSON.stringify(aulas));
        renderAulas();
    }
};

// === LIGAR TEMPO À AULA ATUAL ===
function adicionarTempoNaAulaAtual(segundos) {
    if (aulas.length > 0) {
        // Adiciona tempo à última aula registrada
        const ultima = aulas[aulas.length - 1]; 
        ultima.tempo = (ultima.tempo || 0) + segundos;
        localStorage.setItem('aulas', JSON.stringify(aulas));
        renderAulas();
    }
}

// === PONTOS ===
function addPoints(v) {
    points += v;
    pointsEl.textContent = points;
    localStorage.setItem('pontos', points);
}

// === TEMPO TOTAL ===
function atualizarTempoTotal() {
    const total = Object.values(estudoDiario).reduce((a, b) => a + b, 0); 
    totalTimeEl.textContent = Math.round(total / 60) + ' min';
}

// === SALVAR TEMPO DIÁRIO ===
function salvarEstudoDiario(segundos) {
    const hoje = new Date().toLocaleDateString('pt-BR');
    estudoDiario[hoje] = (estudoDiario[hoje] || 0) + segundos;
    localStorage.setItem('estudoDiario', JSON.stringify(estudoDiario));
    atualizarTempoTotal();
    renderGrafico();
}

// === GRÁFICO ===
function renderGrafico() {
    const ultimos7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toLocaleDateString('pt-BR');
    });

    const dados = ultimos7.map(d => (estudoDiario[d] || 0) / 60);
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ultimos7,
            datasets: [{
                label: 'Minutos estudados',
                data: dados,
                // Cor adaptável ao tema, se você tiver variáveis CSS configuradas
                backgroundColor: document.body.classList.contains('dark') ? 'rgba(76, 175, 80, 0.8)' : 'rgba(33, 150, 243, 0.8)' 
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function atualizarGraficoAoVivo() {
    // Atualiza o gráfico durante o cronômetro
    renderGrafico(); 
}

// ===================================
// === BLOCO: ANOTAÇÕES & PDF ===
// ===================================

document.getElementById('saveNote').addEventListener('click', () => {
    const anotacao = document.getElementById('noteText').value.trim();
    
    if (anotacao) {
        // Adiciona a anotação com a data/hora
        notas.push({ 
            data: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR'), 
            texto: anotacao 
        });
        
        localStorage.setItem('notas', JSON.stringify(notas));
        
        document.getElementById('noteText').value = '';
        renderNotas(); 
    } else {
        alert('A anotação não pode estar vazia.');
    }
});

function renderNotas() {
    const container = document.getElementById('savedNotes');
    if (!container) return; 

    container.innerHTML = '';
    
    if (notas.length === 0) {
        container.innerHTML = '<p style="font-style: italic; color: var(--text-color-secondary, #666);">Nenhuma anotação salva ainda.</p>';
        return;
    }
    
    const ul = document.createElement('ul');
    ul.className = 'notes-list';
    
    // Exibe da mais recente para a mais antiga
    notas.slice().reverse().forEach((nota, index) => { 
        // Calcula o índice original no array não invertido
        const indiceOriginal = notas.length - 1 - index; 
        const li = document.createElement('li');
        li.className = 'note-item'; 
        li.innerHTML = `
            <div class="note-header">
                <strong>${nota.data}</strong> 
                <button onclick="removerNota(${indiceOriginal})" class="remove-note-btn">🗑️</button>
            </div>
            <p>${nota.texto.replace(/\n/g, '<br>')}</p>
        `;
        ul.appendChild(li);
    });
    
    container.appendChild(ul);
}

window.removerNota = (i) => {
    if (i >= 0 && i < notas.length && confirm("Tem certeza que deseja remover esta anotação?")) {
        notas.splice(i, 1);
        localStorage.setItem('notas', JSON.stringify(notas));
        renderNotas(); 
    }
};

// EXPORTAR PARA PDF (Requer jspdf e html2canvas no HTML)
document.getElementById('exportNotes').addEventListener('click', () => {
    // Verifica se as bibliotecas estão carregadas
    if (!window.jspdf || !window.html2canvas) {
        alert('As bibliotecas de exportação (jsPDF e html2canvas) não foram carregadas. Verifique seu arquivo HTML.');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const notesContainer = document.getElementById('savedNotes');
    
    if (notas.length === 0) {
        alert('Não há anotações para exportar.');
        return;
    }

    // Cria um elemento temporário para estruturar o PDF
    const exportDiv = document.createElement('div');
    exportDiv.id = 'contentToExport';
    // Estilos para garantir que o html2canvas capture corretamente
    exportDiv.style.width = '210mm'; 
    exportDiv.style.padding = '10mm';
    exportDiv.style.background = '#fff'; // Fundo branco para o PDF
    
    // Adiciona o título e o conteúdo das anotações
    exportDiv.innerHTML = `
        <h1 style="color:#000; font-size:24px;">📝 Anotações do Painel de Estudos</h1>
        ${notesContainer.innerHTML}
    `;
    
    document.body.appendChild(exportDiv);

    // Usa html2canvas e jsPDF
    html2canvas(exportDiv, { scale: 3 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 200; 
        const pageHeight = 295; 
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        
        let position = 0;

        pdf.addImage(imgData, 'PNG', 5, 5, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Lógica para adicionar páginas se o conteúdo for muito longo
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            // -5mm para compensar a margem inicial e ter um pouco de 'respiro'
            pdf.addImage(imgData, 'PNG', 5, position + 5, imgWidth, imgHeight); 
            heightLeft -= pageHeight;
        }

        pdf.save(`anotacoes_estudo_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
        
        // Remove o elemento temporário
        document.body.removeChild(exportDiv);
    });
});


// === FILTRO ===
document.getElementById('filter').addEventListener('change', renderAulas);

// === MODO ESCURO ===
document.getElementById('toggleTheme').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const modo = document.body.classList.contains('dark') ? 'escuro' : 'claro';
    document.getElementById('toggleTheme').textContent = modo === 'escuro' ? '☀️ Modo Claro' : '🌙 Modo Escuro';
    localStorage.setItem('tema', modo);
    // Renderiza o gráfico novamente para aplicar a cor do tema
    renderGrafico(); 
});

// === AO INICIAR ===
window.onload = () => {
    pointsEl.textContent = points;
    renderAulas();
    renderGrafico();
    atualizarTempoTotal();
    renderNotas(); 
    
    // Carrega o tema
    const tema = localStorage.getItem('tema');
    if (tema === 'escuro') {
        document.body.classList.add('dark');
        document.getElementById('toggleTheme').textContent = '☀️ Modo Claro';
    }
};

