<?php
/*
 * AQUÁRIO DO GIGIO | GIGIO'S AQUARIUM
 * Material de estudo: Como funciona a inteligência de um NPC?
 *
 * IMPORTANTE PARA QUEM ESTÁ ESTUDANDO:
 * Este arquivo foi mantido funcionalmente idêntico à versão original.
 * Foram acrescentados comentários explicativos; nenhuma regra, condição,
 * variável, valor ou comportamento da simulação foi modificado.
 *
 * O PHP apenas entrega a página ao navegador. A simulação propriamente dita
 * é executada em JavaScript, usando o Canvas para desenhar o aquário.
 *
 * MAPA DOS SEIS SLIDES — ciclo de decisão de um agente:
 *   SLIDE 3 — PERCEPÇÃO: observar o ambiente e identificar estímulos.
 *   SLIDE 4 — MEMÓRIA DE TRABALHO: manter dados percebidos e estado atual.
 *   SLIDE 5 — PROCESSAMENTO: avaliar regras, prioridades e alternativas.
 *   SLIDE 6 — GATILHO: reconhecer a condição que autoriza uma resposta.
 *   SLIDE 7 — PLANO DE AÇÃO: definir o objetivo e a direção pretendida.
 *   SLIDE 8 — EXECUÇÃO: mover o agente e aplicar os efeitos da ação.
 *
 * SIX-SLIDE MAP — the agent's decision-making cycle:
 *   SLIDE 3 — PERCEPTION: observe the environment and identify stimuli.
 *   SLIDE 4 — WORKING MEMORY: keep perceived data and the current state available.
 *   SLIDE 5 — PROCESSING: evaluate rules, priorities, and alternatives.
 *   SLIDE 6 — TRIGGER: detect the condition that authorizes a response.
 *   SLIDE 7 — ACTION PLAN: define the goal and the intended direction.
 *   SLIDE 8 — EXECUTION: move the agent and apply the effects of its action.
 *
 * Os seis conceitos aparecem distribuídos pelo ciclo step(), não como seis
 * funções isoladas. Isso é importante: um NPC normalmente percebe, consulta
 * seu estado, decide e age continuamente, a cada atualização da simulação.
 */
?>
<!doctype html>
<html lang="<?= ($idioma === 'en') ? 'en' : 'pt-BR' ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= ($idioma === 'en') ? "Gigio's Aquarium — AI & Coffee" : "Aquário do Gigio — IA e Café" ?></title>
<link rel="stylesheet" href="estilos.css">

</head>
<body>

<!-- Seletor de idioma / Language selector. Both versions share the same simulation engine. -->
<nav class="language-switch" aria-label="Idioma / Language">
  <a href="pt.php" class="<?= $idioma === 'pt' ? 'active' : '' ?>">Português</a>
  <a href="en.php" class="<?= $idioma === 'en' ? 'active' : '' ?>">English</a>
</nav>

<header><h1>🐟 Aquário do Gigio <span class="title-english">| Gigio's Aquarium</span></h1><p>Laboratório multiagente / Multi-agent laboratory · IA e Café · simulação baseada em regras, não em consciência ou LLM / rule-based simulation, not consciousness or an LLM</p></header>
<!-- Barra fixa de acesso rápido: permite reabrir qualquer janela depois de fechá-la. -->
<nav class="window-launcher" aria-label="Abrir painéis do aquário / Open aquarium panels">
 <strong>JANELAS / WINDOWS:</strong>
 <button type="button" data-open-window="inspection">Inspeção do agente / Agent inspection</button>
 <button type="button" data-open-window="history">Histórico de decisões / Decision history</button>
 <button type="button" data-open-window="modeling">Modelagem de perfis / Profile modeling</button>
</nav>

