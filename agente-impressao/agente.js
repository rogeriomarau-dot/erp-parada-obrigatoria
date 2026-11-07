// =====================================================================
//  Programa de impressão — ERP Espaço Parada Obrigatória
//  Fica rodando no computador do caixa. Escuta a fila "impressoes" no
//  Firebase e manda cada pedido para a impressora certa (cozinha, copa,
//  tele/retirada e caixa) pela rede, em ESC/POS.
//
//  Uso:
//    node agente.js                 -> modo normal (fica escutando)
//    node agente.js --teste IP      -> imprime uma folha de teste direto no IP (sem Firebase)
// =====================================================================
import fs from 'node:fs';
import os from 'node:os';
import { montar, enviar } from './escpos.js';

const VERSAO = '1.0.0';
const AQUI = new URL('.', import.meta.url);
const log = (...a) => { const l = `[${new Date().toLocaleString('pt-BR')}] ${a.join(' ')}`; console.log(l); try { fs.appendFileSync(new URL('agente.log', AQUI), l + '\n'); } catch {} };

// ---------- modo teste direto ----------
const iTeste = process.argv.indexOf('--teste');
if (iTeste > -1) {
  const ip = process.argv[iTeste + 1]; const porta = +(process.argv[iTeste + 2] || 9100);
  const linhas = [{a:'c', s:'TESTE DIRETO', g:1, b:1}, {a:'c', s:'Programa de impressao'}, {hr:1}, {kv:['IP', `${ip}:${porta}`]}, {a:'l', s:new Date().toLocaleString('pt-BR')}, {a:'l', s:'Acentos: ação, pão, café, coração'}, {hr:1}];
  try { await enviar(ip, porta, montar(linhas, {colunas:48, acentos:'sem'})); console.log('OK: teste enviado para', ip); process.exit(0); }
  catch (e) { console.error('FALHOU:', e.message); process.exit(1); }
}

// ---------- configuração ----------
let conf;
try { conf = JSON.parse(fs.readFileSync(new URL('config.json', AQUI), 'utf8')); }
catch (e) { console.error('Não encontrei o config.json ao lado do agente.js. Copie o config.exemplo.json para config.json e preencha.'); process.exit(1); }
if (!conf.firebase?.projectId || !conf.email || !conf.senha) { console.error('Preencha firebase, email e senha no config.json'); process.exit(1); }

const { initializeApp } = await import('firebase/app');
const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
const F = await import('firebase/firestore');

const app = initializeApp(conf.firebase);
const auth = getAuth(app);
const db = F.getFirestore(app);
const MAQUINA = conf.nomeMaquina || os.hostname();
const MAX_TENT = 5, VALIDADE_MIN = conf.validadeMinutos || 120;

let impressoras = {};
const fila = new Map();     // id -> dados (pendentes a processar)
let rodando = false;

async function login(){
  for (;;) {
    try { await signInWithEmailAndPassword(auth, conf.email, conf.senha); log('Conectado ao Firebase como', conf.email); return; }
    catch (e) { log('Falha no login:', e.code || e.message, '— tentando de novo em 30 s'); await new Promise(r => setTimeout(r, 30000)); }
  }
}

async function processar(){
  if (rodando) return; rodando = true;
  try {
    while (fila.size) {
      const [id, j] = fila.entries().next().value; fila.delete(id);
      await imprimir(id, j);
    }
  } finally { rodando = false; }
}

async function imprimir(id, j){
  const ref = F.doc(db, 'impressoes', id);
  // reserva o trabalho (evita imprimir duas vezes se houver dois programas abertos)
  let dados;
  try {
    dados = await F.runTransaction(db, async t => {
      const s = await t.get(ref); if (!s.exists()) return null; const d = s.data();
      if (d.status !== 'pendente' && d.status !== 'erro') return null;
      t.update(ref, { status:'imprimindo', agente:MAQUINA, inicioEm:new Date().toISOString() });
      return d;
    });
  } catch (e) { log('Não consegui reservar', id, e.code || e.message); return; }
  if (!dados) return;
  const idade = (Date.now() - new Date(dados.criadoEm)) / 60000;
  if (idade > VALIDADE_MIN) { await F.updateDoc(ref, { status:'expirado', erro:`Não impresso: ficou ${Math.round(idade)} min na fila. Use Reimprimir se ainda precisar.` }); log('Expirado', dados.destino, dados.ref); return; }
  const p = Object.assign({ colunas:48, acentos:'sem', porta:9100, ativa:true }, impressoras[dados.destino] || {});
  const tent = (dados.tentativas || 0) + 1;
  try {
    if (p.ativa === false) throw new Error(`Impressora ${dados.destino} marcada como inativa`);
    await enviar(p.ip, p.porta, montar(dados.linhas, p));
    await F.updateDoc(ref, { status:'impresso', impressoEm:new Date().toISOString(), tentativas:tent, erro:F.deleteField() });
    log('Impresso', dados.destino.padEnd(8), dados.ref || '', `(${p.ip})`);
  } catch (e) {
    await F.updateDoc(ref, { status:'erro', erro:e.message, tentativas:tent, ultimaTentativa:new Date().toISOString() }).catch(() => {});
    log('ERRO', dados.destino, dados.ref || '', '-', e.message, `(tentativa ${tent}/${MAX_TENT})`);
  }
}


async function main(){
  log(`Programa de impressão v${VERSAO} iniciando em ${MAQUINA}`);
  await login();

  F.onSnapshot(F.doc(db, 'config', 'impressoras'), s => { impressoras = s.exists() ? s.data() : {}; log('Impressoras:', Object.entries(impressoras).map(([k, v]) => `${k}=${v.ip || '?'}`).join(' ')); },
    e => log('Erro lendo configuração das impressoras:', e.code || e.message));

  F.onSnapshot(F.query(F.collection(db, 'impressoes'), F.where('status', '==', 'pendente')), s => {
    s.docChanges().forEach(c => { if (c.type !== 'removed') fila.set(c.doc.id, c.doc.data()); });
    processar();
  }, e => log('Erro escutando a fila:', e.code || e.message));

  // nova tentativa automática para os que deram erro (impressora sem papel, desligada…)
  setInterval(async () => {
    try {
      const s = await F.getDocs(F.query(F.collection(db, 'impressoes'), F.where('status', '==', 'erro')));
      s.forEach(d => { const x = d.data(); if ((x.tentativas || 0) < MAX_TENT && Date.now() - new Date(x.ultimaTentativa || 0) > 15000) fila.set(d.id, x); });
      processar();
    } catch (e) { log('Erro buscando falhas:', e.code || e.message); }
  }, 20000);

  // sinal de vida (o ERP mostra "conectado" na tela Impressões)
  const sinal = () => F.setDoc(F.doc(db, 'config', 'agente'), { ultimoSinal:new Date().toISOString(), maquina:MAQUINA, versao:VERSAO }).catch(e => log('Sem internet? sinal falhou:', e.code || e.message));
  sinal(); setInterval(sinal, 30000);
}

process.on('unhandledRejection', e => log('Erro inesperado:', e?.message || e));
main();
