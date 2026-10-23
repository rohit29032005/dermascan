from pydantic import BaseModel, EmailStr
from datetime import date

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    dob: date
    blood_group: str
    gender: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str