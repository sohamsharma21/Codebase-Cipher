# Codebase Cipher

**Understand any GitHub repository in seconds.**

Codebase Cipher is an AI-powered tool that instantly visualizes the structure, dependencies, APIs, and logic of any public GitHub repository. Simply paste a URL and let AI do the heavy lifting.

## ✨ Features

- **Instant Repo Analysis**: Paste any GitHub repo URL and get immediate insights
- **AI-Powered Visualization**: Understand complex codebases with intelligent summaries
- **Dependency Mapping**: See how different parts of the codebase connect
- **API Documentation**: Automatically discover and document APIs
- **Logic Explanation**: Get clear explanations of core functionality
- **Modern UI**: Beautiful, intuitive interface built with React and TypeScript
- **Responsive Design**: Works seamlessly on desktop and mobile

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd codebase-cipher
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

### Usage

1. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. Open your browser and navigate to `http://localhost:5173`

3. Paste any GitHub repository URL and explore the AI-powered insights!

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React
- **AI Integration**: Placeholder for future AI API integration
- **Deployment**: Built with Lovable's deployment pipeline

## 📂 Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── RepoInput.tsx    # GitHub URL input component
│   ├── RepoVisualizer.tsx # Codebase visualization
│   ├── DependencyGraph.tsx # Dependency visualization
│   ├── ApiExplorer.tsx  # API documentation
│   └── LogicAnalyzer.tsx # Logic explanation
├── pages/             # Page components
│   ├── Home.tsx       # Main landing page
│   └── RepoAnalysis.tsx # Repo analysis results
├── services/          # API and service integrations
│   └── githubService.ts # GitHub API client
├── App.tsx            # Root application component
├── main.tsx           # Entry point
└── index.css          # Global styles
```

## 🔌 AI Integration

This project is built with AI capabilities in mind. The `services/githubService.ts` file contains placeholders for integrating with AI APIs (e.g., OpenAI, Anthropic, or custom models) to analyze codebase structure, dependencies, and logic.

**Future Enhancements:**
- Integrate with GitHub API to fetch repository data
- Implement AI-powered code analysis using LLMs
- Add dependency graph visualization
- Build API documentation generation
- Create logic explanation modules

## 🎨 Design System

The project uses a modern, clean design system with:
- **Color Palette**: Deep blues, vibrant purples, and clean whites
- **Typography**: Inter font for professional readability
- **Components**: Custom React components with Tailwind CSS
- **Icons**: Lucide React for crisp, scalable icons

## 🤝 Contributing

Contributions are welcome! This project is built with Lovable's development standards. Feel free to fork the repository, create a feature branch, and submit a pull request.

## 📝 License

This project is open-sourced software licensed by Lovable.
