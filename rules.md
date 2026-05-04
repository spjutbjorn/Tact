# Rules
* All user-facing text, labels, tooltips, titles, and alerts must be written in English.
* Simpler is always better. Reduce complexity as much as possible.
* Exstract state, side effects, and data transformations to its own file.
* Keep Functions Short
* Organize Project Like a Boss
* Beware of Dependencies
* Test Everything You Write
* Silent Comments
* Keep Functions Laser-Focused (SRP)
* Use Names That Mean Something
* Prefer polymorphism to if/else or switch/case.
* Follow Law of Demeter.



# Design 
* Keep new UI copy short and direct.
* Exstract resued colors to global file for usage
* Be Consistent with Formatting code
* Make Your Code Readable
* Always try to explain yourself in code.

# Architecture
* Prefer data structures.
* Base class should know nothing about their derivatives.
* Prefer non-static methods to static methods.

# Code smells
* Rigidity. 
* Fragility. 
* Immobility. 

Rule of three:
1. do not extract shared code until a pattern has repeated at least two times,
2. improve it if duplicated so it is not risky or bulky
3. don't nest functions or structures more than twice