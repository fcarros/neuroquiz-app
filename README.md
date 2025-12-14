# 🧠 NeuroQuiz - AI Powered Classroom Game

NeuroQuiz es una plataforma de juego educativo en tiempo real (estilo Kahoot!) que utiliza **Inteligencia Artificial (OpenAI)** para generar preguntas automáticamente a partir de documentos PDF.

Diseñado para profesores que buscan gamificar el aula sin perder tiempo preparando preguntas.

## 🚀 Características

* **Generación IA:** Sube un PDF y obtén un quiz al instante (GPT-4o).
* **Tiempo Real:** Conexión fluida entre Host y Alumnos mediante `Socket.io`.
* **Personalización:** Configura dificultad, número de preguntas y tiempo de respuesta.
* **Modo Gran Pantalla:** Interfaz optimizada con textos gigantes para proyectores.
* **Gamificación:** Ranking en vivo, podio final y animaciones.

## 🛠️ Tecnologías

* **Backend:** Node.js, Express.
* **Realtime:** Socket.io.
* **AI:** OpenAI API.
* **Frontend:** HTML5, Tailwind CSS.

## 📦 Instalación Local

1.  Clona el repositorio.
2.  Instala las dependencias: `npm install`
3.  Crea un archivo `.env` y añade tu API Key: `OPENAI_API_KEY=tu_clave_aqui`
4.  Inicia el servidor: `npm start`
5.  Accede a `http://localhost:3000`.

## ☁️ Despliegue

Listo para desplegar en **Render** o **Railway**. Recuerda configurar la variable de entorno `OPENAI_API_KEY` en tu panel de hosting.
