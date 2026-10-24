"""Train a RandomForestRegressor pipeline and save it with Joblib."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.config import get_settings
from ml.dataset import ensure_demo_dataset
from ml.features import (
    CATEGORICAL_FEATURE_COLUMNS,
    MODEL_FEATURE_COLUMNS,
    MODEL_MODE,
    MODEL_NAME,
    NUMERIC_FEATURE_COLUMNS,
    TARGET_COLUMN,
    TARGET_DEFINITION,
    prepare_model_frame,
)

RANDOM_STATE = 42
TEST_SIZE = 0.2


def build_pipeline(n_estimators: int = 100, random_state: int = RANDOM_STATE) -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                OneHotEncoder(
                    categories=[["cafe", "hotel", "retail"]],
                    handle_unknown="error",
                    sparse_output=False,
                ),
                CATEGORICAL_FEATURE_COLUMNS,
            ),
            ("numeric", StandardScaler(), NUMERIC_FEATURE_COLUMNS),
        ],
        remainder="drop",
        verbose_feature_names_out=True,
    )
    model = RandomForestRegressor(
        n_estimators=n_estimators,
        max_depth=12,
        min_samples_leaf=2,
        random_state=random_state,
        n_jobs=1,
    )
    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("regressor", model),
        ]
    )


def train_and_save(
    dataset_path: Path | None = None,
    artifact_path: Path | None = None,
    metadata_path: Path | None = None,
    n_estimators: int = 100,
    random_state: int = RANDOM_STATE,
    test_size: float = TEST_SIZE,
) -> dict:
    settings = get_settings()
    dataset_path = Path(dataset_path or settings.ml_dataset_path)
    artifact_path = Path(artifact_path or settings.ml_artifact_path)
    metadata_path = Path(metadata_path or settings.ml_metadata_path)

    frame = ensure_demo_dataset(
        dataset_path,
        min_lat=settings.coimbatore_min_lat,
        max_lat=settings.coimbatore_max_lat,
        min_lng=settings.coimbatore_min_lng,
        max_lng=settings.coimbatore_max_lng,
        random_state=random_state,
    )
    features = prepare_model_frame(frame)
    target = frame[TARGET_COLUMN].astype(float)

    train_idx, test_idx = train_test_split(
        np.arange(len(frame)),
        test_size=test_size,
        random_state=random_state,
        stratify=frame["business_type"],
    )
    x_train, x_test = features.iloc[train_idx], features.iloc[test_idx]
    y_train, y_test = target.iloc[train_idx], target.iloc[test_idx]

    pipeline = build_pipeline(n_estimators=n_estimators, random_state=random_state)
    pipeline.fit(x_train, y_train)

    predictions = pipeline.predict(x_test)
    mae = float(mean_absolute_error(y_test, predictions))
    rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))

    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "pipeline": pipeline,
        "model_feature_columns": MODEL_FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "target_definition": TARGET_DEFINITION,
        "model_mode": MODEL_MODE,
        "model_name": MODEL_NAME,
        "dataset_status": "synthetic_demo",
    }
    joblib.dump(payload, artifact_path)

    metadata = {
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "model_name": MODEL_NAME,
        "model_mode": MODEL_MODE,
        "target_column": TARGET_COLUMN,
        "target_definition": TARGET_DEFINITION,
        "dataset_path": str(dataset_path),
        "dataset_status": "synthetic_demo",
        "n_rows": int(len(frame)),
        "n_estimators": n_estimators,
        "random_state": random_state,
        "test_size": test_size,
        "validation_strategy": (
            "Stratified 80/20 holdout by business_type. "
            "This split does not block nearby coordinates, so spatially correlated "
            "synthetic points can leak similar patterns into both sides."
        ),
        "model_feature_columns": MODEL_FEATURE_COLUMNS,
        "holdout_mae": mae,
        "holdout_rmse": rmse,
        "limitations": [
            "Training labels are synthetic, not verified Coimbatore demand.",
            "Holdout metrics describe fit to the generator, not real-world accuracy.",
            "Latitude/longitude were sampled inside a bounding box and share a spatial formula, so random splits overstate generalization.",
            "Do not present predictions as validated demand, confidence, or investment advice.",
        ],
        "artifact_path": str(artifact_path),
        "test_row_indices": test_idx.tolist(),
    }
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the DemandWise synthetic demand model.")
    parser.add_argument("--dataset-path", type=Path, default=None)
    parser.add_argument("--artifact-path", type=Path, default=None)
    parser.add_argument("--metadata-path", type=Path, default=None)
    parser.add_argument("--n-estimators", type=int, default=100)
    parser.add_argument("--random-state", type=int, default=RANDOM_STATE)
    args = parser.parse_args()
    metadata = train_and_save(
        dataset_path=args.dataset_path,
        artifact_path=args.artifact_path,
        metadata_path=args.metadata_path,
        n_estimators=args.n_estimators,
        random_state=args.random_state,
    )
    print("Training complete (synthetic demo model).")
    print(f"dataset_status={metadata['dataset_status']}")
    print(f"holdout_mae={metadata['holdout_mae']:.4f}")
    print(f"holdout_rmse={metadata['holdout_rmse']:.4f}")
    print(f"artifact={metadata['artifact_path']}")
    print("These metrics are not real-world demand accuracy.")


if __name__ == "__main__":
    main()
