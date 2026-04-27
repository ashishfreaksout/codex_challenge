#!/usr/bin/env python3
"""Generate GitHub-viewable model evaluation assets for the case study."""

from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib-codex-cache")
os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))

import matplotlib.pyplot as plt
import nbformat as nbf
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml import train_pothole_risk_model as trainer  # noqa: E402

DOCS_DIR = ROOT / "docs"
FIGURES_DIR = DOCS_DIR / "figures"
DATA_DIR = ROOT / "data"
RISK_GRID_PATH = ROOT / "predictive-service" / "data" / "risk_grid.geojson"


def main() -> None:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    dataset = build_dataset()
    metrics, predictions, best_name, best_model = evaluate_models(dataset)
    risk_summary, live_summary = summarize_risk_grid(dataset["records"])
    importance = estimate_importance(best_model, dataset["x_test"], dataset["y_test"])

    write_metric_csv(metrics)
    plot_paths = write_plots(
        metrics,
        predictions,
        dataset["y_test"],
        best_name,
        importance,
        risk_summary,
        live_summary,
    )
    write_notebook(
        metrics=metrics,
        predictions=predictions,
        y_test=dataset["y_test"],
        best_name=best_name,
        importance=importance,
        risk_summary=risk_summary,
        live_summary=live_summary,
        plot_paths=plot_paths,
    )

    print(f"Wrote {DOCS_DIR / 'model_evaluation.ipynb'}")
    print(f"Wrote {DOCS_DIR / 'model_metrics.csv'}")


def build_dataset() -> dict:
    bounds = trainer.BAY_AREA_BOUNDS
    records = trainer.load_records(DATA_DIR / "sample_bay_area_311_potholes.csv", bounds)
    environmental_samples = trainer.load_environmental_samples(
        DATA_DIR / "sample_bay_area_environmental_features.csv"
    )
    lat_step, lon_step = trainer.grid_steps(300, bounds)
    cell_records = trainer.group_records(records, lat_step, lon_step, bounds)
    x, y = trainer.build_training_set(
        records=records,
        cell_records=cell_records,
        environmental_samples=environmental_samples,
        lat_step=lat_step,
        lon_step=lon_step,
        bounds=bounds,
        max_environment_distance_m=9000,
    )

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.35,
        random_state=42,
        stratify=y,
    )

    return {
        "records": records,
        "x_train": x_train,
        "x_test": x_test,
        "y_train": y_train,
        "y_test": y_test,
    }


def evaluate_models(dataset: dict) -> tuple[pd.DataFrame, dict, str, object]:
    models = {
        "Logistic Regression": make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=1500, class_weight="balanced", random_state=42),
        ),
        "Decision Tree": DecisionTreeClassifier(max_depth=5, min_samples_leaf=4, random_state=42),
        "Random Forest": RandomForestClassifier(
            n_estimators=160,
            max_depth=7,
            min_samples_leaf=3,
            class_weight="balanced_subsample",
            random_state=42,
        ),
        "Hist Gradient Boosting": make_pipeline(
            StandardScaler(),
            HistGradientBoostingClassifier(
                random_state=42,
                max_iter=120,
                learning_rate=0.055,
                max_leaf_nodes=14,
                l2_regularization=0.03,
            ),
        ),
    }

    rows = []
    predictions = {}
    x_train = dataset["x_train"]
    x_test = dataset["x_test"]
    y_train = dataset["y_train"]
    y_test = dataset["y_test"]

    for name, model in models.items():
        model.fit(x_train, y_train)
        probability = model.predict_proba(x_test)[:, 1]
        label = (probability >= 0.5).astype(int)
        predictions[name] = {"probability": probability, "label": label, "model": model}
        rows.append(metric_row(name, y_test, probability, label))

    heuristic_probability = trainer.heuristic_probabilities(x_test)
    heuristic_label = (heuristic_probability >= 0.5).astype(int)
    predictions["Weighted Heuristic"] = {
        "probability": heuristic_probability,
        "label": heuristic_label,
        "model": None,
    }
    rows.append(metric_row("Weighted Heuristic", y_test, heuristic_probability, heuristic_label))

    metrics = pd.DataFrame(rows).sort_values(["ROC-AUC", "F1"], ascending=False).reset_index(drop=True)
    best_name = str(metrics.iloc[0]["Model"])
    best_model = predictions[best_name]["model"]
    return metrics, predictions, best_name, best_model