<main class="layout">
<section>
 <div class="panel">
  <h2>AQUÁRIO DE AGENTES / AGENT AQUARIUM · 1500 × 900</h2>
  <div class="viewport" id="viewport"><canvas id="aquarium" width="1500" height="900"></canvas></div>
  <div class="toolbar">
   <button class="primary" id="play">Ⅱ Pausar / Pause</button>
   <button id="identifySchools">◎ Identificar cardumes / Identify schools / Identify schools</button><span id="schoolDetectionStatus" class="help">Cardumes ainda não identificados / Schools not identified yet.</span><button id="addFood">＋ Adicionar comida / Add food</button>
   <button class="danger" id="removeFood">✕ Remover toda comida / Remove all food</button><button id="addPredator">＋ Adicionar predador / Add predator</button>
   <button class="danger" id="removePredators">Remover predadores / Remove predators</button>
   <label class="mode-label"><input type="checkbox" id="autoFood" checked> Mar gerar comida / Ocean generates food</label>
   <label class="mode-label">Intervalo / Interval <input type="number" id="foodInterval" min="50" max="5000" step="50" value="300" style="width:76px"> ciclos / cycles</label>
   <label class="mode-label"><input type="checkbox" id="reproductionEnabled"> Ativar reprodução / Enable reproduction</label>
   <label class="mode-label"><input type="checkbox" id="birthEnabled"> Ativar nascimento / Enable births</label>
   <label class="mode-label"><input type="checkbox" id="babyProtection" checked> Proteção dos bebês / Baby protection</label>
   <button id="zoomOut">− Zoom / Zoom out</button><button id="zoomIn">＋ Zoom / Zoom in</button><button id="zoomReset">100%</button>
   <button id="reset">↻ Reiniciar / Reset</button>
  </div>
  <div class="stats">
   <div class="stat"><strong id="nFish">36</strong><span>PEIXES VIVOS / LIVE FISH</span></div><div class="stat"><strong id="nBaby">0</strong><span>FILHOTES / BABIES</span></div><div class="stat"><strong id="nFood">16</strong><span>PONTOS DE COMIDA / FOOD SOURCES</span></div><div class="stat"><strong id="nPred">1</strong><span>PREDADORES / PREDATORS</span></div><div class="stat"><strong id="cycle">0</strong><span>CICLOS / CYCLES</span></div>
  </div>
  <div class="legend">
   <span>FORMA / SHAPE: ● Espécie / Species SP1</span>
   <span>FORMA / SHAPE: ■ Espécie / Species SP2</span>
   <span>FORMA / SHAPE: ▲ Espécie / Species SP3</span>
  </div>
  <div class="legend">
   <span><i class="dot" style="background:#35b9f2"></i>Azul / Blue · Explorando / Exploring / patrulhando / patrolling</span>
   <span><i class="dot" style="background:#f5d547"></i>Amarelo / Yellow · Procurando comida / Searching for food</span>
   <span><i class="dot" style="background:#42b883"></i>Verde / Green · Acompanhando cardume / Following the school</span>
   <span><i class="dot" style="background:#f04444"></i>Vermelho / Red · Fugindo do predador / Fleeing from predator</span>
   <span><i class="dot" style="background:#b58cff"></i>Roxo / Purple · Atacando outro peixe / Attacking another fish</span>
   <span><i class="dot" style="background:#f08a36"></i>Laranja / Orange · Alimentando-se de outro agente / Feeding on another agent</span>
   <span><i class="dot" style="background:#f04444"></i>Losango vermelho / Red diamond · Predador / Predator</span>
   <span><i class="dot" style="background:#f5d547"></i>Comida / Food (20 porções / portions)</span>
  </div>
  <p class="help">PT: A forma identifica a espécie; a cor do corpo indica a decisão atual. Use “Identificar cardumes / Identify schools” para detectar aglomerados próximos de dois ou mais peixes da mesma espécie; a etiqueta e a faixa colorida mostram o cardume detectado. O mar pode repor comida; reprodução, nascimento e proteção dos filhotes são controles independentes. Os cardumes começam pacíficos: só atacam outros peixes se você ativar “Predar quando faminto”. Clique em um peixe, predador ou alimento para inspecionar / Click a fish, predator, or food source to inspect it. Use os botões JANELAS / WINDOWS para abrir ou fechar os painéis e arraste cada janela pela barra superior. A simulação usa regras programadas; os textos explicam as decisões, não representam pensamento de um LLM. EN: The shape identifies the species; the body color indicates the current decision. Use “Identificar cardumes / Identify schools / Identify schools” to detect nearby groups of two or more fish of the same species; the label and colored band show the detected school. The ocean can replenish food; reproduction, births, and baby protection are independent controls. Schools start peacefully and attack other fish only when “Predar quando faminto / Hunt when hungry” is enabled. Click a fish, predator, or food source to inspect it. Use the WINDOWS buttons to open or close panels, and drag each window by its title bar. The simulation uses programmed rules; its text explains decisions and does not represent the thoughts of an LLM.</p>
 </div>
</section>
</main>

<!--
  Janelas flutuantes independentes.
  Cada janela tem uma barra superior para arrastar e um botão X para fechar.
  Os botões da barra JANELAS, no topo da página, permitem reabri-las.
