// ================= FIREBASE (Auth + Firestore) =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ========== FIREBASE CONFIG (já com suas credenciais) ========== */
const firebaseConfig = {
  apiKey: "AIzaSyA5DVcPBD0rVIPb5wrT2lX33Tm2nL3Yuxg",
  authDomain: "painelestudos-aa3ce.firebaseapp.com",
  projectId: "painelestudos-aa3ce",
  storageBucket: "painelestudos-aa3ce.appspot.com",
  messagingSenderId: "345651228873",
  appId: "1:345651228873:web:d25d3fa527d726be009d18",
  measurementId: "G-2RE102BQVZ"
};
/* =============================================================== */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// ========== UI elements (IDs mantidos) ==========
const display = document.getElementById('display');
const pointsEl = document.getElementById('points');
const totalTimeEl = document.getElementById('totalTime');
const ctx = document.getElementById('studyChart');

const saveBtn = document.getElementById('save');
const aulaInput = document.getElementById('aula');
const capInput = document.getElementById('capitulo');
const progressList = document.getElementById('progressList');
const filter = document.getElementById('filter');

const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');

const selectAulaForNote = document.getElementById('selectAulaForNote');
const noteText = document.getElementById('noteText');
const saveNoteBtn = document.getElementById('saveNote');
const savedNotes = document.getElementById('savedNotes');

const dailyGoalInput = document.getElementById('dailyGoal');
const goalProgress = document.getElementById('goalProgress');

const rankingList = document.getElementById('rankingList');

const exportJsonBtn = document.getElementById('exportJson');
const exportCsvBtn = document.getElementById('exportCsv');

const generalNote = document.getElementById('generalNote');
const saveGeneralNote = document.getElementById('saveGeneralNote');
const generalNotesList = document.getElementById('generalNotesList');

const btnSignIn = document.getElementById('btnSignIn');
const btnSignOut = document.getElementById('btnSignOut');
const userBlock = document.getElementById('userBlock');
const userName = document.getElementById('userName');
const userPhoto = document.getElementById('userPhoto');

const achievementsEl = document.getElementById('achievements');
const sessionHistoryEl = document.getElementById('sessionHistory');
const pomodoroDisplay = document.getElementById('pomodoroDisplay');
const startPom = document.getElementById('startPom');
const stopPom = document.getElementById('stopPom');
const skipPom = document.getElementById('skipPom');
const pomStateEl = document.getElementById('pomState');

// ========== Local state ==========
let startTime, timerInterval;
let totalSeconds = 0;
let points = parseInt(localStorage.getItem('pontos')) || 0;
let aulas = JSON.parse(localStorage.getItem('aulas') || '[]'); // {aula,capitulo,concluida,tempo,notas:[]}
let notas = JSON.parse(localStorage.getItem('notas') || '[]');
let estudoDiario = JSON.parse(localStorage.getItem('estudoDiario') || '{}');
let sessions = JSON.parse(localStorage.getItem('sessions') || '[]'); // {date,seconds,aulaIndex}
let generalNotes = JSON.parse(localStorage.getItem('generalNotes') || '[]');
let chart;
let currentUser = null;
let achievements = JSON.parse(localStorage.getItem('achievements') || '[]');

// Pomodoro state
let pomInterval = null;
let pomSeconds = 25 * 60; // default 25min focus
let isBreak = false;


