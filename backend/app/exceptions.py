class WizardGameError(Exception):
    """Base exception for Wizard game errors."""


class InvalidPlayerError(WizardGameError):
    pass


class InvalidCardError(WizardGameError):
    pass


class InvalidPhaseError(WizardGameError):
    pass


class IllegalMoveError(WizardGameError):
    pass


class InvalidPredictionError(WizardGameError):
    pass


class GameNotFoundError(WizardGameError):
    pass