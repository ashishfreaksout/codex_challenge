# Bay Area Pothole Risk Prediction and Navigation Platform

## 1. Project Title

**Bay Area Pothole Risk Prediction and Navigation Platform: A Machine Learning Web and Mobile Application for Live Road Hazard Reporting and AI-Based Probability Hotspots**

## 2. Introduction

This project is a full-stack machine learning application designed to identify, visualize, and communicate pothole risk across the Bay Area. The application combines live civic service request data, historical pothole records, environmental predictors, and a machine learning prediction engine to help users understand where potholes have already been reported and where potholes are more likely to occur in the future.

The original goal was to move beyond a static map or a single hardcoded dataset. Instead, the project was developed as a dynamic and reusable machine learning system. In its current implementation, the system ingests structured CSV files and API-style service request data. The same architecture can be extended into a broader web dashboard where users upload different datasets, select or confirm the response variable, automatically train models, evaluate performance, and view results through an interactive dashboard.

The final application includes a React Native Expo interface, live pothole markers, a predictive hotspot mode, a 3D navigation mode, a Python machine learning training script, and a Node.js/FastAPI prediction service that serves GeoJSON probability surfaces to the frontend.

## 3. Project Motivation

The motivation for this project was to build a practical machine learning system that could solve a real civic infrastructure problem while still being reusable and explainable. Many beginner machine learning projects are hardcoded around one dataset, one model, and one output table. That approach limits reuse because the system fails when column names, data types, target variables, or problem types change.

This project was created to address that limitation. The goal was to build a pipeline that can ingest historical pothole data, combine it with external predictors such as rainfall, drainage, pavement condition, and traffic load, and generate a probability surface that can be displayed in an app. The project also supports the idea of comparing live reported potholes against the AI-predicted risk layer, which makes the model output more meaningful to users.

From a learning perspective, the project was also motivated by the need to understand the complete machine learning lifecycle: data ingestion, preprocessing, feature engineering, model training, prediction serving, frontend visualization, mobile testing, deployment, and iterative debugging.

## 4. Problem Statement

Potholes are a common urban road hazard that can damage vehicles, reduce road safety, and increase maintenance costs. Cities often collect pothole complaints through 311 systems, but live reports only show where potholes have already been noticed. Drivers and city planners can benefit from an additional predictive layer that estimates where potholes are likely to appear before they are formally reported.

The project solves the following problem:

How can a machine learning application ingest live and historical civic data, combine it with environmental and infrastructure predictors, train an appropriate model, evaluate risk, and present the results in a clear interactive dashboard or mobile map?

The application is designed to help users:

- View live pothole reports from mock or API-based 311 data.
- Visualize predicted pothole probability hotspots.
- Compare live reported potholes with predicted high-risk areas.
- Receive warnings when entering a high-probability pothole area.
- Understand which features contributed to model predictions.
- Reuse the data pipeline with updated historical datasets and future uploaded datasets.

## 5. Technology Used

### Python

Python was used for the machine learning training pipeline. It is well suited for data science because it has strong libraries for numerical computation, preprocessing, model training, and evaluation. In this project, Python reads historical pothole records and environmental predictor files, builds the feature matrix, trains the risk model, and outputs a GeoJSON risk grid.

### Scikit-Learn

Scikit-learn was used as the primary machine learning framework. The current model uses `HistGradientBoostingClassifier`, supported by preprocessing tools such as `StandardScaler` and feature interpretation using permutation importance. Scikit-learn was chosen because it provides reliable implementations of standard machine learning models, consistent APIs for training and prediction, and built-in tools for model evaluation.

### NumPy

NumPy was used for numerical arrays, feature matrices, model inputs, and probability calculations. It helped convert cleaned and engineered feature rows into the format expected by scikit-learn.

### React Native and Expo

React Native with Expo was used to build the mobile and web-facing application interface. Expo made it easier to run the app in development, build Android APK files through EAS Build, and test the same project across mobile and web environments.

### React Native Maps and OpenStreetMap Tiles

The project originally used Google Maps through `react-native-maps`, but later added OpenStreetMap/CARTO tile support for native builds. This reduced dependency on Google Maps rendering and helped avoid blank map issues when API key restrictions or Android signing settings were not configured correctly. The map interface displays live markers, predicted probability cells, the user's location, and navigation-style views.

### Node.js and Express

Node.js with Express was used for the prediction microservice. The service exposes endpoints such as `/api/v1/predictive-map`, `/api/v1/model-metadata`, and `/api/v1/report`. It loads the risk grid, applies gradient weighting, filters cells by bounding box and score, and sends GeoJSON data to the frontend.

### FastAPI and Hugging Face Deployment

