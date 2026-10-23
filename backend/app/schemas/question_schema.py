from pydantic import BaseModel

class Questionnaire(BaseModel):
    image_id: str
    itching: int
    pain: int
    spread: int
    duration_days: int
    fever: bool