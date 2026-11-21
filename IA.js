/*
 * MOTOR DA SIMULAÇÃO — JavaScript
 * A função autoexecutável mantém as variáveis internas protegidas neste escopo.
 * O navegador chama step() repetidamente para avançar o mundo em ciclos.
 */
(() => {
'use strict';
const canvas=document.getElementById('aquarium'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
// A cor do peixe representa seu estado/decisão atual, e não seu cardume.
 // A identidade do cardume será mostrada exclusivamente pela forma geométrica.
 const decisionColors={
  explorar:'#35b9f2',                    // Azul: exploração sem estímulo prioritário.
  buscar_comida:'#f5d547',               // Amarelo: deslocamento em busca de alimento.\n  alimentando_se:'#ffe58a',                // Amarelo-claro: está consumindo alimento.
  acompanhar_cardume:'#42b883',          // Verde: coesão com companheiros do mesmo grupo.
  seguir_lider_comida:'#42b883',             // Verde: acompanhando socialmente o integrante que iniciou a busca.
  investigar_peixe:'#f08a36',             // Laranja: predador investigando um anúncio de alimento.
  fugir:'#f04444',                        // Vermelho: fuga após detectar um predador.
  atacar:'#b58cff',                       // Roxo: tentativa de atacar outro peixe.
  alimentar_se_de_outro_agente:'#f08a36', // Laranja: consumiu outro agente.
  proteger_bebe:'#65d6c2'                  // Turquesa: protegendo um filhote do cardume.
 };
 // Cor de segurança para qualquer decisão que ainda não tenha uma cor específica.
 const defaultDecisionColor='#35b9f2';
const names={A:'Cooperativo',B:'Explorador',C:'Competitivo'};
// A fome aumenta 0,30 ponto por ciclo. Como cada ciclo dura 120 ms,
// isso equivale a aproximadamente 2,5 pontos por segundo de simulação.
// A fome aumenta 0,10 ponto por ciclo (aprox. 0,83 ponto por segundo).
// Com fome inicial 35 e início da busca em 75, o peixe leva cerca de 48 segundos
// para começar a procurar alimento. Isso permite observar o cardume mais tempo.
const base={agressividade:30,instinto:35,campo_visao:145,fome_inicial:35,taxa_fome:.10,limiar_fome:70,margem_fome:5,aleatoriedade:12,sociabilidade:72,medo:65,velocidade:2.2,distancia_seguranca:48};
const modifiers={A:{sociabilidade:22,aleatoriedade:-5,agressividade:-15,medo:12,distancia_seguranca:12,velocidade:-.1},B:{sociabilidade:-28,aleatoriedade:28,agressividade:0,medo:-8,distancia_seguranca:0,velocidade:.35},C:{sociabilidade:-12,aleatoriedade:5,agressividade:28,medo:-18,distancia_seguranca:-14,velocidade:.25}};
const specs=[['agressividade','Agressividade',0,100,1],['instinto','Instinto',0,100,1],['campo_visao','Campo de visão',20,300,5],['fome_inicial','Fome inicial',0,100,1],['taxa_fome','Taxa de fome',0,2,.05],['limiar_fome','Limiar de fome',0,100,1],['margem_fome','Margem de fome',0,30,1],['aleatoriedade','Aleatoriedade',0,100,1],['sociabilidade','Sociabilidade',0,100,1],['medo','Medo',0,100,1],['velocidade','Velocidade',.5,5,.1],['distancia_seguranca','Distância segura',5,150,1]];
// Cada cardume possui seu próprio comportamento alimentar.
// Todos começam pacíficos; A, B e C podem ser configurados separadamente.
const feedingModes={A:'peaceful',B:'peaceful',C:'peaceful'};
function predationEnabledFor(school){
 return feedingModes[school]==='hungry';
}

// Tempo de espera sem encontrar outro cardume antes de permitir atacar o próprio.
// 300 ciclos x 120 ms por ciclo equivalem a aproximadamente 36 segundos.
const OWN_GROUP_FALLBACK_CYCLES=300;

let models={A:{...base},B:{...base},C:{...base}},group='A',world,paused=false,cycle=0,selected=null,zoomLevel=1,nextFood=17,nextPred=2;
// Identifica o agente que está aberto no painel para preservar a expansão das seções.
let lastInspectionKey=null;

// Configurações globais do ecossistema. A comida nasce automaticamente a cada
// intervalo definido em ciclos; reprodução, nascimento e proteção são controles independentes.
// Reprodução e nascimento começam ativos para que a população se renove
// automaticamente durante a demonstração. Os controles da interface continuam
// permitindo desligar cada processo separadamente.
const ecology={autoFood:true,foodInterval:300,reproduction:true,births:true,babyProtection:true};
// Filas de reprodução independentes para cada cardume social.
const INITIAL_SCHOOL_IDS=['S1','S2','S3','S4','S5'];
// Paleta de cores para os agrupamentos espaciais identificados pelo usuário.
const DETECTED_SCHOOL_COLORS=['#35b9f2','#42b883','#f5d547','#b58cff','#f08a36','#ff6b9a','#7bdff2','#c2f970','#ff9f1c','#d6a2e8'];
// A identificação visual só acontece quando o botão é acionado.
let schoolDetectionActive=false;
let detectedSchoolCount=0;
const SCHOOL_NEIGHBOR_DISTANCE=105; // Distância máxima entre vizinhos do mesmo cardume.
const pendingBirths=Object.fromEntries(INITIAL_SCHOOL_IDS.map(id=>[id,[]]));
// Anúncios locais de alimento: o peixe emite um aviso ao redor de sua posição.
// Qualquer peixe ou predador dentro do raio pode ouvi-lo, independentemente do cardume.
const foodAnnouncements=[];
const FOOD_HEARING_RADIUS=260; // Distância máxima para ouvir o anúncio.
const FOOD_ANNOUNCEMENT_DURATION=150; // 18 segundos em ciclos de 120 ms.
const FOOD_ANNOUNCEMENT_COOLDOWN=90; // Evita que o mesmo peixe repita o aviso continuamente.
// Destino coletivo de exploração: o cardume percorre o aquário como grupo,
// em vez de cada peixe escolher uma direção aleatória independente.
const schoolExploration=Object.fromEntries(INITIAL_SCHOOL_IDS.map(id=>[id,null]));
const FOOD_SIGNAL_DURATION=300; // 300 ciclos x 120 ms = cerca de 36 segundos.
const FOOD_SIGNAL_LINGER=90; // O cardume continua seguindo por 10,8 s após o líder se alimentar.
const MIN_HUNGER_TO_EAT=60; // Um peixe satisfeito acompanha o grupo, mas não consome porções sem necessidade.
const MEAL_COOLDOWN_CYCLES=60; // Evita consumir várias porções em sequência enquanto permanece sobre a comida.
// Cada cardume tenta reproduzir aproximadamente a cada 200 ciclos.
const REPRODUCTION_INTERVAL_CYCLES=200;
const BIRTH_DELAY_CYCLES=200;
const nextReproductionCycle=Object.fromEntries(INITIAL_SCHOOL_IDS.map(id=>[id,REPRODUCTION_INTERVAL_CYCLES]));
const BABY_MATURITY_CYCLES=600; // 600 ciclos de 120 ms = 72 segundos para facilitar o teste visual.
const FOOD_PORTIONS_PER_SPAWN=12;
// Agenda de regras por espécie: cada espécie possui seus próprios interruptores.
// Desligar uma regra impede a execução daquela ação, não apenas reduz sua intensidade.
const SPECIES_RULE_DEFINITIONS=[
 ['swim','Nadar','Permite qualquer deslocamento físico. É a regra-mestra do movimento.'],
 ['explore','Explorar','Permite explorar o ambiente quando não há prioridade maior.'],
 ['metabolism','Sentir fome','Permite o aumento gradual da fome ao longo dos ciclos.'],
 ['seekFood','Buscar alimento','Permite iniciar e executar buscas por comida.'],
 ['eat','Alimentar-se','Permite consumir porções de comida.'],
 ['announceFood','Anunciar alimento','Permite avisar outros agentes sobre comida percebida.'],
 ['hearFood','Ouvir anúncios','Permite receber anúncios locais de alimento.'],
 ['social','Interagir com o cardume','Permite coesão, alinhamento e interação social com companheiros.'],
 ['followAdults','Acompanhar adultos','Permite que filhotes acompanhem adultos da mesma espécie/cardume.'],
 ['flee','Fugir','Permite executar fuga quando um predador é percebido.'],
 ['protectBabies','Proteger filhotes','Permite que adultos protejam filhotes ameaçados.'],
 ['predation','Peixes predarem','Permite que os peixes ataquem outros peixes quando os demais critérios forem atendidos. Não controla o predador natural.'],
 ['reproduce','Reproduzir','Permite iniciar processos de reprodução.'],
 ['beBorn','Nascer','Permite que nascimentos agendados aconteçam.'],
 ['mature','Amadurecer','Permite que filhotes atinjam a fase adulta ao cumprir a idade mínima.']
];
// As regras são globais: existe um único interruptor por comportamento.
// Todas as espécies e todos os peixes consultam exatamente o mesmo estado.
const globalRules=Object.fromEntries(SPECIES_RULE_DEFINITIONS.map(([key])=>[key,true]));
function ruleEnabled(fish,rule){
 return globalRules[rule]!==false;
}

function rand(min,max){return min+Math.random()*(max-min)}
function modelFor(g){let m={...models[g]};for(const [k,v] of Object.entries(modifiers[g]))m[k]+=v;return m}
/*
 * MEMÓRIA DE TRABALHO — estrutura de dados do agente.
 *
 * makeFish() cria a ficha interna de cada peixe. É aqui que ficam reunidos
 * dados que o NPC precisa consultar durante a simulação:
 *   - posição e velocidade: onde está e como está se deslocando;
 *   - fome e energia: condições internas que influenciam decisões;
 *   - decision: estado/decisão atual;
 *   - currentPlan: objetivo que está tentando cumprir;
 *   - trigger: condição que justificou a decisão;
 *   - target: identificador do alvo, quando existe;
 *   - memory e history: registros de acontecimentos e decisões anteriores.
 *
 * A memória de trabalho não é uma consciência. É o conjunto de informações
 * estruturadas que o código mantém disponíveis para o próximo processamento.
 */
function makeFish(id,g,options={}){
 return{
  id,
  // Espécie biológica e cardume social são dimensões independentes.
  // group permanece como perfil comportamental do agente.
  speciesId:options.speciesId??'SP1',
  schoolId:options.schoolId??INITIAL_SCHOOL_IDS[(id-1)%INITIAL_SCHOOL_IDS.length],
  detectedSchoolId:null, // Rótulo visual atribuído pela detecção espacial.
  group:g,x:options.x??rand(100,1400),y:options.y??rand(80,820),
  vx:rand(-1,1),vy:rand(-1,1),hunger:options.hunger??base.fome_inicial,
  energy:options.energy??100,search:false,noOtherPreySince:null,
  // Impede que o mesmo peixe consuma porções repetidamente enquanto está parado sobre a comida.
  lastMealCycle:-1000,
  // Controle de avisos: impede spam e registra qual anúncio o peixe já ouviu.
  lastFoodAnnouncementCycle:-1000,
  heardFoodAnnouncementId:null,
  // Peixes iniciais já são adultos; recém-nascidos começam com idade zero.
  isBaby:options.isBaby??false,ageCycles:options.ageCycles??10000,
  sex:options.sex??(Math.random()<.5?'F':'M'),parentGroup:g,
  decision:'explorar',currentPlan:options.isBaby?'Acompanhar os adultos do cardume':'Explorar o ambiente',thought:options.isBaby?'Acabei de nascer. Vou acompanhar meu cardume.':'Acabei de iniciar. Vou observar o ambiente.',
  trigger:options.isBaby?'Nascimento':'Inicialização',
  memory:[`Ciclo 0: agente do cardume ${g} inicializado`],
  history:[{cycle,decision:'explorar',trigger:options.isBaby?'Nascimento':'Inicialização'}],
  target:null,lastAttack:-1000,
  // A intenção de movimento permanece por vários ciclos para evitar zigue-zague.
  wanderTarget:null,searchTarget:null,nextWanderCycle:0,nextSearchCycle:0,
  planVector:null,nextDecisionCycle:0
 };
}
function makePred(id){return{
 id,x:850,y:450,vx:0.7,vy:0.3,hunger:25,satisfaction:80,energy:100,
 decision:'patrulhar',currentPlan:'Patrulhar o ambiente',
 thought:'Estou satisfeito. Vou observar o ambiente.',trigger:'Inicialização',
 // Patrulha com destino persistente: o predador percorre o território em vez de tremer no lugar.
 patrolTarget:null,nextPatrolCycle:0,
 memory:['Predador inicializado'],history:[{cycle:0,decision:'patrulhar',trigger:'Inicialização'}]
}}
function resetWorld(){
 world={fish:Array.from({length:36},(_,i)=>makeFish(i+1,['A','B','C'][i%3],{
  // Distribuição equilibrada: 12 círculos SP1, 12 quadrados SP2 e 12 triângulos SP3.
  // O perfil A/B/C continua sendo definido separadamente, sem determinar a espécie.
  speciesId:['SP1','SP2','SP3'][i%3],
  schoolId:INITIAL_SCHOOL_IDS[i%INITIAL_SCHOOL_IDS.length]
 })), food:Array.from({length:16},(_,i)=>({id:i+1,x:rand(60,1440),y:rand(50,850),portions:20})),pred:[makePred(1)]};
 cycle=0;selected=null;nextFood=17;nextPred=2;nextFish=37;
 schoolDetectionActive=false;detectedSchoolCount=0;
 $('schoolDetectionStatus').textContent='Cardumes ainda não identificados / Schools not identified yet.';
 for(const schoolId of INITIAL_SCHOOL_IDS)pendingBirths[schoolId]=[];
 foodAnnouncements.length=0;
 for(const schoolId of INITIAL_SCHOOL_IDS)schoolExploration[schoolId]=null;
 for(const schoolId of INITIAL_SCHOOL_IDS)nextReproductionCycle[schoolId]=REPRODUCTION_INTERVAL_CYCLES;
 updatePanels();
}
/*
 * MEMÓRIA / REGISTRO:
 * log() guarda acontecimentos recentes em uma lista limitada.
 * hist() registra mudanças de decisão e o gatilho associado.
 * Esses registros ajudam a explicar o comportamento no painel de inspeção;
 * não são, por si só, o mecanismo que escolhe a próxima ação.
 */
function log(a,msg){a.memory.push(`Ciclo ${cycle}: ${msg}`);if(a.memory.length>12)a.memory.shift()}
function hist(a,decision,trigger){a.history.push({cycle,decision,trigger});if(a.history.length>20)a.history.shift()}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

// Calcula a menor distância entre um peixe e o trajeto percorrido pelo predador
// em um ciclo. Isso evita que uma captura seja perdida quando o predador avança
// alguns pixels e "salta" de um lado para o outro da presa entre duas verificações.
function distancePointToSegment(point,start,end){
 const segmentX=end.x-start.x;
 const segmentY=end.y-start.y;
 const segmentLengthSquared=segmentX*segmentX+segmentY*segmentY;

 // Se o predador praticamente não se moveu, considera apenas a posição atual.
 if(segmentLengthSquared===0)return dist(point,start);

 // Projeta a posição do peixe sobre o segmento e limita o resultado
 // ao trecho realmente percorrido pelo predador neste ciclo.
 const projection=((point.x-start.x)*segmentX+(point.y-start.y)*segmentY)/segmentLengthSquared;
 const clampedProjection=Math.max(0,Math.min(1,projection));
 const closestPoint={
  x:start.x+clampedProjection*segmentX,
  y:start.y+clampedProjection*segmentY
 };
 return dist(point,closestPoint);
}

function unit(x,y){let d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}}

// Procura uma posição livre próxima ao ponto de referência; se estiver cheio,
// amplia gradualmente o raio para evitar que o filhote nasça sobre outro agente.
function findFreePosition(centerX,centerY,minimumDistance=20){
 for(let attempt=0;attempt<40;attempt++){
  const angle=Math.random()*Math.PI*2;
  const radius=minimumDistance+attempt*2;
  const x=Math.max(12,Math.min(1488,centerX+Math.cos(angle)*radius));
  const y=Math.max(12,Math.min(888,centerY+Math.sin(angle)*radius));
  if(world.fish.every(f=>Math.hypot(f.x-x,f.y-y)>=minimumDistance)&&world.pred.every(p=>Math.hypot(p.x-x,p.y-y)>=minimumDistance)){
   return{x,y};
  }
 }
 return{x:rand(30,1470),y:rand(30,870)};
}

// O mar repõe alimento em pontos aleatórios, sem ultrapassar 24 pontos ativos.
function spawnOceanFood(){
 if(world.food.length>=24)return;
 const x=rand(45,1455),y=rand(45,855);
 // Evita nascer comida praticamente em cima de um peixe ou predador.
 const crowded=world.fish.some(f=>Math.hypot(f.x-x,f.y-y)<35)||world.pred.some(p=>Math.hypot(p.x-x,p.y-y)<35);
 if(crowded)return;
 world.food.push({id:nextFood++,x,y,portions:FOOD_PORTIONS_PER_SPAWN});
}

// Reprodução e nascimento são controles globais e independentes.
// Os dois precisam estar ligados: a reprodução agenda o filhote e a regra
// Nascer permite que o agendamento seja convertido em um novo agente.
function processReproduction(){
 if(ecology.reproduction){
  for(const schoolId of INITIAL_SCHOOL_IDS){
   if(cycle<(nextReproductionCycle[schoolId]||0))continue;
   const adults=world.fish.filter(f=>f.schoolId===schoolId&&ruleEnabled(f,'reproduce')&&!f.isBaby&&f.ageCycles>=BABY_MATURITY_CYCLES&&f.hunger<70&&f.energy>35);
   let pair=null,bestDistance=Infinity;
   for(let i=0;i<adults.length;i++)for(let j=i+1;j<adults.length;j++){
    const d=dist(adults[i],adults[j]);
    if(adults[i].sex!==adults[j].sex&&d<90&&d<bestDistance){pair=[adults[i],adults[j]];bestDistance=d;}
   }
   if(pair){
    pendingBirths[schoolId].push({
     // O filhote nasce 200 ciclos após a reprodução ser iniciada.
     due:cycle+BIRTH_DELAY_CYCLES,
     parentX:(pair[0].x+pair[1].x)/2,
     parentY:(pair[0].y+pair[1].y)/2,
     speciesId:pair[0].speciesId,
     profile:pair[0].group
    });
    // O mesmo cardume pode iniciar uma nova reprodução após mais 200 ciclos.
    nextReproductionCycle[schoolId]=cycle+REPRODUCTION_INTERVAL_CYCLES;
    log(pair[0],`Reprodução iniciada no cardume ${schoolId}`);
    log(pair[1],`Reprodução iniciada no cardume ${schoolId}`);
   }else nextReproductionCycle[schoolId]=cycle+REPRODUCTION_INTERVAL_CYCLES;
  }
 }
 if(ecology.births){
  for(const schoolId of INITIAL_SCHOOL_IDS){
   const queue=pendingBirths[schoolId];
   for(let i=queue.length-1;i>=0;i--){
    if(cycle<queue[i].due)continue;
    // As regras agora são globais; o nascimento consulta o mesmo interruptor
    // usado pelo painel inferior, sem depender da antiga matriz por espécie.
    if(!ruleEnabled(null,'beBorn'))continue;
    const birth=queue.splice(i,1)[0],pos=findFreePosition(birth.parentX,birth.parentY,18);
    const baby=makeFish(nextFish++,birth.profile,{x:pos.x,y:pos.y,isBaby:true,ageCycles:0,hunger:20,energy:65,speciesId:birth.speciesId,schoolId});
    world.fish.push(baby);
    log(baby,`Nasci na espécie ${baby.speciesId}, no cardume ${schoolId}`);
    hist(baby,'nascer','Nascimento agendado pela reprodução');
   }
  }
 }
}

// Quando um predador se aproxima de um filhote, adultos do mesmo cardume
// deslocam-se para perto dele e formam uma barreira móvel entre a ameaça e o bebê.
function babyProtectionVector(fish){
 if(!ecology.babyProtection||!ruleEnabled(fish,'protectBabies')||fish.isBaby)return null;
 const babies=world.fish.filter(b=>b.isBaby&&b.schoolId===fish.schoolId);
 let chosen=null,nearest=Infinity;
 for(const baby of babies){
  const predator=world.pred.filter(p=>dist(p,baby)<260).sort((a,b)=>dist(a,baby)-dist(b,baby))[0];
  if(!predator)continue;
  const d=dist(fish,baby);
  if(d<180&&d<nearest){chosen={baby,predator};nearest=d;}
 }
 if(!chosen)return null;

 // Os adultos ocupam posições diferentes em um arco do lado do predador,
 // evitando que todos tentem chegar exatamente ao mesmo ponto.
 const adults=world.fish.filter(f=>f.schoolId===fish.schoolId&&!f.isBaby&&dist(f,chosen.baby)<180)
  .sort((a,b)=>a.id-b.id);
 const index=Math.max(0,adults.findIndex(a=>a.id===fish.id));
 const count=Math.max(1,adults.length);
 const away=unit(chosen.baby.x-chosen.predator.x,chosen.baby.y-chosen.predator.y);
 const baseAngle=Math.atan2(away.y,away.x);
 const spread=(index-(count-1)/2)*0.22;
 const angle=baseAngle+spread;
 const guardX=chosen.baby.x+Math.cos(angle)*30;
 const guardY=chosen.baby.y+Math.sin(angle)*30;
 return unit(guardX-fish.x,guardY-fish.y);
}

// Corrige sobreposições após todos os movimentos. A separação é simétrica,
// respeita as bordas do aquário e evita que os agentes ocupem o mesmo ponto.
function resolveFishOverlaps(){
 for(let pass=0;pass<3;pass++){
  for(let i=0;i<world.fish.length;i++){
   for(let j=i+1;j<world.fish.length;j++){
    const a=world.fish[i],b=world.fish[j];
    let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    const minimum=(a.isBaby||b.isBaby)?15:19;
    if(d>=minimum)continue;
    if(d<.001){const angle=Math.random()*Math.PI*2;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
    const nx=dx/d,ny=dy/d;
    const aCanMove=ruleEnabled(a,'swim');
    const bCanMove=ruleEnabled(b,'swim');
    // Se ambos podem nadar, cada um recebe metade do deslocamento corretivo.
    // Se apenas um pode nadar, ele absorve todo o desvio e o peixe imóvel permanece parado.
    const push=(minimum-d)/2;
    if(aCanMove&&bCanMove){
     a.x=Math.max(8,Math.min(1492,a.x-nx*push));
     a.y=Math.max(8,Math.min(892,a.y-ny*push));
     b.x=Math.max(8,Math.min(1492,b.x+nx*push));
     b.y=Math.max(8,Math.min(892,b.y+ny*push));
    }else if(aCanMove&&!bCanMove){
     a.x=Math.max(8,Math.min(1492,a.x-nx*(minimum-d)));
     a.y=Math.max(8,Math.min(892,a.y-ny*(minimum-d)));
    }else if(!aCanMove&&bCanMove){
     b.x=Math.max(8,Math.min(1492,b.x+nx*(minimum-d)));
     b.y=Math.max(8,Math.min(892,b.y+ny*(minimum-d)));
    }
   }
  }
 }
}

// Um peixe que percebe alimento emite um anúncio local ao redor de sua posição.
 // O anúncio não é transmitido para o aquário inteiro: só agentes dentro do raio
 // conseguem ouvi-lo. O predador também pode ouvir e investigar a região.
function updateFoodAnnouncements(){
 // Remove anúncios expirados ou cuja fonte de alimento já acabou.
 for(let i=foodAnnouncements.length-1;i>=0;i--){
  const announcement=foodAnnouncements[i];
  const food=world.food.find(item=>item.id===announcement.foodId&&item.portions>0);
  const speaker=world.fish.find(f=>f.id===announcement.speakerId);
  if(cycle>=announcement.expires||!food||!speaker){
   foodAnnouncements.splice(i,1);
   continue;
  }
  // A área de audição acompanha o peixe que está avisando o grupo.
  announcement.speakerX=speaker.x;
  announcement.speakerY=speaker.y;
  announcement.foodX=food.x;
  announcement.foodY=food.y;
 }

 // Qualquer peixe adulto pode descobrir alimento dentro do próprio campo de visão.
 for(const fish of world.fish){
  if(!ruleEnabled(fish,'announceFood')||fish.isBaby||cycle-fish.lastFoodAnnouncementCycle<FOOD_ANNOUNCEMENT_COOLDOWN)continue;
  const model=modelFor(fish.group);
  const food=world.food
   .filter(item=>item.portions>0&&dist(fish,item)<model.campo_visao)
   .sort((a,b)=>dist(fish,a)-dist(fish,b))[0];
  if(!food)continue;

  // Evita vários peixes anunciarem a mesma fonte ao mesmo tempo.
  const alreadyAnnounced=foodAnnouncements.some(a=>
   a.foodId===food.id&&cycle<a.expires&&dist(fish,{x:a.speakerX,y:a.speakerY})<FOOD_HEARING_RADIUS*.7
  );
  if(alreadyAnnounced)continue;

  const announcement={
   id:`${fish.id}-${cycle}`,
   speakerId:fish.id,
   speakerGroup:fish.group,
   speakerX:fish.x,
   speakerY:fish.y,
   foodId:food.id,
   foodX:food.x,
   foodY:food.y,
   created:cycle,
   expires:cycle+FOOD_ANNOUNCEMENT_DURATION
  };
  foodAnnouncements.push(announcement);
  fish.lastFoodAnnouncementCycle=cycle;
  log(fish,`Encontrei alimento e emiti um aviso local. Alcance: ${FOOD_HEARING_RADIUS} unidades.`);
  hist(fish,'avisar_alimento','Alimento percebido e anúncio local emitido');
 }
}

// Retorna o anúncio válido mais próximo que o agente consegue ouvir.
function foodAnnouncementHeardBy(agent){
 return foodAnnouncements
  .filter(a=>cycle<a.expires&&dist(agent,{x:a.speakerX,y:a.speakerY})<=FOOD_HEARING_RADIUS)
  .sort((a,b)=>dist(agent,{x:a.speakerX,y:a.speakerY})-dist(agent,{x:b.speakerX,y:b.speakerY}))[0]||null;
}

// Cada cardume escolhe uma região para explorar em conjunto.
 // O rumo usa a direção média atual com uma variação suave, evitando giros aleatórios.
function updateSchoolExploration(){
 for(const school of INITIAL_SCHOOL_IDS){
  const members=world.fish.filter(f=>f.schoolId===school&&!f.isBaby);
  if(!members.length)continue;
  const center=members.reduce((acc,f)=>({x:acc.x+f.x,y:acc.y+f.y}),{x:0,y:0});
  center.x/=members.length;center.y/=members.length;
  const heading=members.reduce((acc,f)=>({x:acc.x+f.vx,y:acc.y+f.vy}),{x:0,y:0});
  const current=schoolExploration[school];
  if(!current||cycle>=current.nextCycle||dist(center,current)<55){
   const baseHeading=Math.hypot(heading.x,heading.y)>0.15
    ?Math.atan2(heading.y,heading.x):rand(0,Math.PI*2);
   // Desvia no máximo cerca de 50 graus da direção predominante do cardume.
   const angle=baseHeading+rand(-0.88,0.88);
   const distance=rand(260,420);
   schoolExploration[school]={
    x:Math.max(70,Math.min(1430,center.x+Math.cos(angle)*distance)),
    y:Math.max(70,Math.min(830,center.y+Math.sin(angle)*distance)),
    nextCycle:cycle+Math.floor(rand(100,160))
   };
  }
 }
}

/*
 * CICLO CENTRAL DO NPC — aqui os seis conceitos se encontram.
 *
 * Cada chamada de step() representa uma atualização do mundo.
 * O ciclo avança, o ambiente muda e cada agente recebe uma oportunidade
 * de perceber, recuperar informações, processar condições e agir.
 *
 * SLIDE 3 — PERCEPÇÃO (primeira parte):
 * O NPC não precisa conhecer tudo o que existe no aquário. O código consulta
 * o que está dentro de seus limites de visão/audição e transforma isso em
 * informações disponíveis para a decisão. Exemplos abaixo: ameaças próximas,
 * alimento visível e anúncios que chegaram ao raio de audição.
 *
 * SLIDE 3 — PERCEPTION (first part):
 * The NPC does not need to know everything in the aquarium. The code checks
 * what is within its vision and hearing ranges and turns those observations
 * into information available for decision-making. Examples include nearby
 * threats, visible food, and announcements received within hearing range.
 */
let nextFish=37;
function step(){
 cycle++;
 // O oceano renova os recursos no intervalo configurado.
 if(ecology.autoFood&&cycle%ecology.foodInterval===0)spawnOceanFood();
 // Atualiza idade, reprodução e nascimentos antes das decisões individuais.
 for(const fish of world.fish){
  fish.ageCycles++;
  if(fish.isBaby&&ruleEnabled(fish,'mature')&&fish.ageCycles>=BABY_MATURITY_CYCLES){
   fish.isBaby=false;
   log(fish,'Atingi a maturidade e agora sou adulto');
   hist(fish,'amadurecer','Idade mínima de maturidade atingida');
  }
 }
 processReproduction();

 /*
  * SLIDE 4 — MEMÓRIA DE TRABALHO (estado interno atualizado):
  * Antes de escolher uma ação, o agente atualiza variáveis que representam
  * sua condição atual. A fome, por exemplo, é um estado interno acumulado
  * ciclo após ciclo. O NPC compara esse estado com limites configurados.
  * Não é uma lembrança humana: é informação numérica disponível ao algoritmo.
  * This is not human memory; it is numerical information available to the algorithm.
  */
 // Atualiza a fome de todos os peixes antes de decidir o comportamento coletivo.
 // Assim, o cardume sabe se algum integrante precisa procurar alimento neste ciclo.
 for(const fish of world.fish){
  const model=modelFor(fish.group);
  if(ruleEnabled(fish,'metabolism'))fish.hunger=Math.min(100,fish.hunger+model.taxa_fome);
  if(ruleEnabled(fish,'seekFood')&&!fish.isBaby&&!fish.search&&fish.hunger>=model.limiar_fome+model.margem_fome){
   fish.search=true;
   log(fish,'Fome ativou busca por alimento');
  }
  if(fish.isBaby)fish.search=false;
  if((!ruleEnabled(fish,'seekFood'))||(fish.search&&fish.hunger<=model.limiar_fome-model.margem_fome))fish.search=false;
 }

 /*
  * SLIDE 3 — PERCEPÇÃO (audição / estímulos recebidos):
  * updateFoodAnnouncements() atualiza os avisos existentes. Em seguida, cada
  * peixe consulta foodAnnouncementHeardBy() para saber se recebeu um aviso
  * dentro do raio permitido. O predador também pode interpretar esse sinal.
  */
 // Peixes próximos podem ouvir os anúncios locais de alimento.
 updateFoodAnnouncements();

 // Predadores: caçam quando percebem uma presa e, fora da caça, patrulham rotas persistentes.
 for(const p of world.pred){
  p.hunger=Math.min(100,p.hunger+.16);
  p.satisfaction=Math.max(0,p.satisfaction-.1);
  const visiblePrey=world.fish.filter(f=>dist(p,f)<230);
  // O predador natural prioriza filhotes; se não houver, caça o adulto mais próximo.
  const prey=visiblePrey.sort((a,b)=>(a.isBaby?0:1)-(b.isBaby?0:1)||dist(p,a)-dist(p,b))[0];
  // O predador interpreta o anúncio de outra maneira:
  // para os peixes, o aviso significa "há alimento por aqui";
  // para o predador, significa "há um peixe nesta região".
  // Ele usa a posição do peixe que emitiu o aviso, nunca a posição da comida.
  const heardAnnouncement=foodAnnouncementHeardBy(p);

  if(p.hunger>=55&&prey){
   // A caça interrompe imediatamente a patrulha.
   // Guardamos o ponto inicial para detectar colisão em todo o trajeto,
   // e não somente na posição final do predador.
   const previousPosition={x:p.x,y:p.y};
   const direction=unit(prey.x-p.x,prey.y-p.y);
   p.vx=p.vx*.25+direction.x*.75;
   p.vy=p.vy*.25+direction.y*.75;
   const velocity=unit(p.vx,p.vy);
   p.x+=velocity.x*3.4;
   p.y+=velocity.y*3.4;

   // O detector considera que houve captura quando o predador passa por cima
   // ou suficientemente perto do peixe durante este ciclo.
   // O raio de 24 unidades contempla o tamanho visual dos agentes e pequenas
   // diferenças de posição entre a atualização dos peixes e a do predador.
   const captureDistance=distancePointToSegment(prey,previousPosition,{x:p.x,y:p.y});
   const captureRadius=24;

   p.decision='caçar';
   p.currentPlan=`Perseguir o peixe #${prey.id}`;
   p.trigger='Fome e presa percebida no campo de visão';
   p.thought=`Estou com fome e percebi o peixe #${prey.id}. Vou persegui-lo e capturá-lo quando passar por cima dele.`;
   if(p._lastDecision!=='caçar'){hist(p,p.decision,p.trigger);p._lastDecision='caçar'}

   // A captura é imediata quando o trajeto cruza a área de colisão da presa.
   if(captureDistance<=captureRadius){
    world.fish=world.fish.filter(f=>f!==prey);
    p.hunger=Math.max(0,p.hunger-65);
    p.satisfaction=Math.min(100,p.satisfaction+70);
    p.decision='alimentar-se';
    p.currentPlan='Presa detectada no contato: alimentar-se';
    p.trigger='Contato com a presa';
    p.thought=`Passei sobre o peixe #${prey.id} e o capturei. Minha fome diminuiu; vou retomar a patrulha.`;
    log(p,`Detectei contato e comi o peixe #${prey.id}`);
    hist(p,p.decision,p.trigger);
    p._lastDecision='alimentar-se';
    p.patrolTarget=null;
   }
  }else if(heardAnnouncement){
   // O predador não segue a comida anunciada.
   // Ele interpreta o som como um indício de presença de outro peixe
   // e investiga a posição de quem emitiu o aviso.
   // A posição do emissor é apenas uma pista: a presa só será perseguida
   // quando realmente entrar no campo de visão do predador.
   p.patrolTarget={x:heardAnnouncement.speakerX,y:heardAnnouncement.speakerY};
   const investigateDirection=unit(p.patrolTarget.x-p.x,p.patrolTarget.y-p.y);
   p.vx=p.vx*.82+investigateDirection.x*.18;
   p.vy=p.vy*.82+investigateDirection.y*.18;
   const velocity=unit(p.vx,p.vy);
   p.x+=velocity.x*2.55;
   p.y+=velocity.y*2.55;
   p.decision='investigar_peixe';
   p.currentPlan=`Investigar a presença do peixe #${heardAnnouncement.speakerId}`;
   p.trigger=`Sinal de peixe ouvido a ${Math.round(dist(p,{x:heardAnnouncement.speakerX,y:heardAnnouncement.speakerY}))} unidades`;
   p.thought=`Ouvi um sinal indicando a presença do peixe #${heardAnnouncement.speakerId}. Vou investigar a posição dele; só começo a caçar quando conseguir enxergar uma presa.`;
   if(p._lastDecision!=='investigar_peixe'){
    hist(p,p.decision,p.trigger);
    p._lastDecision='investigar_peixe';
   }
  }else{
   // Sem presa visível ou anúncio audível, mantém a patrulha persistente.
   if(!p.patrolTarget||p.decision==='investigar_peixe'||cycle>=p.nextPatrolCycle||dist(p,p.patrolTarget)<38){
    const currentHeading=Math.hypot(p.vx,p.vy)>0.15
     ?Math.atan2(p.vy,p.vx):rand(0,Math.PI*2);
    const angle=currentHeading+rand(-1.05,1.05);
    const distance=rand(260,460);
    p.patrolTarget={
     x:Math.max(45,Math.min(1455,p.x+Math.cos(angle)*distance)),
     y:Math.max(45,Math.min(855,p.y+Math.sin(angle)*distance))
    };
    p.nextPatrolCycle=cycle+Math.floor(rand(120,190));
   }
   const patrolDirection=unit(p.patrolTarget.x-p.x,p.patrolTarget.y-p.y);
   p.vx=p.vx*.86+patrolDirection.x*.14;
   p.vy=p.vy*.86+patrolDirection.y*.14;
   const velocity=unit(p.vx,p.vy);
   p.x+=velocity.x*2.25;
   p.y+=velocity.y*2.25;
   p.decision='patrulhar';
   p.currentPlan='Percorrer o território em busca de presas';
   p.trigger=p.hunger>=55?'Nenhuma presa detectada; patrulha ativa':'Patrulha territorial';
   p.thought='Não percebi uma presa no meu campo de visão. Vou percorrer outra região do território e continuar observando.';
   if(p._lastDecision!=='patrulhar'){hist(p,p.decision,p.trigger);p._lastDecision='patrulhar'}
  }
  // Mantém o predador dentro dos limites do aquário.
  p.x=Math.max(12,Math.min(1488,p.x));
  p.y=Math.max(12,Math.min(888,p.y));
 }

 /*
  * SLIDE 3 — PERCEPÇÃO INDIVIDUAL:
  * No laço abaixo, o agente reúne observações relevantes do seu entorno:
  * amigos do mesmo cardume, peixes de outros cardumes, predadores, filhotes,
  * anúncios ouvidos e comida que está efetivamente dentro do campo de visão.
  *
  * SLIDE 4 — MEMÓRIA DE TRABALHO:
  * Os valores calculados (friends, others, threats, localAnnouncement etc.)
  * ficam disponíveis durante o processamento deste peixe neste ciclo.
  * O agente também consulta seus estados persistentes, como fome, energia,
  * plano anterior e alvo atual.
  */
 // Atualiza o destino de exploração compartilhado antes das decisões dos peixes.
 updateSchoolExploration();
 const survivors=[];
 for(const f of world.fish){
  const m=modelFor(f.group);
  const friends=ruleEnabled(f,'social')?world.fish.filter(o=>o!==f&&o.schoolId===f.schoolId&&dist(f,o)<m.campo_visao):[];
  const others=ruleEnabled(f,'social')?world.fish.filter(o=>o!==f&&o.schoolId!==f.schoolId&&dist(f,o)<m.campo_visao):[];
  const threats=world.pred.filter(p=>dist(f,p)<m.campo_visao);
  // Filhotes não lideram buscas; a fome deles não os afasta dos adultos.
  let dx=0,dy=0;
  const protectionVector=ruleEnabled(f,'protectBabies')?babyProtectionVector(f):null;
  // O peixe só conhece anúncios emitidos dentro de seu raio de audição.
  const localAnnouncement=ruleEnabled(f,'hearFood')?foodAnnouncementHeardBy(f):null;
  const announcedFood=localAnnouncement
   ?world.food.find(food=>food.id===localAnnouncement.foodId&&food.portions>0)
   :null;
  const hearsNewAnnouncement=!!localAnnouncement&&f.heardFoodAnnouncementId!==localAnnouncement.id;
  if(hearsNewAnnouncement){
   f.heardFoodAnnouncementId=localAnnouncement.id;
   log(f,`Ouvi o peixe #${localAnnouncement.speakerId} anunciar alimento nas proximidades.`);
   hist(f,'ouvir_alimento','Anúncio local recebido dentro do raio de audição');
  }
  // Exploração e acompanhamento têm persistência: a cada 8 ciclos (0,96 s)
  // o agente reavalia o ambiente. Ameaças, fome e proteção continuam podendo
  // interromper esse intervalo imediatamente.
  const holdCurrentPlan=!!f.planVector&&cycle<f.nextDecisionCycle&&
   !f.search&&!threats.length&&!protectionVector&&
   !(localAnnouncement&&f.hunger>=MIN_HUNGER_TO_EAT)&&
   (f.decision==='acompanhar_cardume');
  /*
   * SLIDE 5 — PROCESSAMENTO:
   * Esta é uma das partes mais importantes para demonstrar a lógica do NPC.
   * O código compara as informações percebidas com regras e prioridades.
   * Não escolhe uma ação por acaso: percorre condições em uma ordem definida.
   *
   * A sequência abaixo funciona como uma hierarquia de decisão. Uma ameaça
   * pode ter prioridade sobre a busca de alimento; outras condições entram
   * em cena somente quando as anteriores não se aplicam.
   *
   * SLIDE 6 — GATILHO:
   * Cada condição verdadeira funciona como um gatilho para ativar uma resposta.
   * Exemplo: se threats.length for maior que zero e a regra 'flee' estiver
   * Example: if threats.length is greater than zero and the 'flee' rule is
   * habilitada, o gatilho "Predador detectado" autoriza a decisão de fugir.
   * enabled, the "Predator detected" trigger authorizes the flee decision.
   */
  // PIRÂMIDE DE PRIORIDADES: 1) fugir de predador; 2) seguir alimento/buscar comida;
  // 3) filhote acompanha adultos; 4) proteção coletiva; 5) coesão; 6) exploração.
  // A ameaça imediata sempre interrompe qualquer plano.
  if(threats.length&&ruleEnabled(f,'flee')){let v=unit(f.x-threats[0].x,f.y-threats[0].y);dx=v.x;dy=v.y;f.decision='fugir';f.currentPlan='Afastar-se do predador';f.trigger='Predador detectado';f.thought='Detectei um predador. Vou me afastar.'}
  else if(f.isBaby&&ruleEnabled(f,'followAdults')){
   // Filhotes acompanham o adulto mais próximo, evitando perseguir comida ou explorar sozinhos.
   const adults=world.fish.filter(o=>o!==f&&o.schoolId===f.schoolId&&!o.isBaby);
   const adult=adults.sort((a,b)=>dist(f,a)-dist(f,b))[0];
   if(adult&&dist(f,adult)>24){
    const follow=unit(adult.x-f.x,adult.y-f.y);
    dx=follow.x;dy=follow.y;
   }else if(adult){
    dx=adult.vx*.35;dy=adult.vy*.35;
   }
   f.decision='acompanhar_cardume';
   f.currentPlan='Acompanhar os adultos e permanecer protegido';
   f.trigger='Comportamento de acompanhamento de filhote';
   f.thought='Sou filhote. Vou acompanhar os adultos mais próximos e não me afastar para procurar alimento sozinho.';
  }
  else if(ruleEnabled(f,'seekFood')&&localAnnouncement&&announcedFood&&f.hunger>=MIN_HUNGER_TO_EAT){
   // Só peixes famintos que conseguem ouvir o anúncio se deslocam até a fonte.
   // Peixes satisfeitos ou fora do raio continuam com seu comportamento normal.
   const target=unit(announcedFood.x-f.x,announcedFood.y-f.y);
   dx=target.x;dy=target.y;
   f.decision='buscar_comida';
   f.currentPlan=`Ir até o alimento anunciado pelo peixe #${localAnnouncement.speakerId}`;
   f.trigger='Anúncio local ouvido dentro do raio de audição';
   f.thought=`Ouvi o peixe #${localAnnouncement.speakerId} anunciar alimento perto de mim. Vou verificar a fonte.`;
  }
  else if(ruleEnabled(f,'seekFood')&&f.search){
   // Só considera fontes com porções disponíveis dentro do campo de visão.
   // Um ponto distante não é conhecimento do peixe: ele precisa explorar para encontrá-lo.
   const visibleFood=world.food
    .filter(food=>food.portions>0&&dist(f,food)<m.campo_visao)
    .sort((a,b)=>dist(f,a)-dist(f,b))[0];
   if(visibleFood){
    const v=unit(visibleFood.x-f.x,visibleFood.y-f.y);
    dx=v.x;dy=v.y;
    f.decision='buscar_comida';
    f.currentPlan='Nadar até a fonte de alimento percebida';
    f.trigger='Alimento percebido dentro do campo de visão';
    f.thought='Estou com fome e percebi uma fonte de alimento próxima. Vou me aproximar.';
   }else{
    // Sem alimento percebido, o peixe mantém uma rota exploratória persistente.
    // A busca não depende de a lista global de comida estar vazia.
    if(!f.searchTarget||cycle>=f.nextSearchCycle||dist(f,f.searchTarget)<35){
     const angle=rand(0,Math.PI*2);
     const distance=rand(180,360);
     f.searchTarget={
      x:Math.max(30,Math.min(1470,f.x+Math.cos(angle)*distance)),
      y:Math.max(30,Math.min(870,f.y+Math.sin(angle)*distance))
     };
     f.nextSearchCycle=cycle+Math.floor(rand(35,65));
    }
    const searchDirection=unit(f.searchTarget.x-f.x,f.searchTarget.y-f.y);
    dx=searchDirection.x;dy=searchDirection.y;
    f.decision='buscar_comida';
    f.currentPlan='Percorrer o ambiente procurando alimento';
    f.trigger='Fome elevada, mas não há alimento percebido';
    f.thought='Estou com fome e mantenho uma rota de busca. Ainda não encontrei alimento.';
   }
  }
  else if(protectionVector){
   dx=protectionVector.x*1.25;
   dy=protectionVector.y*1.25;
   f.decision='proteger_bebe';
   f.currentPlan='Aproximar-se do filhote e formar uma barreira';
   f.trigger='Filhote do cardume ameaçado por predador';
   f.thought='Um filhote do meu cardume está em perigo. Vou me aproximar para formar uma barreira de proteção.';
  }
  else if(holdCurrentPlan){
   // Continua executando o plano anterior sem recalcular a decisão a cada ciclo.
   dx=f.planVector.x;
   dy=f.planVector.y;
  }
  else if(friends.length){
   // Mesmo quando já há vizinhos próximos, o cardume continua avançando para
   // o destino coletivo de exploração; coesão não significa ficar parado em grupo.
   let cx=0,cy=0,vx=0,vy=0,sx=0,sy=0;
   for(const o of friends){
    cx+=o.x;cy+=o.y;vx+=o.vx;vy+=o.vy;
    const d=Math.max(1,dist(f,o));
    if(d<m.distancia_seguranca){sx+=(f.x-o.x)/d;sy+=(f.y-o.y)/d}
   }
   const schoolTarget=schoolExploration[f.group];
   const targetDirection=schoolTarget
    ?unit(schoolTarget.x-f.x,schoolTarget.y-f.y)
    :unit(vx,vy);
   const cohesion=unit(cx/friends.length-f.x,cy/friends.length-f.y);
   const alignment=unit(vx/friends.length,vy/friends.length);
   const separation=unit(sx,sy);
   const social=m.sociabilidade/100;
   dx=targetDirection.x*.55+alignment.x*.25+cohesion.x*social*.28+separation.x*.9;
   dy=targetDirection.y*.55+alignment.y*.25+cohesion.y*social*.28+separation.y*.9;
   f.decision='acompanhar_cardume';
   f.currentPlan='Explorar junto ao cardume, mantendo coesão e distância segura';
   f.trigger='Companheiros próximos e destino coletivo de exploração';
   f.thought=`Percebo ${friends.length} peixes do meu cardume. Vou avançar com o grupo, mantendo coesão e distância segura.`;
  }else if(ruleEnabled(f,'explore')){
   // Exploração normal: todo o cardume compartilha uma região de destino.
   // Cada peixe combina direção coletiva, alinhamento e separação para nadar como grupo.
   const schoolTarget=schoolExploration[f.group];
   const targetDirection=schoolTarget
    ?unit(schoolTarget.x-f.x,schoolTarget.y-f.y)
    :unit(f.vx,f.vy);
   let centerX=0,centerY=0,alignX=0,alignY=0,sepX=0,sepY=0;
   for(const neighbor of friends){
    centerX+=neighbor.x;centerY+=neighbor.y;
    alignX+=neighbor.vx;alignY+=neighbor.vy;
    const separation=Math.max(1,dist(f,neighbor));
    if(separation<m.distancia_seguranca){
     sepX+=(f.x-neighbor.x)/separation;
     sepY+=(f.y-neighbor.y)/separation;
    }
   }
   const cohesion=friends.length
    ?unit(centerX/friends.length-f.x,centerY/friends.length-f.y)
    :targetDirection;
   const alignment=friends.length
    ?unit(alignX/friends.length,alignY/friends.length)
    :targetDirection;
   const separation=unit(sepX,sepY);
   dx=targetDirection.x*.58+alignment.x*.24+cohesion.x*.24+separation.x*.85;
   dy=targetDirection.y*.58+alignment.y*.24+cohesion.y*.24+separation.y*.85;
   f.decision='explorar';
   f.currentPlan='Explorar o aquário junto ao cardume';
   f.trigger='Sem alimento percebido; destino coletivo de exploração';
   f.thought='Não percebo alimento próximo. Vou explorar uma nova região junto ao meu cardume, mantendo distância dos vizinhos.';
  }
  if(!ruleEnabled(f,'explore')&&f.decision==='explorar'){
   dx=0;dy=0;f.currentPlan='Aguardando: exploração desativada para esta espécie';f.trigger='Regra Explorar desligada';f.thought='Não estou explorando porque essa regra foi desativada para minha espécie.';
  }
  if(others.length&&!protectionVector&&!threats.length){let sx=0,sy=0;for(const o of others){let d=Math.max(1,dist(f,o));sx+=(f.x-o.x)/d*(1-d/m.campo_visao);sy+=(f.y-o.y)/d*(1-d/m.campo_visao)}let v=unit(sx,sy);dx+=v.x*1.2;dy+=v.y*1.2}
  // A aleatoriedade é reduzida em fuga, proteção e perseguição para não desviar a ação prioritária.
  const priorityAction=!!protectionVector||threats.length>0||f.decision==='atacar';
  const randomFactor=priorityAction?0.04:0.12;
  dx+=rand(-1,1)*m.aleatoriedade/100*randomFactor;
  dy+=rand(-1,1)*m.aleatoriedade/100*randomFactor;
  // A fome aumenta o desespero, mas não torna o peixe agressivo por padrão.
  // A predação só é considerada quando o usuário ativa o modo correspondente.
  const desperation=Math.max(0,f.hunger-55)*1.15;
  const instinct=Math.min(100,m.instinto+desperation);
  const aggr=Math.min(100,m.agressividade+desperation*.9);

  /*
   * SLIDE 5 — PROCESSAMENTO (exemplo de decisão com várias condições):
   * A predação demonstra que um NPC pode precisar avaliar vários critérios
   * ao mesmo tempo: regra global habilitada, perfil alimentar, ausência de
   * ameaça imediata, nível de fome, instinto, agressividade e alvo permitido.
   *
   * SLIDE 6 — GATILHO:
   * O gatilho de caça só é aceito quando a combinação de condições abaixo
   * é verdadeira. A fome isoladamente não basta para iniciar o ataque.
   */
  // REGRA DE PREDAÇÃO:
  // 1. No modo pacífico, nenhum peixe ataca outro peixe.
  // 2. No modo faminto, a fome precisa chegar a 82/100.
  // 3. O primeiro alvo possível é sempre de OUTRO cardume.
  // 4. O próprio cardume só pode ser alvo após 300 ciclos sem encontrar outro.
  let attackTarget=null;

  if(ruleEnabled(f,'predation')&&predationEnabledFor(f.group)&&!threats.length&&f.hunger>=82&&instinct>=55&&aggr>=45){
   const visibleOtherAdults=others
    .filter(candidate=>!candidate.isBaby&&candidate.energy>0)
    .sort((a,b)=>dist(f,a)-dist(f,b));
   const visibleBabies=world.fish
    .filter(candidate=>candidate!==f&&candidate.isBaby&&candidate.energy>0&&dist(f,candidate)<m.campo_visao)
    .sort((a,b)=>dist(f,a)-dist(f,b));
   const visibleOwnAdults=friends
    .filter(candidate=>!candidate.isBaby&&candidate.energy>0)
    .sort((a,b)=>dist(f,a)-dist(f,b));

   // Prioridade 1: peixe adulto de outro cardume.
   if(visibleOtherAdults.length){
    attackTarget=visibleOtherAdults[0];
    f.noOtherPreySince=null;
   }
   // Prioridade 2: filhote de qualquer cardume, inclusive o próprio.
   else if(visibleBabies.length){
    attackTarget=visibleBabies[0];
    f.noOtherPreySince=null;
   }
   // Prioridade 3: adulto do próprio cardume, somente após a espera definida.
   else{
    if(f.noOtherPreySince===null)f.noOtherPreySince=cycle;
    const cyclesWithoutPreferredPrey=cycle-f.noOtherPreySince;
    if(cyclesWithoutPreferredPrey>=OWN_GROUP_FALLBACK_CYCLES&&visibleOwnAdults.length){
     attackTarget=visibleOwnAdults[0];
    }
   }
  }else{
   f.noOtherPreySince=null;
  }

  /*
   * SLIDE 7 — PLANO DE AÇÃO:
   * Quando existe um alvo autorizado, o agente transforma a decisão em um
   * objetivo concreto: perseguir aquele peixe. currentPlan guarda a descrição
   * do objetivo; target guarda o ID do alvo; dx e dy recebem a direção desejada.
   *
   * Repare na diferença:
   *   decision = categoria da decisão atual;
   *   currentPlan = objetivo descrito em linguagem;
   *   target = referência ao objeto que será perseguido;
   *   dx / dy = direção que orienta o deslocamento.
   *   dx / dy = direction used to guide movement.
   */
  // O plano de caça muda apenas quando existe alvo autorizado pela hierarquia.
  if(attackTarget){
   const directionToTarget=unit(attackTarget.x-f.x,attackTarget.y-f.y);
   dx=directionToTarget.x;
   dy=directionToTarget.y;
   f.decision='atacar';
   f.currentPlan=`Perseguir o alvo #${attackTarget.id}`;
   f.target=attackTarget.id;
   if(!attackTarget.isBaby&&attackTarget.schoolId!==f.schoolId){
    f.trigger='Fome extrema + adulto de outro cardume percebido';
    f.thought=`Estou com muita fome. Primeiro procuro adultos de outros cardumes; encontrei o peixe #${attackTarget.id}.`;
   }else if(attackTarget.isBaby){
    f.trigger='Fome extrema + filhote percebido (segunda prioridade)';
    f.thought=`Não encontrei um adulto de outro cardume. O filhote #${attackTarget.id} passa a ser a segunda prioridade alimentar.`;
   }else{
    f.trigger='Fome extrema + espera prolongada sem outras presas';
    f.thought=`Não encontrei adultos de outros cardumes nem filhotes durante ${OWN_GROUP_FALLBACK_CYCLES} ciclos. Só agora considero um adulto do meu cardume.`;
   }
  }
  /*
   * SLIDE 7 — PLANO DE AÇÃO (preparação do movimento):
   * Depois de escolher a prioridade, o NPC já tem uma direção desejada.
   * O bloco seguinte ajusta velocidade, persistência e suavidade da direção.
   * Isso ainda é planejamento: define como a intenção será traduzida em movimento.
   * This is still planning: it defines how the intention will be translated into movement.
   */
  // A velocidade de busca aumenta junto com a fome.
  // Com fome em 0, o multiplicador é 1; com fome máxima, chega a 1,75.
  let speed=m.velocidade;
  if(f.search){
   const hungerSpeedMultiplier=1+(f.hunger/100)*0.75;
   speed*=Math.min(1.75,hungerSpeedMultiplier);
  }

  if(!ruleEnabled(f,'swim')){
   dx=0;dy=0;f.vx=0;f.vy=0;f.planVector={x:0,y:0};
   f.currentPlan='Parado: regra Nadar desativada para esta espécie';
   f.trigger='Nadar desligado na agenda da espécie';
   f.thought='Não me movimento porque a regra Nadar está desativada para minha espécie.';
  }
  let v=unit(dx,dy);
  // Guarda a intenção escolhida para mantê-la durante os próximos ciclos.
  f.planVector={x:v.x,y:v.y};
  if(f.decision==='explorar'||f.decision==='acompanhar_cardume'){
   f.nextDecisionCycle=cycle+8;
  }else{
   // Ações urgentes ou orientadas a objetivos são reavaliadas com mais frequência.
   f.nextDecisionCycle=cycle+1;
  }
  /*
   * SLIDE 8 — EXECUÇÃO:
   * Agora a intenção vira alteração concreta no mundo. A velocidade anterior
   * é combinada com a direção planejada, a posição x/y é atualizada e o peixe
   * efetivamente se desloca no Canvas.
   *
   * É importante separar decisão de execução: escolher "fugir" ou "perseguir"
   * não move o peixe automaticamente. O código precisa aplicar a direção,
   * calcular a velocidade e atualizar sua posição.
   */
  /*
   * SLIDE 8 — EXECUÇÃO:
   * A intenção vira alteração concreta no mundo. A direção planejada é
   * combinada com a velocidade, e a posição do peixe é atualizada.
   * Escolher "fugir" ou "perseguir" não move o peixe automaticamente:
   * o código precisa aplicar a direção e atualizar x/y.
   *
   * SLIDE 8 — EXECUTION:
   * The intention becomes a concrete change in the world. The planned
   * direction is combined with velocity, and the fish position is updated.
   * Choosing "flee" or "pursue" does not move the fish automatically:
   * the code must apply the direction and update x/y.
   */
  // Movimentos comuns fazem curvas suaves; ações urgentes respondem mais rápido.
  const steeringInertia=(priorityAction||f.decision==='atacar')?0.35:0.84;
  if(ruleEnabled(f,'swim')){
   f.vx=f.vx*steeringInertia+v.x*(1-steeringInertia);
   f.vy=f.vy*steeringInertia+v.y*(1-steeringInertia);
   let dir=unit(f.vx,f.vy);
   f.x=Math.max(8,Math.min(1492,f.x+dir.x*speed));
   f.y=Math.max(8,Math.min(892,f.y+dir.y*speed));
  }else{
   f.vx=0;f.vy=0;
  }
  if(f.decision!==f._lastDecision){hist(f,f.decision,f.trigger);f._lastDecision=f.decision}
  /*
   * SLIDE 8 — EXECUÇÃO (efeito da ação):
   * Além de se mover, o agente pode produzir efeitos no ambiente.
   * Quando alcança uma fonte válida, o código reduz as porções disponíveis,
   * diminui a fome, atualiza a decisão e registra o acontecimento.
   * Este é um exemplo de ação executada e de mudança de estado resultante.
   */
  // Eat food when close.
  for(let i=world.food.length-1;i>=0;i--){let food=world.food[i];if(
   ruleEnabled(f,'eat')&&dist(f,food)<10&&food.portions>0&&
   f.hunger>=MIN_HUNGER_TO_EAT&&
   cycle-f.lastMealCycle>=MEAL_COOLDOWN_CYCLES
  ){
   // Cada porção representa uma refeição: peixes satisfeitos acompanham o grupo,
   // mas não consomem comida sem necessidade.
   food.portions--;
   f.lastMealCycle=cycle;
   f.hunger=Math.max(0,f.hunger-25);
   f.decision='alimentando_se';
   f.wanderTarget=null;f.searchTarget=null;
   f.currentPlan='Consumir alimento e reduzir a fome';
   f.trigger='Alimento alcançado';
   f.thought='Encontrei alimento e estou me alimentando. Minha fome está diminuindo.';
   log(f,'Alimentei-me. Porções restantes: '+food.portions);
   if(food.portions<=0){
    world.food.splice(i,1);
    // Quando a fonte acaba, os anúncios correspondentes deixam de existir.
    for(let a=foodAnnouncements.length-1;a>=0;a--){
     if(foodAnnouncements[a].foodId===food.id)foodAnnouncements.splice(a,1);
    }
   }
   if(f.hunger<=m.limiar_fome-m.margem_fome)f.search=false;
   break;
  }}
  survivors.push(f);
 }
 world.fish=survivors;
 /*
  * SLIDE 8 — EXECUÇÃO (interação entre agentes):
  * A resolução do ataque acontece depois do movimento dos peixes.
  * O código verifica se o atacante chegou perto do alvo, aplica dano à energia
  * da vítima e, quando a energia chega a zero, remove a presa da população.
  * O atacante também atualiza fome, decisão e histórico.
  *
  * Observe que o plano de perseguir é uma intenção; o dano e a remoção são
  * efeitos executados pelo motor da simulação.
  */
 // Resolve a predação entre peixes depois do movimento.
 // O contato usa raio de 24 unidades porque resolveFishOverlaps mantém
 // adultos separados por 19 unidades; um limite menor nunca seria alcançado.
 // O intervalo de 18 ciclos evita dano em todos os frames consecutivos.
 const removed=new Set();
 for(const attacker of world.fish){if(!ruleEnabled(attacker,'predation')||attacker.decision!=='atacar'||cycle-attacker.lastAttack<18)continue;let target=world.fish.find(t=>t.id===attacker.target&&t.id!==attacker.id&&!removed.has(t.id));// A separação física mantém adultos a pelo menos 19 unidades.
  // O raio de contato precisa ser um pouco maior para permitir a mordida.
  if(target&&dist(attacker,target)<=24){target.energy-=22;attacker.hunger=Math.max(0,attacker.hunger-8);attacker.lastAttack=cycle;log(attacker,`Ataquei o peixe #${target.id}`);log(target,`Fui atacado pelo peixe #${attacker.id}`);if(target.energy<=0){removed.add(target.id);attacker.hunger=Math.max(0,attacker.hunger-35);attacker.decision='alimentar_se_de_outro_agente';attacker.currentPlan='Consumir a presa capturada';attacker.thought=`Consegui consumir o peixe #${target.id}. Minha fome diminuiu.`;log(attacker,`Consumi o peixe #${target.id}`)}}}
 if(removed.size)world.fish=world.fish.filter(f=>!removed.has(f.id));
 // Última etapa física: desfaz sobreposições que possam ter surgido durante a movimentação.
 resolveFishOverlaps();
}
/*
 * IDENTIFICAÇÃO ESPACIAL DE CARDUMES
 * A rotina encontra componentes conectados de peixes da mesma espécie.
 * Dois peixes são vizinhos quando estão a até SCHOOL_NEIGHBOR_DISTANCE px.
 * A relação é transitiva: A perto de B e B perto de C forma um grupo A-B-C.
 * Grupos com apenas um indivíduo não são chamados de cardume.
 *
 * Nesta etapa, a identificação é visual. As regras ecológicas antigas ainda
 * usam schoolId para reprodução e coesão; não alteramos essas filas internas
 * aqui para evitar misturar uma detecção espacial com a arquitetura legada.
 */
function identifySchools(){
 const fish=world.fish;
 fish.forEach(f=>{f.detectedSchoolId=null;});
 const visited=new Set();
 const clusters=[];

 for(const start of fish){
  if(visited.has(start.id))continue;
  const queue=[start];
  const cluster=[];
  visited.add(start.id);

  while(queue.length){
   const current=queue.shift();
   cluster.push(current);
   for(const candidate of fish){
    if(visited.has(candidate.id))continue;
    if(candidate.speciesId!==current.speciesId)continue;
    if(dist(current,candidate)<=SCHOOL_NEIGHBOR_DISTANCE){
     visited.add(candidate.id);
     queue.push(candidate);
    }
   }
  }
  if(cluster.length>=2)clusters.push(cluster);
 }

 clusters.sort((a,b)=>Math.min(...a.map(f=>f.id))-Math.min(...b.map(f=>f.id)));
 clusters.forEach((cluster,index)=>{
  const label=`S${index+1}`;
  cluster.forEach(f=>{f.detectedSchoolId=label;});
 });

 schoolDetectionActive=true;
 detectedSchoolCount=clusters.length;
 const grouped=fish.filter(f=>f.detectedSchoolId).length;
 $('schoolDetectionStatus').textContent=
  `${clusters.length} cardume(s) detectado(s) · ${grouped} peixes agrupados · ${fish.length-grouped} sem cardume identificado`;
 updatePanels();
}

/*
 * REPRESENTAÇÃO VISUAL — não confundir desenho com inteligência.
 * draw() transforma o estado interno dos agentes em elementos gráficos.
 * A cor mostra a decisão atual, a forma representa a espécie e a identificação
 * espacial pode mostrar o cardume detectado. O desenho apresenta o resultado
 * do processamento; ele não é a etapa que toma a decisão.
 */
function draw(){
 ctx.clearRect(0,0,1500,900);ctx.strokeStyle='rgba(100,150,190,.07)';ctx.lineWidth=1;
 for(let x=0;x<1500;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,900);ctx.stroke()}for(let y=0;y<900;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1500,y);ctx.stroke()}
 for(const food of world.food){ctx.beginPath();ctx.arc(food.x,food.y,5.5,0,Math.PI*2);ctx.fillStyle='#f5d547';ctx.fill();ctx.beginPath();ctx.arc(food.x,food.y,9,0,Math.PI*2);ctx.strokeStyle='rgba(245,213,71,.4)';ctx.stroke();ctx.fillStyle='#fff2a8';ctx.font='9px sans-serif';ctx.fillText(food.portions,food.x+9,food.y-7)}
 // Predadores são losangos vermelho-escuros.
 // Assim, mesmo quando um peixe fica vermelho para indicar fuga,
 // o formato do predador continua permitindo distingui-lo rapidamente.
 for(const p of world.pred){
  ctx.beginPath();
  ctx.moveTo(p.x,p.y-10);
  ctx.lineTo(p.x+10,p.y);
  ctx.lineTo(p.x,p.y+10);
  ctx.lineTo(p.x-10,p.y);
  ctx.closePath();
  ctx.fillStyle='#a91f32';
  ctx.fill();
  ctx.strokeStyle='#ff7777';
  ctx.lineWidth=1.5;
  ctx.stroke();

  // A circunferência externa representa a área visual de presença do predador.
  ctx.beginPath();
  ctx.arc(p.x,p.y,16,0,Math.PI*2);
  ctx.strokeStyle='rgba(240,68,68,.35)';
  ctx.lineWidth=1;
  ctx.stroke();
 }
 // A forma representa a espécie; a cor do corpo representa a decisão atual.
 // A faixa colorida e a etiqueta S1, S2... representam o cardume detectado.
 for(const f of world.fish){
  const radius=f.isBaby?4.1:6.2;
  const fishColor=decisionColors[f.decision]||defaultDecisionColor;
  if(f.isBaby){
   ctx.beginPath();ctx.arc(f.x,f.y,8,0,Math.PI*2);
   ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1;ctx.stroke();
  }

  // A cor é aplicada antes de desenhar a forma, para todos os grupos.
  ctx.fillStyle=fishColor;
  ctx.strokeStyle='rgba(5,15,25,.85)';
  ctx.lineWidth=1;

  // Espécie SP1: círculo.
  if(f.speciesId==='SP1'){
   ctx.beginPath();
   ctx.arc(f.x,f.y,radius,0,Math.PI*2);
   ctx.fill();
   ctx.stroke();
  }
  // Espécie SP2: quadrado.
  else if(f.speciesId==='SP2'){
   ctx.beginPath();
   ctx.rect(f.x-radius,f.y-radius,radius*2,radius*2);
   ctx.fill();
   ctx.stroke();
  }
  // Espécie SP3: triângulo apontando para cima.
  else if(f.speciesId==='SP3'){
   ctx.beginPath();
   ctx.moveTo(f.x,f.y-radius-1);
   ctx.lineTo(f.x+radius+1,f.y+radius);
   ctx.lineTo(f.x-radius-1,f.y+radius);
   ctx.closePath();
   ctx.fill();
   ctx.stroke();
  }

  // A faixa colorida e a etiqueta identificam o agrupamento espacial detectado.
  // O corpo mantém a cor da decisão atual, sem misturar os dois significados.
  if(schoolDetectionActive&&f.detectedSchoolId){
   const clusterIndex=Number(f.detectedSchoolId.slice(1))-1;
   // Matiz distribuído pelo círculo cromático: mantém cores distintas mesmo com muitos cardumes.
   const clusterColor=`hsl(${(clusterIndex*137.508)%360} 78% 62%)`;
   ctx.fillStyle=clusterColor;
   ctx.fillRect(f.x-7,f.y-radius-8,14,3);
   ctx.font='bold 10px system-ui, sans-serif';
   ctx.textAlign='center';
   ctx.lineWidth=3;
   ctx.strokeStyle='rgba(4,12,22,.95)';
   ctx.strokeText(f.detectedSchoolId,f.x,f.y-radius-12);
   ctx.fillStyle=clusterColor;
   ctx.fillText(f.detectedSchoolId,f.x,f.y-radius-12);
  }

  // A barra acima do peixe mostra sua fome (0 a 100), independentemente da decisão.
  // Verde: pouca fome; amarelo: fome intermediária; vermelho: fome elevada.
  const hungerBarWidth=f.isBaby?13:18;
  const hungerRatio=Math.max(0,Math.min(1,f.hunger/100));
  ctx.fillStyle='rgba(10,18,28,.75)';
  ctx.fillRect(f.x-hungerBarWidth/2,f.y-(f.isBaby?10:13),hungerBarWidth,3);
  ctx.fillStyle=f.hunger>=75?'#f04444':f.hunger>=45?'#f5d547':'#42b883';
  ctx.fillRect(f.x-hungerBarWidth/2,f.y-(f.isBaby?10:13),hungerBarWidth*hungerRatio,3);

  // O anel branco mostra qual peixe está selecionado sem alterar sua cor de estado.
  if(selected&&selected.type==='fish'&&selected.id===f.id){
   ctx.beginPath();
   ctx.arc(f.x,f.y,11,0,Math.PI*2);
   ctx.strokeStyle='#ffffff';
   ctx.lineWidth=1.7;
   ctx.stroke();
  }
 }
 // Ao selecionar um predador, desenha um anel branco maior ao redor dele.
 if(selected&&selected.type==='pred'){
  let p=world.pred.find(x=>x.id===selected.id);
  if(p){
   ctx.beginPath();
   ctx.arc(p.x,p.y,22,0,Math.PI*2);
   ctx.strokeStyle='#ffffff';
   ctx.lineWidth=1.7;
   ctx.stroke();
  }
 }
 requestAnimationFrame(draw)
}
function updatePanels(){
 $('nFish').textContent=world.fish.length;
 $('nBaby').textContent=world.fish.filter(f=>f.isBaby).length;
 $('nFood').textContent=world.food.length;
 $('nPred').textContent=world.pred.length;
 $('cycle').textContent=cycle;

 if(!selected){
  lastInspectionKey=null;
  $('status').textContent='Clique em um indivíduo no aquário / Click an individual in the aquarium.';
  $('inspection').innerHTML='<div class="empty">Nenhum agente selecionado / No agent selected.</div>';
  $('history').innerHTML='<div class="empty">Nenhum agente selecionado / No agent selected.</div>';
  return;
 }

 let a=selected.type==='fish'
  ?world.fish.find(x=>x.id===selected.id)
  :selected.type==='pred'
   ?world.pred.find(x=>x.id===selected.id)
   :world.food.find(x=>x.id===selected.id);

 if(!a){
  selected=null;
  updatePanels();
  return;
 }

 const inspectionKey=selected.type+':'+selected.id;
 const inspectionPanel=$('inspection');
 const sameAgent=inspectionKey===lastInspectionKey;
 lastInspectionKey=inspectionKey;

 if(selected.type==='food'){
  $('status').textContent='Comida #'+a.id;
  inspectionPanel.innerHTML=`<div class="readout">Porções restantes: ${a.portions}/20<br>Posição: ${a.x.toFixed(0)}, ${a.y.toFixed(0)}</div>`;
  $('history').innerHTML='<div class="empty">Comida não possui decisões.</div>';
  return;
 }

 const isFish=selected.type==='fish';
 $('status').textContent=isFish
  ?`Peixe #${a.id} · Espécie ${a.speciesId} · ${a.detectedSchoolId ? `Cardume ${a.detectedSchoolId}` : (schoolDetectionActive ? 'Sem cardume identificado' : 'Cardume ainda não identificado')}`
  :`Predador #${a.id}`;

 // Atualiza apenas os campos de texto quando o mesmo agente continua selecionado.
 // Assim, os elementos <details> nunca são removidos enquanto o usuário os abre.
 if(sameAgent&&inspectionPanel.querySelector('[data-live="decision"]')){
  const setLive=(name,value)=>{
   const node=inspectionPanel.querySelector(`[data-live="${name}"]`);
   if(node)node.innerHTML=value;
  };
  if(isFish){
   setLive('state',`Fome: ${a.hunger.toFixed(1)}/100<br>Energia: ${a.energy.toFixed(1)}/100<br>Fase: ${a.isBaby?'Filhote':'Adulto'} · Idade: ${a.ageCycles} ciclos<br>Busca por comida: ${a.search?'ATIVA':'inativa'}`);
   setLive('decision',escapeHtml(a.decision));
   setLive('mode',predationEnabledFor(a.group)?'Predação habilitada quando faminto':'Pacífico');
   setLive('thought',escapeHtml(a.thought));
  }else{
   setLive('state',`Fome: ${a.hunger.toFixed(1)}/100<br>Satisfação: ${a.satisfaction.toFixed(1)}/100<br>Energia: ${a.energy}/100`);
   setLive('decision',escapeHtml(a.decision));
   setLive('thought',escapeHtml(a.thought));
  }
  setLive('perception',escapeHtml(a.thought || 'Aguardando estímulos do ambiente.'));
  setLive('processing',`Condição avaliada: ${escapeHtml(a.trigger || 'Nenhuma condição registrada.')}<br>Decisão selecionada: ${escapeHtml(a.decision || 'Aguardando decisão.')}`);
  setLive('plan',isFish
   ?escapeHtml(a.currentPlan||'Explorar / manter relações sociais')
   :escapeHtml(a.currentPlan||'Patrulhar ou caçar'));
  setLive('trigger',escapeHtml(a.trigger));
  setLive('memory',a.memory.slice().reverse().map(escapeHtml).join('<br>'));
  $('history').innerHTML=a.history.slice().reverse()
   .map(h=>`<div class="event"><b>Ciclo ${h.cycle} · ${escapeHtml(h.decision)}</b><br>${escapeHtml(h.trigger)}</div>`)
   .join('')||'<div class="empty">Nenhuma decisão registrada.</div>';
  return;
 }

 // Só cria o painel quando a seleção muda. Plano e gatilho começam abertos.
 const stateHtml=isFish
  ?`Fome: ${a.hunger.toFixed(1)}/100<br>Energia: ${a.energy.toFixed(1)}/100<br>Fase: ${a.isBaby?'Filhote':'Adulto'} · Idade: ${a.ageCycles} ciclos<br>Busca por comida: ${a.search?'ATIVA':'inativa'}`
  :`Fome: ${a.hunger.toFixed(1)}/100<br>Satisfação: ${a.satisfaction.toFixed(1)}/100<br>Energia: ${a.energy}/100`;
 const mainHtml=isFish
  ?`<b>IDENTIDADE DO AGENTE</b><br>Espécie: ${a.speciesId}<br>Cardume detectado: ${a.detectedSchoolId || (schoolDetectionActive?'Não identificado (indivíduo isolado)':'Aguardando identificação')}<br>Perfil comportamental / Behavioral profile: ${names[a.group]}<br><br><b>ESTADO INTERNO</b><br><span data-live="state">${stateHtml}</span><br><br><b>DECISÃO ATUAL</b><br><span data-live="decision">${escapeHtml(a.decision)}</span><br><br><b>MODO ALIMENTAR</b><br><span data-live="mode">${predationEnabledFor(a.group)?'Predação habilitada quando faminto':'Pacífico'}</span><br><br><b>JUSTIFICATIVA DA DECISÃO</b><br><span data-live="thought">${escapeHtml(a.thought)}</span>`
  :`<b>ESTADO INTERNO</b><br><span data-live="state">${stateHtml}</span><br><br><b>DECISÃO ATUAL</b><br><span data-live="decision">${escapeHtml(a.decision)}</span><br><br><b>JUSTIFICATIVA DA DECISÃO</b><br><span data-live="thought">${escapeHtml(a.thought)}</span>`;

 inspectionPanel.innerHTML=`<div class="readout">${mainHtml}</div>
  <details data-section="perception" open>
   <summary>Percepção (Perception)</summary>
   <div class="readout" data-live="perception">${escapeHtml(a.thought || 'Aguardando estímulos do ambiente.')}</div>
  </details>
  <details data-section="memory">
   <summary>Memória de trabalho (Working Memory)</summary>
   <div class="readout" data-live="memory">${a.memory.slice().reverse().map(escapeHtml).join('<br>')}</div>
  </details>
  <details data-section="processing" open>
   <summary>Processamento (Decision Processing)</summary>
   <div class="readout" data-live="processing">Condição avaliada: ${escapeHtml(a.trigger || 'Nenhuma condição registrada.')}<br>Decisão selecionada: ${escapeHtml(a.decision || 'Aguardando decisão.')}</div>
  </details>
  <details data-section="plan" open>
   <summary>Plano de ação (Action Plan)</summary>
   <div class="readout" data-live="plan">${escapeHtml(a.currentPlan||(isFish?'Explorar / manter relações sociais':'Patrulhar ou caçar'))}</div>
  </details>
  <details data-section="trigger" open>
   <summary>Gatilho (Trigger) · condição de ativação</summary>
   <div class="readout" data-live="trigger">${escapeHtml(a.trigger)}</div>
  </details>`;

 $('history').innerHTML=a.history.slice().reverse()
  .map(h=>`<div class="event"><b>Ciclo ${h.cycle} · ${escapeHtml(h.decision)}</b><br>${escapeHtml(h.trigger)}</div>`)
  .join('')||'<div class="empty">Nenhuma decisão registrada.</div>';
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function selectAt(e){let r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*canvas.width/r.width,y=(e.clientY-r.top)*canvas.height/r.height,best=22,found=null;for(const f of world.fish){let d=dist({x,y},f);if(d<best){best=d;found={type:'fish',id:f.id}}}for(const p of world.pred){let d=dist({x,y},p);if(d<best){best=d;found={type:'pred',id:p.id}}}for(const f of world.food){let d=dist({x,y},f);if(d<best){best=d;found={type:'food',id:f.id}}}if(found){selected=found;updatePanels()}}
canvas.addEventListener('click',selectAt);
function applyZoom(z){zoomLevel=Math.max(.5,Math.min(1.8,z));canvas.style.width=(1500*zoomLevel)+'px';canvas.style.height=(900*zoomLevel)+'px'}
// O modo pacífico é o padrão. Só o usuário pode habilitar a predação entre peixes.
// Mantém o seletor sincronizado com o cardume que está sendo modelado.
function updateFeedingModeControl(){
 $('feedingModeGroup').value=feedingModes[group];
}

// Cada alteração afeta apenas o perfil comportamental atualmente selecionado.
$('feedingModeGroup').onchange=event=>{
 feedingModes[group]=event.target.value;

 // Ao voltar ao modo pacífico, cancela ataques somente dos peixes deste cardume.
 if(!predationEnabledFor(group)){
  for(const fish of world.fish.filter(item=>item.group===group)){
   fish.target=null;
   fish.noOtherPreySince=null;
   if(fish.decision==='atacar'){
    fish.decision=fish.search?'buscar_comida':'explorar';
    fish.trigger='Cardume voltou ao modo pacífico';
    fish.thought='Meu cardume está no modo pacífico. Não vou atacar outros peixes.';
   }
  }
 }
 updatePanels();
};
$('identifySchools').onclick=identifySchools;
$('play').onclick=()=>{paused=!paused;$('play').textContent=paused?'▶ Retomar':'Ⅱ Pausar'};
$('addFood').onclick=()=>{world.food.push({id:nextFood++,x:rand(50,1450),y:rand(40,860),portions:20});updatePanels()};
$('removeFood').onclick=()=>{if(confirm('Remover toda a comida?')){world.food=[];if(selected?.type==='food')selected=null;updatePanels()}};
$('addPredator').onclick=()=>{world.pred.push(makePred(nextPred++));updatePanels()};
$('removePredators').onclick=()=>{world.pred=[];if(selected?.type==='pred')selected=null;updatePanels()};
$('removeSelected').onclick=()=>{if(!selected)return;if(selected.type==='fish')world.fish=world.fish.filter(f=>f.id!==selected.id);if(selected.type==='pred')world.pred=world.pred.filter(p=>p.id!==selected.id);if(selected.type==='food')world.food=world.food.filter(f=>f.id!==selected.id);selected=null;updatePanels()};
$('zoomIn').onclick=()=>applyZoom(zoomLevel+0.1);$('zoomOut').onclick=()=>applyZoom(zoomLevel-0.1);$('zoomReset').onclick=()=>applyZoom(1);
$('reset').onclick=()=>resetWorld();
/*
 * CONTROLE DAS JANELAS FLUTUANTES
 * - Os botões no topo reabrem uma janela que tenha sido fechada.
 * - O X fecha somente a janela correspondente.
 * - A barra de título funciona como alça para arrastar a janela.
 * - O movimento é limitado à área visível da tela.
 */
function setupFloatingWindows(){
 // Botões da barra superior: alternam a visibilidade da janela solicitada.
 document.querySelectorAll('[data-open-window]').forEach(button=>{
  button.addEventListener('click',()=>{
   const key=button.dataset.openWindow;
   const win=document.querySelector(`[data-window="${key}"]`);
   if(win) win.classList.remove('is-hidden');
  });
 });

 // Botões X: escondem a janela sem apagar seus dados ou controles.
 document.querySelectorAll('[data-close-window]').forEach(button=>{
  button.addEventListener('click',event=>{
   event.stopPropagation();
   const key=button.dataset.closeWindow;
   const win=document.querySelector(`[data-window="${key}"]`);
   if(win) win.classList.add('is-hidden');
  });
 });

 // Configura o arraste individual de cada janela pela respectiva barra de título.
 document.querySelectorAll('.floating-window').forEach(win=>{
  const handle=win.querySelector('.window-titlebar');
  let dragging=false;
  let pointerOffsetX=0;
  let pointerOffsetY=0;

  handle.addEventListener('pointerdown',event=>{
   // Não inicia arraste se o clique foi no botão de fechar.
   if(event.target.closest('button')) return;
   dragging=true;
   const rect=win.getBoundingClientRect();
   pointerOffsetX=event.clientX-rect.left;
   pointerOffsetY=event.clientY-rect.top;
   win.style.zIndex=String(100+Date.now()%10000);
   handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove',event=>{
   if(!dragging) return;
   const maxLeft=Math.max(0,window.innerWidth-win.offsetWidth);
   const maxTop=Math.max(0,window.innerHeight-70);
   const left=Math.max(0,Math.min(maxLeft,event.clientX-pointerOffsetX));
   const top=Math.max(0,Math.min(maxTop,event.clientY-pointerOffsetY));
   win.style.left=left+'px';
   win.style.top=top+'px';
  });

  const stopDragging=()=>{dragging=false};
  handle.addEventListener('pointerup',stopDragging);
  handle.addEventListener('pointercancel',stopDragging);
 });
}

// Atualiza o símbolo grande ao lado do seletor sempre que outro cardume é escolhido.
function updateGroupShape(){
 const shapeByGroup={A:'●',B:'■',C:'▲'}; // Símbolos dos perfis comportamentais, não das espécies.
 $('groupShape').textContent=shapeByGroup[group]||'●';
}


// Constrói a lista fixa de regras globais.
// Cada checkbox altera uma única regra compartilhada por todos os peixes.
function setGlobalRule(ruleKey,enabled){
 globalRules[ruleKey]=enabled;

 // Desligar busca cancela a busca em andamento de todos os peixes.
 if(ruleKey==='seekFood'&&!enabled){
  world.fish.forEach(f=>{f.search=false;f.searchTarget=null;});
 }

 // Desligar predação interrompe ataques em andamento.
 if(ruleKey==='predation'&&!enabled){
  world.fish.forEach(f=>{
   if(f.decision==='atacar'){
    f.target=null;
    f.decision='explorar';
    f.currentPlan='Predação desativada globalmente';
   }
  });
 }

 // Desligar natação interrompe imediatamente o deslocamento de todos os peixes.
 if(ruleKey==='swim'&&!enabled){
  world.fish.forEach(f=>{
   f.vx=0;
   f.vy=0;
   f.planVector={x:0,y:0};
  });
 }
 updatePanels();
}

function buildGlobalRules(){
 const container=$('globalRulesList');
 if(!container)return;
 container.innerHTML='';

 for(const [ruleKey,ruleLabel,description] of SPECIES_RULE_DEFINITIONS){
  const label=document.createElement('label');
  label.className='global-rule-toggle';
  const checkbox=document.createElement('input');
  checkbox.type='checkbox';
  checkbox.checked=globalRules[ruleKey]!==false;
  checkbox.addEventListener('change',()=>{
   setGlobalRule(ruleKey,checkbox.checked);
  });
  const text=document.createElement('span');
  const title=document.createElement('b');
  title.textContent=ruleLabel;
  const detail=document.createElement('small');
  detail.textContent=description;
  text.append(title,detail);
  label.append(checkbox,text);
  container.appendChild(label);
 }

 $('enableAllGlobalRules').onclick=()=>{
  for(const [ruleKey] of SPECIES_RULE_DEFINITIONS)globalRules[ruleKey]=true;
  updatePanels();
  buildGlobalRules();
 };
 $('disableAllGlobalRules').onclick=()=>{
  for(const [ruleKey] of SPECIES_RULE_DEFINITIONS)globalRules[ruleKey]=false;
  world.fish.forEach(f=>{
   f.search=false;f.searchTarget=null;
   f.vx=0;f.vy=0;f.planVector={x:0,y:0};
  });
  updatePanels();
  buildGlobalRules();
 };
}

// Monta os controles do perfil comportamental atualmente selecionado.
function buildFields(){const wrap=$('fields');wrap.innerHTML='';for(const [key,label,min,max,step] of specs){let d=document.createElement('div');d.className='field';d.innerHTML=`<label>${label}<output>${models[group][key]}</output></label><input type="range" min="${min}" max="${max}" step="${step}" value="${models[group][key]}">`;let input=d.querySelector('input'),out=d.querySelector('output');input.oninput=()=>{models[group][key]=Number(input.value);out.textContent=input.value};wrap.appendChild(d)}}
// Ao trocar o perfil comportamental, atualiza os parâmetros e o símbolo ilustrativo.
// Controles ecológicos: cada um pode ser ligado ou desligado independentemente.
$('autoFood').checked=ecology.autoFood;
$('autoFood').onchange=e=>{ecology.autoFood=e.target.checked;};
$('foodInterval').value=ecology.foodInterval;
$('foodInterval').onchange=e=>{
 ecology.foodInterval=Math.max(50,Math.min(5000,Number(e.target.value)||300));
 e.target.value=ecology.foodInterval;
};
$('reproductionEnabled').checked=ecology.reproduction;
$('reproductionEnabled').onchange=e=>{ecology.reproduction=e.target.checked;};
$('birthEnabled').checked=ecology.births;
$('birthEnabled').onchange=e=>{ecology.births=e.target.checked;};
$('babyProtection').checked=ecology.babyProtection;
$('babyProtection').onchange=e=>{ecology.babyProtection=e.target.checked;};

$('group').onchange=e=>{
 group=e.target.value;
 updateGroupShape();
 updateFeedingModeControl();
 buildFields();
};
$('defaults').onclick=()=>{models[group]={...base};buildFields()};
setupFloatingWindows();
buildGlobalRules();
updateGroupShape();
updateFeedingModeControl();
buildFields();
resetWorld();requestAnimationFrame(draw);
// Atualiza também os indicadores gerais (ciclo, peixes, comida e filhotes), mesmo sem agente selecionado.
setInterval(()=>{if(!paused){step();updatePanels()}},120);
})();