A FastAPI version of the prediction service was prepared for hosted deployment on Hugging Face Spaces. This provides a cloud-friendly way to serve the model output through an API. The app can point to the hosted prediction URL instead of relying on a local Node.js server.

### GeoJSON

GeoJSON was used as the format for the probability surface. Each grid cell is stored as a polygon with properties such as probability score, risk band, feature values, feature explanations, and model metadata. GeoJSON is useful because it is widely supported by mapping libraries and can represent spatial prediction results clearly.

### rbush

`rbush` was used for spatial indexing in the Node.js service. Spatial indexing improves performance by allowing the service to return only the risk cells visible in the current map viewport instead of sending thousands of polygons every time.

### Styled Components

Styled Components was used for UI styling in the React Native application. It helped keep component styling organized and reusable while maintaining a clean dashboard layout.

### Visualization Libraries and Map-Based Visualization

The current app focuses on geospatial visualization rather than traditional static charts. It visualizes live reports as orange warning markers and predicted probability as colored hotspot overlays. For a full academic dashboard extension, the same model outputs can also be visualized using charts such as actual vs predicted plots, model comparison charts, ROC curves, confusion matrices, and feature importance charts.

### GitHub

GitHub was used for version control. It allowed the project to be committed, pushed, tracked over multiple iterations, and prepared for portfolio or professor review.

### Expo EAS Build

Expo Application Services were used to create Android APK builds for testing. Separate actual and sandbox builds were configured so the production-style app and 3D sandbox navigation app can be installed separately.

### AI Coding Assistant

An AI coding assistant was used during development to help design the machine learning pipeline, create the prediction service, improve frontend map behavior, debug mobile build issues, and refine the interface. The AI agent helped make the ML engine more descriptive, explainable, and visual by adding feature descriptions, risk explanations, probability bands, prediction metadata, and dashboard-ready GeoJSON outputs.

## 6. System Architecture

The overall system follows a layered architecture:

1. Data ingestion layer
2. Data preprocessing and feature engineering layer
3. Machine learning training layer
4. Risk grid generation layer
5. Prediction API layer
6. Frontend map and dashboard layer
7. Mobile navigation and alert layer

The pipeline works as follows:

1. Historical pothole records are loaded from CSV data.
2. Live pothole records are loaded from mock data or 311 API-style endpoints.
3. Environmental predictors are loaded from a separate feature file.
4. The system validates latitude, longitude, date, service type, status, and fixed-date fields.
5. Pothole records are grouped into spatial grid cells.
6. Feature engineering calculates temporal frequency, seasonality, infrastructure decay, rainfall, drainage, pavement, and traffic predictors.
7. A classification model estimates the probability that a grid cell will receive a pothole report.
8. The output is written as a GeoJSON feature collection.
9. The Node.js or FastAPI service serves the risk grid to the frontend.
10. The React Native app displays live reports, predicted hotspots, and navigation warnings.
11. User-submitted pothole reports trigger partial risk recalculation for nearby cells.

Simple written pipeline:

```text
Dataset/API Input
    -> Validation and Column Detection
    -> Spatial Grid Creation
    -> Feature Engineering
    -> Model Training
    -> Probability Scoring
    -> GeoJSON Risk Grid
    -> Prediction API
    -> Interactive Map Dashboard
    -> Live Driver Warning
```

## 7. Machine Learning Engine

The machine learning engine was designed by the AI agent to be reusable, descriptive, and explainable. Instead of only plotting reported potholes, the engine builds a probability model from historical data and additional predictors.

### Dynamic Data Handling

The training script detects common column names for service type, latitude, longitude, request date, fixed date, and status. This allows it to handle datasets that use slightly different naming conventions, such as `latitude`, `lat`, `longitude`, `lng`, `created_at`, `opened_at`, `closed_at`, or `resolved_at`.

For a future upload-based dashboard, this logic can be extended so users upload a dataset and either allow automatic target detection or manually select the response variable.

### Response Variable

In the current pothole model, the target variable is whether a grid cell is associated with pothole activity. Positive examples are generated from cells containing historical pothole reports. Negative examples are sampled from nearby cells without reported potholes, while still respecting the road/land prediction mask.

For a general ML dashboard version, the response variable could be selected by the user. The system would then determine whether the task is classification or regression based on the target variable's data type and number of unique values.

### Predictor Variables

The project uses the following predictor groups:

- Historical pothole report frequency in the last 24 months.
- Rainy-season indicator for January through March.
- Infrastructure decay based on time since a fixed or closed status.
- 30-day and 90-day rainfall.
- Heavy-rain-day counts.
- Impervious surface percentage.
- Slope and topographic wetness.
- Flow accumulation and drainage risk.
- Storm drain distance and storm drain density.
- Flooding or drainage complaint counts.
- Pavement condition index.
- Days since resurfacing.
- Annual average daily traffic.
- Truck route exposure.
- Road class score.

