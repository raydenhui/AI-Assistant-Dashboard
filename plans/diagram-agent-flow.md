# AI Agent Logic Flow (Mermaid)

```mermaid
flowchart TD
    A[User Input] --> B(Agent Service)
    B --> C{Context Window Full?}
    C -- Yes --> D[Summarize History]
    C -- No --> E[Prepare Prompt]
    D --> E
    E --> F[Call LLM (Ollama/OpenRouter)]
    F --> G{Tool Call?}
    G -- Yes --> H[Execute Tool Function]
    H --> I[Get Tool Result]
    I --> E
    G -- No --> J[Final Response]
    J --> K[Update Chat History]
    K --> L[Send to Client]
```
