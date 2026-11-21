/*
 * IDIOMAS / LANGUAGES
 * Traduz textos visíveis no modo inglês sem alterar as regras da simulação.
 * This layer translates visible text in English mode without changing simulation rules.
 */
(() => {
  'use strict';

  const idioma = document.documentElement.lang === 'en' ? 'en' : 'pt';
  if (idioma !== 'en') return;

  const traducoes = {"🐟 Aquário do Gigio": "🐟 Gigio's Aquarium", "Laboratório multiagente": "Multi-agent laboratory", "JANELAS / WINDOWS:": "WINDOWS:", "Inspeção do agente / Agent inspection": "Agent inspection", "Histórico de decisões / Decision history": "Decision history", "Modelagem de perfis / Profile modeling": "Profile modeling", "AQUÁRIO DE AGENTES / AGENT AQUARIUM": "AGENT AQUARIUM", "Ⅱ Pausar / Pause": "Ⅱ Pause", "◎ Identificar cardumes / Identify schools / Identify schools": "◎ Identify schools", "Cardumes ainda não identificados / Schools not identified yet.": "Schools not identified yet.", "＋ Adicionar comida / Add food": "＋ Add food", "✕ Remover toda comida / Remove all food": "✕ Remove all food", "＋ Adicionar predador / Add predator": "＋ Add predator", "Remover predadores / Remove predators": "Remove predators", "Mar gerar comida / Ocean generates food": "Ocean generates food", "Intervalo / Interval": "Interval", "ciclos / cycles": "cycles", "Ativar reprodução / Enable reproduction": "Enable reproduction", "Ativar nascimento / Enable births": "Enable births", "Proteção dos bebês / Baby protection": "Baby protection", "PEIXES VIVOS / LIVE FISH": "LIVE FISH", "FILHOTES / BABIES": "BABIES", "PONTOS DE COMIDA / FOOD SOURCES": "FOOD SOURCES", "PREDADORES / PREDATORS": "PREDATORS", "CICLOS / CYCLES": "CYCLES", "FORMA / SHAPE:": "SHAPE:", "Espécie / Species": "Species", "Azul / Blue": "Blue", "Explorando / Exploring / patrulhando / patrolling": "Exploring / patrolling", "Amarelo / Yellow": "Yellow", "Procurando comida / Searching for food": "Searching for food", "Verde / Green": "Green", "Acompanhando cardume / Following the school": "Following the school", "Vermelho / Red": "Red", "Fugindo do predador / Fleeing from predator": "Fleeing from predator", "Roxo / Purple": "Purple", "Atacando outro peixe / Attacking another fish": "Attacking another fish", "Laranja / Orange": "Orange", "Alimentando-se de outro agente / Feeding on another agent": "Feeding on another agent", "Losango vermelho / Red diamond": "Red diamond", "Predador / Predator": "Predator", "Comida / Food": "Food", "INSPEÇÃO DO AGENTE / AGENT INSPECTION": "AGENT INSPECTION", "Clique em um indivíduo no aquário / Click an individual in the aquarium.": "Click an individual in the aquarium.", "Nenhum agente selecionado / No agent selected.": "No agent selected.", "Remover selecionado / Remove selected / Remove selected": "Remove selected", "HISTÓRICO DE DECISÕES / DECISION HISTORY": "DECISION HISTORY", "Selecione um peixe ou predador para consultar os acontecimentos e decisões recentes / Select a fish or predator to review recent events and decisions.": "Select a fish or predator to review recent events and decisions.", "MODELAGEM DE PERFIS COMPORTAMENTAIS / BEHAVIORAL PROFILE MODELING": "BEHAVIORAL PROFILE MODELING", "Perfil comportamental / Behavioral profile:": "Behavioral profile:", "Cooperativo / Cooperative": "Cooperative", "Explorador / Explorer": "Explorer", "Competitivo / Competitive": "Competitive", "Restaurar padrão / Restore defaults / Restore defaults": "Restore defaults", "Fechar inspeção / Close inspection": "Close inspection", "Fechar histórico / Close history": "Close history", "Fechar modelagem / Close modeling": "Close modeling", "Reiniciar / Reset": "Reset", "Zoom / Zoom out": "Zoom out", "Fome": "Hunger", "Energia": "Energy", "Decisão": "Decision", "Plano atual": "Current plan", "Gatilho": "Trigger", "Pensamento": "Reasoning", "Histórico": "History", "Explorar": "Explore", "Fugir": "Flee", "Buscar comida": "Search for food", "Alimentar-se": "Feed", "Patrulhar": "Patrol", "Investigar peixe": "Investigate fish", "Encontrei alimento": "I found food", "Estou com fome": "I am hungry", "Detectei um predador": "I detected a predator"};

  // Traduz textos e atributos acessíveis, preservando IDs, classes e eventos.
  function traduzirTexto(texto) {
    let resultado = texto;
    const chaves = Object.keys(traducoes).sort((a, b) => b.length - a.length);
    for (const origem of chaves) resultado = resultado.split(origem).join(traducoes[origem]);
    return resultado;
  }

  function traduzirNo(no) {
    if (no.nodeType === Node.TEXT_NODE) {
      no.nodeValue = traduzirTexto(no.nodeValue);
      return;
    }
    if (no.nodeType !== Node.ELEMENT_NODE) return;
    for (const atributo of ['aria-label', 'title', 'placeholder', 'alt']) {
      if (no.hasAttribute(atributo)) no.setAttribute(atributo, traduzirTexto(no.getAttribute(atributo)));
    }
    for (const filho of no.childNodes) traduzirNo(filho);
  }

  function iniciarTraducao() {
    traduzirNo(document.body);
    // Observa painéis, mensagens e históricos que surgem durante a simulação.
    const observador = new MutationObserver(registros => {
      for (const registro of registros) {
        if (registro.type === 'characterData') {
          const novoTexto = traduzirTexto(registro.target.nodeValue);
          if (novoTexto !== registro.target.nodeValue) registro.target.nodeValue = novoTexto;
        }
        for (const no of registro.addedNodes || []) traduzirNo(no);
      }
    });
    observador.observe(document.body, {subtree:true, childList:true, characterData:true});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarTraducao, {once:true});
  } else {
    iniciarTraducao();
  }
})();