These predictors were selected because potholes are more likely where weakened pavement, water retention, traffic load, and repeated repair history overlap.

### Missing Values

The engine handles missing environmental values by falling back to default regional averages. When environmental samples exist near a grid cell, the model uses distance-weighted interpolation from nearby samples. This reduces failures when one input layer is incomplete.

For a general upload-based ML dashboard, missing numeric values should be handled through mean, median, or model-based imputation, while categorical missing values should be handled through an "Unknown" category or most-frequent imputation.

### Categorical Variables

The current pothole engine mainly uses numeric predictors. Categorical inputs such as service type and status are normalized as text and used for filtering or status interpretation. In a generalized dashboard, categorical predictors should be encoded using one-hot encoding, ordinal encoding, or target encoding depending on the model and dataset size.

### Scaling and Normalization

The scikit-learn model uses a pipeline with `StandardScaler`. Scaling is especially helpful for models that are sensitive to feature magnitude, such as logistic regression, KNN, and neural network-style methods. Although gradient boosting is less sensitive to scaling than distance-based models, keeping scaling in the pipeline makes the engine more consistent and easier to extend.

### Train-Test Split

For academic evaluation, the model should be evaluated on a held-out test set using a reproducible random seed or a time-based split. A time-based split is especially appropriate for pothole prediction because future reports should be predicted from past data, not randomly mixed with it.

Current implementation note: the training script builds positive and negative samples and trains the risk model, but the final report metrics should be generated from a held-out test set before submission. Placeholders are included in the Results section for these values.

### Classification vs Regression

The current pothole prediction task is treated as a classification problem: each grid cell receives a probability of pothole risk. If the target were pothole count, repair time, repair cost, or severity score, the system could instead treat the task as regression.

In a generalized dashboard, task type can be detected as follows:

- Numeric continuous target: regression.
- Binary categorical target: binary classification.
- Categorical target with more than two classes: multiclass classification.
- Date-indexed target: possible time-series modeling extension.

### Model Training

The current implemented model is a `HistGradientBoostingClassifier` combined with a weighted heuristic score. The model produces probability scores from 0.0 to 1.0. The heuristic score ensures that domain knowledge such as rainfall, water retention, pavement decay, traffic load, and report history still contributes to the final risk estimate.

### Model Comparison and Best Model Selection

For the full dashboard version, the engine should train multiple candidate models and compare them using objective metrics. For classification, the best model should be selected using ROC-AUC, F1-score, recall, precision, and confusion matrix behavior. For regression, the best model should be selected using RMSE, MAE, R-squared, adjusted R-squared, and residual behavior.

## 8. Models Used

### HistGradientBoostingClassifier

The main implemented model is scikit-learn's `HistGradientBoostingClassifier`. This model builds an ensemble of decision trees sequentially, where each new tree attempts to correct errors from the previous trees. It is efficient for tabular datasets and can model nonlinear relationships between predictors.

Why it was included:

- Pothole risk is unlikely to be purely linear.
- Interactions between rainfall, pavement condition, water retention, and traffic load are important.
- Gradient boosting performs well on structured tabular data.

Strengths:

- Handles nonlinear relationships.
- Captures feature interactions.
- Often performs better than single decision trees.
- Produces probability estimates for classification.

Weaknesses:

- Less directly interpretable than linear models.
- Can overfit if not regularized.
- Requires careful validation.

When it works well:

- Medium-sized structured datasets.
- Problems with nonlinear feature interactions.
- Situations where predictive performance is more important than simple coefficients.

Performance in this project:

- Current best implemented model: `HistGradientBoostingClassifier`.
- Insert final evaluation here: `[Insert ROC-AUC value here]`, `[Insert accuracy value here]`, `[Insert F1-score here]`.

### Weighted Heuristic Risk Model

The project also includes a weighted heuristic fallback. This score combines report history, rainfall, water retention, pavement decay, traffic load, repair decay, and seasonality using domain-informed weights.

Why it was included:

- It provides a fallback when the dataset is too small for reliable ML training.
- It makes the system more transparent.
- It prevents the probability surface from depending only on historical complaints.

Strengths:

- Explainable and easy to inspect.
- Works even with limited labeled data.
- Encodes known pothole risk factors.

Weaknesses:

- Weights are manually chosen.
- It may not capture complex relationships.
- It should be validated against real future pothole reports.

Performance in this project:

- Used as a fallback and blended with the trained model.
- Insert final comparison here: `[Insert heuristic-only ROC-AUC here]`.

### Logistic Regression

Logistic regression is a classification model that estimates the probability of a binary outcome using a linear combination of input features.

