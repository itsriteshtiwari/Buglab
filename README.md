# Buglab

# 🐛 BugLab — Bug Tracker & AI Code Fixer

BugLab is a modern, full-stack bug tracking application that leverages the power of Google's Gemini AI to not only track bugs but actively help you fix them. Paste your broken code, and BugLab will automatically detect the language, assess the severity, and provide a step-by-step AI analysis with corrected code.

## ✨ Features

* **⚡ AI Code Analyzer**: Click a button to have Google Gemini instantly analyze buggy code. It explains what went wrong, provides step-by-step instructions, generates the fixed code, and suggests best practices.
* **🤖 Smart Auto-Detect**: Paste your code into the bug report form, and the AI automatically detects the programming language/framework and assigns the appropriate priority level (Critical, High, Medium, Low) based on security and crash risks.
* **📊 Bug Management**: Track bugs by status (Open, In Progress, Review, Closed). Filter and organize them with a sleek, custom-designed UI.
* **💾 Built-in Database**: Uses SQLite for zero-configuration, lightweight local data storage.

## 🛠️ Tech Stack

* **Frontend**: React (Vite), pure CSS (Custom UI with Syne & JetBrains Mono fonts)
* **Backend**: Python, FastAPI
* **Database**: SQLite
* **AI Integration**: Google GenAI SDK (`gemini-3-flash-preview` model)

---

## 🚀 Getting Started

Follow these steps to run BugLab locally on your machine.

### Prerequisites
* [Node.js](https://nodejs.org/) (v16 or higher)
* [Python](https://www.python.org/downloads/) (v3.9 or higher)
* A **Google Gemini API Key** (Get one for free at [Google AI Studio](https://aistudio.google.com/))

### 1. Set Up the Backend (FastAPI)

Open your terminal and navigate to the root directory of the project.

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install the required Python packages
pip install fastapi uvicorn pydantic google-genai