// ========== Helpers ==========
const pad = (n) => n.toString().padStart(2,'0');
function formatHMS(totalSec){
  const hrs = Math.floor(totalSec/3600);
  const mins = Math.floor((totalSec%3600)/60);
  const secs = totalSec%60;
  if (hrs>0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}
function todayKey(){ return new Date().toLocaleDateString('pt-BR'); }

// persist local
function persistLocalAll(){
  localStorage.setItem('aulas', JSON.stringify(aulas));
  localStorage.setItem('notas', JSON.stringify(notas));
  localStorage.setItem('estudoDiario', JSON.stringify(estudoDiario));
  localStorage.setItem('sessions', JSON.stringify(sessions));
  localStorage.setItem('generalNotes', JSON.stringify(generalNotes));
  localStorage.setItem('pontos', String(points));
  localStorage.setItem('achievements', JSON.stringify(achievements));
  localStorage.setItem('dailyGoal', dailyGoalInput.value || '');
}

// ========== AUTH (simple) ==========
btnSignIn.addEventListener('click', async ()=>{
  try{
    const res = await signInWithPopup(auth, provider);
    currentUser = res.user;
    userBlock.style.display = 'flex';
    userName.textContent = currentUser.displayName;
    if (userPhoto) userPhoto.src = currentUser.photoURL || '';
    // load user data from firestore
    await loadUserFromCloud(currentUser.uid);
  }catch(e){
    console.error(e);
    alert('Erro no login: ' + (e.message || e));
  }
});
btnSignOut.addEventListener('click', async ()=>{
  try{
    await signOut(auth);
    currentUser = null;
    userBlock.style.display = 'none';
    loadLocalCache();
    refreshUI();
  }catch(e){ console.warn(e); }
});
onAuthStateChanged(auth, async (u)=>{
  if (u){
    currentUser = u;
    userBlock.style.display = 'flex';
    userName.textContent = u.displayName;
    if (userPhoto) userPhoto.src = u.photoURL || '';
    await loadUserFromCloud(u.uid);
  } else {
    currentUser = null;
    userBlock.style.display = 'none';
    loadLocalCache();
    refreshUI();
  }
});

// ========== Firestore helpers (merge logic) ==========
function userDocRef(uid){ return doc(db, 'users', uid); }

async function loadUserFromCloud(uid){
  try{
    const ref = userDocRef(uid);
    const snap = await getDoc(ref);
    if (snap.exists()){
      const cloud = snap.data();
      // merge rules:
      // - take cloud as source of truth, but sum estudoDiario & sessions & achievements & pontos
      aulas = cloud.aulas || aulas;
      // merge estudoDiario (sum per day)
      const cloudEst = cloud.estudoDiario || {};
      for (const k of Object.keys(cloudEst)) estudoDiario[k] = Math.max(estudoDiario[k]||0, cloudEst[k]);
      // sessions: concat and dedupe by timestamp
      sessions = [...(cloud.sessions || []), ...sessions];
      // dedupe sessions by date+seconds
      const seenS = new Set();
      sessions = sessions.filter(s => {
        const key = s.date + '|' + s.seconds + '|' + (s.aulaIndex||'');
        if (seenS.has(key)) return false;
        seenS.add(key);
        return true;
      }).slice(-500);
      points = Math.max(points, cloud.pontos || 0);
      generalNotes = cloud.generalNotes || generalNotes;
      achievements = cloud.achievements || achievements;
      // save merged back to cloud to harmonize
      await saveUserToCloud(uid);
    } else {
      // create
      await setDoc(userDocRef(uid), {
        aulas: aulas,
        estudoDiario,
        sessions,
        pontos: points,
        generalNotes,
        achievements,
        dailyGoal: Number(dailyGoalInput.value) || 60,
        nome: currentUser.displayName || ''
      });
    }
    persistLocalAll();
    refreshUI();
  }catch(e){
    console.warn('cloud load fail', e);
  }
}

async function saveUserToCloud(uid){
  try{
    await setDoc(userDocRef(uid), {
      aulas, estudoDiario, sessions, pontos: points, generalNotes, achievements, dailyGoal: Number(dailyGoalInput.value) || 0
    }, { merge:true });
  }catch(e){ console.warn('cloud save fail', e); }
}

// ========== Load local cache ==========
function loadLocalCache(){
  aulas = JSON.parse(localStorage.getItem('aulas') || '[]');
  notas = JSON.parse(localStorage.getItem('notas') || '[]');
  estudoDiario = JSON.parse(localStorage.getItem('estudoDiario') || '{}');
  sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
  generalNotes = JSON.parse(localStorage.getItem('generalNotes') || '[]');
  points = parseInt(localStorage.getItem('pontos') || '0');
  achievements = JSON.parse(localStorage.getItem('achievements') || '[]');
  const dg = localStorage.getItem('dailyGoal'); if (dg) dailyGoalInput.value = dg;
}
loadLocalCache();

// ========== Core: aulas, notas, sessions ==========
function renderAulas(){
  progressList.innerHTML = '';
  const filtro = filter.value;
  aulas.filter(a => filtro==='todas' || (filtro==='concluidas' && a.concluida) || (filtro==='pendentes' && !a.concluida))
    .forEach((a,i)=>{
      const li = document.createElement('li');
      li.innerHTML = `<div>
          <strong>Aula ${a.aula}</strong> - Cap ${a.capitulo}
          <div><small>${((a.tempo||0)/60).toFixed(1)} min</small></div>
        </div>
        <div class="li-controls">
          <button onclick="toggleConclude(${i})">${a.concluida? '✔️' : 'Concluir'}</button>
          <button onclick="viewNotes(${i})">📝</button>
          <button onclick="removeAula(${i})">🗑️</button>
        </div>`;
      progressList.appendChild(li);
    });
  renderSelectAulas();
}
window.toggleConclude = async function(i){
  aulas[i].concluida = !aulas[i].concluida;
  persistLocalAll();
  if (currentUser) await saveUserToCloud(currentUser.uid);
  computeAchievements();
  renderAulas();
};
window.viewNotes = function(i){
  selectAulaForNote.value = i;
  renderNotesForSelected();
};
window.removeAula = async function(i){
  if (!confirm('Remover esta aula?')) return;
  aulas.splice(i,1);
  persistLocalAll();
  if (currentUser) await saveUserToCloud(currentUser.uid);
  renderAulas();
};

function renderSelectAulas(){
  selectAulaForNote.innerHTML = '';
  aulas.forEach((a,i)=>{
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Aula ${a.aula} - Cap ${a.capitulo}`;
    selectAulaForNote.appendChild(opt);
  });
  if (!aulas.length) selectAulaForNote.innerHTML = '<option value="">(Nenhuma aula)</option>';
}
function renderNotesForSelected(){
  const idx = selectAulaForNote.value;
  savedNotes.innerHTML = '';
  if (idx === '' || aulas.length===0 || aulas[idx]==null) { savedNotes.innerHTML = '<p>Nenhuma aula selecionada.</p>'; return; }
  const notasLocal = aulas[idx].notas || [];
  if (!notasLocal.length) savedNotes.innerHTML = '<p>Sem notas.</p>';
  notasLocal.forEach((n, i)=>{
    const div = document.createElement('div');
    div.innerHTML = `<p>${n.text} <small>${n.date}</small></p><button onclick="removeNota(${idx},${i})">Excluir</button>`;
    savedNotes.appendChild(div);
  });
}
window.removeNota = async function(aulaIdx, notaIdx){
  aulas[aulaIdx].notas.splice(notaIdx,1);
  persistLocalAll();
  if (currentUser) await saveUserToCloud(currentUser.uid);
  renderNotesForSelected();
};

saveNoteBtn.addEventListener('click', async ()=>{
  const idx = selectAulaForNote.value;
  const txt = noteText.value.trim();
  if (idx === '' || !txt) return alert('Selecione aula e escreva a nota.');
  aulas[idx].notas = aulas[idx].notas || [];
  aulas[idx].notas.push({ text: txt, date: new Date().toLocaleString() });
  noteText.value='';
  persistLocalAll();
  if (currentUser) await saveUserToCloud(currentUser.uid);
  renderNotesForSelected();
});

// add aula
saveBtn.addEventListener('click', async ()=>{
  const a = aulaInput.value.trim(), c = capInput.value.trim();
  if (!a || !c) return alert('Preencha aula e capítulo.');
  aulas.push({ aula:a, capitulo:c, concluida:false, tempo:0, notas:[] });
  aulaInput.value=''; capInput.value='';
  persistLocalAll();
  if (currentUser) await saveUserToCloud(currentUser.uid);
  renderAulas();
});

// ========== Timer (linked to last aula) ==========
startBtn.addEventListener('click', ()=>{
  if (timerInterval) return;
  startTime = Date.now() - totalSeconds*1000;
  timerInterval = setInterval(()=>{
    totalSeconds = Math.floor((Date.now()-startTime)/1000);
    display.textContent = formatHMS(totalSeconds);
    updateChartLive();
  },1000);
});

stopBtn.addEventListener('click', async ()=>{
  if (!timerInterval) return;
  clearInterval(timerInterval); timerInterval=null;
  const secs = totalSeconds;
  totalSeconds = 0;
  display.textContent = '00:00:00';

  const key = todayKey();
  estudoDiario[key] = (estudoDiario[key] || 0) + Math.floor(secs);
  if (aulas.length>0){
    aulas[aulas.length-1].tempo = (aulas[aulas.length-1].tempo || 0) + Math.floor(secs);
  }
  // session record
  sessions.push({ date: new Date().toLocaleString(), seconds: Math.floor(secs), aulaIndex: aulas.length>0? aulas.length-1 : null });
  // points: 1 point per 10 min
  const gained = Math.floor(secs / 600);
  points += gained;
  persistLocalAll();
  if (currentUser) await saveUserToCloud(currentUser.uid);
  computeAchievements();
  refreshUI();
  maybeNotify();
});

// ========== Chart / stats ==========
function computeTotals(){
  const total = Object.values(estudoDiario).reduce((a,b)=>a+(b||0),0);
  totalTimeEl.textContent = Math.round(total/60) + ' min';
  pointsEl.textContent = points;
}
function renderChart(){
  const ultimos7 = Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate() - (6-i)); return d.toLocaleDateString('pt-BR');
  });
  const dados = ultimos7.map(d => (estudoDiario[d] || 0)/60);
  const goal = Number(dailyGoalInput.value) || 0;
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ultimos7,
      datasets: [
        { label:'Minutos estudados', data:dados, backgroundColor:'#4a90e2' },
        { label:'Meta diária (min)', data: ultimos7.map(()=>goal), type:'line', borderColor:'#00aaff', tension:0.3, fill:false }
      ]
    },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}
let lastUpdate=0;
function updateChartLive(){
  const now = Date.now();
  if (now - lastUpdate < 1200) return;
  const copia = {...estudoDiario};
  copia[todayKey()] = (copia[todayKey()] || 0) + totalSeconds;
  const ultimos7 = Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate() - (6-i)); return d.toLocaleDateString('pt-BR');
  });
  const dados = ultimos7.map(d => (copia[d] || 0)/60);
  if (chart) {
    chart.data.datasets[0].data = dados;
    chart.update();
  } else renderChart();
  lastUpdate = now;
}

// ========== Achievements ==========
function computeAchievements(){
  achievements = achievements || [];
  const ach = new Set(achievements.map(a=>a.id));
  // criteria
  const completedCount = aulas.filter(a=>a.concluida).length;
  if (completedCount >= 5 && !ach.has('5aulas')) achievements.push({ id:'5aulas', title:'🎯 5 aulas concluídas', date:new Date().toLocaleDateString() });
  if (completedCount >= 10 && !ach.has('10aulas')) achievements.push({ id:'10aulas', title:'🏅 10 aulas concluídas', date:new Date().toLocaleDateString() });
  // streak: days in a row with study >0
  const days = Object.keys(estudoDiario).sort((a,b)=> new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
  let streak = 0;
  for (let i=0;i<7;i++){
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('pt-BR');
    if ((estudoDiario[key]||0) > 0) streak++;
    else break;
  }
  if (streak >= 3 && !ach.has('3dias')) achievements.push({ id:'3dias', title:'🔥 3 dias seguidos estudando', date:new Date().toLocaleDateString() });
  if (streak >= 7 && !ach.has('7dias')) achievements.push({ id:'7dias', title:'💪 7 dias seguidos estudando', date:new Date().toLocaleDateString() });

  // points-based
  if (points >= 50 && !ach.has('50pts')) achievements.push({ id:'50pts', title:'⭐ 50 pontos', date:new Date().toLocaleDateString() });

  localStorage.setItem('achievements', JSON.stringify(achievements));
  if (currentUser) saveUserToCloud(currentUser.uid);
  renderAchievements();
}
function renderAchievements(){
  achievementsEl.innerHTML = '';
  achievements.forEach(a=>{
    const div = document.createElement('div');
    div.className = 'achievement';
    div.textContent = a.title;
    achievementsEl.appendChild(div);
  });
}

// ========== Ranking (Firestore) ==========
async function fetchRanking(){
  rankingList.innerHTML = '<li>Carregando...</li>';
  try{
    const q = query(collection(db,'users'), orderBy('pontos','desc'), limit(10));
    const snap = await getDocs(q);
    rankingList.innerHTML = '';
    snap.forEach(d=>{
      const data = d.data();
      const li = document.createElement('li');
      li.innerHTML = `<strong>${data.nome || 'Usuário'}</strong> — ${data.pontos||0} pts`;
      rankingList.appendChild(li);
    });
  }catch(e){
    rankingList.innerHTML = '<li>Ranking indisponível</li>';
  }
}

// ========== Sessions history ==========
function renderSessions(){
  sessionHistoryEl.innerHTML = '';
  const last = sessions.slice(-50).reverse();
  last.forEach(s=>{
    const li = document.createElement('li');
    const aulaLabel = (s.aulaIndex != null && aulas[s.aulaIndex]) ? ` (Aula ${aulas[s.aulaIndex].aula})` : '';
    li.innerHTML = `<div>${s.date}${aulaLabel}</div><div><small>${Math.round(s.seconds/60)} min</small></div>`;
    sessionHistoryEl.appendChild(li);
  });
}

// ========== Notifications / reminders ==========
async function maybeNotify(){
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted'){
    const mins = Math.round((estudoDiario[todayKey()]||0)/60);
    const goal = Number(dailyGoalInput.value) || 0;
    new Notification('Progresso salvo', { body: `Você estudou ${mins} min hoje. Meta: ${goal} min.` });
  }
}

// on load, if no study today, small reminder (non-intrusive)
window.addEventListener('load', async ()=>{
  const today = estudoDiario[todayKey()] || 0;
  if (today === 0 && Notification.permission !== 'denied') {
    // show a friendly in-page prompt (not push)
    // small banner could be implemented; for now show console + optional permission
    console.log('Lembrete: você ainda não estudou hoje — toque no cronômetro!');
  }
});

// ========== Export JSON / CSV ==========
exportJsonBtn.addEventListener('click', ()=>{
  const payload = { aulas, estudoDiario, sessions, pontos:points, generalNotes, achievements, dailyGoal: dailyGoalInput.value };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'painel_estudos_backup.json'; a.click();
});
exportCsvBtn.addEventListener('click', ()=>{
  const rows = [['aula','capitulo','concluida','tempo_min','notas']];
  aulas.forEach(a=>{
    rows.push([a.aula, a.capitulo, a.concluida, ((a.tempo||0)/60).toFixed(1), (a.notas||[]).map(n=> `"${n.text.replace(/"/g,'""')}"`).join('|')]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'aulas.csv'; a.click();
});

