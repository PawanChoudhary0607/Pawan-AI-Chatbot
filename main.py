import streamlit as st
import google.generativeai as genai
import os
from dotenv import load_dotenv

# ✅ Load .env safely
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

# ✅ Streamlit page config
st.set_page_config(
    page_title="Pawan AI Chatbot",
    page_icon="⚡",
    layout="centered"
)

# ✅ Small custom style (clean premium feel)
st.markdown("""
<style>
    .block-container {padding-top: 2rem;}
    .stChatMessage {border-radius: 14px;}
</style>
""", unsafe_allow_html=True)

st.title("⚡ Pawan AI Chatbot")
st.caption("Built with Google Gemini + Streamlit | Fast • Clean • Minimal ✨")

# ✅ Sidebar controls (looks pro + prevents quota waste)
with st.sidebar:
    st.header("⚙️ Controls")

    model_name = st.selectbox(
        "Choose Model",
        [
            "gemini-2.0-flash",
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-pro-latest",
            "gemini-flash-latest"
        ],
        index=0
    )

    temperature = st.slider("Creativity (temperature)", 0.0, 1.0, 0.7, 0.1)

    if st.button("🧹 Clear Chat"):
        st.session_state.messages = []
        st.rerun()

    st.markdown("---")
    st.markdown("✅ **Tip:** Use Flash models to save quota.")

    st.markdown("This chatbot is built by Pawan and using Gemini API services")
# ✅ If key missing -> stop
if not API_KEY:
    st.error("❌ API Key missing. Set GEMINI_API_KEY inside your .env file.")
    st.stop()

# ✅ Configure Gemini
genai.configure(api_key=API_KEY)

# ✅ Create model
model = genai.GenerativeModel(
    model_name=model_name,
    generation_config={
        "temperature": temperature,
        "top_p": 0.95,
        "top_k": 40,
        "max_output_tokens": 512,
    }
)

# ✅ Chat memory
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "Yo 👋 I'm Pawan AI. Ask me anything 🔥"}
    ]

# ✅ Display messages
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ✅ Input
prompt = st.chat_input("Ask me anything...")

if prompt:
    # show user msg
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # assistant reply
    with st.chat_message("assistant"):
        with st.spinner("Thinking... ⚡"):
            try:
                response = model.generate_content(prompt)
                reply = response.text.strip()

                if not reply:
                    reply = "⚠️ Gemini sent an empty reply. Try again."

            except Exception as e:
                reply = f"❌ Error: {e}"

        st.markdown(reply)

    st.session_state.messages.append({"role": "assistant", "content": reply})