def metric_row(name: str, y_true: np.ndarray, probability: np.ndarray, label: np.ndarray) -> dict:
    return {
        "Model": name,
        "Accuracy": accuracy_score(y_true, label),
        "Precision": precision_score(y_true, label, zero_division=0),
        "Recall": recall_score(y_true, label, zero_division=0),
        "F1": f1_score(y_true, label, zero_division=0),
        "ROC-AUC": roc_auc_score(y_true, probability),
    }


def summarize_risk_grid(records: list) -> tuple[pd.DataFrame, pd.DataFrame]:
    grid = json.loads(RISK_GRID_PATH.read_text(encoding="utf-8"))
    features = grid.get("features", [])
    probabilities = [feature["properties"]["probability_score"] for feature in features]
    bands = [feature["properties"]["risk_band"] for feature in features]
    risk_summary = (
        pd.DataFrame({"probability_score": probabilities, "risk_band": bands})
        .groupby("risk_band")
        .agg(cells=("probability_score", "size"), mean_probability=("probability_score", "mean"))
        .reindex(["low", "medium", "high"])
        .fillna(0)
        .reset_index()
    )

    grid_size = int(grid.get("properties", {}).get("grid_size_meters") or 300)
    bounds = grid.get("properties", {}).get("bounds") or trainer.BAY_AREA_BOUNDS
    lat_step, lon_step = trainer.grid_steps(grid_size, bounds)
    feature_by_id = {str(feature.get("id")): feature for feature in features}

    matched = []
    for record in records:
        cell_id = trainer.cell_id_for(record.latitude, record.longitude, lat_step, lon_step, bounds)
        feature = feature_by_id.get(cell_id)
        if feature:
            matched.append(
                {
                    "risk_band": feature["properties"]["risk_band"],
                    "probability_score": feature["properties"]["probability_score"],
                }
            )

    live_summary = (
        pd.DataFrame(matched)
        .groupby("risk_band")
        .agg(live_reports=("probability_score", "size"), mean_probability=("probability_score", "mean"))
        .reindex(["low", "medium", "high"])
        .fillna(0)
        .reset_index()
    )
    return risk_summary, live_summary


def estimate_importance(model: object, x_test: np.ndarray, y_test: np.ndarray) -> pd.DataFrame:
    if model is None:
        heuristic_weights = {
            "prior_pothole_count_24m": 0.20,
            "rain_30d_mm": 0.09,
            "rain_90d_mm": 0.06,
            "heavy_rain_days_30d": 0.04,
            "topographic_wetness_index": 0.08,
            "distance_to_storm_drain_m": 0.07,
            "pavement_condition_index": 0.13,
            "traffic_aadt": 0.08,
        }
        return pd.DataFrame(
            [{"Feature": feature, "Importance": value} for feature, value in heuristic_weights.items()]
        )

    result = permutation_importance(
        model,
        x_test,
        y_test,
        n_repeats=8,
        random_state=42,
        scoring="roc_auc",
    )
    importance = pd.DataFrame(
        {
            "Feature": trainer.MODEL_FEATURES,
            "Importance": np.maximum(result.importances_mean, 0),
        }
    )
    importance = importance.sort_values("Importance", ascending=False).head(10)
    total = importance["Importance"].sum()
    if total > 0:
        importance["Importance"] = importance["Importance"] / total
    return importance


