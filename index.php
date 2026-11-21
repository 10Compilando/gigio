<?php
/* Tela inicial para escolher o idioma / Initial language selector. */
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aquário do Gigio | IA e Café</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07111f;color:#e8f1fb;font:16px Inter,system-ui,Arial}
main{width:min(560px,calc(100% - 32px));padding:34px;background:#101e30;border:1px solid #29415c;border-radius:18px;text-align:center;box-shadow:0 20px 60px #0006}
h1{margin:0 0 8px;font-size:28px}p{color:#9bb0c7;line-height:1.6}
.languages{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:28px}
a{display:inline-block;padding:13px 22px;border:1px solid #38536f;border-radius:9px;background:#145078;color:#fff;text-decoration:none;font-weight:700}
a:hover{filter:brightness(1.2)}small{display:block;margin-top:22px;color:#9bb0c7}
</style>
</head>
<body><main>
<h1>🐟 Aquário do Gigio</h1>
<p>Um laboratório multiagente para explorar como funciona a inteligência de um NPC.</p>
<div class="languages"><a href="pt.php">🇧🇷 Português</a><a href="en.php">🇬🇧 English</a></div>
<small>IA e Café · Simulação baseada em regras</small>
</main></body></html>
