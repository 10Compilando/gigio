# Aquário do Gigio | Gigio's Aquarium

## Arquivos
- `index.php`: seletor inicial de idioma.
- `pt.php` e `en.php`: pontos de entrada de cada idioma.
- `Aquario.php`: interface compartilhada.
- `IA.js`: motor JavaScript original da simulação.
- `estilos.css`: estilos compartilhados.
- `idiomas.js`: camada de tradução da interface inglesa.

## Instalação
Envie todos os arquivos para a mesma pasta em um servidor com PHP e abra `index.php`.

## Arquitetura
As duas entradas definem somente `$idioma` e incluem `Aquario.php`.
A simulação é carregada uma única vez por `IA.js`: não há duas versões da
inteligência dos agentes. O CSS também é compartilhado.

## Observação
A camada inglesa traduz os textos visíveis mais recorrentes e observa atualizações
dinâmicas. Como a interface original contém muitas mensagens de diagnóstico e
textos variáveis, revise a terminologia inglesa durante os testes.

O JavaScript original foi extraído sem alteração das regras da simulação.
Esta etapa organiza os arquivos; não converte ainda todos os agentes em classes.
A orientação a objetos pode ser introduzida depois, incrementalmente.
