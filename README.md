# Zerodha Tax Tracker (FY 2025-2026)

A premium, privacy-first web application built with **Next.js** to instantly analyze and visualize your Zerodha Tax P&L report. Designed specifically for Indian Income Tax Return (ITR) filing, this tool parses your raw Excel data and generates a clean, consolidated dashboard without ever uploading your financial data to a server.

## ✨ Key Features

- **🔒 100% Private (Local Processing):** Your financial data never leaves your computer. The Excel parsing is done entirely in your browser using the `xlsx` library.
- **📊 Auto-Segregation:** Automatically reads the `Tradewise Exits` sheet to segregate and calculate P&L for:
  - **Stocks (EQ)**
  - **Mutual Funds (MF)**
  - **Precious Metals (Gold/Silver ETFs)**
- **⏱️ Holding Period Detection:** Computes precise holding periods to dynamically separate trades into Short-Term Capital Gains (STCG) and Long-Term Capital Gains (LTCG).
- **📅 Quarterly Breakdown:** Breaks down capital gains into Q1, Q2, Q3, and Q4, which is required for advance tax calculations in ITR.
- **📈 Dividend Tracking:** Aggregates and lists all dividend income.
- **🖨️ Export Ready:** 
  - **Export to Excel:** Generates a clean, multi-sheet `.xlsx` file formatted perfectly for sharing with your Chartered Accountant.
  - **Print to PDF:** Specifically optimized print styles to generate a seamless, scroll-free PDF document.
  - **Export to HTML:** Downloads a standalone, styled HTML file for offline viewing.

## 🚀 How to Run Locally

### Prerequisites
Make sure you have Node.js (v18 or higher) and npm installed on your machine.

### Installation

1. Clone this repository and navigate into the directory:
   ```bash
   cd tax-tracker
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```

### Running the Development Server
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## 📥 How to Get Your Zerodha Data

1. Log in to **Zerodha Console**.
2. Go to **Reports** > **Tax P&L**.
3. Select the Financial Year **2025-2026** (or your desired year).
4. Click on **Download Tax P&L report for all segments** (this will download a single Excel file).
5. Open the Tax Tracker app, upload this exact Excel file, and click **Generate Tax Report**.

## 🛠️ Technology Stack
- **Framework:** Next.js (App Router)
- **UI & Styling:** React, Vanilla CSS (Premium Dark Mode)
- **Icons:** Lucide React
- **Data Parsing:** SheetJS (`xlsx`)

## 📄 License
This project is for personal use to assist with tax reporting. Please verify all auto-generated numbers with a qualified Chartered Accountant before submitting your final ITR.