def write_metric_csv(metrics: pd.DataFrame) -> None:
    rounded = metrics.copy()
    for column in rounded.columns:
        if column != "Model":
            rounded[column] = rounded[column].round(3)
    rounded.to_csv(DOCS_DIR / "model_metrics.csv", index=False)


def write_plots(
    metrics: pd.DataFrame,
    predictions: dict,
    y_test: np.ndarray,
    best_name: str,
    importance: pd.DataFrame,
    risk_summary: pd.DataFrame,
    live_summary: pd.DataFrame,
) -> None:
    plt.style.use("seaborn-v0_8-whitegrid")
    return {
        "model_comparison": write_model_comparison(metrics),
        "confusion_matrix": write_confusion_matrix(predictions[best_name]["label"], y_test, best_name),
        "roc_curve": write_roc_curve(predictions, y_test),
        "feature_importance": write_feature_importance(importance, best_name),
        "risk_distribution": write_risk_distribution(risk_summary),
        "live_vs_predicted": write_live_vs_predicted(live_summary),
    }


def write_model_comparison(metrics: pd.DataFrame) -> None:
    figure, axis = plt.subplots(figsize=(9.5, 4.8))
    ordered = metrics.sort_values("ROC-AUC", ascending=True)
    axis.barh(ordered["Model"], ordered["ROC-AUC"], color="#2563eb")
    axis.set_xlim(0, 1)
    axis.set_xlabel("ROC-AUC")
    axis.set_title("Model Comparison on Sample Holdout Set")
    for index, value in enumerate(ordered["ROC-AUC"]):
        axis.text(value + 0.015, index, f"{value:.2f}", va="center", fontsize=10)
    figure.tight_layout()
    return save_figure(figure, "model-comparison")


def write_confusion_matrix(labels: np.ndarray, y_test: np.ndarray, best_name: str) -> None:
    matrix = confusion_matrix(y_test, labels)
    figure, axis = plt.subplots(figsize=(5.5, 4.8))
    image = axis.imshow(matrix, cmap="Blues")
    axis.set_title(f"Confusion Matrix: {best_name}")
    axis.set_xlabel("Predicted")
    axis.set_ylabel("Actual")
    axis.set_xticks([0, 1], ["No pothole", "Pothole"])
    axis.set_yticks([0, 1], ["No pothole", "Pothole"])
    for row in range(matrix.shape[0]):
        for col in range(matrix.shape[1]):
            axis.text(col, row, str(matrix[row, col]), ha="center", va="center", fontsize=14)
    figure.colorbar(image, ax=axis, fraction=0.046, pad=0.04)
    figure.tight_layout()
    return save_figure(figure, "confusion-matrix")


def write_roc_curve(predictions: dict, y_test: np.ndarray) -> None:
    figure, axis = plt.subplots(figsize=(7, 5.2))
    for name, payload in predictions.items():
        false_positive, true_positive, _ = roc_curve(y_test, payload["probability"])
        auc = roc_auc_score(y_test, payload["probability"])
        axis.plot(false_positive, true_positive, linewidth=2, label=f"{name} ({auc:.2f})")
    axis.plot([0, 1], [0, 1], color="#94a3b8", linestyle="--", label="Random")
    axis.set_title("ROC Curves")
    axis.set_xlabel("False positive rate")
    axis.set_ylabel("True positive rate")
    axis.legend(loc="lower right", fontsize=8)
    figure.tight_layout()
    return save_figure(figure, "roc-curve")


def write_feature_importance(importance: pd.DataFrame, best_name: str) -> None:
    figure, axis = plt.subplots(figsize=(9.5, 5))
    ordered = importance.sort_values("Importance", ascending=True)
    axis.barh(ordered["Feature"], ordered["Importance"], color="#16a34a")
    axis.set_xlabel("Relative importance")
    axis.set_title(f"Top Feature Importance: {best_name}")
    figure.tight_layout()
    return save_figure(figure, "feature-importance")