Why it should be included as a baseline:

- It provides a simple interpretable comparison model.
- Coefficients show whether each feature increases or decreases risk.
- It helps determine whether more complex models are necessary.

Strengths:

- Easy to interpret.
- Fast to train.
- Useful for baseline performance.

Weaknesses:

- Assumes a mostly linear relationship between predictors and log-odds.
- May underperform when feature interactions are important.

When it works well:

- Clean datasets with linear decision boundaries.
- Cases where interpretability is more important than maximum accuracy.

Performance in this project:

- Recommended baseline for the final evaluation table.
- Insert value here: `[Insert logistic regression ROC-AUC here]`.

### Decision Tree Classification

A decision tree splits the data into branches based on feature thresholds. For example, it may split first by pavement condition, then rainfall, then traffic load.

Why it should be included:

- It is easy to explain visually.
- It can capture nonlinear rules.
- It provides a useful comparison against ensemble models.

Strengths:

- Interpretable.
- Handles nonlinear relationships.
- Does not require heavy preprocessing.

Weaknesses:

- Can overfit easily.
- Small changes in data can change the tree structure.
- Usually performs worse than random forests or gradient boosting.

Performance in this project:

- Useful as an interpretable baseline.
- Insert value here: `[Insert decision tree accuracy or ROC-AUC here]`.

### Random Forest Classification

Random forest trains many decision trees and averages their predictions. It reduces the overfitting risk of a single decision tree.

Why it should be included:

- It is strong for tabular data.
- It provides feature importance.
- It is less sensitive to noise than a single tree.

Strengths:

- Good predictive performance.
- Handles nonlinear relationships.
- Provides feature importance.

Weaknesses:

- Less interpretable than one tree.
- Larger models can be slower.
- Probability calibration may need improvement.

Performance in this project:

- Recommended comparison model for pothole probability classification.
- Insert value here: `[Insert random forest ROC-AUC here]`.

### K-Nearest Neighbors Classification

KNN predicts a class based on nearby examples in feature space.

Why it may be included:

- It is simple and intuitive.
- It can capture local patterns if features are well scaled.

Strengths:

- Easy to understand.
- No complex training phase.
- Useful as a simple comparison.

Weaknesses:

- Sensitive to feature scaling.
- Can be slow for large datasets.
- Performs poorly with irrelevant features or high-dimensional data.

Performance in this project:

- Useful mainly as a baseline, not expected to outperform tree ensembles.
- Insert value here: `[Insert KNN accuracy or ROC-AUC here]`.

### XGBoost

XGBoost is an advanced gradient boosting library often used for high-performing tabular machine learning.

Why it may be included:

- It is powerful for structured data.
- It provides regularization and strong model tuning options.
- It often performs well in machine learning competitions and production systems.

Strengths:

- High predictive performance.
- Strong handling of nonlinear relationships.
- Supports feature importance.

Weaknesses:

- Adds an additional dependency.
- Requires tuning.
- Can be harder to explain than simpler models.

Performance in this project:

- Recommended future model for comparison.
- Insert value here: `[Insert XGBoost ROC-AUC here]`.

### Regression Models for Future Extensions

The current pothole risk model is classification-based because it predicts probability. Regression models would be useful if the target changed to pothole count, repair duration, maintenance cost, or severity score.

Linear Regression:

- Predicts a continuous value using a linear relationship.
- Strength: easy to interpret.
- Weakness: may underfit nonlinear infrastructure patterns.

Random Forest Regression:

- Predicts continuous values using many decision trees.
- Strength: captures nonlinear relationships.
- Weakness: less interpretable than linear regression.

Gradient Boosting Regression:

- Builds sequential trees to reduce prediction error.
- Strength: strong predictive performance.
- Weakness: requires tuning and validation.

Decision Tree Regression:

- Splits data into rule-based regions.
- Strength: easy to visualize.
- Weakness: can overfit.

Regression performance placeholders:

- `[Insert best regression model name here]`
- `[Insert R-squared value here]`
- `[Insert RMSE value here]`
- `[Insert MAE value here]`

## 9. Model Selection Criteria

The best model should be selected using both numerical metrics and visual diagnostics. A model should not be chosen only because it has the highest score on one metric. It should also be stable, interpretable, and useful for the application.

### Regression Metrics

R-squared:

R-squared measures how much variance in the target variable is explained by the model. A higher R-squared usually means better fit, but it can be misleading if the model overfits.

Adjusted R-squared:

Adjusted R-squared penalizes unnecessary predictors. It is useful when comparing linear regression models with different numbers of variables.

RMSE:

Root Mean Squared Error measures the average prediction error with stronger penalty for large errors. It is useful when large mistakes are especially costly.

MAE:

