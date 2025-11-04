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
  const aula = document.getElementById('aula').value;
  const capitulo = document.getElementById('capitulo').value;
  if (aula && capitulo) {
    aulas.push({ aula, capitulo, concluida: false, tempo: 0 });
    localStorage.setItem('aulas', JSON.stringify(aulas));
    renderAulas();
    document.getElementById('aula').value = '';
    document.getElementById('capitulo').value = '';
    resetTimer();
  }
});

function renderAulas() {
  const list = document.getElementById('progressList');
  const filtro = document.getElementById('filter').value;
  list.innerHTML = '';
  aulas
    .filter(a => filtro === 'todas' ||
      (filtro === 'concluidas' && a.concluida) ||
      (filtro === 'pendentes' && !a.concluida))
    .forEach((a, i) => {
      const li = document.createElement('li');
      li.className = a.concluida ? 'completed' : '';
      li.innerHTML = `
        Aula ${a.aula} - Capítulo ${a.capitulo} <br>
        <small>Tempo: ${(a.tempo / 60).toFixed(1)} min</small>
        <div>
          <button onclick="concluirAula(${i})">${a.concluida ? '✔️' : 'Concluir'}</button>
          <button onclick="removerAula(${i})">🗑️</button>
        </div>
      `;
      list.appendChild(li);
    });
}

window.concluirAula = (i) => {
  aulas[i].concluida = !aulas[i].concluida;
  localStorage.setItem('aulas', JSON.stringify(aulas));
  renderAulas();
};

window.removerAula = (i) => {
  aulas.splice(i, 1);
  localStorage.setItem('aulas', JSON.stringify(aulas));
  renderAulas();
};

// === LIGAR TEMPO À AULA ATUAL ===
function adicionarTempoNaAulaAtual(segundos) {
  if (aulas.length > 0) {
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
        data: dados
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

function atualizarGraficoAoVivo() {
  renderGrafico();
}

// === FILTRO ===
document.getElementById('filter').addEventListener('change', renderAulas);

// === MODO ESCURO ===
document.getElementById('toggleTheme').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const modo = document.body.classList.contains('dark') ? 'escuro' : 'claro';
  document.getElementById('toggleTheme').textContent = modo === 'escuro' ? '☀️ Modo Claro' : '🌙 Modo Escuro';
  localStorage.setItem('tema', modo);
});

// === AO INICIAR ===
window.onload = () => {
  pointsEl.textContent = points;
  renderAulas();
  renderGrafico();
  atualizarTempoTotal();
  const tema = localStorage.getItem('tema');
  if (tema === 'escuro') {
    document.body.classList.add('dark');
    document.getElementById('toggleTheme').textContent = '☀️ Modo Claro';
  }
};

