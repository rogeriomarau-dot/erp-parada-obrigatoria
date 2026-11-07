// Converte as linhas geradas pelo ERP em comandos ESC/POS (Epson, Elgin e Bematech em modo ESC/POS)
// e envia para a impressora pela rede (TCP, porta 9100).
import net from 'node:net';

const ESC = 0x1b, GS = 0x1d;

const CP850 = { 'Ç':0x80,'ü':0x81,'é':0x82,'â':0x83,'à':0x85,'ç':0x87,'ê':0x88,'É':0x90,'ô':0x93,'ú':0xa3,'á':0xa0,'í':0xa1,'ó':0xa2,
  'ª':0xa6,'º':0xa7,'Á':0xb5,'Â':0xb6,'À':0xb7,'ã':0xc6,'Ã':0xc7,'Ê':0xd2,'Í':0xd6,'Ó':0xe0,'Ô':0xe2,'õ':0xe4,'Õ':0xe5,'Ú':0xe9,'Ü':0x9a };

export function semAcento(s){ return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ºª]/g, '.').replace(/[^\x20-\x7e\n]/g, '?'); }

function codifica(s, modo){
  s = String(s ?? '');
  if (modo === 'cp850') return Buffer.from([...s].map(c => CP850[c] ?? (c.charCodeAt(0) < 128 ? c.charCodeAt(0) : semAcento(c).charCodeAt(0) || 0x3f)));
  if (modo === 'cp1252') return Buffer.from([...s].map(c => { const n = c.charCodeAt(0); return n < 256 ? n : (semAcento(c).charCodeAt(0) || 0x3f); }));
  return Buffer.from(semAcento(s), 'ascii');
}

function quebra(texto, w){
  const out = [];
  for (let p of String(texto ?? '').split('\n')) {
    while (p.length > w) { let k = p.lastIndexOf(' ', w); if (k < w * 0.5) k = w; out.push(p.slice(0, k)); p = p.slice(k).trimStart(); }
    out.push(p);
  }
  return out;
}

/** Monta o buffer ESC/POS de um trabalho de impressão. prn = {colunas, acentos} */
export function montar(linhas, prn = {}){
  const W = +prn.colunas || 48; const modo = prn.acentos || 'sem';
  const partes = [];
  const raw = (...b) => partes.push(Buffer.from(b));
  const txt = s => partes.push(codifica(s, modo));
  raw(ESC, 0x40);                                   // inicializa
  if (modo === 'cp850') raw(ESC, 0x74, 2);          // tabela de caracteres 850
  if (modo === 'cp1252') raw(ESC, 0x74, 16);        // tabela WPC1252
  for (const l of linhas || []) {
    if (l.hr) { raw(ESC, 0x61, 0); txt('-'.repeat(W) + '\n'); continue; }
    if (l.feed) { raw(ESC, 0x64, Math.min(10, +l.feed || 1)); continue; }
    const w = l.g ? Math.floor(W / 2) : W;
    raw(ESC, 0x45, l.b ? 1 : 0);                    // negrito
    raw(GS, 0x21, l.g ? 0x11 : 0x00);               // tamanho (altura e largura dupla)
    if (l.kv) {
      raw(ESC, 0x61, 0);
      const [a, b] = l.kv.map(x => String(x ?? ''));
      if (a.length + b.length + 1 > w) { quebra(a, w).forEach(x => txt(x + '\n')); txt(' '.repeat(Math.max(0, w - b.length)) + b + '\n'); }
      else txt(a + ' '.repeat(w - a.length - b.length) + b + '\n');
    } else {
      raw(ESC, 0x61, l.a === 'c' ? 1 : l.a === 'r' ? 2 : 0);
      quebra(l.s, w).forEach(x => txt(x + '\n'));
    }
    raw(GS, 0x21, 0x00); raw(ESC, 0x45, 0);
  }
  raw(ESC, 0x61, 0);
  raw(ESC, 0x64, 4);                                // avança papel
  raw(GS, 0x56, 66, 0);                             // corte parcial
  return Buffer.concat(partes);
}

/** Envia o buffer para ip:porta. Resolve quando a impressora aceitou os dados. */
export function enviar(ip, porta, buf, timeoutMs = 8000){
  return new Promise((resolve, reject) => {
    if (!ip) return reject(new Error('Impressora sem IP configurado'));
    const sock = net.createConnection({ host: ip, port: +porta || 9100 });
    let ok = false;
    const t = setTimeout(() => { sock.destroy(); reject(new Error(`Sem resposta de ${ip}:${porta || 9100} (desligada, sem rede ou IP errado)`)); }, timeoutMs);
    sock.on('connect', () => { sock.write(buf, () => { ok = true; sock.end(); }); });
    sock.on('error', e => { clearTimeout(t); reject(new Error(`${ip}:${porta || 9100} — ${e.code || e.message}`)); });
    sock.on('close', () => { clearTimeout(t); if (ok) resolve(); else reject(new Error(`${ip}:${porta || 9100} — conexão encerrada pela impressora`)); });
  });
}