Mean Absolute Error measures the average absolute difference between predicted and actual values. It is easier to interpret than RMSE because it stays in the same units as the target variable.

AIC:

Akaike Information Criterion is used mostly for statistical models. It balances model fit and complexity. Lower AIC indicates a better tradeoff.

Residual Analysis:

Residual plots show whether model errors are randomly distributed. Clear patterns in residuals may indicate bias, missing predictors, or model underfitting.

Predicted vs Actual Plot:

This plot compares predicted values against actual values. Predictions close to the diagonal line indicate better model fit.

### Classification Metrics

Accuracy:

Accuracy measures the percentage of correct predictions. It is useful when classes are balanced but can be misleading when one class is much more common than another.

Precision:

Precision measures how many predicted positive cases were actually positive. In this project, high precision means predicted high-risk cells often correspond to actual pothole reports.

Recall:

Recall measures how many actual positive cases the model successfully detected. High recall is important if missing a high-risk area is costly.

F1-score:

F1-score balances precision and recall. It is useful when both false positives and false negatives matter.

ROC Curve:

The ROC curve shows the tradeoff between true positive rate and false positive rate across thresholds.

AUC:

AUC summarizes ROC performance. A value closer to 1.0 indicates stronger classification ability.

Confusion Matrix:

The confusion matrix shows true positives, false positives, true negatives, and false negatives. It helps identify whether the model is producing too many false alarms or missing too many real pothole areas.

Sensitivity:

Sensitivity is another name for recall. It measures how well the model detects positive cases.

Specificity:

Specificity measures how well the model detects negative cases.

Current model selection placeholder:

- Best classification model: `[Insert best model name here]`
- ROC-AUC: `[Insert ROC-AUC value here]`
- Accuracy: `[Insert accuracy value here]`
- Precision: `[Insert precision value here]`
- Recall: `[Insert recall value here]`
- F1-score: `[Insert F1-score here]`

## 10. Visualizations and Graphs

The application emphasizes visual explanation because machine learning results are easier to understand when users can see both predictions and evidence.

### Probability Gradient Map

The predicted hotspot layer displays grid cells colored from low to high probability. Green or yellow cells represent lower or medium risk, while orange or red cells represent higher risk. The opacity is kept low enough so the street map remains visible underneath.

### Live Reported Pothole Markers

Live potholes are shown as warning markers. This allows users to distinguish confirmed reports from model-predicted risk areas.

### Actual vs Predicted Values Plot

This graph should compare actual pothole labels or counts against model predictions. It helps users see whether predictions align with observed outcomes.

### Residual Plot

For regression extensions, a residual plot should show the difference between actual and predicted values. Randomly scattered residuals suggest a better model.

### Feature Importance Plot

Feature importance shows which variables contributed most to prediction quality. For this project, expected important variables include prior pothole count, rainfall, water retention, pavement condition, and traffic load.

### Model Comparison Chart

A model comparison chart should display candidate models and their evaluation scores. For classification, this could compare ROC-AUC, F1-score, precision, and recall. For regression, it could compare R-squared, RMSE, and MAE.

### R-squared Comparison Chart

For regression models, this chart shows which model explains the most variance in the target variable.

### RMSE Comparison Chart

This chart compares average prediction error across regression models. Lower RMSE indicates better performance.

### ROC Curve

The ROC curve is useful for classification because it shows how model sensitivity changes as the decision threshold changes.

### Confusion Matrix Heatmap

The confusion matrix heatmap helps users understand false positives and false negatives. In this project, false positives are cells predicted as risky where no pothole was reported, while false negatives are cells where potholes occurred but the model did not flag high risk.

### Target Distribution

The target distribution chart shows whether the dataset is balanced. For pothole risk, positive cases may be much less common than negative cells, so imbalance should be considered.

### Correlation Plot

A correlation plot helps identify relationships between numeric variables, such as rainfall and flood complaints or pavement age and pothole frequency.

### Live Data vs Predictive Data Chart

This chart should compare actual live pothole reports with predicted hotspot cells. It can show whether new live reports fall inside or near high-risk predicted regions.

### Coefficient Plot

For logistic regression or linear regression, a coefficient plot shows the direction and magnitude of each variable's effect.

### Prediction Error Visualization

Prediction error maps or charts show where the model performs well and where it performs poorly. This is useful for improving future data collection and model retraining.

## 11. Live Data vs Predictive Data Comparison

One of the most important parts of this project is the comparison between live reported potholes and predicted pothole hotspots.

The dashboard should show:

- Original live reported pothole locations.
- Predicted probability score for each nearby grid cell.
- Difference between actual report occurrence and predicted probability.
- Error percentage where a numeric target is available.
- Visual overlap between live reports and predicted high-risk cells.
- Model reliability based on whether reports appear inside predicted hotspots.

