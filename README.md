<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NEURONA Chat</title>
  <style>
    /* Сброс */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* Фон и центрирование */
    body {
      background: #1a1a1a;
      color: #e0e0e0;
      font-family: sans-serif;
      height: 100vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    /* Холст для анимации нейросвязей */
    #bg {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: -1;
    }

    /* Заставка */
    #loader {
      position: fixed;
      inset: 0;
      background: rgba(26,26,26,0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .loader-text {
      font-size: 3rem;
      letter-spacing: 0.2em;
      color: #4a90e2;
      animation: fade 3s ease-in-out infinite;
    }
    @keyframes fade {
      0%, 100% { opacity: 0; }
      50%      { opacity: 1; }
    }

    /* Основной контейнер */
    #app {
      display: none;
      flex-direction: column;
      align-items: center;
      width: 100%;
      max-width: 500px;
      height: 100%;
      padding: 10px;
    }

    /* Языковые кнопки в правом верхнем углу */
    .lang-select {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      z-index: 10;
    }
    .lang-select button {
      margin-left: 5px;
      padding: 6px 12px;
      background: #4a4a4a;
      border: none;
      border-radius: 4px;
      color: #fff;
      cursor: pointer;
      transition: background 0.2s;
    }
    .lang-select button.active,
    .lang-select button:hover {
      background: #6a6a6a;
    }

    /* Чат */
    .chat-container {
      flex: 1;
      width: 100%;
      background: rgba(43,43,43,0.9);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      margin-top: 40px; /* пространство под языковые кнопки */
    }
    #messages {
      flex: 1;
      padding: 15px;
      overflow-y: auto;
    }
    .message {
      margin-bottom: 10px;
      line-height: 1.4;
      max-width: 80%;
      word-wrap: break-word;
    }
    .message.user {
      align-self: flex-end;
      background: #3a3a3a;
      padding: 8px 12px;
      border-radius: 12px 12px 0 12px;
    }
    .message.bot {
      align-self: flex-start;
      background: #444;
      padding: 8px 12px;
      border-radius: 12px 12px 12px 0;
    }

    /* Поле ввода */
    .input-area {
      display: flex;
      padding: 10px;
      background: #1f1f1f;
    }
    #input {
      flex: 1;
      resize: none;
      border: none;
      padding: 10px;
      border-radius: 4px;
      background: #333;
      color: #fff;
      font-size: 1rem;
      height: 50px;
    }
    #send {
      margin-left: 8px;
      padding: 0 16px;
      border: none;
      border-radius: 4px;
      background: #4a90e2;
      color: #fff;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    #send:hover {
      background: #6ab0ff;
    }

    /* Адаптивность */
    @media (max-width: 600px) {
      .loader-text { font-size: 2rem; }
      #app { max-width: 100%; padding: 5px; }
      #send { font-size: 0.9rem; padding: 0 12px; }
      #input { font-size: 0.9rem; height: 40px; }
    }
  </style>
</head>
<body>
  <!-- Canvas для нейросвязей -->
  <canvas id="bg"></canvas>

  <!-- Заставка -->
  <div id="loader">
    <div class="loader-text">NEURONA 1.0</div>
  </div>

  <!-- Приложение -->
  <div id="app">
    <!-- Языковые кнопки -->
    <div class="lang-select">
      <button data-lang="en">EN</button>
      <button data-lang="ru" class="active">RU</button>
      <button data-lang="ua">UA</button>
    </div>

    <!-- Чат -->
    <div class="chat-container">
      <div id="messages"></div>
      <div class="input-area">
        <textarea id="input" placeholder="Напишите сообщение..."></textarea>
        <button id="send">Отправить</button>
      </div>
    </div>
  </div>

  <script>
    // Canvas animation: нейросвязи
    const canvas = document.getElementById('bg');
    const ctx = canvas.getContext('2d');
    let W, H, nodes;
    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    function initNodes() {
      nodes = [];
      for (let i = 0; i < 30; i++) {
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random()-0.5)*0.3,
          vy: (Math.random()-0.5)*0.3
        });
      }
    }
    function draw() {
      ctx.clearRect(0,0,W,H);
      // рисуем связи
      for (let i=0; i<nodes.length; i++) {
        for (let j=i+1; j<nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x-b.x, dy = a.y-b.y;
          const dist = Math.hypot(dx,dy);
          if (dist < 200) {
            ctx.strokeStyle = 'rgba(74,144,226,'+((200-dist)/200*0.3)+')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x,a.y);
            ctx.lineTo(b.x,b.y);
            ctx.stroke();
          }
        }
      }
      // рисуем узлы
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x<0||n.x>W) n.vx *= -1;
        if (n.y<0||n.y>H) n.vy *= -1;
        ctx.fillStyle = '#4a90e2';
        ctx.beginPath();
        ctx.arc(n.x,n.y,3,0,Math.PI*2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    resize();
    initNodes();
    draw();

    // Загрузка интерфейса
    const i18n = {
      en: { placeholder: "Type a message...", send: "Send" },
      ru: { placeholder: "Напишите сообщение...", send: "Отправить" },
      ua: { placeholder: "Введіть повідомлення...", send: "Надіслати" }
    };
    let lang = "ru";
    const loader = document.getElementById('loader');
    const app    = document.getElementById('app');
    const input  = document.getElementById('input');
    const send   = document.getElementById('send');

    function setLanguage(l) {
      lang = l;
      input.placeholder = i18n[l].placeholder;
      send.textContent   = i18n[l].send;
      document.querySelectorAll(".lang-select button")
        .forEach(b => b.classList.toggle("active", b.dataset.lang === l));
    }
    document.querySelectorAll(".lang-select button")
      .forEach(b => b.addEventListener("click", () => setLanguage(b.dataset.lang)));
    window.addEventListener("load", () => {
      setTimeout(() => {
        loader.style.display = "none";
        app.style.display    = "flex";
      }, 5000);
    });

    // Работа чата
    const messages = document.getElementById("messages");
    function addMessage(text, who) {
      const div = document.createElement("div");
      div.className = `message ${who}`;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }
    send.onclick = async () => {
      const txt = input.value.trim();
      if (!txt) return;
      addMessage(txt, "user");
      input.value = "";
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: txt })
      });
      const j = await res.json();
      addMessage(j.reply, "bot");
    };
  </script>
</body>
</html>
