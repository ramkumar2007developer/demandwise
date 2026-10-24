"""Evaluate the saved pipeline with MAE and RMSE on the synthetic holdout."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import GroupShuffleSplit, train_test_split

from app.config import get_settings
from ml.dataset import load_dataset
from ml.features import TARGET_COLUMN, prepare_model_frame
from ml.predict import load_model_bundle
from ml.train import RANDOM_STATE, TEST_SIZE


def _spatial_group_ids(frame, bins: int = 4) -> np.ndarray:
    lat_bin = np.digitize(
        frame["latitude"],
        np.linspace(frame["latitude"].min(), frame["latitude"].max(), bins, endpoint=False),
    )
    lng_bin = np.digitize(
        frame["longitude"],
        np.linspace(frame["longitude"].min(), frame["longitude"].max(), bins, endpoint=False),
    )
    return lat_bin * 10 + lng_bin


def evaluate(
    dataset_path: Path | None = None,
    artifact_path: Path | None = None,
    metadata_path: Path | None = None,
    output_path: Path | None = None,
) -> dict:
    settings = get_settings()
    dataset_path = Path(dataset_path or settings.ml_dataset_path)
    artifact_path = Path(artifact_path or settings.ml_artifact_path)
    metadata_path = Path(metadata_path or settings.ml_metadata_path)
    output_path = Path(output_path or "artifacts/evaluation_metrics.json")

    frame = load_dataset(dataset_path)
    bundle = load_model_bundle(artifact_path)
    pipeline = bundle["pipeline"]
    features = prepare_model_frame(frame)
    target = frame[TARGET_COLUMN].astype(float)

    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        test_idx = np.array(metadata["test_row_indices"])
    else:
        _, test_idx = train_test_split(
            np.arange(len(frame)),
            test_size=TEST_SIZE,
            random_state=RANDOM_STATE,
            stratify=frame["business_type"],
        )

    y_true = target.iloc[test_idx]
    y_pred = pipeline.predict(features.iloc[test_idx])
    holdout_mae = float(mean_absolute_error(y_true, y_pred))
    holdout_rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))

    groups = _spatial_group_ids(frame)
    splitter = GroupShuffleSplit(n_splits=1, test_size=TEST_SIZE, random_state=RANDOM_STATE)
    _, spatial_test_idx = next(splitter.split(features, target, groups))
    spatial_true = target.iloc[spatial_test_idx]
    spatial_pred = pipeline.predict(features.iloc[spatial_test_idx])
    spatial_mae = float(mean_absolute_error(spatial_true, spatial_pred))
    spatial_rmse = float(np.sqrt(mean_squared_error(spatial_true, spatial_pred)))

    report = {
        "dataset_status": "synthetic_demo",
        "dataset_path": str(dataset_path),
        "n_rows": int(len(frame)),
        "n_holdout_rows": int(len(test_idx)),
        "target_column": TARGET_COLUMN,
        "validation_strategy": (
            "Primary: stratified 80/20 holdout by business_type using saved test indices. "
            "Diagnostic: GroupShuffleSplit on a 4x4 latitude/longitude grid. "
            "Both are still synthetic; spatial groups only reduce (not remove) generator leakage."
        ),
        "holdout_mae": holdout_mae,
        "holdout_rmse": holdout_rmse,
        "spatial_group_mae": spatial_mae,
        "spatial_group_rmse": spatial_rmse,
        "limitations": [
            "All metrics measure reconstruction of a synthetic generator, not real Coimbatore demand.",
            "Spatially correlated coordinates make a random holdout optimistic.",
            "The spatial-group diagnostic is still in-sample relative to the already-fitted pipeline.",
            "Do not report these values as model accuracy, confidence, or real demand error.",
        ],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the DemandWise synthetic demand model.")
    parser.add_argument("--dataset-path", type=Path, default=None)
    parser.add_argument("--artifact-path", type=Path, default=None)
    parser.add_argument("--metadata-path", type=Path, default=None)
    parser.add_argument("--output-path", type=Path, default=None)
    args = parser.parse_args()
    report = evaluate(
        dataset_path=args.dataset_path,
        artifact_path=args.artifact_path,
        metadata_path=args.metadata_path,
        output_path=args.output_path,
    )
    print("Evaluation complete (synthetic demo only).")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