// ========== General notes ==========
saveGeneralNote.addEventListener('click', async ()=>{
  const t = generalNote.value.trim();
  if (!t) return;
  generalNotes.push({ text:t, date: new Date().toLocaleString() });
  generalNote.value='';
  persistLocalAll();
  if (currentUser) await saveUserToCloud(currentUser.uid);
  renderGeneralNotes();
});
function renderGeneralNotes(){
  generalNotesList.innerHTML = '';
  generalNotes.forEach(n=>{
    const div = document.createElement('div');
    div.innerHTML = `<p>${n.text} <small>${n.date}</small></p>`;
    generalNotesList.appendChild(div);
  });
}

// ========== Pomodoro ==========
function renderPom(){
  const m = Math.floor(pomSeconds/60);
  const s = pomSeconds%60;
  pomodoroDisplay.textContent = `${pad(m)}:${pad(s)}`;
}
startPom.addEventListener('click', ()=>{
  if (pomInterval) return;
  isBreak = false;
  pomSeconds = 25 * 60;
  pomStateEl.textContent = 'Foco';
  pomInterval = setInterval(()=>{
    pomSeconds--;
    renderPom();
    if (pomSeconds<=0){
      clearInterval(pomInterval); pomInterval = null;
      // play sound / notify
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Pomodoro', { body: isBreak? 'Fim do intervalo' : 'Fim do foco — faça pausa' });
      // toggle break
      if (!isBreak){
        isBreak = true;
        pomSeconds = 5 * 60;
        pomStateEl.textContent = 'Pausa';
        startPom.click();
      } else {
        pomStateEl.textContent = 'Pronto';
      }
    }
  },1000);
});
stopPom.addEventListener('click', ()=>{
  if (pomInterval) { clearInterval(pomInterval); pomInterval=null; pomStateEl.textContent = 'Parado'; }
});
skipPom.addEventListener('click', ()=>{
  if (pomInterval){ clearInterval(pomInterval); pomInterval=null; pomStateEl.textContent = 'Pulado'; }
});

