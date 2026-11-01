import os
import json
import io
import base64
import traceback
from flask import Flask, request, jsonify, render_template, send_file
import pandas as pd
import numpy as np
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
app.config['UPLOAD_FOLDER'] = 'uploads'
app.secret_key = 'dataviz_secret_key_2024'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Global in-memory store for the currently loaded DataFrame
current_df = None
current_filename = ""

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def df_info(df):
    """Return a compact summary of a DataFrame."""
    numerical_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    missing = df.isnull().sum()

    columns_info = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        col_missing = int(missing[col])
        col_type = 'numerical' if col in numerical_cols else 'categorical'
        unique_vals = int(df[col].nunique())
        columns_info.append({
            'name': col,
            'dtype': dtype,
            'type': col_type,
            'missing': col_missing,
            'unique': unique_vals
        })

    return {
        'total_records': len(df),
        'total_columns': len(df.columns),
        'numerical_columns': numerical_cols,
        'categorical_columns': categorical_cols,
        'columns_info': columns_info,
        'total_missing': int(missing.sum()),
        'filename': current_filename
    }


def generate_sample_dataset():
    np.random.seed(42)
    n = 200

    names_first = [
        'Aarav', 'Aisha', 'Rohan', 'Priya', 'Vikram', 'Sneha', 'Arjun', 'Kavya',
        'Rahul', 'Deepika', 'Karan', 'Meera', 'Amit', 'Pooja', 'Suresh', 'Ananya',
        'Nikhil', 'Swati', 'Raj', 'Divya', 'Sanjay', 'Ritu', 'Manish', 'Shweta',
        'Vishal', 'Neha', 'Ajay', 'Shreya', 'Ravi', 'Tanvi'
    ]

    genders = np.random.choice(['Male', 'Female'], size=n, p=[0.55, 0.45])
    ages = np.clip(np.random.normal(35, 10, n).astype(int), 22, 65)
    educations = np.random.choice(
        ['High School', "Bachelor's", "Master's", 'PhD', 'Diploma'],
        size=n, p=[0.15, 0.45, 0.28, 0.07, 0.05]
    )
    departments = np.random.choice(
        ['Engineering', 'Marketing', 'Finance', 'HR', 'Operations', 'Sales', 'IT', 'R&D'],
        size=n, p=[0.20, 0.12, 0.12, 0.10, 0.12, 0.14, 0.12, 0.08]
    )
    occupations = np.random.choice(
        ['Software Engineer', 'Data Analyst', 'Manager', 'Executive', 'Consultant',
         'Designer', 'Accountant', 'HR Specialist', 'Sales Rep', 'Research Scientist'],
        size=n
    )

    base_salary = {
        'Engineering': 75000, 'IT': 72000, 'R&D': 80000,
        'Finance': 70000, 'Marketing': 62000, 'Sales': 60000,
        'HR': 58000, 'Operations': 65000
    }
    salaries = np.array([
        int(base_salary[dep] + np.random.normal(0, 8000))
        for dep in departments
    ])
    salaries = np.clip(salaries, 40000, 150000)

    edu_bonus = {"Master's": 8000, "Bachelor's": 3000, 'Diploma': 0, 'High School': -5000, 'PhD': 15000}
    salaries += np.array([edu_bonus[e] for e in educations])

    scores = np.clip(np.random.normal(72, 15, n).astype(int), 0, 100)
    cities = np.random.choice(
        ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad'],
        size=n
    )

    df = pd.DataFrame({
        'ID': range(1, n + 1),
        'Name': [names_first[i % len(names_first)] + ' ' + chr(65 + i % 26) for i in range(n)],
        'Age': ages,
        'Gender': genders,
        'Education': educations,
        'Department': departments,
        'Occupation': occupations,
        'Salary': salaries,
        'Score': scores,
        'City': cities,
        'Years_Experience': np.clip(ages - 22, 0, None)
    })
    return df


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/load-sample', methods=['POST'])
def load_sample():
    global current_df, current_filename
    current_df = generate_sample_dataset()
    current_filename = 'sample_population_dataset.csv'
    preview = current_df.head(10).to_dict(orient='records')
    return jsonify({'success': True, 'info': df_info(current_df), 'preview': preview})