This comparison helps answer a practical question: is the model predicting areas where potholes are actually being reported?

Example comparison table:

| Location or Cell ID | Actual Reported | Predicted Probability | Difference | Error % |
|---|---:|---:|---:|---:|
| `[Insert cell ID]` | `[0 or 1]` | `[Insert probability]` | `[Insert difference]` | `[Insert error %]` |
| `[Insert cell ID]` | `[0 or 1]` | `[Insert probability]` | `[Insert difference]` | `[Insert error %]` |

If many live reports occur inside high-probability cells, the model is likely useful. If many reports occur in low-probability cells, the model may need more data, better predictors, or updated training.

## 12. Coefficients and Model Interpretability

Model interpretability is important because users should understand why the model identified an area as high risk.

### Coefficient-Based Models

For models such as linear regression and logistic regression, coefficients explain the direction and strength of each predictor.

A positive coefficient means the variable increases the predicted value or probability. For example, a positive coefficient for rainfall would suggest that more rainfall increases pothole risk.

A negative coefficient means the variable decreases the predicted value or probability. For example, a negative coefficient for pavement condition index would make sense because better pavement condition should reduce pothole risk.

Coefficient placeholders:

- Strong positive coefficient: `[Insert variable name here]`
- Strong negative coefficient: `[Insert variable name here]`
- Most influential coefficient: `[Insert variable name here]`

### Feature Importance for Tree-Based Models

The current implemented model is tree-based, so it does not provide simple coefficients. Instead, the project uses feature importance and risk explanation fields.

Feature importance helps identify which predictors improved model performance. The GeoJSON output can include feature importance metadata and per-cell risk explanations. For example, one high-risk cell may be explained by:

- Nearby historical pothole reports.
- Recent and seasonal rainfall.
- Standing-water and drainage risk.
- Pavement condition and resurfacing age.

This makes the prediction more useful because the app does not only say "high risk"; it can also explain why the area was considered risky.

## 13. Results

The project successfully produced a functioning full-stack application with live pothole markers, predicted probability hotspots, and mobile navigation warnings. The machine learning pipeline generated a risk grid from historical pothole data and environmental predictors, and the prediction service served those probabilities to the frontend.

Final metric placeholders:

- Best model: `[Insert best model name here]`
- R-squared: `[Insert R-squared value here]`
- Adjusted R-squared: `[Insert adjusted R-squared value here]`
- RMSE: `[Insert RMSE value here]`
- MAE: `[Insert MAE value here]`
- AIC: `[Insert AIC value here]`
- ROC-AUC: `[Insert ROC-AUC value here]`
- Accuracy: `[Insert accuracy value here]`
- Precision: `[Insert precision value here]`
- Recall: `[Insert recall value here]`
- F1-score: `[Insert F1-score here]`

Expected interpretation:

The best model should be selected based on its ability to identify high-risk pothole areas while avoiding excessive false positives. If the final ROC-AUC is high, the model separates high-risk and low-risk cells effectively. If recall is high, the model detects most true pothole-prone cells. If precision is high, most predicted hotspots are meaningful.

Overfitting should be checked by comparing training and test performance. If training performance is much higher than test performance, the model may be overfitting. If both training and test performance are low, the model may be underfitting or missing important predictors.

Insights found from the data:

- Pothole risk is not explained only by historical reports.
- Rainfall and water retention are important because standing water weakens pavement and loosens aggregate material.
- Pavement condition and resurfacing age help explain infrastructure decay.
- Traffic and truck exposure increase road stress.
- Live reports are useful for current conditions, while the predictive model provides a forward-looking risk layer.

## 14. Challenges Faced

Several challenges appeared during development.

Making the ML engine dynamic:

The project needed to avoid being locked to one exact CSV schema. Different cities may use different column names for service type, request date, status, latitude, and longitude.

Handling different column names:

The engine had to detect common column names and normalize them before training.

Handling missing values:

Some environmental features may be missing or unavailable for certain locations. The model needed fallback values and distance-weighted interpolation.

Handling categorical variables:

Status and service type fields were text-based and needed normalization.

Choosing the correct target variable:

For pothole risk, the target was not directly provided as a single column. It had to be constructed from spatial grid cells and historical pothole reports.

Supporting both live and predictive data:

The app needed to show live pothole reports and AI-predicted hotspots without confusing the two.

Avoiding hardcoded logic:

The project originally focused on San Jose, but later expanded to Bay Area data. This required replacing city-specific assumptions with more flexible bounds, datasets, and labels.

Fixing UI layout problems:

The mobile app went through multiple layout iterations, including map visibility, tab spacing, 3D navigation layout, and marker placement.