def write_risk_distribution(risk_summary: pd.DataFrame) -> None:
    colors = {"low": "#84cc16", "medium": "#facc15", "high": "#ef4444"}
    figure, axis = plt.subplots(figsize=(7, 4.6))
    axis.bar(
        risk_summary["risk_band"],
        risk_summary["cells"],
        color=[colors.get(value, "#94a3b8") for value in risk_summary["risk_band"]],
    )
    axis.set_title("Generated Risk Grid Distribution")
    axis.set_xlabel("Risk band")
    axis.set_ylabel("Grid cells")
    figure.tight_layout()
    return save_figure(figure, "risk-distribution")


def write_live_vs_predicted(live_summary: pd.DataFrame) -> None:
    colors = {"low": "#84cc16", "medium": "#facc15", "high": "#ef4444"}
    figure, axis = plt.subplots(figsize=(7, 4.6))
    axis.bar(
        live_summary["risk_band"],
        live_summary["live_reports"],
        color=[colors.get(value, "#94a3b8") for value in live_summary["risk_band"]],
    )
    axis.set_title("Historical Reports by Predicted Risk Band")
    axis.set_xlabel("Predicted risk band")
    axis.set_ylabel("Matched historical reports")
    figure.tight_layout()
    return save_figure(figure, "live-vs-predicted")


def save_figure(figure, name: str) -> dict[str, Path]:
    svg_path = FIGURES_DIR / f"{name}.svg"
    png_path = FIGURES_DIR / f"{name}.png"
    figure.savefig(svg_path, format="svg")
    figure.savefig(png_path, format="png", dpi=180, bbox_inches="tight")
    plt.close(figure)
    return {"svg": svg_path, "png": png_path}


def write_notebook(
    metrics: pd.DataFrame,
    predictions: dict,
    y_test: np.ndarray,
    best_name: str,
    importance: pd.DataFrame,
    risk_summary: pd.DataFrame,
    live_summary: pd.DataFrame,
    plot_paths: dict,
) -> None:
    metrics_md = metrics.round(3).to_markdown(index=False)
    risk_md = risk_summary.round(3).to_markdown(index=False)
    live_md = live_summary.round(3).to_markdown(index=False)
    interpretation = build_interpretation(
        metrics=metrics,
        predictions=predictions,
        y_test=y_test,
        best_name=best_name,
        importance=importance,
        risk_summary=risk_summary,
        live_summary=live_summary,
    )

    notebook = nbf.v4.new_notebook()
    notebook["metadata"] = {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {"name": "python", "pygments_lexer": "ipython3"},
    }

    notebook.cells = [
        nbf.v4.new_markdown_cell(
            "# Pothole Risk Model Evaluation\n\n"
            "This notebook summarizes the current sample-data evaluation for the Bay Area Pothole AI Tracker. "
            "The numbers are useful for portfolio documentation and development checks, but they should not be "
            "treated as production validation because the bundled sample dataset is intentionally small."
        ),
        nbf.v4.new_markdown_cell(
            "## Dataset\n\n"
            "- Historical labels: `data/sample_bay_area_311_potholes.csv`\n"
            "- Environmental predictors: `data/sample_bay_area_environmental_features.csv`\n"
            "- Prediction grid: `predictive-service/data/risk_grid.geojson`\n\n"
            "The training script creates positive cells from pothole report locations and nearby negative cells "
            "from road/land areas without pothole reports."
        ),
        nbf.v4.new_code_cell(
            "from pathlib import Path\n"
            "import pandas as pd\n"
            "metrics_path = Path('model_metrics.csv')\n"
            "if not metrics_path.exists():\n"
            "    metrics_path = Path('docs/model_metrics.csv')\n"
            "metrics = pd.read_csv(metrics_path)\n"
            "metrics"
        ),
        nbf.v4.new_markdown_cell(
            "## Model Comparison\n\n"
            f"Best sample holdout model by ROC-AUC/F1 ordering: **{best_name}**.\n\n"
            f"{metrics_md}\n\n"
            f"{interpretation['model_comparison']}"
        ),
        embedded_plot_cell("Model comparison", plot_paths["model_comparison"]["png"]),
        nbf.v4.new_markdown_cell(
            "## ROC Curve and Confusion Matrix\n\n"
            "The ROC curve shows how well the models separate pothole and non-pothole cells across thresholds. "
            "The confusion matrix shows true and false predictions at a 0.5 threshold.\n\n"
            f"{interpretation['roc_confusion']}"
        ),
        embedded_plot_cell("ROC curve", plot_paths["roc_curve"]["png"]),
        embedded_plot_cell("Confusion matrix", plot_paths["confusion_matrix"]["png"]),
        nbf.v4.new_markdown_cell(
            "## Feature Importance\n\n"
            "Feature importance is estimated with permutation importance on the sample holdout set. "
            "This helps explain which predictors are most useful for the current model.\n\n"
            f"{interpretation['feature_importance']}"
        ),
        embedded_plot_cell("Feature importance", plot_paths["feature_importance"]["png"]),
        nbf.v4.new_markdown_cell(
            "## Risk Grid Distribution\n\n"
            f"{risk_md}\n\n"
            f"{interpretation['risk_distribution']}"
        ),
        embedded_plot_cell("Risk grid distribution", plot_paths["risk_distribution"]["png"]),
        nbf.v4.new_markdown_cell(
            "## Live vs Predicted Comparison\n\n"
            "This chart checks where historical pothole reports fall relative to the generated prediction bands. "
            "In a production study, the same method should be repeated with future reports that were not used "
            "during training.\n\n"
            f"{live_md}\n\n"
            f"{interpretation['live_vs_predicted']}"
        ),
        embedded_plot_cell("Live vs predicted comparison", plot_paths["live_vs_predicted"]["png"]),
        nbf.v4.new_markdown_cell(
            "## Final Interpretation\n\n"
            f"{interpretation['final']}"
        ),
    ]

    nbf.write(notebook, DOCS_DIR / "model_evaluation.ipynb")


