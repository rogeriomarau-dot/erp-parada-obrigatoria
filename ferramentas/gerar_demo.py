"""Gera demo.html (versão de demonstração pública) a partir do index.html de produção.

Uso:  python3 ferramentas/gerar_demo.py
- Sem conexão com o Firebase (dados só no navegador de quem testa).
- Sem nome, logo, cardápio e fichas do Espaço Parada Obrigatória.
"""
import pathlib, re, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
s = (RAIZ / 'index.html').read_text(encoding='utf-8')

def troca(a, b, n=1, regex=False):
    global s
    if regex:
        s, k = re.subn(a, b, s, flags=re.S)
    else:
        k = s.count(a); s = s.replace(a, b)
    if k != n:
        sys.exit(f'gerar_demo: esperava {n} ocorrência(s), achei {k}: {a[:70]}')

# 1) sem Firebase -> modo demonstração
troca(r"const CFG = \{.*?\n\};", "const CFG = {};", regex=True)
# 2) sem logo e sem dados do cliente embutidos
troca(r'const LOGO = "data:[^"]*";', 'const LOGO = "";', regex=True)
troca(r'<link rel="icon" href="data:[^"]*">', '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2214%22 fill=%22%23D62828%22/%3E%3Ctext x=%2232%22 y=%2244%22 font-size=%2236%22 font-family=%22Arial%22 font-weight=%22700%22 fill=%22white%22 text-anchor=%22middle%22%3EF%3C/text%3E%3C/svg%3E">\n<meta name="robots" content="noindex">', regex=True)
troca(r'const CARDAPIO = \{.*?\};\n', 'const CARDAPIO = {"produtos":[],"adicionais":[]};\n', regex=True)
troca(r'const ESTR_FICHAS = \{.*?\};\n', 'const ESTR_FICHAS = {"insumos":[],"sps":[],"fts":[],"revenda":[],"adicionais":[]};\n', regex=True)
# 3) marca
troca('<title>ERP Parada Obrigatória</title>', '<title>ERP Finance Gestão Pro · Demonstração</title>')
troca("const GERAL_PADRAO = { nome:'Espaço Parada Obrigatória',", "const GERAL_PADRAO = { nome:'Meu Restaurante',")
troca('<h1>ERP Parada Obrigatória</h1>', '<h1>ERP Finance Gestão Pro</h1>', n=2)
troca('<div><b>Parada Obrigatória</b><small>ERP · Finance Gestão Pro</small></div>', '<div><b>Finance Gestão Pro</b><small>ERP para restaurantes · demonstração</small></div>')
troca("'ERP ' + (G().nome || 'Parada Obrigatória')", "'ERP ' + (G().nome || 'Finance Gestão Pro')")
troca('backup-parada-obrigatoria-', 'backup-erp-demonstracao-')
troca('ERP ESPAÇO PARADA OBRIGATÓRIA — Finance Gestão Pro', 'ERP Finance Gestão Pro — versão de demonstração')
# 4) sem logo: some com as imagens vazias
troca('</style>', 'img[src=""]{display:none}\n</style>')
# 5) dados de teste separados de qualquer outro teste no mesmo navegador (mesmo tamanho do prefixo)
troca("'epo_demo_'", "'fgp_demo_'", n=s.count("'epo_demo_'") or 1)
troca("'epo-demo'", "'fgp-demo'", n=s.count("'epo-demo'") or 1)
# 6) aviso
troca('MODO DEMONSTRAÇÃO · dados só neste navegador · nada é impresso de verdade',
      'DEMONSTRAÇÃO · os dados ficam só neste navegador · para guardar, use Configurações › Baixar backup completo')

(RAIZ / 'demo.html').write_text(s, encoding='utf-8')
print('demo.html gerado:', len(s), 'bytes')