Graph and overlay readability:

Large prediction overlays initially made the map difficult to read. The opacity, filtering, and cell limits had to be adjusted.

Performance issues:

Rendering too many prediction cells caused map panning to lag. The system needed bounding box filtering, spatial indexing, and native viewport limits.

Model interpretation:

Raw probability values alone were not enough. The app needed risk bands, feature explanations, and metadata.

Dependency and build issues:

Expo, Google Maps configuration, native builds, and EAS environment variables required careful setup.

Making results understandable:

The application needed to communicate risk to non-technical users, not only display model outputs.

## 15. Failures Faced

Early versions of the project did not work perfectly. These failures were important because they guided later improvements.

Early versions were too dataset-specific:

The app initially focused mainly on San Jose data. This made the system less useful for broader Bay Area analysis.

The first map view did not look like a real map:

When the Google Maps key was not fully configured, the app displayed simplified map shapes or blank native tiles. This made the interface confusing.

Prediction tiles appeared in the bay water:

The early prediction grid covered the full bounding box, including water. This was incorrect because potholes cannot occur inside the bay basin.

The predicted overlay was too heavy:

Rendering too many cells caused lag while panning and zooming.

The 3D navigation tab had layout problems:

The arrow did not align with the road surface, and part of the screen appeared blank or incomplete.

Some model outputs were hard to interpret:

Probability scores alone did not explain the reason behind a prediction.

Some dashboard sections had too much empty space:

The UI needed tighter spacing and better component placement.

Some model outputs lacked complete evaluation:

The training pipeline generated probabilities, but final academic metrics such as ROC-AUC, confusion matrix, and train-test comparison still need to be inserted from a formal experiment run.

## 16. Fixes and Improvements

The project improved through multiple iterations.

Dataset expansion:

The data was expanded from San Jose-only examples to Bay Area sample datasets.

Flexible column detection:

The training script now detects common names for coordinates, dates, status, and service type.

Environmental predictors:

Rainfall, drainage, pavement, water retention, traffic, and road class features were added to make the model more realistic.

Water exclusion mask:

Approximate bay and ocean water polygons were added so prediction cells are not generated in the bay basin.

Road/land prediction mask:

Cells too far from road or environmental samples are excluded to reduce unrealistic predictions.

Performance optimization:

The prediction service uses bounding box filtering and spatial indexing. The native app limits visible prediction cells and pauses heavy overlays while panning.

Better visualization:

The app includes separate tabs for live reports, predicted hotspots, and 3D navigation.

Feature importance and risk explanations:

The GeoJSON output includes model metadata, feature descriptions, and risk explanation fields.

Improved mobile builds:

The project supports Android APK builds through EAS, including a separate sandbox package for 3D testing.

Improved user warnings:

The app can show a temporary caution message when a driver enters a high-risk pothole area.

Improved dashboard language:

The UI avoids unnecessary paid-version language and focuses on understandable risk communication.

## 17. Dashboard Design

The dashboard was designed to be clean, readable, and practical. Since the main user experience is map-based, the design avoids unnecessary clutter and focuses on the user's immediate decision: where are potholes reported, and where is risk predicted?

The main dashboard elements include:

- Search bar for Bay Area cities and neighborhoods.
- View mode switch for Live, Predicted, and 3D Nav.
- Status filters for reported and fixed potholes.
- Map markers for live reports.
- Probability overlay for predicted hotspots.
- Floating report button.
- Recenter/location button.
- Temporary high-risk driving alert.

The visual design uses clear spacing, readable labels, and distinct colors. Orange warning markers represent reported potholes. Prediction cells use a green-yellow-red style ramp so users can quickly identify higher-risk areas. The opacity is intentionally reduced so streets remain visible.

## 18. Strengths of the Project

The project has several strengths:

- It combines machine learning with a real-world civic infrastructure problem.
- It separates live reported potholes from AI-predicted hotspots.
- It uses a reusable ML pipeline rather than a single static visualization.
- It integrates historical reports with rainfall, drainage, pavement, and traffic predictors.
- It outputs GeoJSON, which is appropriate for mapping applications.
- It includes a prediction microservice instead of putting all logic in the frontend.
- It uses spatial indexing for better performance.
- It provides feature descriptions and risk explanations.
- It supports mobile APK builds.
- It includes a sandbox mode for navigation-style testing.
- It is understandable for non-technical users because the output is visual and map-based.

## 19. Limitations

The project also has realistic limitations:

