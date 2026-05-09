def calculate_score_change(prediction: int, tricks_won: int) -> int:
    if prediction < 0:
        raise ValueError("Prediction cannot be negative.")

    if tricks_won < 0:
        raise ValueError("Tricks won cannot be negative.")

    if prediction == tricks_won:
        return 20 + 10 * tricks_won

    return -10 * abs(prediction - tricks_won)