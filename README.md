# AgentOps - AI-Powered Vendor Management System

## Overview

AgentOps is a sophisticated vendor management system that leverages AI to streamline the vendor selection and evaluation process. The application uses a combination of React for the frontend and Python for AI/ML workflows, providing an intuitive interface for managing vendor data and making data-driven decisions.

## Features

- **Vendor Search & Filtering**: Advanced search capabilities to find vendors based on various criteria
- **AI-Powered Shortlisting**: Intelligent ranking and shortlisting of vendors using custom algorithms
- **Workflow Automation**: Automated vendor evaluation workflows using LangGraph
- **Data Visualization**: Interactive dashboards for vendor performance metrics
- **Compliance Tracking**: Monitor vendor compliance with industry standards and regulations

## Tech Stack

### Frontend
- **React 18** - Frontend library for building user interfaces
- **TypeScript** - Type-safe JavaScript
- **Vite** - Next Generation Frontend Tooling
- **shadcn/ui** - Beautifully designed components
- **Tailwind CSS** - Utility-first CSS framework
- **React Query** - Data fetching and state management
- **XYFlow** - Interactive node-based workflow editor

### Backend/AI
- **Python 3.10+**
- **LangGraph** - Framework for building stateful, multi-actor applications
- **LangChain** - Framework for developing applications powered by language models
- **Azure OpenAI** - For natural language processing tasks

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Azure OpenAI API key (or other LLM provider)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AgentOps
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Set up Python environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Environment Variables**
   Create a `.env` file in the root directory with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   AZURE_OPENAI_ENDPOINT=your_azure_endpoint
   AZURE_OPENAI_API_KEY=your_azure_api_key
   ```

### Running the Application

1. **Start the development server**
   ```bash
   # In one terminal
   npm run dev
   
   # In another terminal
   python langgraph_workflow_skeleton.py
   ```

2. **Build for production**
   ```bash
   npm run build
   ```

## Project Structure

```
AgentOps/
├── src/                    # Frontend source code
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   ├── lib/                # Utility functions and API clients
│   └── styles/             # Global styles
├── public/                 # Static assets
├── data/                   # Sample vendor datasets
├── scripts/                # Utility scripts
├── langgraph_workflow_skeleton.py  # AI workflow implementation
└── extract_metrics_from_logs.py    # Log analysis utilities
```

## Data Management

The application works with vendor data in JSON format. Sample datasets are provided:
- `vendor_dataset_1000.json`: Large dataset of vendor information
- `vendor_data_compliance_*.json`: Compliance-related vendor data
- `synthetic_vendor_data.json`: Generated sample data for testing

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run tests (setup needed)

### Code Style

- TypeScript: Follows Airbnb style guide
- Python: Follows PEP 8 guidelines
- Pre-commit hooks for code formatting and linting

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository.