- The sample datasets are small and should be replaced with larger production datasets.
- The model may not work perfectly for every Bay Area city without local data.
- Very messy datasets may still require manual cleaning.
- Automatic target construction may not always match the best modeling approach.
- Some environmental features are currently sample or proxy values.
- The water exclusion mask is approximate and should eventually use authoritative land/water GIS boundaries.
- The model needs formal train-test evaluation metrics before final academic submission.
- Small datasets may cause unstable model performance.
- More advanced hyperparameter tuning could improve accuracy.
- More explainability tools could be added.
- Live user reports should be persisted to a real database such as Firestore before production use.
- Free hosted services may sleep when idle, which can delay API responses.

## 20. Future Improvements

Future improvements could include:

- Add a full dataset upload dashboard.
- Allow users to select the target variable manually.
- Add automatic classification vs regression detection.
- Train and compare logistic regression, random forest, decision tree, KNN, XGBoost, and gradient boosting models.
- Add advanced hyperparameter tuning with grid search or randomized search.
- Add SHAP values for stronger model explainability.
- Add downloadable PDF or HTML reports.
- Add automated data cleaning recommendations.
- Add better support for time-series forecasting.
- Add database connections for live production data.
- Add user authentication.
- Deploy the frontend and backend to cloud infrastructure.
- Add model saving and loading.
- Add formal confusion matrix, ROC curve, and feature importance dashboard views.
- Add continuous retraining from updated 311, rainfall, pavement, and traffic data.
- Add authoritative GIS road centerline and land-water masking.
- Add a route-based warning system that evaluates risk along the driver's upcoming route.

## 21. Conclusion

This project demonstrates how machine learning can be combined with an interactive web and mobile dashboard to create a practical civic analytics tool. Instead of only displaying historical pothole reports, the system builds a predictive probability surface using historical pothole frequency, seasonality, infrastructure decay, rainfall, drainage, pavement condition, and traffic exposure.

The project went through multiple iterations. Early versions had map rendering issues, San Jose-only data, unrealistic water predictions, heavy overlays, and limited interpretability. These issues were addressed by expanding the dataset, adding environmental predictors, excluding water cells, improving map performance, separating actual and sandbox app builds, and adding explanatory model metadata.

Overall, the project helped strengthen understanding of real-world machine learning pipelines, spatial feature engineering, model evaluation, dashboard design, mobile development, backend API design, and deployment challenges. It also shows that useful machine learning applications require more than a model. They require clean data, thoughtful features, interpretable outputs, reliable APIs, usable interfaces, and repeated testing.

## 22. Appendix

### A. Important Project Files

| File | Purpose |
|---|---|
| `ml/train_pothole_risk_model.py` | Python training script that builds the pothole probability risk grid. |
| `data/sample_bay_area_311_potholes.csv` | Sample Bay Area historical pothole data. |
| `data/sample_bay_area_environmental_features.csv` | Sample environmental, pavement, drainage, and traffic predictors. |
| `predictive-service/src/server.js` | Node.js Express prediction service. |
| `deployment/huggingface-space/app.py` | FastAPI prediction service for hosted deployment. |
| `src/components/MapComponent.native.js` | Native map rendering, live markers, and prediction overlays. |
| `src/components/SandboxNavigationScene.js` | Sandbox 3D navigation simulation. |
| `src/services/predictiveMapApi.js` | Frontend API client for the prediction service. |
| `README.md` | Setup, training, serving, and deployment instructions. |

### B. Placeholder for Screenshots

Add screenshots here:

- `[Insert screenshot of Live Reported tab]`
- `[Insert screenshot of AI Predicted Hotspots tab]`
- `[Insert screenshot of 3D Nav tab]`
- `[Insert screenshot of high-risk warning banner]`
- `[Insert screenshot of model metadata or API output]`

### C. Placeholder for Model Performance Table

| Model | Task Type | Accuracy | Precision | Recall | F1 | ROC-AUC | RMSE | MAE | R-squared |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Logistic Regression | Classification | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | N/A | N/A | N/A |
| Decision Tree | Classification | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | N/A | N/A | N/A |
| Random Forest | Classification | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | N/A | N/A | N/A |
| Hist Gradient Boosting | Classification | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | N/A | N/A | N/A |
| Weighted Heuristic | Classification | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | N/A | N/A | N/A |

### D. Placeholder for GitHub Link

GitHub repository:

`[Insert GitHub repository URL here]`

### E. Dataset Information

Recommended production data sources:

- San Jose 311 live and historical service requests.
- San Francisco 311 pothole cases.
- Oakland OAK311 service requests.
- NOAA rainfall data.
- MTC Pavement Condition Index.
- USGS 3DEP elevation-derived slope and flow accumulation.
- City storm drain and catch basin GIS layers.
- Flooding and drainage 311 complaints.
- USGS/NLCD impervious surface data.
- USDA SSURGO soil drainage attributes.
- Caltrans AADT and local traffic counts.
- OpenStreetMap road class data.
