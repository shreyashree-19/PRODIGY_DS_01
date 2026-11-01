# DataViz – Interactive Data Distribution & Analysis Dashboard

A fully functional, modern, professional data visualization web application built with **Flask** (Python) + **Chart.js** (JavaScript).

---

## Features

| Feature | Details |
|---|---|
| **Dataset Upload** | CSV & Excel (`.xlsx`, `.xls`) support, drag-and-drop |
| **Sample Dataset** | Built-in 200-record population dataset with 11 columns |
| **Bar Charts** | Categorical variable distribution, vertical/horizontal, 6 color palettes |
| **Histograms** | Numerical variable distribution, adjustable bins (5–50) |
| **Data Analysis** | Mean, median, mode, std, skewness, frequency tables |
| **Auto Interpretation** | AI-like text explaining each chart |
| **Export** | Download charts as PNG, export dataset as CSV |
| **Responsive** | Works on desktop, tablet, and mobile |

---

## Project Structure

```
Interactive Data Visualization Dashboard/
├── app.py                  # Flask backend + API routes
├── requirements.txt        # Python dependencies
├── README.md               # This file
├── templates/
│   └── index.html          # Main dashboard HTML
├── static/
│   ├── css/
│   │   └── style.css       # Premium dark theme CSS
│   └── js/
│       └── main.js         # All frontend JavaScript
└── uploads/                # Uploaded files (auto-created)
```

---

## Quick Start

### 1. Prerequisites
- Python 3.9 or newer
- pip

### 2. Install Dependencies

```bash
cd "Interactive Data Visualization Dashboard"
pip install -r requirements.txt
```

### 3. Run the Application

```bash
python app.py
```

Then open your browser at: **http://localhost:5000**

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/load-sample` | Load the built-in sample dataset |
| `POST` | `/api/upload` | Upload a CSV or Excel file |
| `POST` | `/api/bar-chart` | Get bar chart data for a categorical column |
| `POST` | `/api/histogram` | Get histogram data for a numerical column |
| `GET`  | `/api/analysis` | Full statistical analysis of the loaded dataset |
| `GET`  | `/api/columns` | Get list of numerical and categorical columns |
| `GET`  | `/api/export-csv` | Download the loaded dataset as CSV |
| `POST` | `/api/reset` | Clear all loaded data |

---

## Sample Dataset Columns

| Column | Type | Description |
|---|---|---|
| ID | Numerical | Unique identifier |
| Name | Categorical | Employee name |
| Age | Numerical | Age in years (22–65) |
| Gender | Categorical | Male / Female |
| Education | Categorical | High School / Bachelor's / Master's / PhD / Diploma |
| Department | Categorical | Engineering / Marketing / Finance / HR / etc. |
| Occupation | Categorical | Job title |
| Salary | Numerical | Annual salary (USD) |
| Score | Numerical | Performance score (0–100) |
| City | Categorical | Indian city |
| Years_Experience | Numerical | Years of work experience |

---

## Technology Stack

- **Backend**: Python 3, Flask 3
- **Data Processing**: Pandas, NumPy
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **UI Framework**: Bootstrap 5
- **Charts**: Chart.js 4
- **Icons**: Bootstrap Icons

---

## Screenshots

Load the app, click **"Load Sample Dataset"**, then explore:
- **Bar Chart** → Select `Gender`, `Department`, `Education`, `City`
- **Histogram** → Select `Age`, `Salary`, `Score`, `Years_Experience`
- **Data Analysis** → Click "Run Analysis" for full statistical breakdown
