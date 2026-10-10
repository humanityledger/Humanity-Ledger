# QUICKSTART

## Ledger Alert Network - System Vault

Get the Ledger Alert Network up and running locally in under 5 minutes.

### Prerequisites
- Operating System: Windows, macOS, or Linux
- Node.js: v18 or v20+ recommended
- RAM: 8GB minimum recommended (4GB in Lite Mode)
- Redis: Highly recommended if not using degraded mode.

### Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/humanityledger/humanityledger.git
   cd humanityledger
   ```

2. **Install Dependencies**
   ```bash
   npm ci
   ```

3. **Configure Environment Variables**
   Copy the example environment file and fill in your keys (Alchemy, WorldID, etc. are optional for local demo but required for full functionality).
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` using your preferred text editor.*

4. **Start the System Vault**
   We provide a batch script for a streamlined start on Windows, or you can use the standard npm commands:
   
   **Windows:**
   ```bash
   SystemVault_RUN.bat
   ```
   
   **Linux/macOS:**
   ```bash
   npm run build
   npm run start
   ```
   *Alternatively, run in development mode with `npm run dev`.*

5. **Access the Terminal**
   Once the server is running, open your browser and navigate to:
   ```
   http://localhost:3000/landing
   ```

You are now observing sovereign flows without compromising your privacy.

> [!TIP]
> For advanced configurations, please refer to `DEPLOYMENT.md` and `PRODUCTION_READINESS.md`.
