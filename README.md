# ERP Espaço Parada Obrigatória

Sistema de gestão do Espaço Parada Obrigatória, desenvolvido pela Finance Gestão Pro.
**Módulo 1 (esta versão): vendas e pedidos.** Inclui mesas, garçom no celular, caixa, tele-entrega e retirada, clientes, impressão na cozinha, na copa, na tele e no caixa, e o relatório de vendas.
Os próximos módulos (financeiro, plano de contas, compras, estoque/CMV e relatórios) já aparecem no menu como "em breve".

## Estrutura

```
public/index.html          o ERP (tela, regras de negócio e conexão com o Firebase)
firestore.rules            regras de segurança do banco (quem lê e grava o quê)
firestore.indexes.json     índices do banco (vazio por enquanto)
firebase.json              configuração da hospedagem
agente-impressao/          programa que roda no computador do caixa e imprime os pedidos
```

## Como testar agora (sem Firebase)

Abra `public/index.html` no navegador. Com a configuração do Firebase vazia, o sistema abre em **modo demonstração**:
- os dados ficam só naquele navegador;
- nada é impresso de verdade, mas a tela **Impressões › Ver** mostra como o papel sairia.

Para ver os pedidos chegando em tempo real, abra duas abas, uma como Garçom e outra como Caixa.

## Colocar em produção

### 1. Firebase (uma vez)
1. Em console.firebase.google.com, crie o projeto `erp-parada-obrigatoria`.
2. **Authentication** › Começar › ative **E-mail/senha**.
3. **Firestore Database** › Criar banco › região **southamerica-east1 (São Paulo)** › modo produção.
4. **Configurações do projeto** › Seus apps › **Web** (`</>`). Copie o bloco `firebaseConfig` para:
   - a constante `CFG` no início do `<script>` de `public/index.html`;
   - o `config.json` do programa de impressão (passo 4).

### 2. Publicar
No computador onde já está instalada a ferramenta do Firebase (a mesma usada no Truckcar):
```
firebase login
firebase use --add            (escolha erp-parada-obrigatoria)
firebase deploy
```
Endereço do sistema: `https://erp-parada-obrigatoria.web.app`

### 3. Primeiro acesso
1. Abra o endereço e crie a conta do **administrador**.
2. Em **Produtos**, clique em **Importar cardápio das fichas técnicas**. Isso cadastra os 66 produtos e os 13 adicionais. Confira o destino de cada produto (Cozinha ou Copa).
3. Em **Configurações**, preencha os dados do cupom, a taxa de serviço, a taxa de entrega, o número de mesas e o **IP de cada impressora**.
4. Em **Usuários e acessos**, crie:
   - um usuário para cada **garçom** (perfil Garçom);
   - o usuário do **caixa** (perfil Caixa);
   - um usuário **Programa de impressão**, por exemplo `impressora@…`. Ele é usado só pelo computador do caixa.

### 4. Programa de impressão (computador do caixa, Windows)
1. Instale o **Node.js LTS** (nodejs.org).
2. Copie a pasta `agente-impressao` para o computador, por exemplo `C:\ParadaObrigatoria\agente-impressao`.
3. Rode `instalar.bat`. Ele baixa o que é preciso e cria o `config.json`.
4. Abra o `config.json` e preencha:
   - a configuração do Firebase (passo 1);
   - o e-mail e a senha do usuário **Programa de impressão**.
5. Rode `testar-impressora.bat` com o IP de cada impressora. Deve sair uma folha de teste.
6. Rode `iniciar.bat`. A janela precisa ficar aberta: se o programa cair, ele reinicia sozinho.
7. **Para iniciar junto com o Windows:** tecle `Win + R`, digite `shell:startup` e coloque ali um atalho do `iniciar.bat`.

Na tela **Impressões** do ERP aparece "Programa de impressão conectado" quando está tudo certo.

### Impressoras
- As quatro impressoras ficam em rede (cabo), na porta 9100: cozinha e copa (Bematech), tele/retirada (Elgin) e caixa (Epson).
- **Fixe o IP** de cada impressora no roteador (reserva de DHCP). Se o IP mudar, os pedidos não saem.
- **Bematech:** precisa estar no modo **ESC/POS**. Algumas MP-4200 TH vêm de fábrica no modo ESC/Bema. A troca é feita pelo utilitário da Bematech ou pelo menu da impressora (segure o botão de avanço ao ligar).
- Se os acentos saírem errados, deixe a opção **Acentos = Sem acentos** em Configurações. Esse é o padrão.
- Se a impressora estiver desligada ou sem papel, o pedido fica com **Erro** e o programa tenta de novo sozinho (até 5 vezes). Também dá para **Reimprimir** pela tela Impressões.
- Pedidos que ficaram mais de 2 horas na fila não são impressos (ficam como "Expirado"). Assim a cozinha não recebe pedido velho quando o computador volta a ligar.

### Celulares dos garçons
Abra o endereço do sistema no navegador do celular, entre com o usuário do garçom e use **Adicionar à tela inicial**. O acesso fica salvo.
Se o Wi-Fi cair, o pedido fica guardado no celular e é enviado quando a conexão voltar.

## Backup
O plano gratuito do Firebase não tem backup automático. A exportação de backup entra junto com o módulo financeiro.