@app.route('/api/upload', methods=['POST'])
def upload_file():
    global current_df, current_filename
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part in request'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': 'Invalid file type. Please upload CSV or Excel files.'}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        ext = filename.rsplit('.', 1)[1].lower()
        if ext == 'csv':
            current_df = pd.read_csv(filepath)
        else:
            current_df = pd.read_excel(filepath)
        current_filename = filename
        preview = current_df.head(10).to_dict(orient='records')
        return jsonify({'success': True, 'info': df_info(current_df), 'preview': preview})
    except Exception as e:
        return jsonify({'success': False, 'error': f'Failed to parse file: {str(e)}'}), 500


@app.route('/api/bar-chart', methods=['POST'])
def bar_chart():
    global current_df
    if current_df is None:
        return jsonify({'success': False, 'error': 'No dataset loaded'}), 400

    data = request.get_json()
    column = data.get('column')
    if not column or column not in current_df.columns:
        return jsonify({'success': False, 'error': 'Invalid column selected'}), 400

    freq = current_df[column].value_counts()
    labels = freq.index.tolist()
    values = [int(v) for v in freq.values.tolist()]
    total = sum(values)
    percentages = [round(v / total * 100, 2) for v in values]

    mode_val = current_df[column].mode()
    mode_str = str(mode_val.iloc[0]) if len(mode_val) > 0 else 'N/A'

    interpretation = _interpret_bar(column, labels, values, total)

    return jsonify({
        'success': True,
        'labels': labels,
        'values': values,
        'percentages': percentages,
        'total': total,
        'mode': mode_str,
        'unique_count': int(current_df[column].nunique()),
        'missing': int(current_df[column].isnull().sum()),
        'interpretation': interpretation,
        'frequency_table': [
            {'category': str(l), 'count': v, 'percentage': p}
            for l, v, p in zip(labels, values, percentages)
        ]
    })


@app.route('/api/histogram', methods=['POST'])
def histogram():
    global current_df
    if current_df is None:
        return jsonify({'success': False, 'error': 'No dataset loaded'}), 400

    data = request.get_json()
    column = data.get('column')
    bins = int(data.get('bins', 15))

    if not column or column not in current_df.columns:
        return jsonify({'success': False, 'error': 'Invalid column selected'}), 400

    series = current_df[column].dropna()
    if not pd.api.types.is_numeric_dtype(series):
        return jsonify({'success': False, 'error': 'Selected column is not numerical'}), 400

    counts, bin_edges = np.histogram(series, bins=bins)
    bin_labels = [f'{bin_edges[i]:.1f}-{bin_edges[i+1]:.1f}' for i in range(len(counts))]
    bin_centers = [(bin_edges[i] + bin_edges[i+1]) / 2 for i in range(len(counts))]

    mean_val = float(series.mean())
    median_val = float(series.median())
    mode_vals = series.mode()
    mode_val = float(mode_vals.iloc[0]) if len(mode_vals) > 0 else None
    std_val = float(series.std())
    skew_val = float(series.skew())
    kurt_val = float(series.kurtosis())

    interpretation = _interpret_hist(column, mean_val, median_val, std_val, skew_val, float(series.min()), float(series.max()))

    return jsonify({
        'success': True,
        'labels': bin_labels,
        'values': counts.tolist(),
        'bin_centers': [round(bc, 2) for bc in bin_centers],
        'stats': {
            'mean': round(mean_val, 2),
            'median': round(median_val, 2),
            'mode': round(mode_val, 2) if mode_val else 'N/A',
            'std': round(std_val, 2),
            'min': round(float(series.min()), 2),
            'max': round(float(series.max()), 2),
            'skewness': round(skew_val, 3),
            'kurtosis': round(kurt_val, 3),
            'count': int(series.count()),
            'missing': int(current_df[column].isnull().sum()),
            'q25': round(float(series.quantile(0.25)), 2),
            'q75': round(float(series.quantile(0.75)), 2),
        },
        'interpretation': interpretation
    })


