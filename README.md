# ⚡ Pawan AI Chatbot

A full-stack AI Chatbot built using **Google Gemini API**, **FastAPI**, and **Streamlit**.

This project was created as part of **Project 1 – AI Domain Internship Program**.

---

## 🚀 Features
- ✅ Fast & clean chat UI (Streamlit)
- ✅ Backend API using FastAPI
- ✅ Connects to Google Gemini LLM for responses
- ✅ Environment variable support using `.env`
- ✅ Simple, minimal, submission-ready project structure

---

## 🏗️ Tech Stack
- **Python**
- **Google Gemini API**
- **FastAPI** (Backend)
- **Streamlit** (Frontend)
- **dotenv** (Environment variable loader)

---

## 📂 Project Structure
AI_Chatbot_Project/
│── main.py
│── requirements.txt
│── README.md
│── .env (not included in GitHub)
│── streamlit/
│ ├── config.toml
│ ├── credentials.toml

---

## 🔑 Setup (API Key)
Create a `.env` file in the root folder:

```env
GEMINI_API_KEY=YOUR_API_KEY_HERE


▶️ How to Run Locally
1️⃣ Create Virtual Environment
python -m venv venv

2️⃣ Activate Virtual Environment

Windows cmd

venv\Scripts\activate

3️⃣ Install Dependencies
pip install -r requirements.txt

4️⃣ Run Streamlit App
streamlit run main.py

✅ Output

Streamlit UI runs on: http://localhost:8501