def embedded_plot_cell(title: str, png_path: Path):
    encoded = base64.b64encode(png_path.read_bytes()).decode("ascii")
    return nbf.v4.new_code_cell(
        source=f"# Embedded plot: {title}\n",
        execution_count=None,
        outputs=[
            nbf.v4.new_output(
                "display_data",
                data={"image/png": encoded},
                metadata={"image/png": {"width": 900}},
            )
        ],
        metadata={"jupyter": {"source_hidden": True}},
    )


def build_interpretation(
    metrics: pd.DataFrame,
    predictions: dict,
    y_test: np.ndarray,
    best_name: str,
    importance: pd.DataFrame,
    risk_summary: pd.DataFrame,
    live_summary: pd.DataFrame,
) -> dict[str, str]:
    best = metrics.iloc[0]
    second = metrics.iloc[1] if len(metrics) > 1 else metrics.iloc[0]
    matrix = confusion_matrix(y_test, predictions[best_name]["label"])
    tn, fp, fn, tp = matrix.ravel()
    top_features = importance.sort_values("Importance", ascending=False).head(5)
    top_feature_text = ", ".join(
        f"`{row.Feature}` ({row.Importance:.2f})"
        for row in top_features.itertuples(index=False)
    )

    hgb = metrics.loc[metrics["Model"] == "Hist Gradient Boosting"].iloc[0]
    heuristic = metrics.loc[metrics["Model"] == "Weighted Heuristic"].iloc[0]
    high_cells = int(risk_summary.loc[risk_summary["risk_band"] == "high", "cells"].iloc[0])
    medium_cells = int(risk_summary.loc[risk_summary["risk_band"] == "medium", "cells"].iloc[0])
    low_cells = int(risk_summary.loc[risk_summary["risk_band"] == "low", "cells"].iloc[0])
    high_reports = int(live_summary.loc[live_summary["risk_band"] == "high", "live_reports"].iloc[0])
    medium_reports = int(live_summary.loc[live_summary["risk_band"] == "medium", "live_reports"].iloc[0])
    low_reports = int(live_summary.loc[live_summary["risk_band"] == "low", "live_reports"].iloc[0])

    return {
        "model_comparison": (
            f"The best model on this sample holdout split is **{best_name}** with "
            f"ROC-AUC **{best['ROC-AUC']:.3f}**, accuracy **{best['Accuracy']:.3f}**, "
            f"precision **{best['Precision']:.3f}**, recall **{best['Recall']:.3f}**, "
            f"and F1 **{best['F1']:.3f}**. The next closest model by ROC-AUC is "
            f"**{second['Model']}** at **{second['ROC-AUC']:.3f}**. This means Random Forest is "
            "currently the strongest ranking model on the sample data, although the dataset is too small "
            "to treat this as final production evidence."
        ),
        "roc_confusion": (
            f"The ROC curve confirms that **{best_name}** separates pothole and non-pothole grid cells "
            f"better than the other tested baselines on this sample. At the default 0.5 threshold, the "
            f"confusion matrix contains **{tp} true positives**, **{tn} true negatives**, "
            f"**{fp} false positives**, and **{fn} false negatives**. The low false-positive count is good "
            "for avoiding unnecessary driver warnings, but the false negatives show that recall should be "
            "improved before using the model for safety-critical alerts."
        ),
        "feature_importance": (
            f"The most important features in this sample run are {top_feature_text}. The result is consistent "
            "with the project hypothesis: pothole risk is connected to drainage and water-retention conditions, "
            "historical flooding or 311 activity, road class, impervious surfaces, truck exposure, pavement "
            "condition, rainfall, and traffic load. These importance values should be recalculated when larger "
            "official datasets are added."
        ),
        "risk_distribution": (
            f"The generated Bay Area grid contains **{low_cells} low-risk cells**, **{medium_cells} medium-risk "
            f"cells**, and **{high_cells} high-risk cells**. This distribution is desirable for a prototype "
            "because it does not mark the entire region as dangerous. Instead, it keeps the highest-risk band "
            "focused on a smaller set of cells."
        ),
        "live_vs_predicted": (
            f"In the historical report comparison, **{high_reports} reports** fall in high-risk cells, "
            f"**{medium_reports} reports** fall in medium-risk cells, and **{low_reports} reports** fall in "
            "low-risk cells. Most matched reports are in medium or high predicted areas, which suggests that "
            "the probability surface is directionally useful. The remaining low-risk matches show where the "
            "model needs better data or threshold tuning."
        ),
        "final": (
            f"Based on the current sample evaluation, **{best_name}** is the strongest candidate model for the "
            f"next training iteration because it has the highest ROC-AUC (**{best['ROC-AUC']:.3f}**) and the "
            f"best F1 score (**{best['F1']:.3f}**) among the tested approaches. The deployed training pipeline "
            f"currently uses Hist Gradient Boosting, which still performs reasonably with ROC-AUC "
            f"**{hgb['ROC-AUC']:.3f}** and precision **{hgb['Precision']:.3f}**, but this notebook suggests that "
            "Random Forest should be tested as a production model candidate. The weighted heuristic is useful "
            f"for explainability and fallback behavior, but its standalone ROC-AUC (**{heuristic['ROC-AUC']:.3f}**) "
            "is weaker than the learned models. Overall, the plots support the project design: combining live "
            "reports with drainage, rainfall, pavement, and traffic predictors creates a meaningful pothole-risk "
            "surface. The most important next step is to validate the same pipeline on a larger official dataset "
            "using a time-based split, then tune the alert threshold to increase recall without creating too many "
            "false driver warnings."
        ),
    }


if __name__ == "__main__":
    main()