// ========== UI helpers ==========
function updateGoalProgress(){
  const goal = Number(dailyGoalInput.value) || 0;
  const key = todayKey();
  const doneMin = Math.round((estudoDiario[key] || 0)/60);
  const pct = goal>0 ? Math.min(100, Math.round(doneMin / goal * 100)) : 0;
  goalProgress.style.width = pct + '%';
}

dailyGoalInput.addEventListener('change', async ()=>{
  persistLocalAll();
  if (currentUser) await saveUserToCloud(currentUser.uid);
  updateGoalProgress();
  renderChart();
});

// ========== Refresh UI ==========
function refreshUI(){
  computeTotals();
  renderAulas();
  renderNotesForSelected();
  renderChart();
  renderSessions();
  renderGeneralNotes();
  renderAchievements();
  updateGoalProgress();
  if (currentUser) fetchRanking();
}

// initial refresh
refreshUI();
computeAchievements();
if (currentUser) fetchRanking();

// update listeners for filter
filter.addEventListener('change', renderAulas);

// expose some functions for inline buttons
window.viewNotes = window.viewNotes;
window.toggleConclude = window.toggleConclude;
window.removeAula = window.removeAula;
window.removeNota = window.removeNota;

// ========== Register service worker for PWA (optional) ==========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW failed', err));
}

// ========== MODO ESCURO ==========
const toggleThemeBtn = document.getElementById('toggleTheme');
const body = document.body;

// aplica tema salvo
if (localStorage.getItem('theme') === 'dark') {
  body.classList.add('dark');
  toggleThemeBtn.textContent = '☀️ Modo Claro';
}

// alterna tema ao clicar
toggleThemeBtn.addEventListener('click', () => {
  body.classList.toggle('dark');
  const isDark = body.classList.contains('dark');
  toggleThemeBtn.textContent = isDark ? '☀️ Modo Claro' : '🌙 Modo Escuro';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});


