import pytest
from app.scoring import calculate_score_change


def test_correct_prediction_with_two_tricks_scores_40():
    assert calculate_score_change(prediction=2, tricks_won=2) == 40


def test_correct_zero_prediction_scores_20():
    assert calculate_score_change(prediction=0, tricks_won=0) == 20


def test_wrong_prediction_by_one_scores_minus_10():
    assert calculate_score_change(prediction=2, tricks_won=1) == -10


def test_wrong_prediction_by_three_scores_minus_30():
    assert calculate_score_change(prediction=0, tricks_won=3) == -30


def test_negative_prediction_raises_error():
    with pytest.raises(ValueError):
        calculate_score_change(prediction=-1, tricks_won=0)