@app.route('/api/analysis', methods=['GET'])
def full_analysis():
    global current_df
    if current_df is None:
        return jsonify({'success': False, 'error': 'No dataset loaded'}), 400

    numerical_cols = current_df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = current_df.select_dtypes(exclude=[np.number]).columns.tolist()

    num_stats = {}
    for col in numerical_cols:
        s = current_df[col].dropna()
        mode_v = s.mode()
        num_stats[col] = {
            'mean': round(float(s.mean()), 2),
            'median': round(float(s.median()), 2),
            'mode': round(float(mode_v.iloc[0]), 2) if len(mode_v) else None,
            'std': round(float(s.std()), 2),
            'min': round(float(s.min()), 2),
            'max': round(float(s.max()), 2),
            'missing': int(current_df[col].isnull().sum()),
            'skewness': round(float(s.skew()), 3),
        }

    cat_stats = {}
    for col in categorical_cols:
        freq = current_df[col].value_counts()
        cat_stats[col] = {
            'unique': int(current_df[col].nunique()),
            'missing': int(current_df[col].isnull().sum()),
            'mode': str(current_df[col].mode().iloc[0]) if len(current_df[col].mode()) else 'N/A',
            'top_5': [{'value': str(k), 'count': int(v)} for k, v in freq.head(5).items()],
        }

    return jsonify({
        'success': True,
        'numerical': num_stats,
        'categorical': cat_stats,
        'shape': {'rows': len(current_df), 'cols': len(current_df.columns)},
        'total_missing': int(current_df.isnull().sum().sum()),
    })


@app.route('/api/export-csv', methods=['GET'])
def export_csv():
    global current_df
    if current_df is None:
        return jsonify({'success': False, 'error': 'No dataset loaded'}), 400
    output = io.StringIO()
    current_df.to_csv(output, index=False)
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name='processed_dataset.csv'
    )


@app.route('/api/reset', methods=['POST'])
def reset():
    global current_df, current_filename
    current_df = None
    current_filename = ''
    return jsonify({'success': True, 'message': 'Dashboard reset successfully'})


@app.route('/api/columns', methods=['GET'])
def get_columns():
    global current_df
    if current_df is None:
        return jsonify({'success': False, 'error': 'No dataset loaded'}), 400
    numerical_cols = current_df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = current_df.select_dtypes(exclude=[np.number]).columns.tolist()
    return jsonify({
        'success': True,
        'numerical': numerical_cols,
        'categorical': categorical_cols,
        'all': current_df.columns.tolist()
    })


def _interpret_bar(column, labels, values, total):
    if not labels:
        return 'No data available for interpretation.'
    top_label = labels[0]
    top_count = values[0]
    top_pct = round(top_count / total * 100, 1)
    unique = len(labels)
    lines = [
        f"The bar chart displays the distribution of <strong>{column}</strong> across {unique} unique categories.",
        f"The most frequent category is <strong>'{top_label}'</strong>, appearing {top_count} times ({top_pct}% of all records).",
    ]
    if len(labels) >= 2:
        second_pct = round(values[1] / total * 100, 1)
        lines.append(f"The second most common is <strong>'{labels[1]}'</strong> at {second_pct}%.")
    if top_pct > 50:
        lines.append(f"The distribution is highly concentrated — '{top_label}' dominates the dataset.")
    elif top_pct < 25:
        lines.append("The distribution appears relatively balanced across categories.")
    return ' '.join(lines)


def _interpret_hist(column, mean, median, std, skew, mn, mx):
    lines = [
        f"The histogram shows the frequency distribution of <strong>{column}</strong>.",
        f"Values range from <strong>{mn:.1f}</strong> to <strong>{mx:.1f}</strong> with a mean of <strong>{mean:.2f}</strong> and median of <strong>{median:.2f}</strong>.",
        f"The standard deviation is {std:.2f}, indicating {'high' if std > mean * 0.3 else 'moderate' if std > mean * 0.15 else 'low'} variability.",
    ]
    if abs(skew) < 0.2:
        lines.append("The distribution is approximately <strong>symmetric (normal)</strong>.")
    elif skew > 0.5:
        lines.append(f"The distribution is <strong>right-skewed</strong> (skewness={skew:.2f}), meaning most values cluster toward the lower end with a long right tail.")
    elif skew < -0.5:
        lines.append(f"The distribution is <strong>left-skewed</strong> (skewness={skew:.2f}), meaning most values cluster toward the higher end with a long left tail.")
    else:
        lines.append("The distribution shows slight skewness but is close to symmetric.")
    if std > 0 and abs(mean - median) / std > 0.1:
        lines.append(f"The gap between mean ({mean:.2f}) and median ({median:.2f}) suggests the presence of outliers.")
    return ' '.join(lines)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
