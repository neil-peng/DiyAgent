from langchain_core.tools import tool
from typing import Dict
from utils import log, LogLevel


@tool
def math_calculator(a: float, b: float, operation: str) -> Dict:
    """
    Basic math calculator, supports addition, subtraction, multiplication, and division operations

    Args:
        a: The first number
        b: The second number  
        operation: Operation type, supported:
            - "add" or "+" : Addition
            - "subtract" or "-" : Subtraction  
            - "multiply" or "*" : Multiplication
            - "divide" or "/" : Division

    Returns:
        Dict containing calculation results
    """
    log("math_tools",
        f"math_calculator call: {a} {operation} {b}", LogLevel.DEBUG)

    try:
        # Standardize operators
        if operation in ["add", "+"]:
            result = a + b
            operation_name = "Addition"
        elif operation in ["subtract", "-"]:
            result = a - b
            operation_name = "Subtraction"
        elif operation in ["multiply", "*"]:
            result = a * b
            operation_name = "Multiplication"
        elif operation in ["divide", "/"]:
            if b == 0:
                return {"error": "Divisor cannot be zero"}
            result = a / b
            operation_name = "Division"
        else:
            return {"error": f"Unsupported operation type: {operation}, supported operations: add(+), subtract(-), multiply(*), divide(/)"}

        return {
            "operation_result": result,
            "operation_description": f"{a} {operation_name} {b} = {result}"
        }

    except Exception as e:
        return {"error": f"Calculation error: {str(e)}"}


math_tools = [math_calculator]
