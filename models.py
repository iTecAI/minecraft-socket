import typing
from pydantic import BaseModel

class AuthModel(BaseModel):
    passhash: str