-->
<section class="floating-window" id="window-inspection" data-window="inspection"
         aria-label="Inspeção do agente">
 <div class="window-titlebar" data-drag-handle="inspection">
  <strong>INSPEÇÃO DO AGENTE / AGENT INSPECTION</strong>
  <button type="button" class="window-close" data-close-window="inspection" aria-label="Fechar inspeção / Close inspection">×</button>
 </div>
 <div class="window-content">
  <div id="status" class="help">Clique em um indivíduo no aquário / Click an individual in the aquarium.</div>
  <div id="inspection"><div class="empty">Nenhum agente selecionado / No agent selected.</div></div>
  <div class="toolbar"><button class="danger" id="removeSelected">Remover selecionado / Remove selected / Remove selected</button></div>
 </div>
</section>

<section class="floating-window" id="window-history" data-window="history"
         aria-label="Histórico de decisões / Decision history">
 <div class="window-titlebar" data-drag-handle="history">
  <strong>HISTÓRICO DE DECISÕES / DECISION HISTORY · MEMÓRIA EPISÓDICA / EPISODIC MEMORY</strong>
  <button type="button" class="window-close" data-close-window="history" aria-label="Fechar histórico / Close history">×</button>
 </div>
 <div class="window-content">
  <div class="help">Selecione um peixe ou predador para consultar os acontecimentos e decisões recentes / Select a fish or predator to review recent events and decisions.</div>
  <div id="history" class="history"><div class="empty">Nenhum agente selecionado / No agent selected.</div></div>
 </div>
</section>

<section class="floating-window" id="window-modeling" data-window="modeling"
         aria-label="Modelagem dos perfis comportamentais / Behavioral profile modeling">
 <div class="window-titlebar" data-drag-handle="modeling">
  <strong>MODELAGEM DE PERFIS COMPORTAMENTAIS / BEHAVIORAL PROFILE MODELING</strong>
  <button type="button" class="window-close" data-close-window="modeling" aria-label="Fechar modelagem / Close modeling">×</button>
 </div>
 <div class="window-content">
  <!-- Esta janela configura comportamento, não espécie nem identidade de cardume. -->
  <div class="toolbar group-picker">
   <span class="group-shape-preview" id="groupShape" aria-hidden="true">●</span>
   <label class="group-picker-label" for="group">Perfil comportamental / Behavioral profile:</label>
   <select id="group">
    <option value="A">● A · Cooperativo / Cooperative</option>
    <option value="B">■ B · Explorador / Explorer</option>
    <option value="C">▲ C · Competitivo / Competitive</option>
   </select>
   <button id="defaults">Restaurar padrão / Restore defaults / Restore defaults</button>
  </div>
  <!-- O modo alimentar é configurado para o perfil comportamental selecionado. -->
  <div class="toolbar group-picker">
   <label class="group-picker-label" for="feedingModeGroup">Comportamento alimentar / Feeding behavior:</label>
   <select id="feedingModeGroup" title="Define se este cardume permanece pacífico ou pode predar quando estiver com muita fome.">
    <option value="peaceful">Pacífico / Peaceful</option>
    <option value="hungry">Predar quando faminto / Hunt when hungry</option>
   </select>
  </div>
  <div class="help"><b>Importante:</b> A, B e C são perfis comportamentais, não espécies nem cardumes. Espécie é a identidade biológica; cardume é um agrupamento dinâmico de pelo menos dois peixes da mesma espécie. Os parâmetros acima configuram o perfil; os controles abaixo ligam ou desligam regras da espécie.</div>
  <div class="fields" id="fields"></div>

 </div>
</section>

<!--
  Painel fixo de regras globais:
  cada checkbox controla a mesma regra para todos os peixes, sem distinção de espécie.
-->
<section class="global-rules-dock" id="globalRulesDock" aria-label="Regras globais da simulação">
 <div class="global-rules-heading">
  <div>
   <strong>PAINEL DE IA / AI PANEL · REGRAS GLOBAIS DOS PEIXES / GLOBAL FISH RULES</strong>
   <p>Ative ou desative cada comportamento para todos os peixes do aquário. / Enable or disable each behavior for every fish in the aquarium. O predador natural é independente deste painel e captura peixes ao passar por cima deles. / The natural predator is independent of this panel and captures fish by passing over them.</p>
  </div>
  <div class="ai-panel-actions">
   <button type="button" id="enableAllGlobalRules">Ativar todas / Enable all / Enable all</button>
   <button type="button" id="disableAllGlobalRules">Desativar todas / Disable all / Disable all</button>
  </div>
 </div>
 <div id="globalRulesList" class="global-rules-list"></div>
 <p class="global-rules-note">Importante / Important: estas regras controlam somente os peixes. / These rules control fish only. O predador natural não obedece a estes checkboxes e continuará caçando e se alimentando dos peixes conforme sua própria lógica. / The natural predator does not follow these checkboxes and will continue hunting and feeding according to its own logic.</p>
</section>
<script src="IA.js" defer></script>
<script src="idiomas.js" defer></script>
</body>
</html>
