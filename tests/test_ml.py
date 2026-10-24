from pathlib import Path

import pytest

pd = pytest.importorskip("pandas")
pytest.importorskip("sklearn")
pytest.importorskip("joblib")

from ml.dataset import generate_synthetic_dataset, load_dataset, save_dataset
from ml.evaluate import evaluate
from ml.features import MODEL_FEATURE_COLUMNS, InvalidFeatureError, prepare_model_frame
from ml.predict import ModelArtifactMissingError, load_model_bundle, predict_demand
from ml.train import train_and_save


def _tiny_training_paths(tmp_path: Path) -> tuple[Path, Path, Path]:
    dataset_path = tmp_path / "demo.csv"
    artifact_path = tmp_path / "demand_pipeline.joblib"
    metadata_path = tmp_path / "training_metadata.json"
    frame = generate_synthetic_dataset(n_per_type=24, random_state=0)
    save_dataset(frame, dataset_path)
    return dataset_path, artifact_path, metadata_path


def test_training_writes_joblib_and_metadata(tmp_path: Path) -> None:
    dataset_path, artifact_path, metadata_path = _tiny_training_paths(tmp_path)
    metadata = train_and_save(
        dataset_path=dataset_path,
        artifact_path=artifact_path,
        metadata_path=metadata_path,
        n_estimators=8,
        random_state=0,
    )
    assert artifact_path.exists()
    assert metadata_path.exists()
    assert metadata["dataset_status"] == "synthetic_demo"
    assert metadata["model_name"] == "RandomForestRegressor"
    assert metadata["target_column"] == "synthetic_monthly_visits"
    assert "holdout_mae" in metadata
    assert "holdout_rmse" in metadata


def test_model_loading_and_inference(tmp_path: Path) -> None:
    dataset_path, artifact_path, metadata_path = _tiny_training_paths(tmp_path)
    train_and_save(
        dataset_path=dataset_path,
        artifact_path=artifact_path,
        metadata_path=metadata_path,
        n_estimators=8,
        random_state=0,
    )
    bundle = load_model_bundle(artifact_path)
    assert "pipeline" in bundle
    result = predict_demand(
        {
            "business_type": "cafe",
            "latitude": 11.0168,
            "longitude": 76.9558,
            "budget_inr": 500000,
            "floor_area_sqft": 900,
            "competitor_count": 4,
            "near_college": 1,
        },
        artifact_path=artifact_path,
    )
    assert result.model_mode == "synthetic_demo"
    assert result.target_name == "synthetic_monthly_visits"
    assert result.dataset_status == "synthetic_demo"
    assert result.predicted_synthetic_monthly_visits > 0
    assert "not validated real-world demand" in " ".join(result.limitations)


def test_missing_model_file_raises(tmp_path: Path) -> None:
    missing = tmp_path / "absent.joblib"
    with pytest.raises(ModelArtifactMissingError):
        load_model_bundle(missing)


def test_missing_dataset_file_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_dataset(tmp_path / "missing.csv")


def test_evaluation_writes_metrics(tmp_path: Path) -> None:
    dataset_path, artifact_path, metadata_path = _tiny_training_paths(tmp_path)
    train_and_save(
        dataset_path=dataset_path,
        artifact_path=artifact_path,
        metadata_path=metadata_path,
        n_estimators=8,
        random_state=0,
    )
    output_path = tmp_path / "evaluation_metrics.json"
    report = evaluate(
        dataset_path=dataset_path,
        artifact_path=artifact_path,
        metadata_path=metadata_path,
        output_path=output_path,
    )
    assert output_path.exists()
    assert report["dataset_status"] == "synthetic_demo"
    assert "holdout_mae" in report
    assert "holdout_rmse" in report


def test_missing_required_features_raise() -> None:
    frame = pd.DataFrame(
        [
            {
                "business_type": "cafe",
                "latitude": 11.01,
                "longitude": 76.95,
            }
        ]
    )
    with pytest.raises(InvalidFeatureError, match="Missing required features"):
        prepare_model_frame(frame)


def test_invalid_business_type_raises() -> None:
    frame = pd.DataFrame(
        [
            {
                "business_type": "warehouse",
                "latitude": 11.01,
                "longitude": 76.95,
                "budget_inr": 100000,
                "floor_area_sqft": 500,
                "competitor_count": 1,
                "near_college": 0,
            }
        ]
    )
    with pytest.raises(InvalidFeatureError, match="Unsupported business_type"):
        prepare_model_frame(frame)


def test_feature_order_is_stable_after_column_shuffle(tmp_path: Path) -> None:
    dataset_path, artifact_path, metadata_path = _tiny_training_paths(tmp_path)
    train_and_save(
        dataset_path=dataset_path,
        artifact_path=artifact_path,
        metadata_path=metadata_path,
        n_estimators=8,
        random_state=0,
    )
    raw = {
        "near_college": 0,
        "competitor_count": 3,
        "floor_area_sqft": 1100,
        "budget_inr": 750000,
        "longitude": 76.99,
        "latitude": 11.04,
        "business_type": "retail",
        "unused_column": "ignore-me",
    }
    ordered = prepare_model_frame(pd.DataFrame([raw]))
    shuffled = prepare_model_frame(pd.DataFrame([raw])[["unused_column"] + list(raw.keys())])
    assert list(ordered.columns) == MODEL_FEATURE_COLUMNS
    assert list(shuffled.columns) == MODEL_FEATURE_COLUMNS
    first = predict_demand(pd.DataFrame([raw]), artifact_path=artifact_path)
    second = predict_demand(
        pd.DataFrame([raw])[["unused_column"] + list(raw.keys())],
        artifact_path=artifact_path,
    )
    assert first.predicted_synthetic_monthly_visits == second.predicted_synthetic_monthly_visits
