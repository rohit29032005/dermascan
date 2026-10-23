def calculate_severity(confidence, itching, pain, spread):

    question_avg = (itching + pain + spread) / 3
    normalized_question_score = question_avg / 5

    final_score = (confidence * 0.6) + (normalized_question_score * 0.4)

    if final_score < 0.4:
        level = "Mild"
    elif final_score < 0.7:
        level = "Moderate"
    else:
        level = "Severe"

    return round(final_score, 2), level